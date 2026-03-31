import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransportRequest {
  reservation_id: string;
  riad_id: string;
  transport_offer_id: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  computed_price: number;
  payment_mode: 'at_riad' | 'to_driver';
  payload_details?: Record<string, string>;
  guest_comment?: string;
  is_free_transfer?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logPrefix = '[submit-transport-request]';

  try {
    // Extract client IP
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    let clientIp = realIp || (forwarded ? forwarded.split(',')[0].trim() : '0.0.0.0');

    console.log(`${logPrefix} Request from IP: ${clientIp}`);

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: TransportRequest = await req.json();
    console.log(`${logPrefix} Transport request for reservation: ${body.reservation_id}`);

    // Check rate limit using SQL function
    const { data: rateLimitOk, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        _ip_address: clientIp,
        _endpoint: 'create_transport_request',
        _max_requests: 10,
        _window_minutes: 10
      }
    );

    if (rateLimitError) {
      console.error(`${logPrefix} Rate limit check error:`, rateLimitError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit check failed',
          details: rateLimitError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!rateLimitOk) {
      console.warn(`${logPrefix} Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again in a few minutes.',
          retry_after: 600 // 10 minutes in seconds
        }),
        { 
          status: 429, // Too Many Requests
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '600'
          } 
        }
      );
    }

    console.log(`${logPrefix} Rate limit check passed, creating transport request...`);

    // Call the existing RPC function to create transport request
    const { data: transportRequestId, error: createError } = await supabase.rpc(
      'create_transport_request_public',
      {
        _reservation_id: body.reservation_id,
        _riad_id: body.riad_id,
        _transport_offer_id: body.transport_offer_id,
        _transport_date: body.transport_date,
        _transport_time: body.transport_time,
        _pax: body.pax,
        _computed_price: body.computed_price,
        _payment_mode: body.payment_mode,
        _payload_details: body.payload_details || {},
        _guest_comment: body.guest_comment || null,
        _is_free_transfer: body.is_free_transfer || false
      }
    );

    if (createError) {
      console.error(`${logPrefix} Failed to create transport request:`, createError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: createError.message || 'Failed to create transport request'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`${logPrefix} Transport request created successfully: ${transportRequestId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: transportRequestId,
        message: 'Transport request submitted successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
