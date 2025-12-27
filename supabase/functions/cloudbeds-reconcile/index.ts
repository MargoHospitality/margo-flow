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

interface CloudbedsReservation {
  reservationID: string;
  guestName?: string;
  guestFirstName?: string;
  startDate: string;
  endDate: string;
  nights?: number;
  status?: string;
  source?: string;
  countryCode?: string;
  [key: string]: unknown;
}

async function fetchAllReservations(
  cloudbedsApiKey: string,
  propertyId: string,
  checkInFrom: string,
  modifiedFrom?: string
): Promise<{ reservations: CloudbedsReservation[]; error?: string }> {
  const allReservations: CloudbedsReservation[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  console.log(`[cloudbeds-reconcile] Fetching reservations: checkInFrom=${checkInFrom}, modifiedFrom=${modifiedFrom || 'none'}`);

  while (hasMore) {
    // Build URL with pagination - no end date, only future check-ins
    let cloudbedsUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservations?propertyID=${propertyId}&checkInFrom=${checkInFrom}&pageNumber=${page}&pageSize=${pageSize}`;
    
    // Add modifiedFrom for incremental sync if we have a last sync timestamp
    if (modifiedFrom) {
      cloudbedsUrl += `&modifiedFrom=${modifiedFrom}`;
    }

    console.log(`[cloudbeds-reconcile] Page ${page}: ${cloudbedsUrl}`);

    const response = await fetch(cloudbedsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { reservations: [], error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();

    if (!data.success) {
      return { reservations: [], error: data.message || data.error || 'API returned success=false' };
    }

    const pageReservations = Array.isArray(data.data) ? data.data : [];
    allReservations.push(...pageReservations);

    console.log(`[cloudbeds-reconcile] Page ${page}: fetched ${pageReservations.length} reservations`);

    // Check if there are more pages
    if (pageReservations.length < pageSize) {
      hasMore = false;
    } else {
      page++;
      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('[cloudbeds-reconcile] Reached page limit (100), stopping pagination');
        hasMore = false;
      }
    }
  }

  console.log(`[cloudbeds-reconcile] Total fetched: ${allReservations.length} reservations across ${page} pages`);
  return { reservations: allReservations };
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

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get last successful sync run for incremental sync
    const { data: lastSuccessfulRun } = await supabase
      .from('cloudbeds_sync_runs')
      .select('completed_at')
      .eq('property_id', MASSIBA_PROPERTY_ID)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // Calculate date range: today onwards (no end date)
    const today = new Date().toISOString().split('T')[0];
    
    // Use modifiedFrom for incremental sync if we have a previous successful run
    const modifiedFrom = lastSuccessfulRun?.completed_at 
      ? lastSuccessfulRun.completed_at.split('T')[0]
      : undefined;

    // Fetch all reservations with pagination
    const { reservations, error: fetchError } = await fetchAllReservations(
      cloudbedsApiKey,
      MASSIBA_PROPERTY_ID,
      today,
      modifiedFrom
    );

    if (fetchError) {
      console.error(`[cloudbeds-reconcile] Fetch error:`, fetchError);

      const result: ReconcileResult = {
        success: false,
        property_id: MASSIBA_PROPERTY_ID,
        reservations_processed: 0,
        reservations_created: 0,
        reservations_updated: 0,
        transport_requests_cancelled: 0,
        error: `Cloudbeds API error: ${fetchError}`,
      };

      if (syncRunId) {
        await supabase
          .from('cloudbeds_sync_runs')
          .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
          .eq('id', syncRunId);
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
