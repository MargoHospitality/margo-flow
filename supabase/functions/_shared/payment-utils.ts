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

export function parseStripeWebhookSecretMap() {
  const raw = Deno.env.get("STRIPE_WEBHOOK_SECRETS_JSON");
  if (!raw) {
    throw new Error("STRIPE_WEBHOOK_SECRETS_JSON is not configured");
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("STRIPE_WEBHOOK_SECRETS_JSON must be a JSON object mapping alias to webhook secret");
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

export async function createStripeCheckoutSession(params: {
  secretKey: string;
  amountMinor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  expiresAt?: number;
}) {
  const body = new URLSearchParams();
  body.append("mode", "payment");
  body.append("success_url", params.successUrl);
  body.append("cancel_url", params.cancelUrl);
  body.append("line_items[0][quantity]", "1");
  body.append("line_items[0][price_data][currency]", params.currency.toLowerCase());
  body.append("line_items[0][price_data][unit_amount]", String(params.amountMinor));
  body.append("line_items[0][price_data][product_data][name]", params.description);
  body.append("payment_intent_data[description]", params.description);

  if (params.expiresAt) {
    body.append("expires_at", String(params.expiresAt));
  }

  for (const [key, value] of Object.entries(params.metadata)) {
    body.append(`metadata[${key}]`, value);
    body.append(`payment_intent_data[metadata][${key}]`, value);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
    const message = data?.error?.message || "Failed to create Stripe Checkout Session";
    throw new Error(message);
  }

  return data as {
    id: string;
    url: string;
    expires_at: number | null;
    payment_status: string;
    status: string;
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

function parseStripeSignatureHeader(signatureHeader: string) {
  const entries = signatureHeader.split(",").map((segment) => segment.trim());
  const timestamp = entries.find((entry) => entry.startsWith("t="))?.slice(2) || null;
  const signatures = entries
    .filter((entry) => entry.startsWith("v1="))
    .map((entry) => entry.slice(3))
    .filter(Boolean);

  return { timestamp, signatures };
}

async function computeHmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyStripeWebhookSignature(params: {
  payload: string;
  signatureHeader: string | null;
  secretMap: Record<string, string>;
  toleranceSeconds?: number;
}) {
  if (!params.signatureHeader) {
    throw new Error("Missing Stripe signature header");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(params.signatureHeader);
  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe signature header");
  }

  const toleranceSeconds = params.toleranceSeconds ?? 300;
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error("Invalid Stripe signature timestamp");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsedTimestamp) > toleranceSeconds) {
    throw new Error("Stripe signature timestamp is outside the tolerance window");
  }

  const signedPayload = `${timestamp}.${params.payload}`;

  for (const [alias, secret] of Object.entries(params.secretMap)) {
    const expected = await computeHmacSha256(secret, signedPayload);
    if (signatures.some((signature) => signature === expected)) {
      return { alias };
    }
  }

  throw new Error("No matching Stripe webhook secret");
}

const cardBrandMap: Record<string, string> = {
  visa: "visa",
  mastercard: "master",
  amex: "amex",
  discover: "Discover",
  jcb: "jcb",
  diners: "diners",
  unionpay: "union_pay",
  maestro: "maestro",
};

export async function syncCloudbedsPayment(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  paymentRecord: {
    id: string;
    amount: number;
    amount_minor: number;
    currency_code: string;
    reservation_id: string;
    riad_id: string;
    stripe_payment_intent_id: string | null;
    stripe_secret_key_alias: string;
    cloudbeds_payment_method: string;
    cloudbeds_logged: boolean;
  };
}) {
  const { adminClient, paymentRecord } = params;

  if (!paymentRecord.stripe_payment_intent_id) {
    throw new Error("Payment record is missing Stripe PaymentIntent ID");
  }

  if (paymentRecord.cloudbeds_logged) {
    return {
      paymentIntentId: paymentRecord.stripe_payment_intent_id,
      cloudbedsLogged: true,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency_code,
      cloudbedsReference: paymentRecord.stripe_payment_intent_id,
    };
  }

  const { data: paymentSettings, error: settingsError } = await adminClient
    .from("riad_payment_settings")
    .select("cloudbeds_payment_description, cloudbeds_payment_method, riad:riads(id, name, cloudbeds_property_id)")
    .eq("riad_id", paymentRecord.riad_id)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  const riad = paymentSettings?.riad as { id: string; name: string; cloudbeds_property_id: string | null } | null;
  if (!riad?.cloudbeds_property_id) {
    throw new Error("Property is missing Cloudbeds property ID");
  }

  const cloudbedsPaymentMethod = paymentSettings?.cloudbeds_payment_method || paymentRecord.cloudbeds_payment_method;
  if (!cloudbedsPaymentMethod) {
    throw new Error("Property is missing Cloudbeds payment method");
  }

  const secretMap = parseStripeSecretMap();
  const secretKey = getStripeSecretKey(paymentRecord.stripe_secret_key_alias, secretMap);
  const stripeIntent = await retrieveStripePaymentIntent(secretKey, paymentRecord.stripe_payment_intent_id);

  if (stripeIntent.status !== "succeeded") {
    throw new Error(`Stripe PaymentIntent status is "${stripeIntent.status}", expected "succeeded"`);
  }

  if (stripeIntent.amount !== paymentRecord.amount_minor) {
    throw new Error("Stripe amount does not match the prepared payment record");
  }

  const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY");
  if (!cloudbedsApiKey) {
    throw new Error("CLOUDBEDS_API_KEY is not configured");
  }

  const cardBrand = stripeIntent.latest_charge?.payment_method_details?.card?.brand;
  const last4 = stripeIntent.latest_charge?.payment_method_details?.card?.last4;
  const cardSummary = cardBrand && last4 ? `${cardBrand.toUpperCase()} •••• ${last4}` : null;
  const descriptionParts = [
    paymentSettings?.cloudbeds_payment_description || "Stripe card payment via Margo Flow",
    `PI ${stripeIntent.id}`,
    cardSummary,
  ].filter(Boolean);

  const cloudbedsBody = new URLSearchParams();
  cloudbedsBody.append("propertyID", riad.cloudbeds_property_id);
  cloudbedsBody.append("reservationID", paymentRecord.reservation_id);
  cloudbedsBody.append("type", cloudbedsPaymentMethod);
  cloudbedsBody.append("amount", formatMadAmount(paymentRecord.amount));
  cloudbedsBody.append("description", descriptionParts.join(" | "));

  if (cloudbedsPaymentMethod.toLowerCase() === "credit" && cardBrandMap[cardBrand || ""]) {
    cloudbedsBody.append("cardType", cardBrandMap[cardBrand || ""]);
  }

  const cloudbedsResponse = await fetch("https://api.cloudbeds.com/api/v1.3/postPayment", {
    method: "POST",
    headers: {
      "x-api-key": cloudbedsApiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: cloudbedsBody,
  });

  const cloudbedsPayload = await cloudbedsResponse.json();
  if (!cloudbedsResponse.ok || cloudbedsPayload?.success === false) {
    const errorMessage = cloudbedsPayload?.error || cloudbedsPayload?.message || "Cloudbeds rejected the payment post";
    await adminClient
      .from("reservation_payments")
      .update({
        status: "cloudbeds_failed",
        cloudbeds_error_message: errorMessage,
        stripe_payment_method_summary: cardSummary,
      })
      .eq("id", paymentRecord.id);

    throw new Error(errorMessage);
  }

  const reference = cloudbedsPayload?.data?.paymentID
    ? String(cloudbedsPayload.data.paymentID)
    : stripeIntent.id;

  const { error: updateError } = await adminClient
    .from("reservation_payments")
    .update({
      status: "cloudbeds_logged",
      cloudbeds_logged: true,
      cloudbeds_logged_at: new Date().toISOString(),
      cloudbeds_payment_reference: reference,
      cloudbeds_payment_method: cloudbedsPaymentMethod,
      cloudbeds_error_message: null,
      stripe_payment_method_summary: cardSummary,
    })
    .eq("id", paymentRecord.id);

  if (updateError) {
    throw updateError;
  }

  return {
    paymentIntentId: stripeIntent.id,
    cloudbedsLogged: true,
    amount: paymentRecord.amount,
    currency: paymentRecord.currency_code,
    cloudbedsReference: reference,
  };
}
