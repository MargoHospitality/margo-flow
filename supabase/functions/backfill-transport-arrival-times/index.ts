import { createAdminClient, getSupabaseEnv, jsonResponse } from "../_shared/payment-utils.ts";
import { syncTransportArrivalTimeToCloudbeds } from "../_shared/cloudbeds-arrival-time.ts";

type BackfillBody = {
  dry_run?: boolean;
  limit?: number;
  offset?: number;
  transport_request_ids?: string[];
  reservation_ids?: string[];
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as BackfillBody;
    const dryRun = body.dry_run !== false;
    const limit = Math.min(Math.max(body.limit ?? 500, 1), 2000);
    const offset = Math.max(body.offset ?? 0, 0);
    const transportRequestIds = (body.transport_request_ids ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const reservationIds = (body.reservation_ids ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    let query = adminClient
      .from("transport_requests")
      .select("id, reservation_id, riad_id, status, transport_time, transport_date, riad:riads(name, cloudbeds_property_id, cloudbeds_sync_enabled)")
      .eq("status", "confirmed")
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (transportRequestIds.length > 0) {
      query = query.in("id", transportRequestIds);
    }

    if (reservationIds.length > 0) {
      query = query.in("reservation_id", reservationIds);
    }

    const { data: requests, error } = await query;
    if (error) {
      throw error;
    }

    const rows = requests ?? [];
    const results = [] as Array<Record<string, unknown>>;

    for (const row of rows) {
      if (dryRun) {
        results.push({
          transportRequestId: row.id,
          reservationId: row.reservation_id,
          arrivalTime: row.transport_time,
          status: row.status,
        });
        continue;
      }

      try {
        const result = await syncTransportArrivalTimeToCloudbeds({
          transportRequest: row,
        });

        results.push({
          transportRequestId: row.id,
          ...result,
        });
      } catch (syncError) {
        results.push({
          transportRequestId: row.id,
          reservationId: row.reservation_id,
          success: false,
          error: syncError instanceof Error ? syncError.message : "Unexpected sync error",
        });
      }
    }

    return jsonResponse({
      success: true,
      dryRun,
      processed: rows.length,
      offset,
      results,
    });
  } catch (error) {
    console.error("[backfill-transport-arrival-times]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while backfilling transport arrival times",
    }, 500);
  }
});
