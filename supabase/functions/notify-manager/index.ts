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
  riadId: string; // Used to fetch manager contact info securely
  propertyName: string;
  guestName: string;
  transportType: string;
  transportDate: string;
  transportTime: string;
  payloadDetails?: Record<string, string>; // All dynamic fields
  guestComment?: string;
  appUrl: string;
  isUrgent: boolean; // True if transport is within 48 hours
  isFreeTransfer?: boolean; // True if guest selected complimentary transfer
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
              <span style="color: #dc2626; font-size: 14px; font-weight: 600;">⚠️ URGENT – Transport within 48 hours</span>
            </td>
          </tr>` : '';
  
  const freeTransferBanner = data.isFreeTransfer ? `
          <tr>
            <td style="background-color: #ecfdf5; padding: 16px 40px; text-align: center; border-bottom: 1px solid #a7f3d0;">
              <span style="color: #059669; font-size: 14px; font-weight: 600;">🎁 Complimentary transfer requested</span>
            </td>
          </tr>` : '';

  // Build transport details rows from payloadDetails
  const transportDetailsHtml = Object.entries(data.payloadDetails || {})
    .filter(([key, value]) => value && value.trim())
    .map(([key, value]) => `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px; text-transform: capitalize;">${key.replace(/_/g, ' ')}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${value}</span>
                        </td>
                      </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Transport Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
          <!-- White Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://fnbqegolwitkgjmlesbc.supabase.co/storage/v1/object/public/assets/margoflow-logo.png" alt="Margo Flow" style="height: 40px; width: auto;" />
            </td>
          </tr>
          ${urgentBanner}
          ${freeTransferBanner}
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0F4C5C; margin: 0 0 24px 0; font-size: 20px; font-weight: 600;">New Transport Request</h2>
              
              <!-- Info Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Property</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Reservation ID</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.reservationId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Guest</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.guestName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Transport Type</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Date</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Time</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportTime}</span>
                        </td>
                      </tr>
                      ${transportDetailsHtml}${data.guestComment ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 13px;">Comment</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.guestComment}</span>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${reviewUrl}" style="display: inline-block; background-color: #0F4C5C; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Review in Margo Flow
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Margo Flow – Transfer Management<br>
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

    // Fetch manager contact info securely using service role
    const { data: riad, error: riadError } = await supabase
      .from("riads")
      .select("manager_email, manager_whatsapp, whatsapp_enabled")
      .eq("id", data.riadId)
      .single();

    if (riadError || !riad) {
      console.error("[notify-manager] Failed to fetch riad:", riadError);
      return new Response(
        JSON.stringify({ error: "Riad not found", success: false }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!riad.manager_email) {
      console.error("[notify-manager] No manager email configured for riad:", data.riadId);
      return new Response(
        JSON.stringify({ error: "No manager email configured", success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const managerEmail = riad.manager_email;
    const managerPhone = riad.manager_whatsapp;
    const whatsappEnabled = riad.whatsapp_enabled ?? false;
    const notificationType = data.isUrgent ? "manager_urgent" : "manager_new_request";
    
    let whatsappSuccess = false;
    let emailSuccess = false;

    // Step 1: For urgent requests, try WhatsApp first (if enabled and phone provided)
    if (data.isUrgent && whatsappEnabled && managerPhone) {
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
            to: managerPhone,
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
        // Build email data with manager contact info
        const emailData = {
          ...data,
          managerEmail,
          managerPhone,
        };
        const emailHtml = buildManagerEmailHtml(emailData as any, data.isUrgent);
        const subject = data.isUrgent 
          ? `🚨 URGENT: New Transport Request (#${data.reservationId})`
          : `New Transport Request from Margo Flow (#${data.reservationId})`;
        
        const emailResponse = await sendEmail([managerEmail], subject, emailHtml);
        emailSuccess = true;

        // Log email attempt
        await logNotificationAttempt(supabase, {
          transportRequestId: data.transportRequestId,
          notificationType,
          channel: "email",
          recipientEmail: managerEmail,
          status: "sent",
          providerMessageId: emailResponse.id,
          isFallback: data.isUrgent && whatsappEnabled && managerPhone ? true : false,
          metadata: { isUrgent: data.isUrgent },
        });

        console.log("[notify-manager] Email sent successfully:", emailResponse.id);
      } catch (emailErr: any) {
        console.error("[notify-manager] Email failed:", emailErr);
        
        await logNotificationAttempt(supabase, {
          transportRequestId: data.transportRequestId,
          notificationType,
          channel: "email",
          recipientEmail: managerEmail,
          status: "failed",
          errorMessage: emailErr.message,
          isFallback: data.isUrgent && whatsappEnabled && managerPhone ? true : false,
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
