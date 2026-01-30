import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AddNoteRequest {
  transport_request_id: string;
  reservation_id: string;
  riad_id?: string;
  riad_name?: string; // legacy fallback
  guest_name: string;
  transport_offer_name: string;
  transport_date: string;
  transport_time: string;
  payload_details?: Record<string, string>; // All dynamic fields
  payment_mode: string;
  guest_comment?: string;
  price: number;
  is_free_transfer?: boolean;
}


interface AddNoteResult {
  success: boolean;
  error?: string;
  note_created?: boolean;
  skipped_reason?: string;
  reservation_id?: string;
  property_id?: string;
  cloudbeds_endpoint?: string;
  cloudbeds_status_code?: number;
  cloudbeds_message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logPrefix = '[cloudbeds-add-note]';
  
  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log(`${logPrefix} No authorization header`);
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use anon client for auth verification
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      console.log(`${logPrefix} Authentication failed:`, userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: AddNoteRequest = await req.json();
    console.log(`${logPrefix} Request received for transport_request_id: ${body.transport_request_id}`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve property configuration from the riad
    const { data: riadData, error: riadError } = body.riad_id
      ? await supabase
          .from('riads')
          .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
          .eq('id', body.riad_id)
          .maybeSingle()
      : await supabase
          .from('riads')
          .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
          .eq('name', body.riad_name ?? '')
          .maybeSingle();

    if (riadError) {
      console.error(`${logPrefix} Failed to load riad config: ${riadError.message}`);
      await logCloudbedsError(supabase, 'add_note_riad_lookup_error', undefined, body.reservation_id, riadError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to load property configuration',
          reservation_id: body.reservation_id,
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const propertyId = riadData?.cloudbeds_property_id ?? undefined;

    if (!propertyId) {
      console.log(`${logPrefix} Skipped - missing cloudbeds_property_id for riad ${riadData?.name ?? body.riad_name ?? '(unknown)'}`);
      return new Response(
        JSON.stringify({
          success: true,
          note_created: false,
          skipped_reason: 'Missing cloudbeds_property_id',
          reservation_id: body.reservation_id,
          property_id: propertyId,
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!riadData?.cloudbeds_sync_enabled) {
      console.log(`${logPrefix} Skipped - cloudbeds_sync_enabled=false (property: ${propertyId})`);
      return new Response(
        JSON.stringify({
          success: true,
          note_created: false,
          skipped_reason: 'Cloudbeds sync disabled for this property',
          reservation_id: body.reservation_id,
          property_id: propertyId,
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloudbeds API key
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    if (!cloudbedsApiKey) {
      console.error(`${logPrefix} CLOUDBEDS_API_KEY not configured`);
      
      // Log error to webhook logs for visibility
       await logCloudbedsError(supabase, 'add_note', propertyId, body.reservation_id, 'CLOUDBEDS_API_KEY not configured');
      
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudbeds API not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the note content with unique marker for idempotency
    const uniqueMarker = `[MARGO FLOW][REQUEST_ID: ${body.transport_request_id}]`;
    
    // Check if note already exists by searching existing notes
    const checkUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservationNotes?propertyID=${encodeURIComponent(propertyId)}&reservationID=${encodeURIComponent(body.reservation_id)}`;
    
    console.log(`${logPrefix} Checking existing notes for reservation ${body.reservation_id}`);
    
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      console.log(`${logPrefix} Check notes response: success=${checkData.success}`);
      
      if (checkData.success && Array.isArray(checkData.data)) {
        // Check if our unique marker already exists in any note
        const existingNote = checkData.data.find((note: any) =>
          (typeof note.note === 'string' && note.note.includes(uniqueMarker)) ||
          (typeof note.text === 'string' && note.text.includes(uniqueMarker))
        );

        if (existingNote) {
          console.log(`${logPrefix} Note already exists for request ${body.transport_request_id}, skipping`);
          return new Response(
            JSON.stringify({
              success: true,
              note_created: false,
              skipped_reason: 'Note already exists (idempotency check)',
              reservation_id: body.reservation_id,
              property_id: propertyId,
              cloudbeds_endpoint: checkUrl,
              cloudbeds_status_code: checkResponse.status,
            } satisfies AddNoteResult),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      console.log(`${logPrefix} Could not check existing notes (${checkResponse.status}), proceeding with add`);
    }

    // Format the note content
    const paymentModeText = body.is_free_transfer ? 'Complimentary Transfer' : (body.payment_mode === 'at_riad' ? 'Payment at Riad' : 'Cash to driver');
    
    let noteContent = `${uniqueMarker}
[MARGO FLOW] Transport confirmed
Offer: ${body.transport_offer_name}
Date: ${body.transport_date}
Arrival time: ${body.transport_time}`;

    // Add all dynamic fields from payload_details
    if (body.payload_details) {
      Object.entries(body.payload_details)
        .filter(([key, value]) => !['guest_email', 'guest_whatsapp'].includes(key) && value && value.trim())
        .forEach(([key, value]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          noteContent += `\n${formattedKey}: ${value}`;
        });
    }

    noteContent += `\nPayment mode: ${paymentModeText}`;
    noteContent += body.is_free_transfer ? '\nPrice: Complimentary' : `\nPrice: ${body.price} MAD`;

    if (body.guest_comment) {
      noteContent += `\nGuest comment: ${body.guest_comment}`;
    }

    console.log(`${logPrefix} Adding note to reservation ${body.reservation_id}`);
    
    // Add the note to Cloudbeds using POST with form data
    const addNoteUrl = `https://hotels.cloudbeds.com/api/v1.1/postReservationNote`;
    
    const formData = new URLSearchParams();
    formData.append('propertyID', propertyId);
    formData.append('reservationID', body.reservation_id);
    // Cloudbeds expects this field name (otherwise returns: "Parameter reservationNote is required")
    formData.append('reservationNote', noteContent);
    formData.append('isPrivate', 'true'); // Internal note, not guest-facing

    console.log(`${logPrefix} POST URL: ${addNoteUrl}`);
    
    const addNoteResponse = await fetch(addNoteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await addNoteResponse.text();
    console.log(`${logPrefix} Add note response status: ${addNoteResponse.status}`);
    console.log(`${logPrefix} Add note response body: ${responseText.substring(0, 500)}`);

    if (!addNoteResponse.ok) {
      console.error(`${logPrefix} Failed to add note: ${addNoteResponse.status} - ${responseText}`);

      await logCloudbedsError(
        supabase,
        'add_note_failed',
        propertyId,
        body.reservation_id,
        `HTTP ${addNoteResponse.status}: ${responseText.substring(0, 200)}`,
        { endpoint: addNoteUrl, status: addNoteResponse.status }
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to add note: HTTP ${addNoteResponse.status}`,
          reservation_id: body.reservation_id,
          property_id: propertyId,
          cloudbeds_endpoint: addNoteUrl,
          cloudbeds_status_code: addNoteResponse.status,
          cloudbeds_message: responseText.substring(0, 200),
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error(`${logPrefix} Failed to parse response as JSON`);
       await logCloudbedsError(supabase, 'add_note_parse_error', propertyId, body.reservation_id, responseText.substring(0, 200), { endpoint: addNoteUrl, status: addNoteResponse.status });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid response from Cloudbeds',
          reservation_id: body.reservation_id,
          property_id: propertyId,
          cloudbeds_endpoint: addNoteUrl,
          cloudbeds_status_code: addNoteResponse.status,
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!responseData.success) {
      const errorMsg = responseData.message || responseData.error || 'Unknown error';
      console.error(`${logPrefix} Cloudbeds API error: ${errorMsg}`);
      
       await logCloudbedsError(supabase, 'add_note_api_error', propertyId, body.reservation_id, errorMsg, { endpoint: addNoteUrl, status: addNoteResponse.status });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Cloudbeds error: ${errorMsg}`,
          reservation_id: body.reservation_id,
          property_id: propertyId,
          cloudbeds_endpoint: addNoteUrl,
          cloudbeds_status_code: addNoteResponse.status,
          cloudbeds_message: String(errorMsg).substring(0, 200),
        } satisfies AddNoteResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${logPrefix} Successfully added note to reservation ${body.reservation_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        note_created: true,
        reservation_id: body.reservation_id,
        property_id: propertyId,
        cloudbeds_endpoint: addNoteUrl,
        cloudbeds_status_code: addNoteResponse.status,
      } satisfies AddNoteResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to log errors to cloudbeds_webhook_logs for visibility
async function logCloudbedsError(
  supabase: any,
  eventType: string,
  propertyId: string | undefined,
  reservationId: string,
  errorMessage: string,
  details?: Record<string, unknown>
) {
  try {
    await supabase
      .from('cloudbeds_webhook_logs')
      .insert({
        event_type: eventType,
        property_id: propertyId ?? 'unknown',
        reservation_id: reservationId,
        payload: { error: errorMessage, source: 'cloudbeds-add-note', ...(details ?? {}) },
        processed: false,
        error_message: errorMessage,
      });
  } catch (logError) {
    console.error('[cloudbeds-add-note] Failed to log error:', logError);
  }
}
