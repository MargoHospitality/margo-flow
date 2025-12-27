import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyManagerRequest {
  transportRequestId: string;
  reservationId: string;
  propertyName: string;
  guestName: string;
  transportType: string;
  transportDate: string;
  transportTime: string;
  flightTrainNumber?: string;
  guestComment?: string;
  managerEmail: string;
  managerPhone?: string; // WhatsApp number in E.164 format
  appUrl: string;
  isUrgent: boolean; // True if transport is within 48 hours
}

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Margo Flow <flow@margo-hospitality.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return res.json();
}

function buildManagerEmailHtml(data: NotifyManagerRequest, isUrgent: boolean): string {
  const reviewUrl = `${data.appUrl}/backoffice`;
  const urgentBanner = isUrgent ? `
    <tr>
      <td style="background-color: #fef2f2; padding: 16px 40px; text-align: center; border-bottom: 1px solid #fecaca;">
        <span style="color: #dc2626; font-size: 14px; font-weight: 600;">⚠️ URGENT: Transport within 48 hours</span>
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Transport Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F4C5C 0%, #1a6b7a 100%); padding: 32px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Margo Flow</h1>
            </td>
          </tr>
          
          ${urgentBanner}
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0F4C5C; margin: 0 0 8px 0; font-size: 22px; font-weight: 600;">New Transport Request</h2>
              <p style="color: #6b7280; margin: 0 0 32px 0; font-size: 16px;">A guest has submitted a transport request.</p>
              
              <!-- Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Reservation ID</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">#${data.reservationId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Guest Name</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.guestName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Transport Type</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Date</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.transportDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;${data.flightTrainNumber || data.guestComment ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
                          <span style="color: #6b7280; font-size: 14px;">Arrival Time</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.transportTime}</span>
                        </td>
                      </tr>
                      ${data.flightTrainNumber ? `
                      <tr>
                        <td style="padding: 8px 0;${data.guestComment ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
                          <span style="color: #6b7280; font-size: 14px;">Flight / Train Number</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.flightTrainNumber}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.guestComment ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Guest Comment</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.guestComment}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #0F4C5C 0%, #1a6b7a 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(15, 76, 92, 0.3);">
                      Review &amp; confirm in Margo Flow
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                This email was sent by Margo Flow – Transfer Management System<br>
                © 2025 Margo Hospitality
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function logNotificationAttempt(
  supabase: any,
  data: {
    transportRequestId: string;
    notificationType: string;
    channel: string;
    recipientPhone?: string;
    recipientEmail?: string;
    templateSid?: string;
    status: string;
    errorMessage?: string;
    providerMessageId?: string;
    isFallback: boolean;
    metadata?: Record<string, any>;
  }
) {
  try {
    const { error } = await supabase
      .from("notification_attempts")
      .insert({
        transport_request_id: data.transportRequestId,
        notification_type: data.notificationType,
        channel: data.channel,
        recipient_phone: data.recipientPhone,
        recipient_email: data.recipientEmail,
        template_sid: data.templateSid,
        status: data.status,
        error_message: data.errorMessage,
        provider_message_id: data.providerMessageId,
        is_fallback: data.isFallback,
        metadata: data.metadata || {},
      });

    if (error) {
      console.error("[notify-manager] Failed to log notification attempt:", error);
    }
  } catch (err) {
    console.error("[notify-manager] Error logging notification:", err);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: NotifyManagerRequest = await req.json();
    console.log("[notify-manager] Processing notification for:", data.reservationId, "isUrgent:", data.isUrgent);

    // Check if WhatsApp is enabled for this property
    const { data: riad } = await supabase
      .from("riads")
      .select("whatsapp_enabled")
      .eq("name", data.propertyName)
      .single();

    const whatsappEnabled = riad?.whatsapp_enabled ?? false;
    const notificationType = data.isUrgent ? "manager_urgent" : "manager_new_request";
    
    let whatsappSuccess = false;
    let emailSuccess = false;

    // Step 1: For urgent requests, try WhatsApp first (if enabled and phone provided)
    if (data.isUrgent && whatsappEnabled && data.managerPhone) {
      console.log("[notify-manager] Attempting WhatsApp for urgent request...");
      
      // Format arrival date/time for WhatsApp template
      const arrivalDateTime = `${data.transportDate} at ${data.transportTime}`;
      
      // Build authenticated backoffice link
      const backofficeLink = `${data.appUrl}/backoffice`;

      try {
        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: data.managerPhone,
            templateKey: "manager_last_minute_en",
            variables: {
              guestName: data.guestName,
              propertyName: data.propertyName,
              arrivalDateTime,
              link: backofficeLink,
            },
            transportRequestId: data.transportRequestId,
            notificationType: "manager_urgent",
            isFallback: false,
          }),
        });

        const whatsappResult = await whatsappResponse.json();
        whatsappSuccess = whatsappResult.success === true;
        
        if (!whatsappSuccess) {
          console.log("[notify-manager] WhatsApp failed, will fallback to email:", whatsappResult.error);
        }
      } catch (err) {
        console.error("[notify-manager] WhatsApp request failed:", err);
      }
    }

    // Step 2: Send email (always for non-urgent, or as fallback for urgent)
    if (!whatsappSuccess) {
      console.log("[notify-manager] Sending email notification...");
      
      try {
        const emailHtml = buildManagerEmailHtml(data, data.isUrgent);
        const subject = data.isUrgent 
          ? `🚨 URGENT: New Transport Request (#${data.reservationId})`
          : `New Transport Request from Margo Flow (#${data.reservationId})`;
        
        const emailResponse = await sendEmail([data.managerEmail], subject, emailHtml);
        emailSuccess = true;

        // Log email attempt
        await logNotificationAttempt(supabase, {
          transportRequestId: data.transportRequestId,
          notificationType,
          channel: "email",
          recipientEmail: data.managerEmail,
          status: "sent",
          providerMessageId: emailResponse.id,
          isFallback: data.isUrgent && whatsappEnabled && data.managerPhone ? true : false,
          metadata: { isUrgent: data.isUrgent },
        });

        console.log("[notify-manager] Email sent successfully:", emailResponse.id);
      } catch (emailErr: any) {
        console.error("[notify-manager] Email failed:", emailErr);
        
        await logNotificationAttempt(supabase, {
          transportRequestId: data.transportRequestId,
          notificationType,
          channel: "email",
          recipientEmail: data.managerEmail,
          status: "failed",
          errorMessage: emailErr.message,
          isFallback: data.isUrgent && whatsappEnabled && data.managerPhone ? true : false,
          metadata: { isUrgent: data.isUrgent },
        });
      }
    }

    const success = whatsappSuccess || emailSuccess;

    return new Response(
      JSON.stringify({ 
        success,
        whatsappSent: whatsappSuccess,
        emailSent: emailSuccess && !whatsappSuccess,
        isUrgent: data.isUrgent,
      }),
      { status: success ? 200 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[notify-manager] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
