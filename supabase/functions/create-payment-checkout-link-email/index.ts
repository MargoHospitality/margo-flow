import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  createStripeCheckoutSession,
  ensureAuthenticatedUser,
  formatMadAmount,
  getStripeSecretKey,
  getSupabaseEnv,
  jsonResponse,
  parseStripeSecretMap,
  toMinorAmount,
} from "../_shared/payment-utils.ts";
import { normalizeEmailAddress, sendPaymentLinkEmail } from "../_shared/email-utils.ts";

interface CreatePaymentCheckoutLinkEmailBody {
  riad_id?: string;
  reservation_id?: string;
  check_in_date?: string;
  amount?: number;
  client_email?: string;
  app_origin?: string;
}

function resolveAppOrigin(value: string | undefined) {
  if (!value) {
    throw new Error("app_origin is required");
  }

  try {
    return new URL(value).origin;
  } catch {
    throw new Error("app_origin is invalid");
  }
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

    const body = (await req.json()) as CreatePaymentCheckoutLinkEmailBody;
    if (!body.riad_id || !body.reservation_id || !body.check_in_date || typeof body.amount !== "number" || !body.client_email) {
      return jsonResponse({
        success: false,
        error: "riad_id, reservation_id, check_in_date, amount, and client_email are required",
      }, 400);
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return jsonResponse({ success: false, error: "Amount must be a positive number" }, 400);
    }

    const roundedAmount = Number(body.amount.toFixed(2));
    const amountMinor = toMinorAmount(roundedAmount);
    if (amountMinor <= 0) {
      return jsonResponse({ success: false, error: "Amount is too small" }, 400);
    }

    const appOrigin = resolveAppOrigin(body.app_origin);
    const normalizedEmail = normalizeEmailAddress(body.client_email);

    const { user, authedClient } = await ensureAuthenticatedUser(authHeader);
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const [{ data: paymentSettings, error: settingsError }, { data: reservation, error: reservationError }] = await Promise.all([
      authedClient
        .from("riad_payment_settings")
        .select("id, riad_id, is_enabled, payment_label, stripe_secret_key_alias, cloudbeds_payment_method, cloudbeds_payment_description, riad:riads(id, name)")
        .eq("riad_id", body.riad_id)
        .eq("is_enabled", true)
        .maybeSingle(),
      authedClient
        .from("reservations")
        .select("reservation_id, property_id, riad_id, guest_first_name, guest_last_name, check_in_date, status")
        .eq("riad_id", body.riad_id)
        .eq("reservation_id", body.reservation_id.trim())
        .eq("check_in_date", body.check_in_date)
        .maybeSingle(),
    ]);

    if (settingsError) throw settingsError;
    if (reservationError) throw reservationError;

    if (!paymentSettings || !paymentSettings.riad) {
      return jsonResponse({ success: false, error: "This property does not have payments enabled" }, 403);
    }

    if (!reservation) {
      return jsonResponse({ success: false, error: "Reservation not found for the selected property and check-in date" }, 404);
    }

    if (!["confirmed", "checked_in"].includes(reservation.status)) {
      return jsonResponse({ success: false, error: `Reservation status "${reservation.status}" cannot receive a payment link` }, 400);
    }

    const riad = paymentSettings.riad as { id: string; name: string };
    const guestName = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim() || reservation.guest_last_name;
    const guestFirstName = reservation.guest_first_name?.trim() || reservation.guest_last_name;
    const description = `${paymentSettings.payment_label || "Card payment"} - ${riad.name} - ${guestName} - ${reservation.reservation_id}`;
    const secretMap = parseStripeSecretMap();
    const secretKey = getStripeSecretKey(paymentSettings.stripe_secret_key_alias, secretMap);

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
        status: "checkout_creating",
        payment_flow: "email_link",
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
      const successUrl = new URL("/payment/checkout-status", appOrigin);
      successUrl.searchParams.set("status", "success");
      successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

      const cancelUrl = new URL("/payment/checkout-status", appOrigin);
      cancelUrl.searchParams.set("status", "cancelled");

      const checkoutSession = await createStripeCheckoutSession({
        secretKey,
        amountMinor,
        currency: "mad",
        description,
        successUrl: successUrl.toString(),
        cancelUrl: cancelUrl.toString(),
        metadata: {
          payment_id: paymentRecord.id,
          reservation_id: reservation.reservation_id,
          property_id: reservation.property_id,
          riad_id: paymentSettings.riad_id,
          created_by: user.id,
          payment_flow: "email_link",
        },
      });

      const checkoutExpiresAt = checkoutSession.expires_at
        ? new Date(checkoutSession.expires_at * 1000).toISOString()
        : null;

      const { error: checkoutUpdateError } = await adminClient
        .from("reservation_payments")
        .update({
          stripe_checkout_session_id: checkoutSession.id,
          stripe_checkout_url: checkoutSession.url,
          checkout_expires_at: checkoutExpiresAt,
          status: "checkout_link_created",
          whatsapp_error_message: null,
        })
        .eq("id", paymentRecord.id);

      if (checkoutUpdateError) {
        throw checkoutUpdateError;
      }

      let emailResult: { success: boolean; emailId?: string | null; email?: string; error?: string | null };
      try {
        emailResult = await sendPaymentLinkEmail({
          to: normalizedEmail,
          guestFirstName,
          propertyName: riad.name,
          amountLabel: `${formatMadAmount(roundedAmount)} MAD`,
          paymentLink: checkoutSession.url,
        });
      } catch (error) {
        emailResult = {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send payment email",
        };
      }

      const nextStatus = emailResult.success ? "checkout_link_sent" : "checkout_link_created";
      const sentAt = emailResult.success ? new Date().toISOString() : null;

      const { error: emailUpdateError } = await adminClient
        .from("reservation_payments")
        .update({
          status: nextStatus,
          link_sent_at: sentAt,
          link_last_sent_at: sentAt,
          link_sent_count: emailResult.success ? 1 : 0,
          whatsapp_error_message: emailResult.error || null,
        })
        .eq("id", paymentRecord.id);

      if (emailUpdateError) {
        throw emailUpdateError;
      }

      return jsonResponse({
        success: true,
        paymentId: paymentRecord.id,
        paymentUrl: checkoutSession.url,
        checkoutExpiresAt,
        clientEmail: emailResult.email || normalizedEmail,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
        amount: roundedAmount,
        currency: "MAD",
      });
    } catch (error) {
      await adminClient
        .from("reservation_payments")
        .update({
          status: "checkout_failed",
          whatsapp_error_message: error instanceof Error ? error.message : "Failed to generate payment link",
        })
        .eq("id", paymentRecord.id);

      throw error;
    }
  } catch (error) {
    console.error("[create-payment-checkout-link-email]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while creating the payment email",
    }, 500);
  }
});
