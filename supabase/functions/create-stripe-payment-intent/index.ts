import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  createStripePaymentIntent,
  ensureAuthenticatedUser,
  formatMadAmount,
  getStripeSecretKey,
  getSupabaseEnv,
  jsonResponse,
  parseStripeSecretMap,
  toMinorAmount,
} from "../_shared/payment-utils.ts";

interface CreatePaymentIntentBody {
  riad_id?: string;
  reservation_id?: string;
  check_in_date?: string;
  amount?: number;
  moto?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" }, 401);
    }

    const body = (await req.json()) as CreatePaymentIntentBody;
    if (!body.riad_id || !body.reservation_id || !body.check_in_date || typeof body.amount !== "number") {
      return jsonResponse({ success: false, error: "riad_id, reservation_id, check_in_date, and amount are required" }, 400);
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return jsonResponse({ success: false, error: "Amount must be a positive number" }, 400);
    }

    const moto = body.moto === true;

    const roundedAmount = Number(body.amount.toFixed(2));
    const amountMinor = toMinorAmount(roundedAmount);
    if (amountMinor <= 0) {
      return jsonResponse({ success: false, error: "Amount is too small" }, 400);
    }

    const { user, authedClient } = await ensureAuthenticatedUser(authHeader);
    const {
      supabaseUrl,
      supabaseServiceRoleKey,
    } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: paymentSettings, error: settingsError } = await authedClient
      .from("riad_payment_settings")
      .select("id, riad_id, is_enabled, payment_label, stripe_secret_key_alias, stripe_publishable_key, cloudbeds_payment_method, cloudbeds_payment_description, riad:riads(id, name, cloudbeds_property_id)")
      .eq("riad_id", body.riad_id)
      .eq("is_enabled", true)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    if (!paymentSettings || !paymentSettings.riad) {
      return jsonResponse({ success: false, error: "This property does not have payments enabled" }, 403);
    }

    const { data: reservation, error: reservationError } = await authedClient
      .from("reservations")
      .select("reservation_id, property_id, riad_id, guest_first_name, guest_last_name, check_in_date, status")
      .eq("riad_id", body.riad_id)
      .eq("reservation_id", body.reservation_id.trim())
      .eq("check_in_date", body.check_in_date)
      .maybeSingle();

    if (reservationError) {
      throw reservationError;
    }

    if (!reservation) {
      return jsonResponse({ success: false, error: "Reservation not found for the selected property and check-in date" }, 404);
    }

    if (!["confirmed", "checked_in"].includes(reservation.status)) {
      return jsonResponse({ success: false, error: `Reservation status "${reservation.status}" cannot be charged from backoffice` }, 400);
    }

    const secretMap = parseStripeSecretMap();
    const secretKey = getStripeSecretKey(paymentSettings.stripe_secret_key_alias, secretMap);
    const guestName = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim() || reservation.guest_last_name;
    const description = `${paymentSettings.payment_label || "Card payment"} - ${paymentSettings.riad.name} - ${guestName} - ${reservation.reservation_id}`;

    const { data: paymentRecord, error: paymentInsertError } = await adminClient
      .from("reservation_payments")
      .insert({
        riad_id: paymentSettings.riad_id,
        reservation_id: reservation.reservation_id,
        property_id: reservation.property_id,
        created_by: user.id,
        currency_code: "MAD",
        amount: roundedAmount,
        amount_minor: amountMinor,
        status: "intent_creating",
        stripe_secret_key_alias: paymentSettings.stripe_secret_key_alias!,
        cloudbeds_payment_method: paymentSettings.cloudbeds_payment_method!,
        notes: paymentSettings.cloudbeds_payment_description || null,
      })
      .select("id")
      .single();

    if (paymentInsertError) {
      throw paymentInsertError;
    }

    try {
      const stripeIntent = await createStripePaymentIntent({
        secretKey,
        amountMinor,
        currency: "mad",
        description,
        moto,
        metadata: {
          payment_id: paymentRecord.id,
          reservation_id: reservation.reservation_id,
          property_id: reservation.property_id,
          riad_id: paymentSettings.riad_id,
          created_by: user.id,
          payment_mode: moto ? "moto" : "sca",
        },
      });

      const { error: paymentUpdateError } = await adminClient
        .from("reservation_payments")
        .update({
          stripe_payment_intent_id: stripeIntent.id,
          status: stripeIntent.status,
        })
        .eq("id", paymentRecord.id);

      if (paymentUpdateError) {
        throw paymentUpdateError;
      }

      return jsonResponse({
        success: true,
        clientSecret: stripeIntent.client_secret,
        paymentId: paymentRecord.id,
        amount: Number((stripeIntent.amount / 100).toFixed(2)),
        currency: stripeIntent.currency.toUpperCase(),
        displayAmount: `${formatMadAmount(roundedAmount)} MAD`,
      });
    } catch (error) {
      await adminClient
        .from("reservation_payments")
        .update({
          status: "intent_failed",
          cloudbeds_error_message: error instanceof Error ? error.message : "Failed to create Stripe PaymentIntent",
        })
        .eq("id", paymentRecord.id);

      throw error;
    }
  } catch (error) {
    console.error("[create-stripe-payment-intent]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while preparing payment",
    }, 500);
  }
});
