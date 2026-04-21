import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "manager" | "super_admin";

type ReviewsRequest = {
  riadIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  rating?: number;
  limit?: number;
  offset?: number;
};

type AccessibleRiad = {
  id: string;
  name: string;
  cloudbeds_property_id: string | null;
};

type GeaReviewItem = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  cloudbedsPropertyId: string | null;
  reservationId: string;
  guestEmail?: string | null;
  guestName?: string | null;
  ratingGlobal: number;
  ratingStaff: number;
  ratingCleanliness: number;
  servicesAppreciated?: string[] | null;
  suggestions?: string | null;
  redirectedToGoogle: boolean;
  createdAt: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  );
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function normalizeOptionalRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }

  return value;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geaBaseUrl = Deno.env.get("GEA_BASE_URL") ?? "https://gea.margo-hospitality.com";
    const geaInternalSecret = Deno.env.get("GEA_INTERNAL_API_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("[get-reviews] Missing Supabase env config");
      return jsonResponse({ success: false, error: "Server configuration error" }, 500);
    }

    if (!geaInternalSecret) {
      console.error("[get-reviews] Missing GEA internal API secret");
      return jsonResponse({ success: false, error: "Reviews temporarily unavailable" }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Authentication failed" }, 401);
    }

    const [{ data: roleData, error: roleError }, requestBody] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["manager", "super_admin"])
        .maybeSingle(),
      req.json() as Promise<ReviewsRequest>,
    ]);

    if (roleError || !roleData?.role) {
      return jsonResponse({ success: false, error: "Access denied" }, 403);
    }

    const role = roleData.role as AppRole;
    const selectedRiadIds = normalizeUniqueStrings(requestBody?.riadIds);
    const dateFrom = normalizeOptionalDate(requestBody?.dateFrom);
    const dateTo = normalizeOptionalDate(requestBody?.dateTo);
    const rating = normalizeOptionalRating(requestBody?.rating);
    const limit = typeof requestBody?.limit === "number"
      ? Math.max(1, Math.min(200, Math.trunc(requestBody.limit)))
      : 100;
    const offset = typeof requestBody?.offset === "number"
      ? Math.max(0, Math.trunc(requestBody.offset))
      : 0;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return jsonResponse({ success: false, error: "Invalid date range" }, 400);
    }

    let allowedRiadIds: string[] | null = null;

    if (role !== "super_admin") {
      const { data: userRiads, error: userRiadsError } = await supabaseAdmin
        .from("user_riads")
        .select("riad_id")
        .eq("user_id", user.id);

      if (userRiadsError) {
        console.error("[get-reviews] Failed to load manager riads:", userRiadsError);
        return jsonResponse({ success: false, error: "Failed to resolve property access" }, 500);
      }

      allowedRiadIds = (userRiads ?? []).map((item) => item.riad_id);

      if (selectedRiadIds.length > 0) {
        allowedRiadIds = allowedRiadIds.filter((riadId) => selectedRiadIds.includes(riadId));
      }

      if (allowedRiadIds.length === 0) {
        return jsonResponse({
          success: true,
          data: {
            reviews: [],
          },
        });
      }
    }

    let riadsQuery = supabaseAdmin
      .from("riads")
      .select("id, name, cloudbeds_property_id")
      .not("cloudbeds_property_id", "is", null)
      .order("name", { ascending: true });

    if (role === "super_admin" && selectedRiadIds.length > 0) {
      riadsQuery = riadsQuery.in("id", selectedRiadIds);
    }

    if (allowedRiadIds) {
      riadsQuery = riadsQuery.in("id", allowedRiadIds);
    }

    const { data: accessibleRiads, error: riadsError } = await riadsQuery;

    if (riadsError) {
      console.error("[get-reviews] Failed to load accessible riads:", riadsError);
      return jsonResponse({ success: false, error: "Failed to resolve property access" }, 500);
    }

    const riads = (accessibleRiads ?? []) as AccessibleRiad[];
    if (riads.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          reviews: [],
        },
      });
    }

    const propertyNameByCloudbedsId = new Map(
      riads
        .filter((riad): riad is AccessibleRiad & { cloudbeds_property_id: string } => Boolean(riad.cloudbeds_property_id))
        .map((riad) => [riad.cloudbeds_property_id, riad.name]),
    );

    const cloudbedsPropertyIds = [...propertyNameByCloudbedsId.keys()];
    const searchParams = new URLSearchParams({
      cloudbedsPropertyIds: cloudbedsPropertyIds.join(","),
      limit: String(limit),
      offset: String(offset),
    });

    if (dateFrom) searchParams.set("dateFrom", dateFrom);
    if (dateTo) searchParams.set("dateTo", dateTo);
    if (rating) {
      searchParams.set("minRating", String(rating));
      searchParams.set("maxRating", String(rating));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const geaResponse = await fetch(`${geaBaseUrl}/api/v1/internal/reviews?${searchParams.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Margo-Internal-Secret": geaInternalSecret,
        },
        signal: controller.signal,
      });

      const responseText = await geaResponse.text();
      let geaPayload: { success?: boolean; data?: { reviews?: GeaReviewItem[] }; error?: string } | null = null;

      try {
        geaPayload = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.error("[get-reviews] Failed to parse GEA response:", parseError);
      }

      if (!geaResponse.ok || !geaPayload?.success) {
        console.error("[get-reviews] GEA response error:", geaResponse.status, geaPayload?.error ?? responseText);
        return jsonResponse({ success: false, error: "Reviews temporarily unavailable" }, 503);
      }

      const reviews = (geaPayload.data?.reviews ?? []).map((review) => ({
        id: review.id,
        propertyId: review.propertyId,
        propertyName: (review.cloudbedsPropertyId && propertyNameByCloudbedsId.get(review.cloudbedsPropertyId))
          ?? review.propertyName
          ?? "Unknown property",
        reservationId: review.reservationId,
        guestEmail: review.guestEmail ?? null,
        guestName: review.guestName ?? null,
        ratingGlobal: review.ratingGlobal,
        ratingStaff: review.ratingStaff,
        ratingCleanliness: review.ratingCleanliness,
        servicesAppreciated: review.servicesAppreciated ?? null,
        suggestions: review.suggestions ?? null,
        redirectedToGoogle: review.redirectedToGoogle,
        createdAt: review.createdAt,
      }));

      return jsonResponse({
        success: true,
        data: {
          reviews,
        },
      });
    } catch (error) {
      console.error("[get-reviews] Failed to reach GEA:", error);
      return jsonResponse({ success: false, error: "Reviews temporarily unavailable" }, 503);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("[get-reviews] Unexpected error:", error);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
