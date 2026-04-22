const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function assertResendApiKey() {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return RESEND_API_KEY;
}

async function sendEmail(params: {
  to: string[];
  subject: string;
  html: string;
}) {
  const resendApiKey = assertResendApiKey();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Margo Flow <flow@margo-hospitality.com>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Resend API error");
  }

  return payload as {
    id?: string;
  };
}

export function normalizeEmailAddress(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("Guest email is required");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    throw new Error("Guest email is invalid");
  }

  return trimmed;
}

export async function sendPaymentLinkEmail(params: {
  to: string;
  guestFirstName: string;
  propertyName: string;
  amountLabel: string;
  paymentLink: string;
}) {
  const normalizedEmail = normalizeEmailAddress(params.to);
  const subject = `Your payment link for ${params.propertyName}`;
  const safeGuestFirstName = params.guestFirstName || "Guest";

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:32px 32px 20px 32px;text-align:center;border-bottom:1px solid #e5e7eb;">
                <h1 style="margin:0;color:#0f4c5c;font-size:28px;font-weight:700;">Margo Flow</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;color:#111827;font-size:16px;">Hello ${safeGuestFirstName},</p>
                <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.6;">
                  Your payment link for <strong>${params.propertyName}</strong> is ready.
                </p>
                <div style="margin:24px 0;padding:20px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;">
                  <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Amount due</p>
                  <p style="margin:0;color:#111827;font-size:24px;font-weight:700;">${params.amountLabel}</p>
                </div>
                <div style="margin:28px 0;text-align:center;">
                  <a href="${params.paymentLink}" style="display:inline-block;background:#0f4c5c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;">
                    Pay securely
                  </a>
                </div>
                <p style="margin:0 0 8px 0;color:#374151;font-size:14px;line-height:1.6;">
                  If the button does not work, you can also use this secure payment link:
                </p>
                <p style="margin:0;word-break:break-all;">
                  <a href="${params.paymentLink}" style="color:#0f4c5c;font-size:14px;">${params.paymentLink}</a>
                </p>
                <p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  If you need help, please contact the property team.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const emailResult = await sendEmail({
    to: [normalizedEmail],
    subject,
    html,
  });

  return {
    success: true,
    emailId: emailResult.id || null,
    email: normalizedEmail,
  };
}

export async function sendManagerPaymentConfirmationEmail(params: {
  to: string;
  propertyName: string;
  reservationId: string;
  guestName: string;
  amountLabel: string;
  paymentMethodSummary?: string | null;
  cloudbedsReference?: string | null;
  backofficeUrl?: string;
}) {
  const normalizedEmail = normalizeEmailAddress(params.to);
  const subject = `Payment received for ${params.propertyName} - ${params.reservationId}`;
  const backofficeUrl = params.backofficeUrl || "https://flow.margo-hospitality.com/backoffice/payments";
  const methodSummary = params.paymentMethodSummary?.trim() || "Stripe Checkout";
  const cloudbedsReference = params.cloudbedsReference?.trim() || null;
  const logoUrl = "https://flow.margo-hospitality.com/margo-logo.jpg";

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:32px 32px 20px 32px;text-align:center;border-bottom:1px solid #e5e7eb;">
                ${logoUrl
                  ? `<img src="${logoUrl}" alt="Margo Flow" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />`
                  : `<h1 style="margin:0;color:#0f4c5c;font-size:28px;font-weight:700;">Margo Flow</h1>`}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;color:#111827;font-size:16px;">A guest payment has just been confirmed and posted to Cloudbeds.</p>
                <div style="margin:24px 0;padding:20px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;">
                  <p style="margin:0 0 12px 0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Payment summary</p>
                  <p style="margin:0 0 8px 0;color:#111827;font-size:15px;"><strong>Property:</strong> ${params.propertyName}</p>
                  <p style="margin:0 0 8px 0;color:#111827;font-size:15px;"><strong>Reservation ID:</strong> ${params.reservationId}</p>
                  <p style="margin:0 0 8px 0;color:#111827;font-size:15px;"><strong>Guest:</strong> ${params.guestName}</p>
                  <p style="margin:0 0 8px 0;color:#111827;font-size:15px;"><strong>Amount:</strong> ${params.amountLabel}</p>
                  <p style="margin:0 0 8px 0;color:#111827;font-size:15px;"><strong>Method:</strong> ${methodSummary}</p>
                  ${cloudbedsReference ? `<p style="margin:0;color:#111827;font-size:15px;"><strong>Cloudbeds reference:</strong> ${cloudbedsReference}</p>` : ""}
                </div>
                <div style="margin:28px 0;text-align:center;">
                  <a href="${backofficeUrl}" style="display:inline-block;background:#0f4c5c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;">
                    Open Margo Flow
                  </a>
                </div>
                <p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  This confirmation was sent automatically after the Stripe payment was successfully posted to the reservation folio in Cloudbeds.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const emailResult = await sendEmail({
    to: [normalizedEmail],
    subject,
    html,
  });

  return {
    success: true,
    emailId: emailResult.id || null,
    email: normalizedEmail,
  };
}
