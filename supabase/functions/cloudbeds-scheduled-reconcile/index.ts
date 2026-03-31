import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyResult {
  property_id: string;
  property_name: string;
  success: boolean;
  reservations_processed: number;
  reservations_created: number;
  reservations_updated: number;
  transport_requests_cancelled: number;
  error?: string;
}

interface ScheduledReconcileResult {
  success: boolean;
  run_type: 'scheduled';
  properties_processed: number;
  properties_skipped: number;
  results: PropertyResult[];
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

  console.log(`[cloudbeds-scheduled-reconcile] Fetching reservations for ${propertyId}: checkInFrom=${checkInFrom}, modifiedFrom=${modifiedFrom || 'none'}`);

  while (hasMore) {
    // Build URL with pagination - no end date, only future check-ins
    let cloudbedsUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservations?propertyID=${propertyId}&checkInFrom=${checkInFrom}&pageNumber=${page}&pageSize=${pageSize}`;
    
    // Add modifiedFrom for incremental sync if we have a last sync timestamp
    if (modifiedFrom) {
      cloudbedsUrl += `&modifiedFrom=${modifiedFrom}`;
    }

    console.log(`[cloudbeds-scheduled-reconcile] Page ${page}: ${cloudbedsUrl}`);

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

    console.log(`[cloudbeds-scheduled-reconcile] Page ${page}: fetched ${pageReservations.length} reservations`);

    // Check if there are more pages
    if (pageReservations.length < pageSize) {
      hasMore = false;
    } else {
      page++;
      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('[cloudbeds-scheduled-reconcile] Reached page limit (100), stopping pagination');
        hasMore = false;
      }
    }
  }

  console.log(`[cloudbeds-scheduled-reconcile] Total fetched for ${propertyId}: ${allReservations.length} reservations across ${page} pages`);
  return { reservations: allReservations };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[cloudbeds-scheduled-reconcile] Starting scheduled reconciliation at ${startTime.toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');

    if (!cloudbedsApiKey) {
      console.error('[cloudbeds-scheduled-reconcile] CLOUDBEDS_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudbeds API key not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all properties with cloudbeds_sync_enabled = true
    const { data: enabledRiads, error: riadsError } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
      .eq('cloudbeds_sync_enabled', true)
      .not('cloudbeds_property_id', 'is', null);

    if (riadsError) {
      console.error('[cloudbeds-scheduled-reconcile] Failed to fetch riads:', riadsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch properties' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!enabledRiads || enabledRiads.length === 0) {
      console.log('[cloudbeds-scheduled-reconcile] No properties with sync enabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          run_type: 'scheduled',
          properties_processed: 0, 
          properties_skipped: 0,
          results: [],
          message: 'No properties with Cloudbeds sync enabled' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cloudbeds-scheduled-reconcile] Found ${enabledRiads.length} properties with sync enabled`);

    const results: PropertyResult[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Process each enabled property
    for (const riad of enabledRiads) {
      const propertyId = riad.cloudbeds_property_id!;
      console.log(`[cloudbeds-scheduled-reconcile] Processing ${riad.name} (${propertyId})`);

      // Get last successful sync run for incremental sync
      const { data: lastSuccessfulRun } = await supabase
        .from('cloudbeds_sync_runs')
        .select('completed_at')
        .eq('property_id', propertyId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Create sync run record
      const { data: syncRun, error: syncRunError } = await supabase
        .from('cloudbeds_sync_runs')
        .insert({
          property_id: propertyId,
          run_type: 'scheduled',
          status: 'running',
        })
        .select()
        .single();

      if (syncRunError) {
        console.error(`[cloudbeds-scheduled-reconcile] Failed to create sync run for ${propertyId}:`, syncRunError);
      }

      const syncRunId = syncRun?.id;

      try {
        // Use modifiedFrom for incremental sync if we have a previous successful run
        const modifiedFrom = lastSuccessfulRun?.completed_at 
          ? lastSuccessfulRun.completed_at.split('T')[0]
          : undefined;

        // Fetch all reservations with pagination
        const { reservations, error: fetchError } = await fetchAllReservations(
          cloudbedsApiKey,
          propertyId,
          today,
          modifiedFrom
        );

        if (fetchError) {
          throw new Error(fetchError);
        }

        console.log(`[cloudbeds-scheduled-reconcile] ${riad.name}: Processing ${reservations.length} reservations`);

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
            .eq('riad_id', riad.id)
            .maybeSingle();

          const checkInDateChanged = existingRes && existingRes.check_in_date !== cbRes.startDate;
          const statusBecameCancelled = existingRes && existingRes.status !== 'canceled' && status === 'canceled';

          // Upsert reservation
          const { error: upsertError } = await supabase
            .from('reservations')
            .upsert({
              reservation_id: reservationId,
              property_id: propertyId,
              riad_id: riad.id,
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
            console.error(`[cloudbeds-scheduled-reconcile] Failed to upsert ${reservationId}:`, upsertError);
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

            // First, fetch transport requests with full data for notifications
            const { data: transportRequests } = await supabase
              .from('transport_requests')
              .select('id, transport_type, transport_date, transport_time, guest_name, guest_email, guest_phone, payload')
              .eq('reservation_id', reservationId)
              .in('status', ['pending', 'confirmed']);

            // Update transport requests status
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

            // Send cancellation notifications to clients
            if (transportRequests && transportRequests.length > 0) {
              for (const tr of transportRequests) {
                try {
                  await fetch(`${supabaseUrl}/functions/v1/notify-client-cancellation`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      transportRequestId: tr.id,
                      reservationId,
                      propertyId: String(propertyId),
                      propertyName: riad.name,
                      guestName: tr.guest_name,
                      guestEmail: tr.guest_email,
                      guestPhone: tr.guest_phone,
                      transportType: tr.transport_type,
                      originalDate: tr.transport_date,
                      transportTime: tr.transport_time,
                      cancelReason,
                      language: tr.payload?.language || 'en',
                      newCheckIn: checkInDateChanged ? cbRes.startDate : undefined,
                      newCheckOut: checkInDateChanged ? cbRes.endDate : undefined,
                      tokenUrl: checkInDateChanged && cbRes.customFields?.guest_app_token 
                        ? `https://flow.margo-hospitality.com/token/${cbRes.customFields.guest_app_token}` 
                        : undefined,
                    }),
                  });
                  console.log(`[cloudbeds-scheduled-reconcile] Sent cancellation notification for transport ${tr.id}`);
                } catch (notifErr) {
                  console.error(`[cloudbeds-scheduled-reconcile] Failed to send cancellation notification for transport ${tr.id}:`, notifErr);
                  // Continue processing other notifications
                }
              }
            }

            transportCancelled += cancelled?.length || 0;
          }
        }

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

        results.push({
          property_id: propertyId,
          property_name: riad.name,
          success: true,
          reservations_processed: reservations.length,
          reservations_created: created,
          reservations_updated: updated,
          transport_requests_cancelled: transportCancelled,
        });

        console.log(`[cloudbeds-scheduled-reconcile] ${riad.name}: Completed - ${reservations.length} processed, ${created} created, ${updated} updated`);

      } catch (propError) {
        const errorMsg = propError instanceof Error ? propError.message : 'Unknown error';
        console.error(`[cloudbeds-scheduled-reconcile] ${riad.name}: Failed -`, errorMsg);

        if (syncRunId) {
          await supabase
            .from('cloudbeds_sync_runs')
            .update({
              status: 'failed',
              error_message: errorMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncRunId);
        }

        results.push({
          property_id: propertyId,
          property_name: riad.name,
          success: false,
          reservations_processed: 0,
          reservations_created: 0,
          reservations_updated: 0,
          transport_requests_cancelled: 0,
          error: errorMsg,
        });
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    const successCount = results.filter(r => r.success).length;

    console.log(`[cloudbeds-scheduled-reconcile] Completed in ${duration}s: ${successCount}/${results.length} properties successful`);

    const response: ScheduledReconcileResult = {
      success: successCount > 0,
      run_type: 'scheduled',
      properties_processed: successCount,
      properties_skipped: enabledRiads.length - results.length,
      results,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cloudbeds-scheduled-reconcile] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        run_type: 'scheduled',
        properties_processed: 0,
        properties_skipped: 0,
        results: [],
        error: 'An unexpected error occurred',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
