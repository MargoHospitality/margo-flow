import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type AppRole = "manager" | "super_admin";

export type AccessibleRiad = {
  id: string;
  name: string;
  cloudbeds_property_id: string | null;
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function normalizeUniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
}

export function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

export function resolveAppRole(roles: Array<{ role: AppRole }> | null | undefined): AppRole | null {
  if (!roles || roles.length === 0) {
    return null;
  }

  if (roles.some(({ role }) => role === "super_admin")) {
    return "super_admin";
  }

  if (roles.some(({ role }) => role === "manager")) {
    return "manager";
  }

  return null;
}

export async function ensureBackofficeContext(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables");
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
    throw new Error("Authentication failed");
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["manager", "super_admin"]);

  if (roleError) {
    throw new Error("Failed to resolve role");
  }

  const role = resolveAppRole((roleRows ?? []) as Array<{ role: AppRole }>);
  if (!role) {
    throw new Error("Access denied");
  }

  return {
    user,
    role,
    supabase,
    supabaseAdmin,
  };
}

export async function getAccessibleRiads(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  role: AppRole;
  selectedRiadIds?: string[];
}) {
  const selectedRiadIds = params.selectedRiadIds ?? [];

  let allowedRiadIds: string[] | null = null;

  if (params.role !== "super_admin") {
    const { data: userRiads, error: userRiadsError } = await params.supabaseAdmin
      .from("user_riads")
      .select("riad_id")
      .eq("user_id", params.userId);

    if (userRiadsError) {
      throw new Error("Failed to resolve property access");
    }

    allowedRiadIds = (userRiads ?? []).map((item) => item.riad_id);

    if (selectedRiadIds.length > 0) {
      allowedRiadIds = allowedRiadIds.filter((riadId) => selectedRiadIds.includes(riadId));
    }

    if (allowedRiadIds.length === 0) {
      return [] as AccessibleRiad[];
    }
  }

  let riadsQuery = params.supabaseAdmin
    .from("riads")
    .select("id, name, cloudbeds_property_id")
    .order("name", { ascending: true });

  if (params.role === "super_admin" && selectedRiadIds.length > 0) {
    riadsQuery = riadsQuery.in("id", selectedRiadIds);
  }

  if (allowedRiadIds) {
    riadsQuery = riadsQuery.in("id", allowedRiadIds);
  }

  const { data: accessibleRiads, error: riadsError } = await riadsQuery;

  if (riadsError) {
    throw new Error("Failed to load accessible properties");
  }

  return (accessibleRiads ?? []) as AccessibleRiad[];
}
