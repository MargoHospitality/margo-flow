import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  getSupabaseEnv,
  jsonResponse,
  parseStripeWebhookSecretMap,
  syncCloudbedsPayment,
  verifyStripeWebhookSignature,
} from "../_shared/payment-utils.ts";
import { sendManagerPaymentConfirmationEmail } from "../_shared/email-utils.ts";

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
          .eq("id", paymentId);
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

    const syncResult = await syncCloudbedsPayment({
      adminClient,
      paymentRecord: {
        ...paymentRecord,
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    if (!paymentRecord.cloudbeds_logged) {
      try {
        const [{ data: riad, error: riadError }, { data: reservation, error: reservationError }] = await Promise.all([
          adminClient
            .from("riads")
            .select("name, manager_email, second_manager_email")
            .eq("id", paymentRecord.riad_id)
            .maybeSingle(),
          adminClient
            .from("reservations")
            .select("guest_first_name, guest_last_name")
            .eq("riad_id", paymentRecord.riad_id)
            .eq("reservation_id", paymentRecord.reservation_id)
            .maybeSingle(),
        ]);

        if (riadError) throw riadError;
        if (reservationError) throw reservationError;

        const managerRecipients = [riad?.manager_email, riad?.second_manager_email]
          .filter((email): email is string => typeof email === "string" && email.trim().length > 0);

        if (managerRecipients.length > 0) {
          const guestName = [reservation?.guest_first_name, reservation?.guest_last_name]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .join(" ")
            || paymentRecord.reservation_id;

          await sendManagerPaymentConfirmationEmail({
            to: managerRecipients,
            propertyName: riad.name || "your property",
            reservationId: paymentRecord.reservation_id,
            guestName,
            amountLabel: `${Number(paymentRecord.amount).toFixed(2)} ${paymentRecord.currency_code.toUpperCase()}`,
            paymentMethodSummary: null,
            cloudbedsReference: syncResult.cloudbedsReference,
          });
        }
      } catch (notificationError) {
        console.error("[stripe-checkout-webhook] Failed to send manager payment confirmation:", notificationError);
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("[stripe-checkout-webhook]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected webhook error",
    }, 500);
  }
});
