import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geaBaseUrl = Deno.env.get("GEA_BASE_URL") ?? "https://gea.margo-hospitality.com";
    const geaInternalSecret = Deno.env.get("GEA_INTERNAL_API_SECRET");

    if (!supabaseUrl || !supabaseServiceRoleKey || !geaInternalSecret) {
      return jsonResponse({
        ok: false,
        stage: "env",
        supabaseUrl: Boolean(supabaseUrl),
        supabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
        geaInternalSecret: Boolean(geaInternalSecret),
      }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const riadsStartedAt = Date.now();

    const { data: riads, error: riadsError } = await supabaseAdmin
      .from("riads")
      .select("id, name, cloudbeds_property_id")
      .not("cloudbeds_property_id", "is", null)
      .order("name", { ascending: true });

    if (riadsError) {
      return jsonResponse({
        ok: false,
        stage: "riads",
        error: riadsError,
      }, 500);
    }

    const cloudbedsPropertyIds = (riads ?? [])
      .map((riad) => riad.cloudbeds_property_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    const url = `${geaBaseUrl}/api/v1/internal/reviews?cloudbedsPropertyIds=${encodeURIComponent(cloudbedsPropertyIds.join(","))}&limit=5&offset=0`;
    const controller = new AbortController();
    const fetchStartedAt = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    let text: string;

    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-Margo-Internal-Secret": geaInternalSecret,
        },
        signal: controller.signal,
      });

      text = await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      return jsonResponse({
        ok: false,
        stage: "fetch",
        geaBaseUrl,
        riadsCount: riads?.length ?? 0,
        cloudbedsPropertyIdsCount: cloudbedsPropertyIds.length,
        timingsMs: {
          total: Date.now() - startedAt,
          riadsQuery: fetchStartedAt - riadsStartedAt,
          geaFetch: Date.now() - fetchStartedAt,
        },
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      }, 500);
    }

    clearTimeout(timeoutId);

    return jsonResponse({
      ok: response.ok,
      stage: "fetch",
      geaBaseUrl,
      status: response.status,
      riadsCount: riads?.length ?? 0,
      cloudbedsPropertyIdsCount: cloudbedsPropertyIds.length,
      sampleCloudbedsPropertyIds: cloudbedsPropertyIds.slice(0, 5),
      timingsMs: {
        total: Date.now() - startedAt,
        riadsQuery: fetchStartedAt - riadsStartedAt,
        geaFetch: Date.now() - fetchStartedAt,
      },
      body: text,
    }, response.ok ? 200 : 500);
  } catch (error) {
    return jsonResponse({
      ok: false,
      stage: "exception",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    }, 500);
  }
});
