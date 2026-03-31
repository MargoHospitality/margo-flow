import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyCancellationRequest {
  transportRequestId: string;
  reservationId: string;
  propertyId: string; // Cloudbeds property ID (e.g., "9462")
  riadId?: string; // Optional: Internal riad UUID (if provided, takes precedence)
  propertyName: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  transportType: string;
  originalDate: string;
  transportTime?: string; // HH:mm format
  cancelReason: 'reservation_cancelled' | 'reservation_dates_changed' | 'manual_cancellation';
  language: 'en' | 'fr';
  newCheckIn?: string; // Only for dates_changed
  newCheckOut?: string; // Only for dates_changed
  tokenUrl?: string; // Only for dates_changed
}

const translations = {
  en: {
    subject_cancelled: 'Transport Request Cancelled',
    subject_dates_changed: 'Transport Request Cancelled – Reservation Dates Updated',
    subject_manual: 'Transport Request Cancelled',
    title: 'Transport Cancelled',
    subtitle_cancelled: 'Your transport request has been cancelled.',
    subtitle_dates_changed: 'Your transport request has been cancelled due to updated reservation dates.',
    subtitle_manual: 'Your transport request has been cancelled.',
    property: 'Property',
    reservationId: 'Reservation ID',
    transportType: 'Transport Type',
    originalDate: 'Original Date',
    newDates: 'Updated Reservation Dates',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    action_dates_changed: 'If you still need transport for your new dates, please submit a new request:',
    action_button: 'Submit New Request',
    contactSection: 'If needed, you can contact the property manager directly:',
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    footer: 'This email was sent by Margo Flow – Transfer Management System',
    copyright: '© 2025 Margo Hospitality',
  },
  fr: {
    subject_cancelled: 'Demande de Transport Annulée',
    subject_dates_changed: 'Demande de Transport Annulée – Dates de Réservation Modifiées',
    subject_manual: 'Demande de Transport Annulée',
    title: 'Transport Annulé',
    subtitle_cancelled: 'Votre demande de transport a été annulée.',
    subtitle_dates_changed: 'Votre demande de transport a été annulée suite à la modification des dates de votre réservation.',
    subtitle_manual: 'Votre demande de transport a été annulée.',
    property: 'Propriété',
    reservationId: 'Numéro de Réservation',
    transportType: 'Type de Transport',
    originalDate: 'Date Initiale',
    newDates: 'Nouvelles Dates de Réservation',
    checkIn: 'Arrivée',
    checkOut: 'Départ',
    action_dates_changed: 'Si vous avez toujours besoin d\'un transport pour vos nouvelles dates, veuillez soumettre une nouvelle demande :',
    action_button: 'Soumettre une Nouvelle Demande',
    contactSection: "Si besoin, vous pouvez contacter le responsable de la propriété:",
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    footer: 'Cet email a été envoyé par Margo Flow – Système de Gestion des Transferts',
    copyright: '© 2025 Margo Hospitality',
  },
};

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

function buildCancellationEmailHtml(data: NotifyCancellationRequest, t: typeof translations.en, managerEmail?: string, managerWhatsapp?: string): string {
  const whatsappLink = managerWhatsapp 
    ? `https://wa.me/${managerWhatsapp.replace(/\D/g, '')}`
    : null;

  // Select subtitle based on cancel reason
  let subtitle = t.subtitle_cancelled;
  if (data.cancelReason === 'reservation_dates_changed') {
    subtitle = t.subtitle_dates_changed;
  } else if (data.cancelReason === 'manual_cancellation') {
    subtitle = t.subtitle_manual;
  }

  // Use transportTime if provided, otherwise try to parse from originalDate
  const transportTime = data.transportTime || 
    (data.originalDate.includes(' ') 
      ? data.originalDate.split(' ')[1] 
      : data.originalDate.match(/\d{2}:\d{2}/) 
        ? data.originalDate.match(/\d{2}:\d{2}/)[0]
        : '');
  
  const transportDate = data.originalDate.includes(' ')
    ? data.originalDate.split(' ')[0]
    : data.originalDate;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="https://bndrfqfzrolxfmdfqaqa.supabase.co/storage/v1/object/public/assets/margoflow-logo.png" alt="Margo Flow" style="height: 40px; width: auto;" />
            </td>
          </tr>
          
          <!-- Info Banner -->
          <tr>
            <td style="background-color: #fef3c7; padding: 20px 40px; text-align: center; border-bottom: 1px solid #fde68a;">
              <span style="display: inline-block; width: 48px; height: 48px; background-color: #f59e0b; border-radius: 50%; line-height: 48px; color: white; font-size: 24px; margin-bottom: 8px;">ℹ</span>
              <h2 style="color: #92400e; margin: 8px 0 0 0; font-size: 20px; font-weight: 600;">${t.title}</h2>
              <p style="color: #b45309; margin: 4px 0 0 0; font-size: 14px;">${subtitle}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafb; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.property}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.reservationId}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">#${data.reservationId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">Guest Name</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.guestName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.transportType}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.originalDate}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${transportDate}</span>
                        </td>
                      </tr>
                      ${transportTime ? `
                      <tr>
                        <td style="padding: 8px 0; ${data.newCheckIn && data.newCheckOut ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
                          <span style="color: #6b7280; font-size: 13px;">Time</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${transportTime}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.newCheckIn && data.newCheckOut ? `
                      <tr>
                        <td style="padding: 12px 0; background-color: #ecfdf5; border-radius: 8px;">
                          <span style="color: #065f46; font-size: 14px; font-weight: 600; display: block; margin-bottom: 8px;">${t.newDates}</span>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 4px 0;">
                                <span style="color: #059669; font-size: 13px;">${t.checkIn}:</span>
                                <span style="color: #047857; font-size: 15px; font-weight: 600; margin-left: 8px;">${data.newCheckIn}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0;">
                                <span style="color: #059669; font-size: 13px;">${t.checkOut}:</span>
                                <span style="color: #047857; font-size: 15px; font-weight: 600; margin-left: 8px;">${data.newCheckOut}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${data.tokenUrl ? `
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #1e40af; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">${t.action_dates_changed}</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="${data.tokenUrl}" style="display: inline-block; background-color: #0F4C5C; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                        ${t.action_button}
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              ` : ''}
              
              ${(managerEmail || whatsappLink) ? `
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-top: 24px;">
                <p style="color: #1e40af; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">${t.contactSection}</p>
                <table cellpadding="0" cellspacing="0">
                  ${managerEmail ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="mailto:${managerEmail}" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500;">📧 ${t.contactEmail}: ${managerEmail}</a>
                    </td>
                  </tr>
                  ` : ''}
                  ${whatsappLink ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="${whatsappLink}" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500;">💬 ${t.contactWhatsapp}: ${managerWhatsapp}</a>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                ${t.footer}<br>
                ${t.copyright}
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
    recipientEmail?: string;
    status: string;
    errorMessage?: string;
    providerMessageId?: string;
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
        recipient_email: data.recipientEmail,
        status: data.status,
        error_message: data.errorMessage,
        provider_message_id: data.providerMessageId,
        is_fallback: false,
        metadata: data.metadata || {},
      });

    if (error) {
      console.error("[notify-client-cancellation] Failed to log notification attempt:", error);
    }
  } catch (err) {
    console.error("[notify-client-cancellation] Error logging notification:", err);
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
    const data: NotifyCancellationRequest = await req.json();
    console.log("[notify-client-cancellation] Processing for:", data.reservationId, "Reason:", data.cancelReason);

    const t = translations[data.language] || translations.en;
    
    // Fetch manager contact info
    // If riadId (UUID) is provided, use it; otherwise use cloudbeds_property_id
    const { data: riad } = data.riadId
      ? await supabase
          .from("riads")
          .select("manager_email, manager_whatsapp")
          .eq("id", data.riadId)
          .single()
      : await supabase
          .from("riads")
          .select("manager_email, manager_whatsapp")
          .eq("cloudbeds_property_id", data.propertyId)
          .single();

    const managerEmail = riad?.manager_email;
    const managerWhatsapp = riad?.manager_whatsapp;

    // Build subject based on cancel reason
    let subject = t.subject_cancelled;
    if (data.cancelReason === 'reservation_dates_changed') {
      subject = t.subject_dates_changed;
    } else if (data.cancelReason === 'manual_cancellation') {
      subject = t.subject_manual;
    }

    // Send email
    try {
      const emailHtml = buildCancellationEmailHtml(data, t, managerEmail, managerWhatsapp);
      const emailResponse = await sendEmail([data.guestEmail], `${subject} (#${data.reservationId})`, emailHtml);

      await logNotificationAttempt(supabase, {
        transportRequestId: data.transportRequestId,
        notificationType: "client_cancellation",
        channel: "email",
        recipientEmail: data.guestEmail,
        status: "sent",
        providerMessageId: emailResponse.id,
        metadata: { 
          language: data.language,
          cancelReason: data.cancelReason,
        },
      });

      console.log("[notify-client-cancellation] Email sent successfully:", emailResponse.id);

      return new Response(
        JSON.stringify({ success: true, emailSent: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (emailErr: any) {
      console.error("[notify-client-cancellation] Email failed:", emailErr);
      
      await logNotificationAttempt(supabase, {
        transportRequestId: data.transportRequestId,
        notificationType: "client_cancellation",
        channel: "email",
        recipientEmail: data.guestEmail,
        status: "failed",
        errorMessage: emailErr.message,
        metadata: { 
          language: data.language,
          cancelReason: data.cancelReason,
        },
      });

      return new Response(
        JSON.stringify({ success: false, error: emailErr.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("[notify-client-cancellation] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
