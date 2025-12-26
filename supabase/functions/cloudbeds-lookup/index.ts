import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

interface CloudbedsReservation {
  reservationID: string;
  propertyID: string;
  guestName: string;
  guestFirstName?: string;
  guestLastName?: string;
  startDate: string;
  endDate: string;
  status: string;
  source?: string;
  nights?: number;
  countryCode?: string;
}

interface LookupResult {
  found: boolean;
  reservation?: {
    reservation_id: string;
    guest_first_name: string | null;
    guest_last_name: string;
    check_in_date: string;
    check_out_date: string | null;
    nights: number | null;
    status: string;
    source: string | null;
    riad_id: string;
    riad_name: string;
  };
  source: 'local' | 'cloudbeds';
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id, property_id } = await req.json();
    console.log(`[cloudbeds-lookup] Received request for reservation ${reservation_id}, property ${property_id}`);

    if (!reservation_id) {
      return new Response(
        JSON.stringify({ found: false, error: 'Reservation ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MASSIBA ONLY: Reject if property_id is not Massiba
    if (property_id && property_id !== MASSIBA_PROPERTY_ID) {
      console.log(`[cloudbeds-lookup] Rejected: property ${property_id} is not Massiba`);
      return new Response(
        JSON.stringify({ found: false, error: 'Cloudbeds lookup only available for Riad Massiba' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Massiba riad from database
    const { data: massibaRiad, error: riadError } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id')
      .eq('cloudbeds_property_id', MASSIBA_PROPERTY_ID)
      .maybeSingle();

    if (riadError || !massibaRiad) {
      console.error('[cloudbeds-lookup] Massiba riad not found in database:', riadError);
      return new Response(
        JSON.stringify({ found: false, error: 'Riad Massiba not configured in database' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check local database first
    const { data: localReservation, error: localError } = await supabase
      .from('reservations')
      .select(`
        reservation_id,
        guest_first_name,
        guest_last_name,
        check_in_date,
        check_out_date,
        nights,
        status,
        source,
        riad_id,
        riads(name)
      `)
      .eq('reservation_id', reservation_id)
      .eq('riad_id', massibaRiad.id)
      .maybeSingle();

    if (localError) {
      console.error('[cloudbeds-lookup] Local DB error:', localError);
    }

    if (localReservation) {
      console.log(`[cloudbeds-lookup] Found in local database: ${reservation_id}`);
      const result: LookupResult = {
        found: true,
        reservation: {
          reservation_id: localReservation.reservation_id,
          guest_first_name: localReservation.guest_first_name,
          guest_last_name: localReservation.guest_last_name,
          check_in_date: localReservation.check_in_date,
          check_out_date: localReservation.check_out_date,
          nights: localReservation.nights,
          status: localReservation.status,
          source: localReservation.source,
          riad_id: localReservation.riad_id,
          riad_name: (localReservation.riads as any)?.name || 'Riad Massiba',
        },
        source: 'local',
      };
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Not found locally - Call Cloudbeds API
    console.log(`[cloudbeds-lookup] Not found locally, calling Cloudbeds API for ${reservation_id}`);
    
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    if (!cloudbedsApiKey) {
      return new Response(
        JSON.stringify({ found: false, error: 'Cloudbeds API not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Cloudbeds API to get specific reservation
    const cloudbedsUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservation?propertyID=${MASSIBA_PROPERTY_ID}&reservationID=${reservation_id}`;
    
    const cloudbedsResponse = await fetch(cloudbedsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!cloudbedsResponse.ok) {
      const errorText = await cloudbedsResponse.text();
      console.error(`[cloudbeds-lookup] Cloudbeds API error: ${cloudbedsResponse.status}`, errorText);
      
      if (cloudbedsResponse.status === 404 || errorText.includes('not found')) {
        return new Response(
          JSON.stringify({ found: false, error: 'Reservation not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ found: false, error: 'Failed to fetch from Cloudbeds' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cloudbedsData = await cloudbedsResponse.json();
    console.log('[cloudbeds-lookup] Cloudbeds response:', JSON.stringify(cloudbedsData).substring(0, 500));

    if (!cloudbedsData.success || !cloudbedsData.data) {
      return new Response(
        JSON.stringify({ found: false, error: 'Reservation not found in Cloudbeds' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cbRes = cloudbedsData.data;
    
    // Parse guest name
    const guestName = cbRes.guestName || cbRes.guestFirstName || '';
    const nameParts = guestName.split(' ');
    const guestFirstName = nameParts.length > 1 ? nameParts[0] : null;
    const guestLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : guestName;

    // Calculate nights if not provided
    const checkIn = new Date(cbRes.startDate);
    const checkOut = new Date(cbRes.endDate);
    const nights = cbRes.nights || Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Map status
    let status = 'confirmed';
    if (cbRes.status?.toLowerCase().includes('cancel')) {
      status = 'canceled';
    } else if (cbRes.status?.toLowerCase().includes('no_show') || cbRes.status?.toLowerCase().includes('noshow')) {
      status = 'no_show';
    }

    // Step 3: Upsert to local database
    const { error: upsertError } = await supabase
      .from('reservations')
      .upsert({
        reservation_id: String(cbRes.reservationID),
        property_id: MASSIBA_PROPERTY_ID,
        riad_id: massibaRiad.id,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        check_in_date: cbRes.startDate,
        check_out_date: cbRes.endDate,
        nights: nights,
        status: status,
        source: cbRes.source || 'cloudbeds',
        guest_country_code: cbRes.countryCode || null,
        cloudbeds_raw: cbRes,
      }, {
        onConflict: 'reservation_id',
      });

    if (upsertError) {
      console.error('[cloudbeds-lookup] Failed to upsert reservation:', upsertError);
      // Continue anyway - we still found the reservation
    } else {
      console.log(`[cloudbeds-lookup] Upserted reservation ${reservation_id} from Cloudbeds`);
    }

    const result: LookupResult = {
      found: true,
      reservation: {
        reservation_id: String(cbRes.reservationID),
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        check_in_date: cbRes.startDate,
        check_out_date: cbRes.endDate,
        nights: nights,
        status: status,
        source: cbRes.source || 'cloudbeds',
        riad_id: massibaRiad.id,
        riad_name: massibaRiad.name,
      },
      source: 'cloudbeds',
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cloudbeds-lookup] Error:', error);
    return new Response(
      JSON.stringify({ found: false, error: 'An unexpected error occurred' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
