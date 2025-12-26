import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log('[cloudbeds-webhook] Received webhook:', JSON.stringify(payload).substring(0, 500));

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

    // MASSIBA ONLY: Skip if not Massiba property
    if (propertyId !== MASSIBA_PROPERTY_ID) {
      console.log(`[cloudbeds-webhook] Skipping: property ${propertyId} is not Massiba (${MASSIBA_PROPERTY_ID})`);
      
      // Update log to mark as processed (skipped)
      await supabase
        .from('cloudbeds_webhook_logs')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString(),
          error_message: 'Skipped: not Massiba property'
        })
        .eq('property_id', propertyId)
        .eq('reservation_id', reservationId)
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook received but skipped (not Massiba)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Massiba riad from database
    const { data: massibaRiad } = await supabase
      .from('riads')
      .select('id')
      .eq('cloudbeds_property_id', MASSIBA_PROPERTY_ID)
      .maybeSingle();

    if (!massibaRiad) {
      console.error('[cloudbeds-webhook] Massiba riad not found in database');
      return new Response(
        JSON.stringify({ success: false, error: 'Massiba riad not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
