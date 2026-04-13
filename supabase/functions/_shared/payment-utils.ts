import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const STRIPE_API_VERSION = "2026-02-25.clover";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export function createAuthedClient(supabaseUrl: string, supabaseAnonKey: string, authHeader: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export function createAdminClient(supabaseUrl: string, supabaseServiceRoleKey: string) {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export function parseStripeSecretMap() {
  const raw = Deno.env.get("STRIPE_SECRET_KEYS_JSON");
  if (!raw) {
    throw new Error("STRIPE_SECRET_KEYS_JSON is not configured");
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("STRIPE_SECRET_KEYS_JSON must be a JSON object mapping alias to secret key");
  }

  return parsed as Record<string, string>;
}

export function getStripeSecretKey(alias: string | null | undefined, secretMap: Record<string, string>) {
  if (!alias) {
    throw new Error("Missing Stripe secret alias");
  }

  const secret = secretMap[alias];
  if (!secret) {
    throw new Error(`No Stripe secret key configured for alias "${alias}"`);
  }

  return secret;
}

export function toMinorAmount(amount: number) {
  return Math.round(amount * 100);
}

export function formatMadAmount(amount: number) {
  return amount.toFixed(2);
}

export async function ensureAuthenticatedUser(authHeader: string) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const authedClient = createAuthedClient(supabaseUrl, supabaseAnonKey, authHeader);
  const { data: { user }, error } = await authedClient.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication failed");
  }

  return { user, authedClient };
}

export async function createStripePaymentIntent(params: {
  secretKey: string;
  amountMinor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  moto?: boolean;
}) {
  const body = new URLSearchParams();
  body.append("amount", String(params.amountMinor));
  body.append("currency", params.currency.toLowerCase());
  body.append("description", params.description);
  body.append("automatic_payment_methods[enabled]", "true");

  if (params.moto) {
    body.append("payment_method_options[card][moto]", "true");
  }

  for (const [key, value] of Object.entries(params.metadata)) {
    body.append(`metadata[${key}]`, value);
  }

  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Failed to create Stripe PaymentIntent";
    throw new Error(message);
  }

  return data as {
    id: string;
    client_secret: string;
    status: string;
    amount: number;
    currency: string;
  };
}

export async function retrieveStripePaymentIntent(secretKey: string, paymentIntentId: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Stripe-Version": STRIPE_API_VERSION,
      },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Failed to retrieve Stripe PaymentIntent";
    throw new Error(message);
  }

  return data as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    latest_charge?: {
      payment_method_details?: {
        card?: {
          brand?: string;
          last4?: string;
        };
      };
    };
  };
}
