type CloudbedsRiadRelation = {
  name?: string | null;
  cloudbeds_property_id?: string | null;
  cloudbeds_sync_enabled?: boolean | null;
} | CloudbedsRiadRelation[] | null | undefined;

export type TransportArrivalSyncRow = {
  id: string;
  reservation_id: string;
  riad_id: string;
  status: string;
  transport_time: string | null;
  transport_date?: string | null;
  riad?: CloudbedsRiadRelation;
};

function getRelationValue<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toCloudbedsArrivalTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw new Error("Transport request transport_time is not in a supported format");
  }

  return `${match[1]}:${match[2]}`;
}

export async function syncTransportArrivalTimeToCloudbeds(params: {
  transportRequest: TransportArrivalSyncRow;
}) {
  const riad = getRelationValue(params.transportRequest.riad);
  const propertyId = riad?.cloudbeds_property_id ?? null;

  if (params.transportRequest.status !== "confirmed") {
    return {
      success: true,
      updated: false,
      skippedReason: "Transport request is not confirmed",
      reservationId: params.transportRequest.reservation_id,
      propertyId,
    };
  }

  if (!params.transportRequest.transport_time) {
    return {
      success: true,
      updated: false,
      skippedReason: "Transport request is missing transport_time",
      reservationId: params.transportRequest.reservation_id,
      propertyId,
    };
  }

  if (!propertyId) {
    return {
      success: true,
      updated: false,
      skippedReason: "Missing cloudbeds_property_id",
      reservationId: params.transportRequest.reservation_id,
      propertyId,
    };
  }

  if (!riad?.cloudbeds_sync_enabled) {
    return {
      success: true,
      updated: false,
      skippedReason: "Cloudbeds sync disabled for this property",
      reservationId: params.transportRequest.reservation_id,
      propertyId,
    };
  }

  const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");
  if (!cloudbedsApiKey) {
    throw new Error("CLOUDBEDS_API_KEY is not configured");
  }

  const estimatedArrivalTime = toCloudbedsArrivalTime(params.transportRequest.transport_time);

  const response = await fetch(
    `https://api.cloudbeds.com/api/v1.3/putReservation?propertyID=${encodeURIComponent(propertyId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cloudbedsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reservationID: params.transportRequest.reservation_id,
        estimatedArrivalTime,
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const errorMessage = payload?.error || payload?.message || "Cloudbeds rejected the arrival time update";
    throw new Error(errorMessage);
  }

  return {
    success: true,
    updated: true,
    reservationId: params.transportRequest.reservation_id,
    propertyId,
    arrivalTime: estimatedArrivalTime,
  };
}
