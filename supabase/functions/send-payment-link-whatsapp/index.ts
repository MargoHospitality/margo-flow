import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  ensureAuthenticatedUser,
  formatMadAmount,
  getSupabaseEnv,
  jsonResponse,
} from "../_shared/payment-utils.ts";
import { normalizeWhatsappNumber, sendPaymentLinkWhatsapp } from "../_shared/whatsapp-utils.ts";

interface SendPaymentLinkWhatsappBody {
  payment_id?: string;
  client_whatsapp?: string;
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

    const body = (await req.json()) as SendPaymentLinkWhatsappBody;
    if (!body.payment_id) {
      return jsonResponse({ success: false, error: "payment_id is required" }, 400);
    }

    const { authedClient } = await ensureAuthenticatedUser(authHeader);
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: accessiblePayment, error: accessiblePaymentError } = await authedClient
      .from("reservation_payments")
      .select(`
        id,
        amount,
        currency_code,
        reservation_id,
        riad_id,
        client_whatsapp,
        stripe_checkout_url,
        status,
        payment_flow,
        checkout_expires_at,
        link_sent_count,
        cloudbeds_logged,
        reservations!inner(
          guest_first_name,
          guest_last_name
        ),
        riads!inner(
          name
        )
      `)
      .eq("id", body.payment_id)
      .maybeSingle();

    if (accessiblePaymentError) throw accessiblePaymentError;
    if (!accessiblePayment) {
      return jsonResponse({ success: false, error: "Payment record not found" }, 404);
    }

    const paymentRecord = accessiblePayment;

    if (paymentRecord.payment_flow !== "whatsapp_link") {
      return jsonResponse({ success: false, error: "This payment was not created as a WhatsApp link" }, 400);
    }

    if (!paymentRecord.stripe_checkout_url) {
      return jsonResponse({ success: false, error: "This payment link is not ready yet" }, 400);
    }

    if (paymentRecord.cloudbeds_logged || paymentRecord.status === "checkout_completed") {
      return jsonResponse({ success: false, error: "This payment has already been completed" }, 400);
    }

    if (paymentRecord.checkout_expires_at && new Date(paymentRecord.checkout_expires_at).getTime() <= Date.now()) {
      return jsonResponse({ success: false, error: "This payment link has expired. Create a new one instead." }, 400);
    }

    const normalizedWhatsapp = normalizeWhatsappNumber(body.client_whatsapp || paymentRecord.client_whatsapp || "");
    const reservation = Array.isArray(paymentRecord.reservations) ? paymentRecord.reservations[0] : paymentRecord.reservations;
    const riad = Array.isArray(paymentRecord.riads) ? paymentRecord.riads[0] : paymentRecord.riads;
    const guestFirstName = reservation?.guest_first_name?.trim()
      || reservation?.guest_last_name
      || paymentRecord.reservation_id;

    let whatsappResult: { success: boolean; messageSid?: string; error?: string | null };
    try {
      whatsappResult = await sendPaymentLinkWhatsapp({
        to: normalizedWhatsapp,
        guestFirstName,
        propertyName: riad?.name || "your property",
        amountLabel: `${formatMadAmount(Number(paymentRecord.amount))} ${paymentRecord.currency_code.toUpperCase()}`,
        paymentLink: paymentRecord.stripe_checkout_url,
      });
    } catch (error) {
      whatsappResult = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send WhatsApp payment link",
      };
    }

    const sentAt = whatsappResult.success ? new Date().toISOString() : null;
    const nextCount = paymentRecord.link_sent_count + (whatsappResult.success ? 1 : 0);

    const updatePayload: Record<string, string | number | null> = {
      status: whatsappResult.success ? "checkout_link_sent" : paymentRecord.status,
      client_whatsapp: normalizedWhatsapp,
      link_sent_count: nextCount,
      last_whatsapp_message_id: whatsappResult.messageSid || null,
      whatsapp_error_message: whatsappResult.error || null,
    };

    if (paymentRecord.link_sent_count === 0 && sentAt) {
      updatePayload.link_sent_at = sentAt;
    }

    if (sentAt) {
      updatePayload.link_last_sent_at = sentAt;
    }

    const { error: updateError } = await adminClient
      .from("reservation_payments")
      .update(updatePayload)
      .eq("id", paymentRecord.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      paymentId: paymentRecord.id,
      paymentUrl: paymentRecord.stripe_checkout_url,
      clientWhatsapp: normalizedWhatsapp,
      whatsappSent: whatsappResult.success,
      whatsappError: whatsappResult.error || null,
    });
  } catch (error) {
    console.error("[send-payment-link-whatsapp]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while sending the payment link",
    }, 500);
  }
});
