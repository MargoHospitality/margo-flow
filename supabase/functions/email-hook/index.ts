import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Brand colors and styles matching Margo Flow
const BRAND = {
  primary: "#048E9A",
  background: "#FAF9F7",
  cardBg: "#FFFFFF",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  borderColor: "#E5E7EB",
  successBg: "#ECFDF5",
  successBorder: "#D1FAE5",
  successText: "#065F46",
  infoBg: "#EFF6FF",
  infoText: "#1E40AF",
  ctaBg: "#048E9A",
  ctaText: "#FFFFFF",
};

function generateEmailHtml({
  title,
  preheader,
  heading,
  subheading,
  bodyContent,
  ctaUrl,
  ctaText,
  footerNote,
}: {
  title: string;
  preheader: string;
  heading: string;
  subheading?: string;
  bodyContent?: string;
  ctaUrl: string;
  ctaText: string;
  footerNote?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <div style="display: none; font-size: 1px; color: ${BRAND.background}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: ${BRAND.cardBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);">
          
          <!-- Header with Logo (White Background) -->
          <tr>
            <td style="background-color: ${BRAND.cardBg}; padding: 32px 40px; text-align: center; border-bottom: 1px solid ${BRAND.borderColor};" class="mobile-padding">
              <img src="${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/assets/margoflow-logo.png" alt="Margo Flow" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="background-color: ${BRAND.successBg}; padding: 24px 40px; text-align: center; border-bottom: 1px solid ${BRAND.successBorder};" class="mobile-padding">
              <h2 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 500; color: ${BRAND.successText};">${heading}</h2>
              ${subheading ? `<p style="margin: 8px 0 0 0; font-size: 15px; color: ${BRAND.textSecondary};">${subheading}</p>` : ''}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 40px;" class="mobile-padding">
              
              ${bodyContent ? `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${BRAND.textPrimary};">${bodyContent}</p>` : ''}
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${ctaUrl}" style="display: inline-block; background-color: ${BRAND.ctaBg}; color: ${BRAND.ctaText}; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              
              ${footerNote ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND.infoBg}; border-radius: 12px; margin-top: 16px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 13px; color: ${BRAND.infoText};">${footerNote}</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 40px; text-align: center; border-top: 1px solid ${BRAND.borderColor};" class="mobile-padding">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: ${BRAND.textSecondary};">
                Sent by <strong style="color: ${BRAND.primary};">Margo Flow</strong> — Transfer Management System
              </p>
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                © ${new Date().getFullYear()} Margo Hospitality. All rights reserved.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Email hook received:", JSON.stringify(body, null, 2));

    const { type, email, token_hash, redirect_to, site_url } = body;

    // Determine the base URL
    const baseUrl = redirect_to || site_url || Deno.env.get("SUPABASE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    let emailContent: {
      subject: string;
      html: string;
    } | null = null;

    switch (type) {
      case "invite":
        // User invitation email
        const inviteUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=invite&redirect_to=${encodeURIComponent(redirect_to || `${baseUrl}/auth`)}`;
        emailContent = {
          subject: "You're invited to join Margo Flow",
          html: generateEmailHtml({
            title: "You're Invited - Margo Flow",
            preheader: "You've been invited to join the Margo Flow team. Click to set up your account.",
            heading: "Welcome to Margo Flow",
            subheading: "You've been invited to join as a team member",
            bodyContent: "An administrator has invited you to join Margo Flow, our transfer management system. Click the button below to accept your invitation and set up your account.",
            ctaUrl: inviteUrl,
            ctaText: "Accept Invitation",
            footerNote: "This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.",
          }),
        };
        break;

      case "recovery":
        // Password reset email
        const recoveryUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=recovery&redirect_to=${encodeURIComponent(redirect_to || `${baseUrl}/auth`)}`;
        emailContent = {
          subject: "Reset your Margo Flow password",
          html: generateEmailHtml({
            title: "Reset Password - Margo Flow",
            preheader: "A password reset was requested for your Margo Flow account.",
            heading: "Reset Your Password",
            subheading: "We received a password reset request for your account",
            bodyContent: "Click the button below to reset your password. If you didn't request this, you can safely ignore this email.",
            ctaUrl: recoveryUrl,
            ctaText: "Reset Password",
            footerNote: "This link will expire in 1 hour. For security, this request was initiated from the Margo Flow admin panel.",
          }),
        };
        break;

      case "signup":
      case "email_change":
      case "magiclink":
        // Confirmation/verification email
        const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${type}&redirect_to=${encodeURIComponent(redirect_to || `${baseUrl}/auth`)}`;
        emailContent = {
          subject: type === "email_change" ? "Confirm your new email - Margo Flow" : "Confirm your email - Margo Flow",
          html: generateEmailHtml({
            title: "Confirm Email - Margo Flow",
            preheader: "Please confirm your email address to continue.",
            heading: "Confirm Your Email",
            subheading: type === "email_change" ? "Verify your new email address" : "Complete your account setup",
            bodyContent: "Click the button below to confirm your email address and continue.",
            ctaUrl: verifyUrl,
            ctaText: "Confirm Email",
            footerNote: "If you didn't create an account or request this email, you can safely ignore it.",
          }),
        };
        break;

      default:
        console.log("Unknown email type:", type);
        return new Response(JSON.stringify({ error: "Unknown email type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (emailContent) {
      console.log(`Sending ${type} email to ${email}`);
      
      const { data, error } = await resend.emails.send({
        from: "Margo Flow <noreply@margo-hospitality.com>",
        to: [email],
        subject: emailContent.subject,
        html: emailContent.html,
      });

      if (error) {
        console.error("Resend error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Email sent successfully:", data);
      return new Response(JSON.stringify({ success: true, messageId: data?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Email hook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
