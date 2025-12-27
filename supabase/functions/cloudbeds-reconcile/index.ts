import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

interface ReconcileResult {
  success: boolean;
  property_id: string;
  reservations_processed: number;
  reservations_created: number;
  reservations_updated: number;
  transport_requests_cancelled: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify super_admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
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

    // Verify the user is a super_admin
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Access denied: super_admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[cloudbeds-reconcile] Starting manual reconciliation for Massiba...');

    // Get Massiba riad from database and check if sync is enabled
    const { data: massibaRiad, error: riadError } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
      .eq('cloudbeds_property_id', MASSIBA_PROPERTY_ID)
      .maybeSingle();

    if (riadError || !massibaRiad) {
      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: 'Riad Massiba not configured in database',
      };

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if sync is enabled
    if (!massibaRiad.cloudbeds_sync_enabled) {
      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: 'Cloudbeds sync is disabled for this property. Enable it to run reconciliation.',
      };

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create sync run record
    const { data: syncRun, error: syncRunError } = await supabase
      .from('cloudbeds_sync_runs')
      .insert({
        property_id: MASSIBA_PROPERTY_ID,
        run_type: 'manual',
        status: 'running',
      })
      .select()
      .single();

    if (syncRunError) {
      console.error('[cloudbeds-reconcile] Failed to create sync run:', syncRunError);
    }

    const syncRunId = syncRun?.id;

    // Get Cloudbeds API key
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    if (!cloudbedsApiKey) {
      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: 'Cloudbeds API key not configured',
      };

      if (syncRunId) {
        await supabase
          .from('cloudbeds_sync_runs')
          .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
          .eq('id', syncRunId);
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate date range (today - 7 days to today + 365 days for wide coverage)
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 7);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 365);

    const startDate = pastDate.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];

    // Build URL without status filter - Cloudbeds API may not support "not_canceled"
    // Use propertyID as string
    const cloudbedsUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservations?propertyID=${MASSIBA_PROPERTY_ID}&checkInFrom=${startDate}&checkInTo=${endDate}`;
    
    console.log(`[cloudbeds-reconcile] Request URL: ${cloudbedsUrl}`);
    console.log(`[cloudbeds-reconcile] Fetching reservations from ${startDate} to ${endDate} (no status filter)`);

    const cloudbedsResponse = await fetch(cloudbedsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[cloudbeds-reconcile] Cloudbeds response status: ${cloudbedsResponse.status}`);

    const responseText = await cloudbedsResponse.text();
    console.log(`[cloudbeds-reconcile] Cloudbeds response body (first 500 chars): ${responseText.substring(0, 500)}`);

    if (!cloudbedsResponse.ok) {
      console.error(`[cloudbeds-reconcile] HTTP error: ${cloudbedsResponse.status}`, responseText);

      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: `Cloudbeds API HTTP error: ${cloudbedsResponse.status} - ${responseText.substring(0, 200)}`,
      };

      if (syncRunId) {
        await supabase
          .from('cloudbeds_sync_runs')
          .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
          .eq('id', syncRunId);
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let cloudbedsData;
    try {
      cloudbedsData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[cloudbeds-reconcile] Failed to parse JSON:`, parseError);
      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: `Failed to parse Cloudbeds response: ${responseText.substring(0, 200)}`,
      };

      if (syncRunId) {
        await supabase
          .from('cloudbeds_sync_runs')
          .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
          .eq('id', syncRunId);
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[cloudbeds-reconcile] Parsed response - success: ${cloudbedsData.success}, hasData: ${!!cloudbedsData.data}, dataLength: ${Array.isArray(cloudbedsData.data) ? cloudbedsData.data.length : 'not array'}`);

    if (!cloudbedsData.success) {
      const errorMsg = cloudbedsData.message || cloudbedsData.error || 'Unknown error';
      console.error(`[cloudbeds-reconcile] API returned success=false:`, errorMsg);
      
      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: `Cloudbeds API error: ${errorMsg}`,
      };

      if (syncRunId) {
        await supabase
          .from('cloudbeds_sync_runs')
          .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
          .eq('id', syncRunId);
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reservations = Array.isArray(cloudbedsData.data) ? cloudbedsData.data : [];
    console.log(`[cloudbeds-reconcile] Processing ${reservations.length} reservations`);

    let created = 0;
    let updated = 0;
    let transportCancelled = 0;

    for (const cbRes of reservations) {
      const reservationId = String(cbRes.reservationID);

      // Parse guest name
      const guestName = cbRes.guestName || cbRes.guestFirstName || '';
      const nameParts = guestName.split(' ');
      const guestFirstName = nameParts.length > 1 ? nameParts[0] : null;
      const guestLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : guestName;

      // Calculate nights
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

      // Check if reservation exists
      const { data: existingRes } = await supabase
        .from('reservations')
        .select('id, check_in_date, status')
        .eq('reservation_id', reservationId)
        .eq('riad_id', massibaRiad.id)
        .maybeSingle();

      const checkInDateChanged = existingRes && existingRes.check_in_date !== cbRes.startDate;
      const statusBecameCancelled = existingRes && existingRes.status !== 'canceled' && status === 'canceled';

      // Upsert reservation
      const { error: upsertError } = await supabase
        .from('reservations')
        .upsert({
          reservation_id: reservationId,
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
        console.error(`[cloudbeds-reconcile] Failed to upsert ${reservationId}:`, upsertError);
        continue;
      }

      if (existingRes) {
        updated++;
      } else {
        created++;
      }

      // Cancel transport if dates changed or reservation cancelled
      if ((checkInDateChanged || statusBecameCancelled) && existingRes) {
        const cancelReason = statusBecameCancelled ? 'reservation_cancelled' : 'reservation_dates_changed';

        const { data: cancelled } = await supabase
          .from('transport_requests')
          .update({
            status: 'rejected',
            rejection_reason: cancelReason,
            updated_at: new Date().toISOString(),
          })
          .eq('reservation_id', reservationId)
          .in('status', ['pending', 'confirmed'])
          .select('id');

        transportCancelled += cancelled?.length || 0;
      }
    }

    console.log(`[cloudbeds-reconcile] Completed: ${reservations.length} processed, ${created} created, ${updated} updated, ${transportCancelled} transport cancelled`);

    // Update sync run as completed
    if (syncRunId) {
      await supabase
        .from('cloudbeds_sync_runs')
        .update({
          status: 'completed',
          reservations_processed: reservations.length,
          reservations_created: created,
          reservations_updated: updated,
          transport_requests_cancelled: transportCancelled,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncRunId);
    }

    const result: ReconcileResult = {
      success: true,
      property_id: MASSIBA_PROPERTY_ID,
      reservations_processed: reservations.length,
      reservations_created: created,
      reservations_updated: updated,
      transport_requests_cancelled: transportCancelled,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cloudbeds-reconcile] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: 'An unexpected error occurred',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
