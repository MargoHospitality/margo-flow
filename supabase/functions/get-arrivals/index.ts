import {
  corsHeaders,
  ensureBackofficeContext,
  getAccessibleRiads,
  jsonResponse,
  normalizeOptionalDate,
  normalizeUniqueStrings,
} from "../_shared/backoffice-utils.ts";

type ArrivalsRequest = {
  date?: string;
  riadIds?: string[];
  source?: string;
  transportStatus?: "all" | "none" | "requested" | "confirmed";
  checkinStatus?: "all" | "not_yet" | "completed";
  search?: string;
  reservationId?: string;
};

type ReservationRow = {
  reservation_id: string;
  riad_id: string | null;
  property_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  guest_country_code: string | null;
  check_in_date: string;
  check_out_date: string | null;
  source: string | null;
  status: string;
  cloudbeds_raw: Record<string, unknown> | null;
};

type TransportRequestRow = {
  id: string;
  reservation_id: string;
  status: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  guest_comment: string | null;
  payload_details: Record<string, unknown> | null;
  is_free_transfer: boolean;
  created_at: string;
  updated_at: string;
  transport_offer?: {
    name?: string | null;
    type?: string | null;
  } | {
    name?: string | null;
    type?: string | null;
  }[] | null;
};

type CheckinResponseRow = {
  reservation_id: string;
  transport_status: string | null;
  transport_method: string | null;
  transport_details: string | null;
  arrival_time: string | null;
  guests: Array<Record<string, unknown>> | null;
  restauration_preferences: string | null;
  bedding_preferences: string | null;
  bedding_details: string | null;
  other_requests: string | null;
  completed_at: string | null;
  synced_to_cloudbeds: boolean | null;
  cloudbeds_sync_at: string | null;
  cloudbeds_sync_error: string | null;
};

type GuestTokenRow = {
  reservation_id: string;
  token: string;
};

function pickFirstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeCountryValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (["0", "00", "n/a", "na", "unknown", "null"].includes(lower)) {
    return null;
  }

  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

function parseCheckinGuests(rawGuests: unknown): Array<Record<string, unknown>> {
  let parsed = rawGuests;

  if (typeof rawGuests === "string") {
    try {
      parsed = JSON.parse(rawGuests);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((guest): guest is Record<string, unknown> => Boolean(guest && typeof guest === "object"));
}

function extractGuestList(rawReservation: Record<string, unknown> | null | undefined) {
  if (!rawReservation) return [];

  const guestList = rawReservation.guestList;
  if (Array.isArray(guestList)) {
    return guestList.filter((guest): guest is Record<string, unknown> => Boolean(guest && typeof guest === "object"));
  }

  if (guestList && typeof guestList === "object") {
    return Object.values(guestList).filter((guest): guest is Record<string, unknown> => Boolean(guest && typeof guest === "object"));
  }

  return [];
}

function extractMainGuest(rawReservation: Record<string, unknown> | null | undefined) {
  const guests = extractGuestList(rawReservation);
  return guests.find((guest) => guest.isMainGuest === true) ?? guests[0] ?? null;
}

function extractGuestPhone(rawReservation: Record<string, unknown> | null | undefined, checkinGuests: Array<Record<string, unknown>>) {
  const mainGuest = extractMainGuest(rawReservation);
  const submittedPrimaryGuest = checkinGuests[0] ?? null;

  return pickFirstString([
    mainGuest?.guestPhone,
    mainGuest?.guestCellPhone,
    mainGuest?.guestMobile,
    mainGuest?.phone,
    mainGuest?.mobile,
    submittedPrimaryGuest?.phone,
    rawReservation?.guestPhone,
    rawReservation?.guestMobile,
    rawReservation?.phone,
    rawReservation?.mobile,
  ]);
}

function extractGuestCountry(
  reservationCountryCode: string | null | undefined,
  rawReservation: Record<string, unknown> | null | undefined,
  checkinGuests: Array<Record<string, unknown>>,
) {
  const mainGuest = extractMainGuest(rawReservation);
  const submittedPrimaryGuest = checkinGuests[0] ?? null;

  const candidates = [
    reservationCountryCode,
    mainGuest?.guestCountry,
    mainGuest?.guestCountryCode,
    mainGuest?.countryCode,
    mainGuest?.country,
    rawReservation?.guestCountry,
    rawReservation?.guestCountryCode,
    rawReservation?.countryCode,
    rawReservation?.country,
    submittedPrimaryGuest?.nationality,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCountryValue(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function extractGuestCount(rawReservation: Record<string, unknown> | null | undefined, checkinGuests: Array<Record<string, unknown>>) {
  const assigned = rawReservation?.assigned;
  if (Array.isArray(assigned) && assigned.length > 0) {
    const totalAdults = assigned.reduce((sum, room) => {
      if (!room || typeof room !== "object") return sum;
      const value = (room as Record<string, unknown>).adults;
      const parsed = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : 0;
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    if (totalAdults > 0) {
      return totalAdults;
    }
  }

  const rootAdults = rawReservation?.adults;
  if (typeof rootAdults === "number" && Number.isFinite(rootAdults) && rootAdults > 0) {
    return rootAdults;
  }
  if (typeof rootAdults === "string") {
    const parsedAdults = Number.parseInt(rootAdults, 10);
    if (Number.isFinite(parsedAdults) && parsedAdults > 0) {
      return parsedAdults;
    }
  }

  const rawGuestList = extractGuestList(rawReservation);
  if (rawGuestList.length > 0) {
    return rawGuestList.length;
  }

  return checkinGuests.length;
}

function extractRoomNames(rawReservation: Record<string, unknown> | null | undefined) {
  const names = new Set<string>();
  const assigned = rawReservation?.assigned;
  const unassigned = rawReservation?.unassigned;

  const addRoomLabel = (room: unknown) => {
    if (!room || typeof room !== "object") return;
    const roomRecord = room as Record<string, unknown>;
    const label = pickFirstString([
      roomRecord.roomName,
      roomRecord.roomTypeName,
      roomRecord.roomTypeNameShort,
      roomRecord.roomType,
      roomRecord.room_type_name,
      roomRecord.unitName,
      roomRecord.name,
    ]);

    if (label) {
      names.add(label);
    }
  };

  if (Array.isArray(assigned)) {
    for (const room of assigned) {
      addRoomLabel(room);
    }
  }

  if (Array.isArray(unassigned)) {
    for (const room of unassigned) {
      addRoomLabel(room);
    }
  }

  const guests = extractGuestList(rawReservation);
  for (const guest of guests) {
    addRoomLabel(guest);

    const guestRooms = guest.rooms;
    if (Array.isArray(guestRooms)) {
      for (const room of guestRooms) {
        addRoomLabel(room);
      }
    }

    const guestUnassignedRooms = guest.unassignedRooms;
    if (Array.isArray(guestUnassignedRooms)) {
      for (const room of guestUnassignedRooms) {
        addRoomLabel(room);
      }
    }
  }

  const fallback = pickFirstString([
    rawReservation?.roomName,
    rawReservation?.roomTypeName,
    rawReservation?.roomType,
    rawReservation?.unitName,
  ]);

  if (fallback) {
    names.add(fallback);
  }

  return Array.from(names);
}

function hasOperationalReservationDetails(rawReservation: Record<string, unknown> | null | undefined) {
  if (!rawReservation || typeof rawReservation !== "object") return false;

  return extractGuestList(rawReservation).length > 0 || extractRoomNames(rawReservation).length > 0;
}

async function fetchLiveCloudbedsReservation(
  cloudbedsApiKey: string,
  propertyId: string,
  reservationId: string,
) {
  const url = new URL("https://api.cloudbeds.com/api/v1.3/getReservation");
  url.searchParams.set("propertyID", propertyId);
  url.searchParams.set("reservationID", reservationId);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cloudbedsApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[get-arrivals] Live Cloudbeds fetch failed for ${reservationId}: ${response.status}`);
      return null;
    }

    const payload = await response.json();
    if (!payload?.success || !payload?.data || typeof payload.data !== "object") {
      console.warn(`[get-arrivals] Live Cloudbeds payload unavailable for ${reservationId}`);
      return null;
    }

    return payload.data as Record<string, unknown>;
  } catch (error) {
    console.warn(`[get-arrivals] Live Cloudbeds fetch errored for ${reservationId}:`, error);
    return null;
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(mapper));
  }
}

function extractSourceCandidate(rawReservation: Record<string, unknown> | null | undefined, rawSource: string | null | undefined) {
  return pickFirstString([
    rawReservation?.thirdPartySource,
    rawReservation?.third_party_source,
    rawReservation?.subSource,
    rawReservation?.sub_source,
    rawReservation?.sourceName,
    rawReservation?.channelName,
    rawReservation?.bookingSource,
    rawReservation?.booking_source,
    rawReservation?.source,
    rawSource,
  ]);
}

function normalizeSource(rawSource: string | null | undefined, rawReservation: Record<string, unknown> | null | undefined) {
  const value = extractSourceCandidate(rawReservation, rawSource);
  const lower = value?.toLowerCase() ?? "";

  if (!value) {
    return { sourceKey: "other", sourceLabel: "Other", sourceRaw: null };
  }

  if (lower.includes("booking")) {
    return { sourceKey: "booking", sourceLabel: "Booking.com", sourceRaw: value };
  }

  if (lower.includes("airbnb")) {
    return { sourceKey: "airbnb", sourceLabel: "Airbnb", sourceRaw: value };
  }

  if (lower.includes("expedia")) {
    return { sourceKey: "expedia", sourceLabel: "Expedia", sourceRaw: value };
  }

  if (lower.includes("direct") || lower.includes("website") || lower.includes("walk") || lower.includes("net affinity")) {
    return { sourceKey: "direct", sourceLabel: "Direct Booking", sourceRaw: value };
  }

  return { sourceKey: "other", sourceLabel: value, sourceRaw: value };
}

function getGuestName(reservation: ReservationRow) {
  return [reservation.guest_first_name, reservation.guest_last_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    || reservation.guest_last_name
    || "Guest";
}

function getRelationValue<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeCustomFieldName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function extractCustomFieldValue(rawReservation: Record<string, unknown> | null | undefined, fieldName: string | string[]) {
  if (!rawReservation) return null;
  const targetFieldNames = new Set(
    (Array.isArray(fieldName) ? fieldName : [fieldName]).map(normalizeCustomFieldName),
  );
  const customFields = rawReservation.customFields;

  if (customFields && typeof customFields === "object" && !Array.isArray(customFields)) {
    const record = customFields as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (targetFieldNames.has(normalizeCustomFieldName(key))) {
        return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
      }
    }
  }

  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (!field || typeof field !== "object") continue;
      const record = field as Record<string, unknown>;
      const name = pickFirstString([
        record.customFieldName,
        record.fieldName,
        record.name,
        record.label,
      ]);

      if (!targetFieldNames.has(normalizeCustomFieldName(name))) continue;

      return pickFirstString([
        record.customFieldValue,
        record.fieldValue,
        record.value,
      ]);
    }
  }

  return null;
}

function buildGuestAppLinkFromToken(token: string) {
  return `https://app.margo-hospitality.com/?token=${encodeURIComponent(token)}`;
}

function extractGuestAppLink(rawReservation: Record<string, unknown> | null | undefined, fallbackToken: string | null | undefined) {
  const link = extractCustomFieldValue(rawReservation, [
    "guest_app_link",
    "link_guest_app",
    "guest_app_url",
    "guest_app",
  ]);

  if (link) return link;

  const token = extractCustomFieldValue(rawReservation, [
    "token_guest_app",
    "guest_app_token",
  ]);

  return token ? buildGuestAppLinkFromToken(token) : fallbackToken ? buildGuestAppLinkFromToken(fallbackToken) : null;
}

function pickTransportSummary(transportRequests: TransportRequestRow[]) {
  if (transportRequests.length === 0) {
    return {
      transportStatus: "none" as const,
      activeTransport: null,
    };
  }

  const sorted = [...transportRequests].sort((a, b) => {
    const rank = (status: string) => {
      if (status === "confirmed") return 2;
      if (status === "pending") return 1;
      return 0;
    };

    const rankDelta = rank(b.status) - rank(a.status);
    if (rankDelta !== 0) return rankDelta;

    return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
  });

  const activeTransport = sorted[0];

  if (activeTransport.status === "confirmed") {
    return {
      transportStatus: "confirmed" as const,
      activeTransport,
    };
  }

  if (activeTransport.status === "pending") {
    return {
      transportStatus: "requested" as const,
      activeTransport,
    };
  }

  return {
    transportStatus: "none" as const,
    activeTransport: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" }, 401);
    }

    const body = (await req.json()) as ArrivalsRequest;
    const selectedDate = normalizeOptionalDate(body?.date) ?? new Date().toISOString().slice(0, 10);
    const selectedRiadIds = normalizeUniqueStrings(body?.riadIds);
    const search = typeof body?.search === "string" ? body.search.trim().toLowerCase() : "";
    const sourceFilter = typeof body?.source === "string" ? body.source.trim().toLowerCase() : "all";
    const transportFilter = body?.transportStatus ?? "all";
    const checkinFilter = body?.checkinStatus ?? "all";
    const reservationIdFilter = typeof body?.reservationId === "string" ? body.reservationId.trim() : "";

    const { user, role, supabaseAdmin } = await ensureBackofficeContext(authHeader);
    const accessibleRiads = await getAccessibleRiads({
      supabaseAdmin,
      userId: user.id,
      role,
      selectedRiadIds,
    });

    if (accessibleRiads.length === 0) {
      return jsonResponse({
        success: true,
        data: reservationIdFilter
          ? { arrival: null }
          : { arrivals: [], properties: [], sources: [], date: selectedDate },
      });
    }

    const propertyNameByRiadId = new Map(
      accessibleRiads.map((riad) => [riad.id, riad.name]),
    );
    const cloudbedsPropertyIdByRiadId = new Map(
      accessibleRiads.map((riad) => [riad.id, riad.cloudbeds_property_id]),
    );
    const accessibleRiadIds = accessibleRiads.map((riad) => riad.id);

    let reservationsQuery = supabaseAdmin
      .from("reservations")
        .select("reservation_id, riad_id, property_id, guest_first_name, guest_last_name, guest_country_code, check_in_date, check_out_date, source, status, cloudbeds_raw")
      .in("riad_id", accessibleRiadIds);

    if (reservationIdFilter) {
      reservationsQuery = reservationsQuery.eq("reservation_id", reservationIdFilter);
    } else {
      reservationsQuery = reservationsQuery
        .eq("check_in_date", selectedDate)
        .in("status", ["confirmed", "checked_in"]);
    }

    const { data: reservationsData, error: reservationsError } = await reservationsQuery.order("guest_last_name", { ascending: true });

    if (reservationsError) {
      console.error("[get-arrivals] Failed to load reservations:", reservationsError);
      return jsonResponse({ success: false, error: "Failed to load arrivals" }, 500);
    }

    const reservations = (reservationsData ?? []) as ReservationRow[];
    if (reservations.length === 0) {
      return jsonResponse({
        success: true,
        data: reservationIdFilter
          ? { arrival: null }
          : {
              arrivals: [],
              properties: accessibleRiads.map(({ id, name }) => ({ id, name })),
              sources: [],
              date: selectedDate,
            },
      });
    }

    const reservationIds = reservations.map((reservation) => reservation.reservation_id);

    const [
      { data: transportRows, error: transportError },
      { data: checkinRows, error: checkinError },
      { data: guestTokenRows, error: guestTokenError },
    ] = await Promise.all([
      supabaseAdmin
        .from("transport_requests")
        .select("id, reservation_id, status, transport_date, transport_time, pax, guest_comment, payload_details, is_free_transfer, created_at, updated_at, transport_offer:transport_offers(name, type)")
        .in("reservation_id", reservationIds),
      supabaseAdmin
        .from("checkin_responses")
        .select("reservation_id, transport_status, transport_method, transport_details, arrival_time, guests, restauration_preferences, bedding_preferences, bedding_details, other_requests, completed_at, synced_to_cloudbeds, cloudbeds_sync_at, cloudbeds_sync_error")
        .in("reservation_id", reservationIds),
      supabaseAdmin
        .from("guest_tokens")
        .select("reservation_id, token")
        .in("reservation_id", reservationIds)
        .eq("revoked", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);

    if (transportError) {
      console.error("[get-arrivals] Failed to load transport requests:", transportError);
      return jsonResponse({ success: false, error: "Failed to load transport data" }, 500);
    }

    if (checkinError) {
      console.error("[get-arrivals] Failed to load digital check-in responses:", checkinError);
      return jsonResponse({ success: false, error: "Failed to load digital check-in data" }, 500);
    }

    if (guestTokenError) {
      console.error("[get-arrivals] Failed to load guest app tokens:", guestTokenError);
      return jsonResponse({ success: false, error: "Failed to load Guest App links" }, 500);
    }

    const transportByReservationId = new Map<string, TransportRequestRow[]>();
    for (const rawRow of (transportRows ?? []) as TransportRequestRow[]) {
      const current = transportByReservationId.get(rawRow.reservation_id) ?? [];
      current.push(rawRow);
      transportByReservationId.set(rawRow.reservation_id, current);
    }

    const checkinByReservationId = new Map(
      ((checkinRows ?? []) as CheckinResponseRow[]).map((row) => [row.reservation_id, row]),
    );
    const guestTokenByReservationId = new Map<string, string>();
    for (const row of (guestTokenRows ?? []) as GuestTokenRow[]) {
      if (!guestTokenByReservationId.has(row.reservation_id)) {
        guestTokenByReservationId.set(row.reservation_id, row.token);
      }
    }

    const liveRawByReservationId = new Map<string, Record<string, unknown>>();
    const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");

    if (cloudbedsApiKey) {
      await mapWithConcurrency(reservations, 4, async (reservation) => {
        const checkin = checkinByReservationId.get(reservation.reservation_id) ?? null;
        const parsedCheckinGuests = parseCheckinGuests(checkin?.guests ?? null);
        const cachedGuestCountry = extractGuestCountry(reservation.guest_country_code, reservation.cloudbeds_raw, parsedCheckinGuests);
        const cachedRoomNames = extractRoomNames(reservation.cloudbeds_raw);
        const cachedHasOperationalDetails = hasOperationalReservationDetails(reservation.cloudbeds_raw);

        if (cachedHasOperationalDetails && cachedGuestCountry && cachedRoomNames.length > 0) {
          return;
        }

        const propertyId = reservation.riad_id
          ? cloudbedsPropertyIdByRiadId.get(reservation.riad_id)
          : reservation.property_id;

        if (!propertyId) {
          return;
        }

        const liveReservation = await fetchLiveCloudbedsReservation(
          cloudbedsApiKey,
          propertyId,
          reservation.reservation_id,
        );

        if (!liveReservation) {
          return;
        }

        liveRawByReservationId.set(reservation.reservation_id, liveReservation);

        const liveGuestCountry = extractGuestCountry(reservation.guest_country_code, liveReservation, parsedCheckinGuests);
        const { error: updateError } = await supabaseAdmin
          .from("reservations")
          .update({
            cloudbeds_raw: liveReservation,
            guest_country_code: liveGuestCountry ?? reservation.guest_country_code,
            updated_at: new Date().toISOString(),
          })
          .eq("reservation_id", reservation.reservation_id);

        if (updateError) {
          console.warn(`[get-arrivals] Failed to refresh cached Cloudbeds reservation ${reservation.reservation_id}:`, updateError);
        }
      });
    }

    const allArrivals = reservations.map((reservation) => {
      const transportRowsForReservation = transportByReservationId.get(reservation.reservation_id) ?? [];
      const { transportStatus, activeTransport } = pickTransportSummary(transportRowsForReservation);
      const checkin = checkinByReservationId.get(reservation.reservation_id) ?? null;
      const parsedCheckinGuests = parseCheckinGuests(checkin?.guests ?? null);
      const effectiveRawReservation = liveRawByReservationId.get(reservation.reservation_id) ?? reservation.cloudbeds_raw;
      const source = normalizeSource(reservation.source, effectiveRawReservation);
      const checkinStatus = checkin?.completed_at ? "completed" : "not_yet";
      const propertyName = reservation.riad_id ? propertyNameByRiadId.get(reservation.riad_id) ?? "Property unavailable" : "Property unavailable";
      const activeTransportOffer = getRelationValue(activeTransport?.transport_offer);
      const guestPhone = extractGuestPhone(effectiveRawReservation, parsedCheckinGuests);
      const guestCountry = extractGuestCountry(reservation.guest_country_code, effectiveRawReservation, parsedCheckinGuests);
      const guestCount = extractGuestCount(effectiveRawReservation, parsedCheckinGuests);
      const roomNames = extractRoomNames(effectiveRawReservation);
      const guestAppLink = extractGuestAppLink(
        effectiveRawReservation,
        guestTokenByReservationId.get(reservation.reservation_id),
      );

      return {
        reservationId: reservation.reservation_id,
        riadId: reservation.riad_id,
        propertyId: reservation.property_id,
        propertyName,
        guestName: getGuestName(reservation),
        guestFirstName: reservation.guest_first_name,
        guestLastName: reservation.guest_last_name,
        guestCountryCode: guestCountry,
        guestPhone,
        guestAppLink,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        reservationStatus: reservation.status,
        guestCount,
        roomNames,
        sourceKey: source.sourceKey,
        sourceLabel: source.sourceLabel,
        sourceRaw: source.sourceRaw,
        transportStatus,
        checkinStatus,
        arrivalTime: checkin?.arrival_time ?? null,
        transport: activeTransport ? {
          id: activeTransport.id,
          status: activeTransport.status,
          date: activeTransport.transport_date,
          time: activeTransport.transport_time,
          pax: activeTransport.pax,
          isComplimentary: activeTransport.is_free_transfer ?? false,
          guestComment: activeTransport.guest_comment,
          offerName: activeTransportOffer?.name ?? null,
          offerType: activeTransportOffer?.type ?? null,
          payloadDetails: activeTransport.payload_details ?? null,
        } : null,
        checkin: checkin ? {
          completedAt: checkin.completed_at,
          syncedToCloudbeds: checkin.synced_to_cloudbeds ?? false,
          cloudbedsSyncAt: checkin.cloudbeds_sync_at,
          cloudbedsSyncError: checkin.cloudbeds_sync_error,
          transportStatus: checkin.transport_status,
          transportMethod: checkin.transport_method,
          transportDetails: checkin.transport_details,
          arrivalTime: checkin.arrival_time,
          guests: parsedCheckinGuests,
          restaurationPreferences: checkin.restauration_preferences,
          beddingPreferences: checkin.bedding_preferences,
          beddingDetails: checkin.bedding_details,
          otherRequests: checkin.other_requests,
        } : null,
      };
    });

    const sources = Array.from(
      new Map(allArrivals.map((arrival) => [arrival.sourceKey, { key: arrival.sourceKey, label: arrival.sourceLabel }])).values(),
    );

    const arrivals = allArrivals
      .filter((arrival) => {
        if (sourceFilter !== "all" && arrival.sourceKey !== sourceFilter) {
          return false;
        }

        if (transportFilter !== "all" && arrival.transportStatus !== transportFilter) {
          return false;
        }

        if (checkinFilter !== "all" && arrival.checkinStatus !== checkinFilter) {
          return false;
        }

        if (search) {
          const haystack = [
            arrival.guestName,
            arrival.propertyName,
            arrival.reservationId,
            arrival.sourceLabel,
            arrival.roomNames.join(" "),
          ].join(" ").toLowerCase();

          if (!haystack.includes(search)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.arrivalTime ?? "99:99";
        const timeB = b.arrivalTime ?? "99:99";
        if (timeA !== timeB) {
          return timeA.localeCompare(timeB);
        }

        const propertyDelta = a.propertyName.localeCompare(b.propertyName);
        if (propertyDelta !== 0) {
          return propertyDelta;
        }

        return a.guestName.localeCompare(b.guestName);
      });

    if (reservationIdFilter) {
      return jsonResponse({
        success: true,
        data: {
          arrival: arrivals[0] ?? null,
        },
      });
    }

    return jsonResponse({
      success: true,
      data: {
        date: selectedDate,
        arrivals,
        properties: accessibleRiads.map(({ id, name }) => ({ id, name })),
        sources,
      },
    });
  } catch (error) {
    console.error("[get-arrivals]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
