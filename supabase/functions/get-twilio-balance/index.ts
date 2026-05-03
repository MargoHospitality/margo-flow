import { ensureBackofficeContext, jsonResponse } from "../_shared/backoffice-utils.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" }, 401);
    }

    const { role } = await ensureBackofficeContext(authHeader);
    if (role !== "super_admin") {
      return jsonResponse({ success: false, error: "Access denied" }, 403);
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials are not configured");
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Balance.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
      },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error_message || "Failed to fetch Twilio balance");
    }

    return jsonResponse({
      success: true,
      data: {
        balance: payload?.balance ?? null,
        currency: payload?.currency ?? null,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[get-twilio-balance]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while fetching Twilio balance",
    }, 500);
  }
});
