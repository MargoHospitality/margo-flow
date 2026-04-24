import { corsHeaders, createAdminClient, ensureAuthenticatedUser, getSupabaseEnv, jsonResponse } from "../_shared/payment-utils.ts";
import { syncTransportArrivalTimeToCloudbeds } from "../_shared/cloudbeds-arrival-time.ts";

type SyncTransportArrivalTimeBody = {
  transport_request_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as SyncTransportArrivalTimeBody;
    const transportRequestId = body.transport_request_id?.trim();
    if (!transportRequestId) {
      return jsonResponse({ success: false, error: "transport_request_id is required" }, 400);
    }

    const { authedClient } = await ensureAuthenticatedUser(authHeader);
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: permittedRequest, error: authzError } = await authedClient
      .from("transport_requests")
      .select("id")
      .eq("id", transportRequestId)
      .maybeSingle();

    if (authzError) {
      throw authzError;
    }

    if (!permittedRequest) {
      return jsonResponse({ success: false, error: "Transport request not found or not accessible" }, 404);
    }

    const { data: transportRequest, error: requestError } = await adminClient
      .from("transport_requests")
      .select("id, reservation_id, riad_id, status, transport_time, transport_date, riad:riads(name, cloudbeds_property_id, cloudbeds_sync_enabled)")
      .eq("id", transportRequestId)
      .maybeSingle();

    if (requestError) {
      throw requestError;
    }

    if (!transportRequest) {
      return jsonResponse({ success: false, error: "Transport request not found" }, 404);
    }

    const result = await syncTransportArrivalTimeToCloudbeds({
      transportRequest,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("[sync-transport-arrival-time]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while syncing transport arrival time",
    }, 500);
  }
});
