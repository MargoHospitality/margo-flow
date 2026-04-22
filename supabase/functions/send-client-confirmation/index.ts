import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MARGOFLOW_EMAIL_LOGO_URL = "https://flow.margo-hospitality.com/email-assets/margoflow-logo.png";

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



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientConfirmationRequest {
  language: 'en' | 'fr';
  reservationId: string;
  propertyName: string;
  guestName: string;
  guestEmail: string;
  transportType: string;
  transportDate: string;
  arrivalTime: string;
  flightTrainNumber?: string;
  guestComment?: string;
  paymentMode: 'at_riad' | 'to_driver';
  price: number;
  managerEmail?: string;
  managerWhatsapp?: string;
}

const translations = {
  en: {
    subject: 'Transport Confirmation from Margo Flow',
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
    totalPrice: 'Total Price',
    contactSection: 'If needed, you can of course contact the property manager directly by email or WhatsApp.',
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    footer: 'This email was sent by Margo Flow – Transfer Management System',
    copyright: '© 2025 Margo Hospitality',
  },
  fr: {
    subject: 'Confirmation de Transport de Margo Flow',
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
    totalPrice: 'Prix Total',
    contactSection: "Si besoin, vous pouvez bien sûr contacter le responsable de la propriété directement par email ou WhatsApp.",
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    footer: 'Cet email a été envoyé par Margo Flow – Système de Gestion des Transferts',
    copyright: '© 2025 Margo Hospitality',
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ClientConfirmationRequest = await req.json();
    console.log("Sending client confirmation for reservation:", data.reservationId);

    const {
      language,
      reservationId,
      propertyName,
      guestName,
      guestEmail,
      transportType,
      transportDate,
      arrivalTime,
      flightTrainNumber,
      guestComment,
      paymentMode,
      price,
      managerEmail,
      managerWhatsapp,
    } = data;

    const t = translations[language] || translations.en;
    const paymentModeText = paymentMode === 'at_riad' ? t.paymentAtRiad : t.paymentToDriver;
    
    const whatsappLink = managerWhatsapp 
      ? `https://wa.me/${managerWhatsapp.replace(/\D/g, '')}`
      : null;

    const emailHtml = `
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
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${MARGOFLOW_EMAIL_LOGO_URL}" alt="Margo Flow" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
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
              <!-- Transport Details -->
              <h3 style="color: #0F4C5C; margin: 0 0 16px 0; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Transport Details</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafb; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.property}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.reservationId}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">#${reservationId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.transportType}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.date}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${transportDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; background-color: #fef3c7;">
                          <span style="color: #92400e; font-size: 13px; font-weight: 600;">${t.arrivalTime}</span><br>
                          <span style="color: #92400e; font-size: 18px; font-weight: 700;">${arrivalTime}</span>
                        </td>
                      </tr>
                      ${flightTrainNumber ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.flightTrain}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${flightTrainNumber}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${guestComment ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.comment}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 500;">${guestComment}</span>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 13px;">${t.paymentMethod}</span><br>
                          <span style="color: #111827; font-size: 15px; font-weight: 600;">${paymentModeText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 13px;">${t.totalPrice}</span><br>
                          <span style="color: #0F4C5C; font-size: 24px; font-weight: 700;">${price} MAD</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${(managerEmail || whatsappLink) ? `
              <!-- Contact Section -->
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
</html>
    `;
    const subject = `${t.subject} (#${reservationId})`;
    const emailResponse = await sendEmail([guestEmail], subject, emailHtml);

    console.log("Client confirmation sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending client confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
