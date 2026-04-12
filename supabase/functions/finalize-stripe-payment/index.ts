import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  ensureAuthenticatedUser,
  formatMadAmount,
  getStripeSecretKey,
  getSupabaseEnv,
  jsonResponse,
  parseStripeSecretMap,
  retrieveStripePaymentIntent,
} from "../_shared/payment-utils.ts";

interface FinalizePaymentBody {
  payment_id?: string;
}

const cardBrandMap: Record<string, string> = {
  visa: "visa",
  mastercard: "master",
  amex: "amex",
  discover: "Discover",
  jcb: "jcb",
  diners: "diners",
  unionpay: "union_pay",
  maestro: "maestro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" }, 401);
    }

    const body = (await req.json()) as FinalizePaymentBody;
    if (!body.payment_id) {
      return jsonResponse({ success: false, error: "payment_id is required" }, 400);
    }

    const { authedClient } = await ensureAuthenticatedUser(authHeader);
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: paymentRecord, error: paymentError } = await authedClient
      .from("reservation_payments")
      .select("id, amount, amount_minor, currency_code, reservation_id, riad_id, stripe_payment_intent_id, stripe_secret_key_alias, cloudbeds_payment_method, cloudbeds_logged, cloudbeds_payment_reference")
      .eq("id", body.payment_id)
      .maybeSingle();

    if (paymentError) {
      throw paymentError;
    }

    if (!paymentRecord) {
      return jsonResponse({ success: false, error: "Payment record not found" }, 404);
    }

    if (!paymentRecord.stripe_payment_intent_id) {
      return jsonResponse({ success: false, error: "Payment record is missing Stripe PaymentIntent ID" }, 400);
    }

    if (paymentRecord.cloudbeds_logged) {
      return jsonResponse({
        success: true,
        paymentId: paymentRecord.id,
        paymentIntentId: paymentRecord.stripe_payment_intent_id,
        cloudbedsLogged: true,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency_code,
      });
    }

    const { data: paymentSettings, error: settingsError } = await adminClient
      .from("riad_payment_settings")
      .select("cloudbeds_payment_description, riad:riads(id, name, cloudbeds_property_id)")
      .eq("riad_id", paymentRecord.riad_id)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const riad = paymentSettings?.riad as { id: string; name: string; cloudbeds_property_id: string | null } | null;
    if (!riad?.cloudbeds_property_id) {
      return jsonResponse({ success: false, error: "Property is missing Cloudbeds property ID" }, 400);
    }

    const secretMap = parseStripeSecretMap();
    const secretKey = getStripeSecretKey(paymentRecord.stripe_secret_key_alias, secretMap);
    const stripeIntent = await retrieveStripePaymentIntent(secretKey, paymentRecord.stripe_payment_intent_id);

    if (stripeIntent.status !== "succeeded") {
      return jsonResponse({
        success: false,
        error: `Stripe PaymentIntent status is "${stripeIntent.status}", expected "succeeded"`,
      }, 400);
    }

    if (stripeIntent.amount !== paymentRecord.amount_minor) {
      return jsonResponse({
        success: false,
        error: "Stripe amount does not match the prepared payment record",
      }, 400);
    }

    const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");
    if (!cloudbedsApiKey) {
      throw new Error("CLOUDBEDS_API_KEY is not configured");
    }

    const cardBrand = stripeIntent.latest_charge?.payment_method_details?.card?.brand;
    const last4 = stripeIntent.latest_charge?.payment_method_details?.card?.last4;
    const cardSummary = cardBrand && last4 ? `${cardBrand.toUpperCase()} •••• ${last4}` : null;
    const descriptionParts = [
      paymentSettings?.cloudbeds_payment_description || "Stripe card payment via Margo Flow",
      `PI ${stripeIntent.id}`,
      cardSummary,
    ].filter(Boolean);

    const cloudbedsBody = new URLSearchParams();
    cloudbedsBody.append("propertyID", riad.cloudbeds_property_id);
    cloudbedsBody.append("reservationID", paymentRecord.reservation_id);
    cloudbedsBody.append("type", paymentRecord.cloudbeds_payment_method);
    cloudbedsBody.append("amount", formatMadAmount(paymentRecord.amount));
    cloudbedsBody.append("description", descriptionParts.join(" | "));

    if (paymentRecord.cloudbeds_payment_method.toLowerCase() === "credit" && cardBrandMap[cardBrand || ""]) {
      cloudbedsBody.append("cardType", cardBrandMap[cardBrand || ""]);
    }

    const cloudbedsResponse = await fetch("https://api.cloudbeds.com/api/v1.3/postPayment", {
      method: "POST",
      headers: {
        "x-api-key": cloudbedsApiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: cloudbedsBody,
    });

    const cloudbedsPayload = await cloudbedsResponse.json();
    if (!cloudbedsResponse.ok || cloudbedsPayload?.success === false) {
      const errorMessage = cloudbedsPayload?.error || cloudbedsPayload?.message || "Cloudbeds rejected the payment post";
      await adminClient
        .from("reservation_payments")
        .update({
          status: "cloudbeds_failed",
          cloudbeds_error_message: errorMessage,
          stripe_payment_method_summary: cardSummary,
        })
        .eq("id", paymentRecord.id);

      return jsonResponse({ success: false, error: errorMessage }, 502);
    }

    const reference = cloudbedsPayload?.data?.paymentID
      ? String(cloudbedsPayload.data.paymentID)
      : stripeIntent.id;

    const { error: updateError } = await adminClient
      .from("reservation_payments")
      .update({
        status: "cloudbeds_logged",
        cloudbeds_logged: true,
        cloudbeds_logged_at: new Date().toISOString(),
        cloudbeds_payment_reference: reference,
        cloudbeds_error_message: null,
        stripe_payment_method_summary: cardSummary,
      })
      .eq("id", paymentRecord.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      paymentId: paymentRecord.id,
      paymentIntentId: stripeIntent.id,
      cloudbedsLogged: true,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency_code,
    });
  } catch (error) {
    console.error("[finalize-stripe-payment]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while finalizing payment",
    }, 500);
  }
});
