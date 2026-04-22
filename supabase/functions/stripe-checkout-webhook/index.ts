import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  getSupabaseEnv,
  jsonResponse,
  parseStripeWebhookSecretMap,
  syncCloudbedsPayment,
  verifyStripeWebhookSignature,
} from "../_shared/payment-utils.ts";

interface StripeEvent {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.text();
    const secretMap = parseStripeWebhookSecretMap();
    await verifyStripeWebhookSignature({
      payload,
      signatureHeader: req.headers.get("stripe-signature"),
      secretMap,
    });

    const event = JSON.parse(payload) as StripeEvent;
    const object = event.data?.object;
    if (!object || typeof object !== "object") {
      return jsonResponse({ success: true, ignored: true });
    }

    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    if (event.type === "checkout.session.expired") {
      const metadata = object.metadata as Record<string, string> | undefined;
      const paymentId = metadata?.payment_id;
      if (paymentId) {
        await adminClient
          .from("reservation_payments")
          .update({ status: "checkout_expired" })
          .eq("id", paymentId)
          .eq("payment_flow", "whatsapp_link");
      }

      return jsonResponse({ success: true });
    }

    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      return jsonResponse({ success: true, ignored: true });
    }

    const metadata = object.metadata as Record<string, string> | undefined;
    const paymentId = metadata?.payment_id;
    const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : null;
    const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
    const checkoutSessionId = typeof object.id === "string" ? object.id : null;

    if (!paymentId || !paymentIntentId) {
      return jsonResponse({ success: true, ignored: true });
    }

    const { data: paymentRecord, error: paymentError } = await adminClient
      .from("reservation_payments")
      .select("id, amount, amount_minor, currency_code, reservation_id, riad_id, stripe_payment_intent_id, stripe_secret_key_alias, cloudbeds_payment_method, cloudbeds_logged")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!paymentRecord) {
      return jsonResponse({ success: true, ignored: true });
    }

    const { error: updateError } = await adminClient
      .from("reservation_payments")
      .update({
        stripe_checkout_session_id: checkoutSessionId,
        stripe_payment_intent_id: paymentIntentId,
        status: paymentStatus === "paid" ? "checkout_completed" : "checkout_pending",
        whatsapp_error_message: null,
      })
      .eq("id", paymentId);

    if (updateError) {
      throw updateError;
    }

    if (paymentStatus !== "paid") {
      return jsonResponse({ success: true, pending: true });
    }

    await syncCloudbedsPayment({
      adminClient,
      paymentRecord: {
        ...paymentRecord,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("[stripe-checkout-webhook]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected webhook error",
    }, 500);
  }
});
