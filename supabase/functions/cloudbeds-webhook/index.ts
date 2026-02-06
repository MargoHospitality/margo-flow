// Edge Function: Cloudbeds Webhook Handler
// Description: Écoute les webhooks Cloudbeds, génère tokens pour guest app
// Events: new_reservation, reservation_modified

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CloudbedsWebhookPayload {
  event: string;
  reservationID: string;
  propertyID: string;
  guestName?: string;
  guestEmail?: string;
  checkIn?: string;
  checkOut?: string;
  [key: string]: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse webhook payload
    const payload: CloudbedsWebhookPayload = await req.json();
    
    console.log("Webhook received:", {
      event: payload.event,
      reservationID: payload.reservationID,
      propertyID: payload.propertyID,
    });

    // Filter: Only process new reservations
    if (payload.event !== "new_reservation") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${payload.event} ignored (not new_reservation)` 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    // Validate required fields
    if (!payload.reservationID || !payload.propertyID) {
      throw new Error("Missing required fields: reservationID or propertyID");
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate guest token
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      "generate_guest_token",
      {
        p_reservation_id: payload.reservationID,
        p_property_id: payload.propertyID,
        p_guest_email: payload.guestEmail || null,
        p_guest_name: payload.guestName || null,
        p_check_in_date: payload.checkIn || null,
        p_check_out_date: payload.checkOut || null,
        p_expires_days: 90, // Token valide 90 jours
      }
    );

    if (tokenError) {
      throw new Error(`Token generation failed: ${tokenError.message}`);
    }

    if (!tokenData || !tokenData.success) {
      throw new Error(`Token generation returned error: ${JSON.stringify(tokenData)}`);
    }

    console.log("Token generated:", {
      reservationID: payload.reservationID,
      tokenId: tokenData.token_id,
      url: tokenData.url,
    });

    // Inject token into Cloudbeds custom field
    const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY")!;
    
    const cloudbedsResponse = await fetch(
      `https://api.cloudbeds.com/api/v1.3/putReservation?propertyID=${payload.propertyID}`,
      {
        method: "PUT",
        headers: {
          "x-api-key": cloudbedsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationID: payload.reservationID,
          customFields: [
            {
              customFieldName: "guest_app_token",
              customFieldValue: tokenData.token,
            },
          ],
        }),
      }
    );

    if (!cloudbedsResponse.ok) {
      const errorText = await cloudbedsResponse.text();
      console.error("Failed to inject token in Cloudbeds:", errorText);
      // Continue anyway - token is in Supabase
    } else {
      console.log("Token injected in Cloudbeds custom field");
    }

    // TODO: Send email/SMS to guest with token URL
    // await sendGuestEmail(payload.guestEmail, tokenData.url);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token generated successfully",
        data: {
          reservationID: payload.reservationID,
          tokenId: tokenData.token_id,
          url: tokenData.url,
          expiresAt: tokenData.expires_at,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
