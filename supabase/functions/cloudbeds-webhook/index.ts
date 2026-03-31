// Edge Function: Cloudbeds Webhook Handler
// Description: Écoute les webhooks Cloudbeds, importe réservations + génère tokens
// Events: reservation/created, reservation/dates_changed, reservation/status_changed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CloudbedsWebhookPayload {
  event: string;
  reservationID: string;
  propertyID: string | number;
  propertyID_str?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
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

    // Filter: Only process relevant reservation events
    const validEvents = [
      "reservation/created",
      "reservation/dates_changed",
      "reservation/status_changed",
    ];
    
    if (!validEvents.includes(payload.event)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${payload.event} ignored (not in ${validEvents.join(", ")})` 
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

    // Fetch full reservation details from Cloudbeds API
    const cloudbedsApiKey = Deno.env.get("CLOUDBEDS_API_KEY")!;
    const reservationResponse = await fetch(
      `https://api.cloudbeds.com/api/v1.2/getReservation?reservationID=${payload.reservationID}&propertyID=${payload.propertyID}`,
      {
        headers: {
          "Authorization": `Bearer ${cloudbedsApiKey}`,
        },
      }
    );

    if (!reservationResponse.ok) {
      throw new Error(`Failed to fetch reservation from Cloudbeds: ${reservationResponse.statusText}`);
    }

    const reservationData = await reservationResponse.json();
    if (!reservationData.success || !reservationData.data) {
      throw new Error(`Invalid reservation data from Cloudbeds: ${JSON.stringify(reservationData)}`);
    }

    const reservation = reservationData.data;
    
    // Extract guest info from guestList (main guest)
    let guestFirstName = null;
    let guestLastName = "Guest";
    let guestEmail = reservation.guestEmail || null;
    let guestCountry = null;
    
    if (reservation.guestList && typeof reservation.guestList === 'object') {
      const mainGuest = Object.values(reservation.guestList).find((g: any) => g.isMainGuest);
      if (mainGuest) {
        guestFirstName = (mainGuest as any).guestFirstName || null;
        guestLastName = (mainGuest as any).guestLastName || "Guest";
        guestEmail = (mainGuest as any).guestEmail || guestEmail;
        guestCountry = (mainGuest as any).guestCountry || null;
      }
    }
    
    const guestName = guestFirstName ? `${guestFirstName} ${guestLastName}` : guestLastName;

    // Lookup riad by property_id
    const { data: riadData } = await supabase
      .from('riads')
      .select('id')
      .eq('cloudbeds_property_id', String(payload.propertyID))
      .single();

    // Upsert reservation into database
    const reservationToUpsert = {
      reservation_id: payload.reservationID,
      property_id: String(payload.propertyID),
      riad_id: riadData?.id || null,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_country_code: guestCountry || null,
      check_in_date: reservation.startDate,
      check_out_date: reservation.endDate,
      nights: null, // Not directly available in API response
      status: reservation.status || 'confirmed',
      source: reservation.source || null,
      cloudbeds_raw: reservation,
      updated_at: new Date().toISOString(),
    };

    console.log("Upserting reservation:", {
      reservation_id: reservationToUpsert.reservation_id,
      property_id: reservationToUpsert.property_id,
      riad_id: reservationToUpsert.riad_id,
      guest_name: `${guestFirstName} ${guestLastName}`,
    });

    const { data: upsertData, error: upsertError } = await supabase
      .from('reservations')
      .upsert(reservationToUpsert, {
        onConflict: 'reservation_id',
        ignoreDuplicates: false,
      })
      .select();

    if (upsertError) {
      console.error("Failed to upsert reservation:", upsertError);
      throw new Error(`Reservation upsert failed: ${upsertError.message}`);
    } else {
      console.log("Reservation imported/updated in database:", upsertData);
    }

    // Generate token only for new reservations
    if (payload.event === "reservation/created") {
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        "generate_guest_token",
        {
          p_reservation_id: payload.reservationID,
          p_property_id: String(payload.propertyID),
          p_guest_email: guestEmail,
          p_guest_name: guestName,
          p_check_in_date: reservation.startDate || null,
          p_check_out_date: reservation.endDate || null,
          p_expires_days: 90,
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
      const cloudbedsUpdateResponse = await fetch(
        `https://api.cloudbeds.com/api/v1.3/putReservation?propertyID=${payload.propertyID}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${cloudbedsApiKey}`,
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

      if (!cloudbedsUpdateResponse.ok) {
        const errorText = await cloudbedsUpdateResponse.text();
        console.error("Failed to inject token in Cloudbeds:", errorText);
      } else {
        console.log("Token injected in Cloudbeds custom field");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Reservation imported and token generated",
          data: {
            reservationID: payload.reservationID,
            tokenId: tokenData.token_id,
            url: tokenData.url,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // For status_changed: revoke token + cancel transport if cancelled
      if (payload.event === "reservation/status_changed" && 
          (payload.status === "canceled" || payload.status === "cancelled")) {
        
        // 1. Get token for this reservation
        const { data: tokenData } = await supabase
          .from('guest_tokens')
          .select('token')
          .eq('reservation_id', payload.reservationID)
          .eq('property_id', String(payload.propertyID))
          .single();

        if (tokenData?.token) {
          // Revoke guest token
          const { error: revokeError } = await supabase.rpc(
            "revoke_guest_token",
            {
              p_token: tokenData.token,
              p_reason: "Reservation cancelled"
            }
          );

          if (revokeError) {
            console.error("Failed to revoke token:", revokeError);
          } else {
            console.log("Token revoked due to cancellation");
          }
        }

        // 2. Cancel transport request (if exists)
        const { data: transportData, error: transportError } = await supabase
          .from('transport_requests')
          .update({ 
            status: 'canceled_due_to_reservation',
            updated_at: new Date().toISOString()
          })
          .eq('reservation_id', payload.reservationID)
          .select();

        if (transportError) {
          console.error("Failed to cancel transport request:", transportError);
        } else if (transportData && transportData.length > 0) {
          console.log("Transport request cancelled:", transportData[0].id);
        }

        // 3. Mark check-in response as cancelled (if exists)
        const { data: checkinData, error: checkinError } = await supabase
          .from('checkin_responses')
          .update({
            synced_to_cloudbeds: false,
            cloudbeds_sync_error: 'Reservation cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('reservation_id', payload.reservationID)
          .select();

        if (checkinError) {
          console.error("Failed to update check-in response:", checkinError);
        } else if (checkinData && checkinData.length > 0) {
          console.log("Check-in response marked as cancelled:", checkinData[0].id);
        }
      }

      // For other events (dates_changed, status_changed), just update the reservation
      return new Response(
        JSON.stringify({
          success: true,
          message: `Reservation updated for event ${payload.event}`,
          data: {
            reservationID: payload.reservationID,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
