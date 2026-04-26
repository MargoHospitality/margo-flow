import {
  corsHeaders,
  ensureBackofficeContext,
  getAccessibleRiads,
  jsonResponse,
} from "../_shared/backoffice-utils.ts";

type NotesRequest = {
  reservationId?: string;
};

type ReservationRow = {
  reservation_id: string;
  riad_id: string | null;
  property_id: string;
};

type CloudbedsNote = Record<string, unknown>;

function pickFirstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractNoteText(note: CloudbedsNote) {
  return pickFirstString([
    note.reservationNote,
    note.reservation_note,
    note.note,
    note.text,
    note.noteText,
    note.content,
    note.description,
    note.message,
  ]);
}

function extractNoteCreatedAt(note: CloudbedsNote) {
  return pickFirstString([
    note.dateCreated,
    note.dateModified,
    note.createdAt,
    note.created_at,
    note.date_created,
    note.noteDate,
    note.date,
  ]);
}

function extractNoteAuthor(note: CloudbedsNote) {
  return pickFirstString([
    note.userName,
    note.user_name,
    note.author,
    note.createdBy,
    note.created_by,
  ]);
}

function isOperationalNote(text: string) {
  const normalized = text.trimStart().toLowerCase();
  return (
    normalized.startsWith("--- check-in guest app ---\n[margo flow]") ||
    normalized.startsWith("--- check-in guest app ---\r\n[margo flow]") ||
    normalized.startsWith("[margo flow][request_id:") ||
    normalized.startsWith("[margo flow] transport confirmed") ||
    normalized.includes("digital check-in") ||
    normalized.includes("digital check in") ||
    normalized.includes("check-in submitted") ||
    normalized.includes("check in submitted")
  );
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

    const body = (await req.json()) as NotesRequest;
    const reservationId = typeof body?.reservationId === "string" ? body.reservationId.trim() : "";
    if (!reservationId) {
      return jsonResponse({ success: false, error: "reservationId is required" }, 400);
    }

    const { user, role, supabaseAdmin } = await ensureBackofficeContext(authHeader);
    const accessibleRiads = await getAccessibleRiads({
      supabaseAdmin,
      userId: user.id,
      role,
    });
    const accessibleRiadIds = new Set(accessibleRiads.map((riad) => riad.id));

    if (accessibleRiadIds.size === 0) {
      return jsonResponse({ success: true, data: { notes: [] } });
    }

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .select("reservation_id, riad_id, property_id")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    if (reservationError) {
      console.error("[get-cloudbeds-reservation-notes] Failed to load reservation:", reservationError);
      return jsonResponse({ success: false, error: "Failed to load reservation" }, 500);
    }

    const reservationRow = reservation as ReservationRow | null;
    if (!reservationRow || !reservationRow.riad_id || !accessibleRiadIds.has(reservationRow.riad_id)) {
      return jsonResponse({ success: false, error: "Reservation not found" }, 404);
    }

    const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");
    if (!cloudbedsApiKey) {
      return jsonResponse({ success: false, error: "Cloudbeds API not configured" }, 500);
    }

    const notesUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservationNotes?propertyID=${encodeURIComponent(reservationRow.property_id)}&reservationID=${encodeURIComponent(reservationRow.reservation_id)}`;
    const cloudbedsResponse = await fetch(notesUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cloudbedsApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const rawText = await cloudbedsResponse.text();
    let payload: { success?: boolean; data?: unknown } | null = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!cloudbedsResponse.ok || !payload?.success) {
      console.error("[get-cloudbeds-reservation-notes] Cloudbeds notes request failed:", {
        status: cloudbedsResponse.status,
        body: rawText.slice(0, 500),
      });
      return jsonResponse({ success: false, error: "Failed to load Cloudbeds notes" }, 502);
    }

    const rawNotes = Array.isArray(payload.data) ? payload.data as CloudbedsNote[] : [];
    const notes = rawNotes
      .map((note, index) => {
        const text = extractNoteText(note);
        if (!text || isOperationalNote(text)) return null;

        return {
          id: pickFirstString([note.reservationNoteID, note.reservationNoteId, note.id, note.noteID, note.noteId]) ?? `${reservationRow.reservation_id}-${index}`,
          text,
          createdAt: extractNoteCreatedAt(note),
          author: extractNoteAuthor(note),
        };
      })
      .filter((note): note is NonNullable<typeof note> => Boolean(note));

    return jsonResponse({
      success: true,
      data: {
        notes,
      },
    });
  } catch (error) {
    console.error("[get-cloudbeds-reservation-notes]", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
