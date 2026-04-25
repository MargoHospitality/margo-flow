import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
} from "../_shared/payment-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return jsonResponse({
    success: false,
    error: "Manual card entry is no longer available. Please send a Stripe Checkout payment link from Margo Flow.",
  }, 410);
});
