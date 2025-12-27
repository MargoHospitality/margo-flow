import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

serve(async (req) => {
  // ========== RAW LOGGING - FIRST THING ==========
  const requestTimestamp = new Date().toISOString();
  const requestMethod = req.method;
  const requestUrl = req.url;
  const requestHeaders = Object.fromEntries(req.headers.entries());
  
  console.log(`[cloudbeds-webhook] ========== INCOMING REQUEST ==========`);
  console.log(`[cloudbeds-webhook] Timestamp: ${requestTimestamp}`);
  console.log(`[cloudbeds-webhook] Method: ${requestMethod}`);
  console.log(`[cloudbeds-webhook] URL: ${requestUrl}`);
  console.log(`[cloudbeds-webhook] Headers: ${JSON.stringify(requestHeaders)}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[cloudbeds-webhook] Responding to OPTIONS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests for testing reachability
  if (req.method === 'GET') {
    console.log('[cloudbeds-webhook] GET request - returning health check');
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Cloudbeds webhook endpoint is reachable',
        timestamp: requestTimestamp,
        endpoint: 'cloudbeds-webhook'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read raw body first for logging
  let rawBody = '';
  try {
    rawBody = await req.text();
    console.log(`[cloudbeds-webhook] Raw body (first 1000 chars): ${rawBody.substring(0, 1000)}`);
  } catch (e) {
    console.log(`[cloudbeds-webhook] Could not read raw body: ${e}`);
  }

  try {
    // Parse body as JSON
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[cloudbeds-webhook] Failed to parse JSON:', parseError);
      // Log the raw request anyway for debugging
      await supabase
        .from('cloudbeds_webhook_logs')
        .insert({
          property_id: 'PARSE_ERROR',
          reservation_id: null,
          event_type: 'parse_error',
          payload: { raw_body: rawBody.substring(0, 5000), error: String(parseError) },
          processed: false,
        });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[cloudbeds-webhook] Parsed payload:', JSON.stringify(payload).substring(0, 500));

    const eventType = payload.event || payload.type || 'unknown';
    const propertyId = String(payload.propertyID || payload.property_id || '');
    const reservationId = String(payload.reservationID || payload.reservation_id || '');

    // Log the webhook event
    const { error: logError } = await supabase
      .from('cloudbeds_webhook_logs')
      .insert({
        property_id: propertyId,
        reservation_id: reservationId,
        event_type: eventType,
        payload: payload,
        processed: false,
      });

    if (logError) {
      console.error('[cloudbeds-webhook] Failed to log webhook:', logError);
    }

    // Get riad from database and check if sync is enabled
    const { data: riad } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_sync_enabled')
      .eq('cloudbeds_property_id', propertyId)
      .maybeSingle();

    // Skip if property not found or sync is disabled
    if (!riad) {
      console.log(`[cloudbeds-webhook] Skipping: property ${propertyId} not found in database`);
      
      await supabase
        .from('cloudbeds_webhook_logs')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString(),
          error_message: 'Skipped: property not configured'
        })
        .eq('property_id', propertyId)
        .eq('reservation_id', reservationId)
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook received but skipped (property not configured)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!riad.cloudbeds_sync_enabled) {
      console.log(`[cloudbeds-webhook] Skipping: sync disabled for ${riad.name} (${propertyId})`);
      
      await supabase
        .from('cloudbeds_webhook_logs')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString(),
          error_message: 'Skipped: Cloudbeds sync disabled for this property'
        })
        .eq('property_id', propertyId)
        .eq('reservation_id', reservationId)
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook received but skipped (sync disabled)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cloudbeds-webhook] Processing webhook for ${riad.name} (${propertyId})`);

    // Use riad.id as massibaRiad.id for backward compatibility
    const massibaRiad = riad;

    let processedResult = { action: 'none', transportCancelled: 0 };

    // Handle reservation events
    if (eventType.includes('reservation') || eventType.includes('booking')) {
      const reservationData = payload.data || payload;
      const newStatus = reservationData.status?.toLowerCase() || '';
      const newCheckInDate = reservationData.startDate || reservationData.checkInDate;

      // Check if this is a cancellation
      const isCancelled = newStatus.includes('cancel');

      // Check if check-in date changed
      let checkInDateChanged = false;
      if (newCheckInDate && reservationId) {
        const { data: existingRes } = await supabase
          .from('reservations')
          .select('check_in_date')
          .eq('reservation_id', reservationId)
          .eq('riad_id', massibaRiad.id)
          .maybeSingle();

        if (existingRes && existingRes.check_in_date !== newCheckInDate) {
          checkInDateChanged = true;
          console.log(`[cloudbeds-webhook] Check-in date changed for ${reservationId}: ${existingRes.check_in_date} -> ${newCheckInDate}`);
        }
      }

      // Update reservation in database
      if (reservationId) {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (isCancelled) {
          updateData.status = 'canceled';
        }

        if (newCheckInDate) {
          updateData.check_in_date = newCheckInDate;
        }

        if (reservationData.endDate || reservationData.checkOutDate) {
          updateData.check_out_date = reservationData.endDate || reservationData.checkOutDate;
        }

        if (reservationData.guestName) {
          const nameParts = reservationData.guestName.split(' ');
          updateData.guest_first_name = nameParts.length > 1 ? nameParts[0] : null;
          updateData.guest_last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : reservationData.guestName;
        }

        const { error: updateError } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('reservation_id', reservationId)
          .eq('riad_id', massibaRiad.id);

        if (updateError) {
          console.error('[cloudbeds-webhook] Failed to update reservation:', updateError);
        }
      }

      // Auto-cancel transport requests if reservation cancelled or dates changed
      if ((isCancelled || checkInDateChanged) && reservationId) {
        const cancelReason = isCancelled ? 'reservation_cancelled' : 'reservation_dates_changed';
        
        const { data: cancelledRequests, error: cancelError } = await supabase
          .from('transport_requests')
          .update({
            status: 'rejected',
            rejection_reason: cancelReason,
            updated_at: new Date().toISOString(),
          })
          .eq('reservation_id', reservationId)
          .in('status', ['pending', 'confirmed'])
          .select('id');

        if (cancelError) {
          console.error('[cloudbeds-webhook] Failed to cancel transport requests:', cancelError);
        } else {
          processedResult.transportCancelled = cancelledRequests?.length || 0;
          processedResult.action = isCancelled ? 'reservation_cancelled' : 'dates_changed';
          console.log(`[cloudbeds-webhook] Cancelled ${processedResult.transportCancelled} transport requests for ${reservationId}`);
        }
      }
    }

    // Update webhook log as processed
    await supabase
      .from('cloudbeds_webhook_logs')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString(),
      })
      .eq('property_id', propertyId)
      .eq('reservation_id', reservationId)
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log(`[cloudbeds-webhook] Processed successfully:`, processedResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed',
        result: processedResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cloudbeds-webhook] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to process webhook' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
