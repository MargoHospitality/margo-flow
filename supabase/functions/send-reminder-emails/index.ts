import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const translations = {
  en: {
    subject: 'Reminder: Your Transport Tomorrow - Margo Flow',
    title: 'Transport Reminder',
    subtitle: 'Your transfer is scheduled for tomorrow.',
    greeting: 'Dear',
    reminderText: 'This is a friendly reminder that your transport is scheduled for tomorrow.',
    property: 'Property',
    transportType: 'Transport Type',
    date: 'Date',
    time: 'Pickup Time',
    flightTrain: 'Flight / Train Number',
    paymentMethod: 'Payment Method',
    paymentAtRiad: 'Payment at Property',
    paymentToDriver: 'Cash to the Driver',
    price: 'Price',
    importantNote: 'Important: Please be ready 10 minutes before the scheduled pickup time.',
    contactSection: 'If you need to make any changes, please contact the property:',
    footer: 'This email was sent by Margo Flow – Transfer Management System',
    copyright: '© 2025 Margo Hospitality',
  },
  fr: {
    subject: 'Rappel : Votre Transport Demain - Margo Flow',
    title: 'Rappel de Transport',
    subtitle: 'Votre transfert est prévu pour demain.',
    greeting: 'Cher(e)',
    reminderText: 'Ceci est un rappel que votre transport est prévu pour demain.',
    property: 'Propriété',
    transportType: 'Type de Transport',
    date: 'Date',
    time: 'Heure de Prise en Charge',
    flightTrain: 'Numéro de Vol / Train',
    paymentMethod: 'Mode de Paiement',
    paymentAtRiad: 'Paiement à la Propriété',
    paymentToDriver: 'Espèces au Chauffeur',
    price: 'Prix',
    importantNote: 'Important : Veuillez être prêt(e) 10 minutes avant l\'heure de prise en charge.',
    contactSection: 'Si vous devez effectuer des modifications, veuillez contacter la propriété :',
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

function buildReminderEmailHtml(
  data: {
    guestName: string;
    propertyName: string;
    transportType: string;
    transportDate: string;
    transportTime: string;
    payloadDetails?: Record<string, string>;
    paymentMode: string;
    price: number;
    isFreeTransfer?: boolean;
    managerEmail?: string;
    managerWhatsapp?: string;
  },
  t: typeof translations.en
): string {
  const paymentModeText = data.isFreeTransfer ? t.paymentAtRiad : (data.paymentMode === 'at_riad' ? t.paymentAtRiad : t.paymentToDriver);
  const whatsappLink = data.managerWhatsapp 
    ? `https://wa.me/${data.managerWhatsapp.replace(/\D/g, '')}`
    : null;

  // Build transport details rows from payloadDetails
  const transportDetailsHtml = Object.entries(data.payloadDetails || {})
    .filter(([key, value]) => !['guest_email', 'guest_whatsapp', 'language'].includes(key) && value && value.trim())
    .map(([key, value]) => `
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
          
          <!-- Reminder Banner -->
          <tr>
            <td style="background-color: #fef3c7; padding: 20px 40px; text-align: center; border-bottom: 1px solid #fcd34d;">
              <span style="display: inline-block; width: 48px; height: 48px; background-color: #f59e0b; border-radius: 50%; line-height: 48px; color: white; font-size: 24px; margin-bottom: 8px;">🔔</span>
              <h2 style="color: #92400e; margin: 8px 0 0 0; font-size: 20px; font-weight: 600;">${t.title}</h2>
              <p style="color: #b45309; margin: 4px 0 0 0; font-size: 14px;">${t.subtitle}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${t.greeting} ${data.guestName},<br><br>
                ${t.reminderText}
              </p>
              
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
                          <span style="color: #92400e; font-size: 13px; font-weight: 600;">${t.time}</span><br>
                          <span style="color: #92400e; font-size: 18px; font-weight: 700;">${data.transportTime}</span>
                        </td>
                      </tr>
                      ${transportDetailsHtml}
                      ${!data.isFreeTransfer ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.paymentMethod}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 600;">${paymentModeText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 13px;">${t.price}</span><br>
                          <span style="color: #0F4C5C; font-size: 24px; font-weight: 700;">${data.price} MAD</span>
                        </td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="padding: 8px 0; background-color: #ecfdf5;">
                          <span style="color: #059669; font-size: 13px;">🎁 ${t.paymentMethod}</span><br>
                          <span style="color: #059669; font-size: 18px; font-weight: 700;">Complimentary Transfer</span>
                        </td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Important Note -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="color: #991b1b; margin: 0; font-size: 14px; font-weight: 500;">${t.importantNote}</p>
              </div>
              
              ${(data.managerEmail || whatsappLink) ? `
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px;">
                <p style="color: #1e40af; margin: 0 0 12px 0; font-size: 14px;">${t.contactSection}</p>
                <table cellpadding="0" cellspacing="0">
                  ${data.managerEmail ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="mailto:${data.managerEmail}" style="color: #2563eb; text-decoration: none; font-size: 14px;">📧 ${data.managerEmail}</a>
                    </td>
                  </tr>
                  ` : ''}
                  ${whatsappLink ? `
                  <tr>
                    <td style="padding: 4px 0;">
                      <a href="${whatsappLink}" style="color: #2563eb; text-decoration: none; font-size: 14px;">💬 ${data.managerWhatsapp}</a>
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
    recipientEmail: string;
    status: string;
    errorMessage?: string;
    providerMessageId?: string;
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
      });

    if (error) {
      console.error("[send-reminder-emails] Failed to log notification:", error);
    }
  } catch (err) {
    console.error("[send-reminder-emails] Error logging:", err);
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
    console.log("[send-reminder-emails] Starting 48h reminder job...");

    // Calculate date range: transports happening in ~48 hours (tomorrow)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get confirmed transport requests for tomorrow that haven't received a reminder
    const { data: requests, error: fetchError } = await supabase
      .from("transport_requests")
      .select(`
        id,
        reservation_id,
        transport_date,
        transport_time,
        pax,
        computed_price,
        payment_mode,
        guest_comment,
        payload_details,
        is_free_transfer,
        riad:riads!transport_requests_riad_id_fkey (
          name,
          manager_email,
          manager_whatsapp
        ),
        offer:transport_offers!transport_requests_transport_offer_id_fkey (
          name,
          name_fr
        ),
        reservation:reservations!transport_requests_reservation_id_fkey (
          guest_first_name,
          guest_last_name
        )
      `)
      .eq("status", "confirmed")
      .eq("transport_date", tomorrowStr);

    if (fetchError) {
      console.error("[send-reminder-emails] Error fetching requests:", fetchError);
      throw fetchError;
    }

    console.log(`[send-reminder-emails] Found ${requests?.length || 0} confirmed transports for ${tomorrowStr}`);

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No reminders to send" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check which requests already have a reminder sent
    const requestIds = requests.map(r => r.id);
    const { data: existingReminders } = await supabase
      .from("notification_attempts")
      .select("transport_request_id")
      .in("transport_request_id", requestIds)
      .eq("notification_type", "client_reminder")
      .eq("status", "sent");

    const alreadySentIds = new Set(existingReminders?.map(r => r.transport_request_id) || []);
    const requestsToRemind = requests.filter(r => !alreadySentIds.has(r.id));

    console.log(`[send-reminder-emails] ${requestsToRemind.length} reminders to send (${alreadySentIds.size} already sent)`);

    let sent = 0;
    let failed = 0;

    for (const request of requestsToRemind) {
      // Get guest email from Cloudbeds data in reservation
      const { data: reservation } = await supabase
        .from("reservations")
        .select("cloudbeds_raw")
        .eq("reservation_id", request.reservation_id)
        .single();

      const guestEmail = reservation?.cloudbeds_raw?.guestEmail;
      if (!guestEmail) {
        console.log(`[send-reminder-emails] No email for request ${request.id}, skipping`);
        continue;
      }

      // Determine language from payload_details or default to English
      const language = (request.payload_details as any)?.language || 'en';
      const t = translations[language as keyof typeof translations] || translations.en;

      const res = request.reservation as any;
      const riad = request.riad as any;
      const offer = request.offer as any;
      
      const guestName = `${res?.guest_first_name || ''} ${res?.guest_last_name || ''}`.trim();
      const transportType = language === 'fr' 
        ? (offer?.name_fr || offer?.name || 'Transport')
        : (offer?.name || 'Transport');

      try {
        const emailHtml = buildReminderEmailHtml(
          {
            guestName,
            propertyName: riad?.name || 'Property',
            transportType,
            transportDate: request.transport_date,
            transportTime: request.transport_time,
            payloadDetails: request.payload_details as Record<string, string>,
            paymentMode: request.payment_mode,
            price: request.computed_price,
            isFreeTransfer: (request as any).is_free_transfer,
            managerEmail: riad?.manager_email,
            managerWhatsapp: riad?.manager_whatsapp,
          },
          t
        );

        const emailResponse = await sendEmail(
          [guestEmail],
          `${t.subject} (#${request.reservation_id})`,
          emailHtml
        );

        await logNotificationAttempt(supabase, {
          transportRequestId: request.id,
          notificationType: "client_reminder",
          channel: "email",
          recipientEmail: guestEmail,
          status: "sent",
          providerMessageId: emailResponse.id,
        });

        sent++;
        console.log(`[send-reminder-emails] Sent reminder to ${guestEmail} for request ${request.id}`);
      } catch (err: any) {
        console.error(`[send-reminder-emails] Failed to send reminder for ${request.id}:`, err);
        
        await logNotificationAttempt(supabase, {
          transportRequestId: request.id,
          notificationType: "client_reminder",
          channel: "email",
          recipientEmail: guestEmail,
          status: "failed",
          errorMessage: err.message,
        });

        failed++;
      }
    }

    console.log(`[send-reminder-emails] Complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-reminder-emails] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
