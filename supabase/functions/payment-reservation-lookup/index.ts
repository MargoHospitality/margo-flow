import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  ensureAuthenticatedUser,
  jsonResponse,
} from "../_shared/payment-utils.ts";

interface LookupBody {
  riad_id?: string;
  reservation_id?: string;
  check_in_date?: string;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractMainGuest(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;

  const reservation = raw as Record<string, unknown>;
  const guestList = reservation.guestList;
  if (Array.isArray(guestList)) {
    return (guestList.find((guest) => guest && typeof guest === "object" && (guest as Record<string, unknown>).isMainGuest) as Record<string, unknown> | undefined)
      ?? (guestList.find((guest) => guest && typeof guest === "object") as Record<string, unknown> | undefined)
      ?? null;
  }

  if (guestList && typeof guestList === "object") {
    const guests = Object.values(guestList).filter((guest): guest is Record<string, unknown> => Boolean(guest && typeof guest === "object"));
    return guests.find((guest) => guest.isMainGuest === true) ?? guests[0] ?? null;
  }

  return null;
}

function extractGuestWhatsapp(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const reservation = raw as Record<string, unknown>;
  const mainGuest = extractMainGuest(raw);

  return pickFirstString([
    mainGuest?.guestPhone,
    mainGuest?.guestMobile,
    mainGuest?.phone,
    mainGuest?.mobile,
    mainGuest?.cellPhone,
    mainGuest?.cellphone,
    reservation.guestPhone,
    reservation.guestMobile,
    reservation.phone,
    reservation.mobile,
  ]);
}

function extractGuestEmail(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const reservation = raw as Record<string, unknown>;
  const mainGuest = extractMainGuest(raw);

  return pickFirstString([
    mainGuest?.guestEmail,
    mainGuest?.email,
    reservation.guestEmail,
    reservation.email,
  ]);
}

function extractSuggestedAmount(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const reservation = raw as Record<string, unknown>;
  const directBalance = pickFirstString([
    typeof reservation.balance === "number" ? String(reservation.balance) : reservation.balance,
    typeof reservation.pendingPayment === "number" ? String(reservation.pendingPayment) : reservation.pendingPayment,
    typeof reservation.balanceDue === "number" ? String(reservation.balanceDue) : reservation.balanceDue,
  ]);

  const parsedDirect = directBalance ? parseNumericValue(directBalance) : null;
  if (parsedDirect !== null) {
    return Number(parsedDirect.toFixed(2));
  }

  const total = parseNumericValue(reservation.total);
  const paid = parseNumericValue(reservation.paid);
  if (total !== null && paid !== null) {
    return Number(Math.max(total - paid, 0).toFixed(2));
  }

  return null;
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

    const body = (await req.json()) as LookupBody;
    if (!body.riad_id || !body.reservation_id || !body.check_in_date) {
      return jsonResponse({ success: false, error: "riad_id, reservation_id, and check_in_date are required" }, 400);
    }

    const { authedClient } = await ensureAuthenticatedUser(authHeader);

    const [{ data: paymentSetting, error: settingError }, { data: reservation, error: reservationError }] = await Promise.all([
      authedClient
        .from("riad_payment_settings")
        .select("riad_id, is_enabled, riad:riads(id, name, cloudbeds_property_id)")
        .eq("riad_id", body.riad_id)
        .eq("is_enabled", true)
        .maybeSingle(),
      authedClient
        .from("reservations")
        .select("reservation_id, guest_first_name, guest_last_name, check_in_date, check_out_date, status, property_id, riad_id, cloudbeds_raw")
        .eq("riad_id", body.riad_id)
        .eq("reservation_id", body.reservation_id.trim())
        .eq("check_in_date", body.check_in_date)
        .maybeSingle(),
    ]);

    if (settingError) throw settingError;
    if (reservationError) throw reservationError;

    if (!paymentSetting?.riad) {
      return jsonResponse({ success: false, error: "This property does not have payments enabled" }, 403);
    }

    if (!reservation) {
      return jsonResponse({ success: false, error: "Reservation not found for the selected property and check-in date" }, 404);
    }

    const riad = paymentSetting.riad as { id: string; name: string; cloudbeds_property_id: string | null };
    let liveReservation: Record<string, unknown> | null = null;

    if (riad.cloudbeds_property_id) {
      const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");
      if (!cloudbedsApiKey) {
        throw new Error("CLOUDBEDS_API_KEY is not configured");
      }

      const url = new URL("https://api.cloudbeds.com/api/v1.3/getReservation");
      url.searchParams.set("propertyID", riad.cloudbeds_property_id);
      url.searchParams.set("reservationID", reservation.reservation_id);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cloudbedsApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.success && payload?.data && typeof payload.data === "object") {
          liveReservation = payload.data as Record<string, unknown>;
        }
      }
    }

    const effectiveReservation = liveReservation ?? (reservation.cloudbeds_raw as Record<string, unknown> | null);
    const suggestedAmount = extractSuggestedAmount(effectiveReservation);
    const guestWhatsapp = extractGuestWhatsapp(effectiveReservation);
    const guestEmail = extractGuestEmail(effectiveReservation);

    const { data: existingPayments, error: paymentsError } = await authedClient
      .from("reservation_payments")
      .select("id, amount, currency_code, status, payment_flow, stripe_checkout_url, checkout_expires_at, client_whatsapp, link_last_sent_at, link_sent_count, cloudbeds_logged, created_at")
      .eq("riad_id", body.riad_id)
      .eq("reservation_id", reservation.reservation_id)
      .in("payment_flow", ["whatsapp_link", "email_link"])
      .order("created_at", { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    const latestKnownWhatsapp = (existingPayments ?? []).find((payment) => typeof payment.client_whatsapp === "string" && payment.client_whatsapp.trim().length > 0)?.client_whatsapp
      ?? guestWhatsapp;

    return jsonResponse({
      success: true,
      data: {
        reservation: {
          reservation_id: reservation.reservation_id,
          guest_first_name: reservation.guest_first_name,
          guest_last_name: reservation.guest_last_name,
          check_in_date: reservation.check_in_date,
          check_out_date: reservation.check_out_date,
          status: reservation.status,
          property_id: reservation.property_id,
          riad_id: reservation.riad_id,
        },
        guestWhatsapp: latestKnownWhatsapp,
        guestEmail,
        suggestedAmount,
        existingPayments: existingPayments ?? [],
      },
    });
  } catch (error) {
    console.error("[payment-reservation-lookup]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected lookup error",
    }, 500);
  }
});
