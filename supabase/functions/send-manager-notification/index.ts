import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Margo Flow <notifications@resend.dev>",
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

interface ManagerNotificationRequest {
  reservationId: string;
  propertyName: string;
  guestName: string;
  transportType: string;
  transportDate: string;
  arrivalTime: string;
  flightTrainNumber?: string;
  guestComment?: string;
  managerEmail: string;
  appUrl: string;
  requestId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ManagerNotificationRequest = await req.json();
    console.log("Sending manager notification for reservation:", data.reservationId);

    const {
      reservationId,
      propertyName,
      guestName,
      transportType,
      transportDate,
      arrivalTime,
      flightTrainNumber,
      guestComment,
      managerEmail,
      appUrl,
      requestId,
    } = data;

    const reviewUrl = `${appUrl}/backoffice`;

    const emailHtml = `
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
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Reservation ID</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">#${reservationId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Guest Name</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${guestName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Transport Type</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${transportType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Date</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${transportDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;${flightTrainNumber || guestComment ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
                          <span style="color: #6b7280; font-size: 14px;">Arrival Time</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${arrivalTime}</span>
                        </td>
                      </tr>
                      ${flightTrainNumber ? `
                      <tr>
                        <td style="padding: 8px 0;${guestComment ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
                          <span style="color: #6b7280; font-size: 14px;">Flight / Train Number</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${flightTrainNumber}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${guestComment ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Guest Comment</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${guestComment}</span>
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
</html>
    `;
    const subject = `New Transport Request from Margo Flow (#${reservationId})`;
    const emailResponse = await sendEmail([managerEmail], subject, emailHtml);

    console.log("Manager notification sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending manager notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
