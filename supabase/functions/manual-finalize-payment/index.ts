import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  getSupabaseEnv,
  jsonResponse,
  syncCloudbedsPayment,
} from "../_shared/payment-utils.ts";

interface ManualFinalizeBody {
  payment_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ManualFinalizeBody;
    if (!body.payment_id) {
      return jsonResponse({ success: false, error: "payment_id is required" }, 400);
    }

    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: paymentRecord, error: paymentError } = await adminClient
      .from("reservation_payments")
      .select("id, amount, amount_minor, currency_code, reservation_id, riad_id, stripe_payment_intent_id, stripe_secret_key_alias, cloudbeds_payment_method, cloudbeds_logged")
      .eq("id", body.payment_id)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!paymentRecord) {
      return jsonResponse({ success: false, error: "Payment record not found" }, 404);
    }
    if (!paymentRecord.stripe_payment_intent_id) {
      return jsonResponse({ success: false, error: "Payment record is missing Stripe PaymentIntent ID" }, 400);
    }

    const syncResult = await syncCloudbedsPayment({
      adminClient,
      paymentRecord,
    });

    return jsonResponse({
      success: true,
      paymentId: paymentRecord.id,
      paymentIntentId: syncResult.paymentIntentId,
      cloudbedsLogged: syncResult.cloudbedsLogged,
      cloudbedsReference: syncResult.cloudbedsReference,
    });
  } catch (error) {
    console.error("[manual-finalize-payment]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while manually finalizing payment",
    }, 500);
  }
});
