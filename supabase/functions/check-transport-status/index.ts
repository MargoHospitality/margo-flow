// Margo Flow - Supabase Edge Function
// Path: supabase/functions/check-transport-status/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const reservationId = url.searchParams.get('reservation_id')

    if (!reservationId) {
      return new Response(
        JSON.stringify({ error: 'reservation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Query transport_requests for this reservation
    // Only fetch pending or confirmed requests (reject/cancelled = none)
    const { data: requests, error } = await supabaseClient
      .from('transport_requests')
      .select(`
        id,
        status,
        transport_date,
        transport_time,
        pax,
        computed_price,
        payment_mode,
        guest_comment,
        public_token,
        transport_offers!inner(name, type)
      `)
      .eq('reservation_id', reservationId)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected case)
      throw error
    }

    // No active request found
    if (!requests) {
      return new Response(
        JSON.stringify({ status: 'none', request: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build response
    const response = {
      status: requests.status,
      request: {
        transport_type: requests.transport_offers.type,
        transport_type_name: requests.transport_offers.name,
        transport_date: requests.transport_date,
        transport_time: requests.transport_time,
        pax: requests.pax,
        computed_price: requests.computed_price,
        payment_mode: requests.payment_mode,
        guest_comment: requests.guest_comment || null,
        public_token: requests.public_token || null
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error checking transport status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
