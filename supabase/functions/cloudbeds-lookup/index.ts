import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

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
  debug?: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id, property_id } = await req.json();
    
    // CRITICAL: Ensure reservation_id is handled as a string
    const reservationIdStr = String(reservation_id).trim();
    
    console.log(`[cloudbeds-lookup] ====== START LOOKUP ======`);
    console.log(`[cloudbeds-lookup] Reservation ID: ${reservationIdStr} (type: ${typeof reservation_id})`);
    console.log(`[cloudbeds-lookup] Property ID: ${property_id}`);

    if (!reservationIdStr) {
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
    
    console.log(`[cloudbeds-lookup] Massiba riad found: id=${massibaRiad.id}, name=${massibaRiad.name}`);

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
      .eq('reservation_id', reservationIdStr)
      .eq('riad_id', massibaRiad.id)
      .maybeSingle();

    if (localError) {
      console.error('[cloudbeds-lookup] Local DB error:', localError);
    }

    if (localReservation) {
      console.log(`[cloudbeds-lookup] Found in local database: ${reservationIdStr}`);
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
    console.log(`[cloudbeds-lookup] Not found locally, calling Cloudbeds API...`);
    
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    if (!cloudbedsApiKey) {
      console.error('[cloudbeds-lookup] CLOUDBEDS_API_KEY not configured');
      return new Response(
        JSON.stringify({ found: false, error: 'Cloudbeds API not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch the specific reservation using getReservation endpoint
    // IMPORTANT: Use propertyID (not property_id) and reservationID (not reservation_id)
    // The Cloudbeds API uses camelCase for query parameters
    const getReservationUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservation?propertyID=${MASSIBA_PROPERTY_ID}&reservationID=${reservationIdStr}`;
    
    console.log(`[cloudbeds-lookup] Request URL: ${getReservationUrl}`);
    console.log(`[cloudbeds-lookup] Request Method: GET`);
    console.log(`[cloudbeds-lookup] Request Headers: Authorization: Bearer [REDACTED], Content-Type: application/json`);
    
    const getReservationResponse = await fetch(getReservationUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const getResStatus = getReservationResponse.status;
    const getResText = await getReservationResponse.text();
    
    console.log(`[cloudbeds-lookup] getReservation Response Status: ${getResStatus}`);
    console.log(`[cloudbeds-lookup] getReservation Response Body: ${getResText.substring(0, 1000)}`);

    // If getReservation didn't work, try listing reservations as fallback
    if (!getReservationResponse.ok || getResText.includes('"success":false')) {
      console.log(`[cloudbeds-lookup] getReservation failed, trying getReservations list with wide date range...`);
      
      // Calculate date range: today - 7 days to today + 365 days
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 365);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Try getReservations list endpoint
      const listUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservations?propertyID=${MASSIBA_PROPERTY_ID}&checkInFrom=${startDateStr}&checkInTo=${endDateStr}&pageSize=100`;
      
      console.log(`[cloudbeds-lookup] List Request URL: ${listUrl}`);
      
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudbedsApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      const listStatus = listResponse.status;
      const listText = await listResponse.text();
      
      console.log(`[cloudbeds-lookup] getReservations Response Status: ${listStatus}`);
      console.log(`[cloudbeds-lookup] getReservations Response Body (first 2000 chars): ${listText.substring(0, 2000)}`);
      
      if (listResponse.ok) {
        try {
          const listData = JSON.parse(listText);
          
          if (listData.success && listData.data) {
            const reservations = Array.isArray(listData.data) ? listData.data : [];
            console.log(`[cloudbeds-lookup] Found ${reservations.length} reservations in list`);
            
            // Search for our reservation in the list
            // Try multiple ID field possibilities
            const foundRes = reservations.find((r: any) => {
              const resId = String(r.reservationID || r.reservationId || r.reservation_id || '');
              console.log(`[cloudbeds-lookup] Checking reservation ID: ${resId}`);
              return resId === reservationIdStr;
            });
            
            if (foundRes) {
              console.log(`[cloudbeds-lookup] Found reservation ${reservationIdStr} in list!`);
              console.log(`[cloudbeds-lookup] Reservation data: ${JSON.stringify(foundRes).substring(0, 500)}`);
              
              // Process the found reservation
              return await processAndUpsertReservation(foundRes, massibaRiad, supabase);
            } else {
              // Log first few reservation IDs for debugging
              const sampleIds = reservations.slice(0, 10).map((r: any) => 
                String(r.reservationID || r.reservationId || r.reservation_id || 'unknown')
              );
              console.log(`[cloudbeds-lookup] Reservation ${reservationIdStr} NOT found in list. Sample IDs: ${sampleIds.join(', ')}`);
              
              return new Response(
                JSON.stringify({ 
                  found: false, 
                  error: 'Reservation not found in Cloudbeds',
                  debug: {
                    searchedId: reservationIdStr,
                    totalReservationsInRange: reservations.length,
                    sampleIds: sampleIds,
                    dateRange: { from: startDateStr, to: endDateStr }
                  }
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (parseError) {
          console.error('[cloudbeds-lookup] Failed to parse list response:', parseError);
        }
      }
      
      // Both methods failed
      return new Response(
        JSON.stringify({ 
          found: false, 
          error: 'Failed to fetch from Cloudbeds API',
          debug: {
            getReservationStatus: getResStatus,
            getReservationError: getResText.substring(0, 500),
            listStatus: listStatus,
            listError: listText.substring(0, 500)
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // getReservation succeeded - process the response
    try {
      const cloudbedsData = JSON.parse(getResText);
      console.log('[cloudbeds-lookup] Parsed getReservation response successfully');

      if (!cloudbedsData.success || !cloudbedsData.data) {
        return new Response(
          JSON.stringify({ found: false, error: 'Reservation not found in Cloudbeds' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return await processAndUpsertReservation(cloudbedsData.data, massibaRiad, supabase);
      
    } catch (parseError) {
      console.error('[cloudbeds-lookup] Failed to parse getReservation response:', parseError);
      return new Response(
        JSON.stringify({ found: false, error: 'Invalid response from Cloudbeds' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[cloudbeds-lookup] Unexpected error:', error);
    return new Response(
      JSON.stringify({ found: false, error: 'An unexpected error occurred' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processAndUpsertReservation(
  cbRes: any, 
  massibaRiad: { id: string; name: string; cloudbeds_property_id: string | null }, 
  supabase: any
): Promise<Response> {
  console.log('[cloudbeds-lookup] Processing reservation:', JSON.stringify(cbRes).substring(0, 500));
  
  // Handle different possible field names from Cloudbeds API
  const reservationId = String(cbRes.reservationID || cbRes.reservationId || cbRes.reservation_id);
  const guestName = cbRes.guestName || cbRes.guestFirstName || cbRes.guest_name || '';
  const startDate = cbRes.startDate || cbRes.checkInDate || cbRes.check_in_date;
  const endDate = cbRes.endDate || cbRes.checkOutDate || cbRes.check_out_date;
  
  // Parse guest name
  const nameParts = guestName.split(' ');
  const guestFirstName = nameParts.length > 1 ? nameParts[0] : null;
  const guestLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : guestName;

  // Calculate nights if not provided
  let nights = cbRes.nights;
  if (!nights && startDate && endDate) {
    const checkIn = new Date(startDate);
    const checkOut = new Date(endDate);
    nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Map status
  let status = 'confirmed';
  const cbStatus = (cbRes.status || '').toLowerCase();
  if (cbStatus.includes('cancel')) {
    status = 'canceled';
  } else if (cbStatus.includes('no_show') || cbStatus.includes('noshow')) {
    status = 'no_show';
  } else if (cbStatus.includes('checked_in') || cbStatus.includes('checkedin') || cbStatus.includes('in_house') || cbStatus.includes('inhouse')) {
    status = 'checked_in';
  } else if (cbStatus.includes('checked_out') || cbStatus.includes('checkedout')) {
    status = 'checked_out';
  }

  console.log(`[cloudbeds-lookup] Mapped reservation: id=${reservationId}, guest=${guestLastName}, status=${status}, checkIn=${startDate}`);

  // Upsert to local database
  const { error: upsertError } = await supabase
    .from('reservations')
    .upsert({
      reservation_id: reservationId,
      property_id: MASSIBA_PROPERTY_ID,
      riad_id: massibaRiad.id,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      check_in_date: startDate,
      check_out_date: endDate,
      nights: nights,
      status: status,
      source: cbRes.source || 'cloudbeds',
      guest_country_code: cbRes.countryCode || cbRes.country_code || null,
      cloudbeds_raw: cbRes,
    }, {
      onConflict: 'reservation_id',
    });

  if (upsertError) {
    console.error('[cloudbeds-lookup] Failed to upsert reservation:', upsertError);
  } else {
    console.log(`[cloudbeds-lookup] Successfully upserted reservation ${reservationId}`);
  }

  const result: LookupResult = {
    found: true,
    reservation: {
      reservation_id: reservationId,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      check_in_date: startDate,
      check_out_date: endDate,
      nights: nights,
      status: status,
      source: cbRes.source || 'cloudbeds',
      riad_id: massibaRiad.id,
      riad_name: massibaRiad.name,
    },
    source: 'cloudbeds',
  };

  console.log(`[cloudbeds-lookup] ====== LOOKUP SUCCESS ======`);

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
