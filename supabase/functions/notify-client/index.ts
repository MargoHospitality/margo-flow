import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyClientRequest {
  transportRequestId: string;
  language: 'en' | 'fr';
  guestName: string;
  guestEmail: string;
  guestPhone?: string; // WhatsApp number in E.164 format
  propertyName: string;
  reservationId: string;
  transportType: string;
  transportDate: string;
  transportTime: string;
  payloadDetails?: Record<string, string>; // All dynamic fields
  guestComment?: string;
  paymentMode: 'at_riad' | 'to_driver';
  price: number;
  managerEmail?: string;
  managerWhatsapp?: string;
  confirmationToken?: string; // For public confirmation link
  isFreeTransfer?: boolean; // True if complimentary transfer
}

const translations = {
  en: {
    subject: 'Your Transport is Confirmed! - Margo Flow',
    title: 'Transport Confirmed',
    subtitle: 'Your transfer has been confirmed by the property.',
    property: 'Property',
    reservationId: 'Reservation ID',
    transportType: 'Transport Type',
    date: 'Date',
    arrivalTime: 'Arrival Time',
    flightTrain: 'Flight / Train Number',
    comment: 'Your Comment',
    paymentMethod: 'Payment Method',
    paymentAtRiad: 'Payment at Property',
    paymentToDriver: 'Cash to the Driver',
    paymentComplimentary: 'Complimentary Transfer',
    totalPrice: 'Total Price',
    contactSection: 'If needed, you can contact the property manager directly:',
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    footer: 'This email was sent by Margo Flow – Transfer Management System',
    copyright: '© 2025 Margo Hospitality',
  },
  fr: {
    subject: 'Votre Transport est Confirmé ! - Margo Flow',
    title: 'Transport Confirmé',
    subtitle: 'Votre transfert a été confirmé par la propriété.',
    property: 'Propriété',
    reservationId: 'Numéro de Réservation',
    transportType: 'Type de Transport',
    date: 'Date',
    arrivalTime: "Heure d'Arrivée",
    flightTrain: 'Numéro de Vol / Train',
    comment: 'Votre Commentaire',
    paymentMethod: 'Mode de Paiement',
    paymentAtRiad: 'Paiement à la Propriété',
    paymentToDriver: 'Espèces au Chauffeur',
    paymentComplimentary: 'Transfert Offert',
    totalPrice: 'Prix Total',
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

function buildConfirmationEmailHtml(data: NotifyClientRequest, t: typeof translations.en): string {
  const paymentModeText = data.isFreeTransfer ? t.paymentComplimentary : (data.paymentMode === 'at_riad' ? t.paymentAtRiad : t.paymentToDriver);
  const whatsappLink = data.managerWhatsapp 
    ? `https://wa.me/${data.managerWhatsapp.replace(/\D/g, '')}`
    : null;

  // Get all transport-specific fields (exclude contact info)
  const transportFields = Object.entries(data.payloadDetails || {})
    .filter(([key]) => !['guest_email', 'guest_whatsapp'].includes(key))
    .filter(([, value]) => value && value.trim());

  // Build transport details rows
  const transportDetailsHtml = transportFields.map(([key, value]) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #6b7280; font-size: 13px; text-transform: capitalize;">${key.replace(/_/g, ' ')}</span><br>
        <span style="color: #111827; font-size: 15px; font-weight: 500;">${value}</span>
      </td>
    </tr>
  `).join('');

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
              <img src="https://fnbqegolwitkgjmlesbc.supabase.co/storage/v1/object/public/assets/margoflow-logo.png" alt="Margo Flow" style="height: 40px; width: auto;" />
            </td>
          </tr>
          
          <!-- Success Banner -->
          <tr>
            <td style="background-color: #ecfdf5; padding: 20px 40px; text-align: center; border-bottom: 1px solid #d1fae5;">
              <span style="display: inline-block; width: 48px; height: 48px; background-color: #10b981; border-radius: 50%; line-height: 48px; color: white; font-size: 24px; margin-bottom: 8px;">✓</span>
              <h2 style="color: #065f46; margin: 8px 0 0 0; font-size: 20px; font-weight: 600;">${t.title}</h2>
              <p style="color: #047857; margin: 4px 0 0 0; font-size: 14px;">${t.subtitle}</p>
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
                          <span style="color: #6b7280; font-size: 13px;">${t.transportType}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.date}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.transportDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; background-color: #fef3c7;">
                          <span style="color: #92400e; font-size: 13px; font-weight: 600;">${t.arrivalTime}</span><br>
                          <span style="color: #92400e; font-size: 18px; font-weight: 700;">${data.transportTime}</span>
                        </td>
                      </tr>
                      ${transportDetailsHtml}
                      ${data.guestComment ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.comment}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${data.guestComment}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${!data.isFreeTransfer ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.paymentMethod}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 600;">${paymentModeText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 13px;">${t.totalPrice}</span><br>
                          <span style="color: #0F4C5C; font-size: 24px; font-weight: 700;">${data.price} MAD</span>
                        </td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="padding: 8px 0; background-color: #ecfdf5;">
                          <span style="color: #059669; font-size: 13px;">🎁 ${t.paymentMethod}</span><br>
                          <span style="color: #059669; font-size: 18px; font-weight: 700;">${paymentModeText}</span>
                        </td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${(data.managerEmail || whatsappLink) ? `
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-top: 24px;">
                <p style="color: #1e40af; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">${t.contactSection}</p>
                <table cellpadding="0" cellspacing="0">
                  ${data.managerEmail ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="mailto:${data.managerEmail}" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500;">📧 ${t.contactEmail}: ${data.managerEmail}</a>
                    </td>
                  </tr>
                  ` : ''}
                  ${whatsappLink ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="${whatsappLink}" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500;">💬 ${t.contactWhatsapp}: ${data.managerWhatsapp}</a>
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
      console.error("[notify-client] Failed to log notification attempt:", error);
    }
  } catch (err) {
    console.error("[notify-client] Error logging notification:", err);
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
    const data: NotifyClientRequest = await req.json();
    console.log("[notify-client] Processing confirmation for:", data.reservationId);

    const t = translations[data.language] || translations.en;
    let whatsappSuccess = false;
    let emailSuccess = false;

    // Fetch the public_token for this transport request
    let publicToken: string | null = null;
    if (data.transportRequestId) {
      const { data: trData, error: trError } = await supabase
        .from("transport_requests")
        .select("public_token")
        .eq("id", data.transportRequestId)
        .single();
      
      if (trError) {
        console.error("[notify-client] Error fetching public_token:", trError);
      } else {
        publicToken = trData?.public_token;
        console.log("[notify-client] Fetched public_token:", publicToken);
      }
    }

    // Check if WhatsApp is enabled for this property
    const { data: riad } = await supabase
      .from("riads")
      .select("whatsapp_enabled")
      .eq("name", data.propertyName)
      .single();

    const whatsappEnabled = riad?.whatsapp_enabled ?? false;

    // BELT AND SUSPENDERS: Always send email for client confirmations
    // WhatsApp delivery cannot be reliably confirmed (Twilio returns "queued" even for non-WhatsApp numbers)
    // Email guarantees the client receives confirmation; WhatsApp is a bonus channel
    
    // Step 1: Always send email first (guaranteed delivery)
    console.log("[notify-client] Sending email confirmation (primary channel)...");
    
    try {
      const emailHtml = buildConfirmationEmailHtml(data, t);
      const emailResponse = await sendEmail([data.guestEmail], `${t.subject} (#${data.reservationId})`, emailHtml);
      emailSuccess = true;

      // Log email attempt
      await logNotificationAttempt(supabase, {
        transportRequestId: data.transportRequestId,
        notificationType: "client_confirmation",
        channel: "email",
        recipientEmail: data.guestEmail,
        status: "sent",
        providerMessageId: emailResponse.id,
        isFallback: false, // Email is now primary
        metadata: { language: data.language },
      });

      console.log("[notify-client] Email sent successfully:", emailResponse.id);
    } catch (emailErr: any) {
      console.error("[notify-client] Email failed:", emailErr);
      
      await logNotificationAttempt(supabase, {
        transportRequestId: data.transportRequestId,
        notificationType: "client_confirmation",
        channel: "email",
        recipientEmail: data.guestEmail,
        status: "failed",
        errorMessage: emailErr.message,
        isFallback: false,
        metadata: { language: data.language },
      });
    }

    // Step 2: Also send WhatsApp if enabled and phone number provided (bonus channel)
    if (whatsappEnabled && data.guestPhone) {
      console.log("[notify-client] Also sending WhatsApp notification (bonus channel)...");
      
      const templateKey = data.language === 'fr' ? 'client_confirm_fr' : 'client_confirm_en';
      
      // Format arrival date/time for WhatsApp template
      const arrivalDateTime = `${data.transportDate} at ${data.transportTime}`;
      
      // Build public confirmation link (tokenized, read-only for client)
      const publicLink = publicToken 
        ? `https://flow.margo-hospitality.com/confirmation/${publicToken}`
        : `https://flow.margo-hospitality.com`;

      try {
        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: data.guestPhone,
            templateKey,
            variables: {
              guestName: data.guestName,
              propertyName: data.propertyName,
              arrivalDateTime,
              link: publicLink,
            },
            transportRequestId: data.transportRequestId,
            notificationType: "client_confirmation",
            isFallback: false,
          }),
        });

        const whatsappResult = await whatsappResponse.json();
        whatsappSuccess = whatsappResult.success === true;
        
        if (whatsappSuccess) {
          console.log("[notify-client] WhatsApp also sent successfully");
        } else {
          console.log("[notify-client] WhatsApp failed (client already has email):", whatsappResult.error);
        }
      } catch (err) {
        console.error("[notify-client] WhatsApp request failed (client already has email):", err);
      }
    }

    const success = emailSuccess; // Email is now the primary success indicator

    return new Response(
      JSON.stringify({ 
        success,
        emailSent: emailSuccess,
        whatsappSent: whatsappSuccess,
      }),
      { status: success ? 200 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[notify-client] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
