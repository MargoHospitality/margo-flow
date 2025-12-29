import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  
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
              <img src="${supabaseUrl}/storage/v1/object/public/assets/margoflow-logo.png" alt="Margo Flow" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
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

async function sendBrandedEmail(
  resend: Resend,
  to: string,
  type: 'invite' | 'recovery',
  actionUrl: string
): Promise<{ success: boolean; error?: string }> {
  let emailContent: { subject: string; html: string };

  if (type === 'invite') {
    emailContent = {
      subject: "You're invited to join Margo Flow",
      html: generateEmailHtml({
        title: "You're Invited - Margo Flow",
        preheader: "You've been invited to join the Margo Flow team. Click to set up your account.",
        heading: "Welcome to Margo Flow",
        subheading: "You've been invited to join as a team member",
        bodyContent: "An administrator has invited you to join Margo Flow, our transfer management system. Click the button below to accept your invitation and set up your account.",
        ctaUrl: actionUrl,
        ctaText: "Accept Invitation",
        footerNote: "This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.",
      }),
    };
  } else {
    emailContent = {
      subject: "Reset your Margo Flow password",
      html: generateEmailHtml({
        title: "Reset Password - Margo Flow",
        preheader: "A password reset was requested for your Margo Flow account.",
        heading: "Reset Your Password",
        subheading: "We received a password reset request for your account",
        bodyContent: "Click the button below to reset your password. If you didn't request this, you can safely ignore this email.",
        ctaUrl: actionUrl,
        ctaText: "Reset Password",
        footerNote: "This link will expire in 1 hour. For security, this request was initiated from the Margo Flow admin panel.",
      }),
    };
  }

  try {
    const { error } = await resend.emails.send({
      from: "Margo Flow <noreply@margo-hospitality.com>",
      to: [to],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error(`Resend error for ${type}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`${type} email sent successfully to ${to}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to send ${type} email:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const body = await req.json();
    const { action } = body;

    // Prefer an explicit app origin from the client, then fall back to request origin, then production.
    const DEFAULT_APP_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://flow.margo-hospitality.com';
    const candidateOrigin = body?.appOrigin || req.headers.get('origin') || DEFAULT_APP_ORIGIN;

    let appOrigin = DEFAULT_APP_ORIGIN;
    try {
      appOrigin = new URL(candidateOrigin).origin;
    } catch {
      // ignore
    }

    console.log(`admin-search-user action=${action} appOrigin=${appOrigin}`);
    
    // Bootstrap first super_admin - NO AUTH REQUIRED (only works once)
    if (action === 'bootstrap') {
      const BOOTSTRAP_EMAIL = 'baptiste@margo-hospitality.com';
      
      // Check if any super_admin already exists
      const { data: existingAdmins } = await supabaseAdmin.from('user_roles').select('id').eq('role', 'super_admin').limit(1);
      if (existingAdmins && existingAdmins.length > 0) {
        return new Response(JSON.stringify({ error: 'Bootstrap already completed - super_admin exists' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Check if user already exists
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.find(u => u.email?.toLowerCase() === BOOTSTRAP_EMAIL.toLowerCase());
      if (existingUser) {
        return new Response(JSON.stringify({ error: 'User already exists. Try logging in or resetting password.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Generate invite link (doesn't send email)
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: BOOTSTRAP_EMAIL,
        options: {
          redirectTo: `${appOrigin}/auth`
        }
      });
      
      if (linkError) {
        console.error('Bootstrap invite error:', linkError);
        return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Send branded email via Resend
      const emailResult = await sendBrandedEmail(resend, BOOTSTRAP_EMAIL, 'invite', linkData.properties.action_link);
      
      if (!emailResult.success) {
        return new Response(JSON.stringify({ error: `Failed to send invitation email: ${emailResult.error}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Bootstrap user invited successfully:', BOOTSTRAP_EMAIL);
      return new Response(JSON.stringify({ success: true, message: 'Invitation sent to ' + BOOTSTRAP_EMAIL }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // All other actions require super_admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestingUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', requestingUser.id).single();
    if (roleData?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { email, userId, fullName, role, riadIds } = body;

    // Search user
    if (!action || action === 'search') {
      if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!foundUser) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, is_active').eq('user_id', foundUser.id).single();
      return new Response(JSON.stringify({ user: { id: foundUser.id, email: foundUser.email, fullName: profile?.full_name, isActive: profile?.is_active ?? true } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Invite user
    if (action === 'invite') {
      if (!email || !role) return new Response(JSON.stringify({ error: 'Email and role required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      if (users.find(u => u.email?.toLowerCase() === email.toLowerCase())) {
        return new Response(JSON.stringify({ error: 'User already exists' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Inviting user:', email);
      console.log('Invite redirectTo:', `${appOrigin}/auth`);
      
      // Generate invite link (doesn't send email)
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
          redirectTo: `${appOrigin}/auth`
        }
      });
      
      if (linkError) {
        console.error('Invite error:', linkError);
        return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const actionLink = linkData?.properties?.action_link;
      console.log('Invite action_link:', actionLink);
      
      const newUserId = linkData.user.id;
      
      // Send branded email via Resend
      const emailResult = await sendBrandedEmail(resend, email, 'invite', actionLink);
      
      if (!emailResult.success) {
        console.error('Failed to send invite email:', emailResult.error);
        // Continue with user setup even if email fails - admin can resend
      }
      
      console.log('User created:', email, 'ID:', newUserId);
      
      // Create profile
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({ 
        user_id: newUserId, 
        full_name: fullName || null, 
        is_active: true 
      }, { onConflict: 'user_id' });
      
      if (profileError) console.error('Profile upsert error:', profileError);
      
      // Create role
      const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({ 
        user_id: newUserId, 
        role 
      }, { onConflict: 'user_id' });
      
      if (roleError) console.error('Role upsert error:', roleError);
      
      // Assign riads
      if (riadIds?.length > 0) {
        await supabaseAdmin.from('user_riads').delete().eq('user_id', newUserId);
        const { error: riadsError } = await supabaseAdmin.from('user_riads').insert(
          riadIds.map((riadId: string) => ({ user_id: newUserId, riad_id: riadId }))
        );
        if (riadsError) console.error('Riads insert error:', riadsError);
      }
      
      console.log('User setup complete:', email, 'Email sent:', emailResult.success);
      return new Response(JSON.stringify({ 
        success: true, 
        userId: newUserId,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        actionLink,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resend invitation
    if (action === 'resend_invite') {
      if (!userId) return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      // Get the user
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const targetUser = users.find(u => u.id === userId);
      
      if (!targetUser || !targetUser.email) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      if (targetUser.email_confirmed_at) {
        return new Response(JSON.stringify({ error: 'User has already confirmed their email. Use password reset instead.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Resending invite to:', targetUser.email);
      
      // Generate new invite link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: targetUser.email,
        options: {
          redirectTo: `${appOrigin}/auth`
        }
      });
      
      if (linkError) {
        console.error('Resend invite link error:', linkError);
        return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Send branded email via Resend
      const emailResult = await sendBrandedEmail(resend, targetUser.email, 'invite', linkData.properties.action_link);
      
      if (!emailResult.success) {
        return new Response(JSON.stringify({ error: `Failed to send invitation email: ${emailResult.error}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Invitation resent successfully to:', targetUser.email);
      return new Response(JSON.stringify({ success: true, message: 'Invitation resent' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Password reset
    if (action === 'reset_password') {
      if (!userId) return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      // Get the user
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const targetUser = users.find(u => u.id === userId);
      
      if (!targetUser || !targetUser.email) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Sending password reset to:', targetUser.email);
      console.log('Password reset redirectTo:', `${appOrigin}/auth`);
      
      // Generate password reset link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
        options: {
          redirectTo: `${appOrigin}/auth`
        }
      });
      
      if (linkError) {
        console.error('Password reset link error:', linkError);
        return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const actionLink = linkData?.properties?.action_link;
      console.log('Password reset action_link:', actionLink);
      
      // Send branded email via Resend
      const emailResult = await sendBrandedEmail(resend, targetUser.email, 'recovery', actionLink);
      
      if (!emailResult.success) {
        return new Response(JSON.stringify({ error: `Failed to send password reset email: ${emailResult.error}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log('Password reset email sent to:', targetUser.email);
      return new Response(JSON.stringify({ success: true, message: 'Password reset email sent', actionLink }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update user
    if (action === 'update') {
      if (!userId) return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (fullName !== undefined) await supabaseAdmin.from('profiles').upsert({ user_id: userId, full_name: fullName }, { onConflict: 'user_id' });
      if (role) await supabaseAdmin.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id' });
      if (riadIds !== undefined) {
        await supabaseAdmin.from('user_riads').delete().eq('user_id', userId);
        if (riadIds.length > 0) await supabaseAdmin.from('user_riads').insert(riadIds.map((riadId: string) => ({ user_id: userId, riad_id: riadId })));
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deactivate/Reactivate user
    if (action === 'deactivate' || action === 'reactivate') {
      if (!userId) return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await supabaseAdmin.from('profiles').upsert({ user_id: userId, is_active: action === 'reactivate' }, { onConflict: 'user_id' });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // List all users - now includes status and last login
    if (action === 'list') {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
      const { data: roles } = await supabaseAdmin.from('user_roles').select('*');
      const { data: userRiads } = await supabaseAdmin.from('user_riads').select('user_id, riad_id');
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const riadMap = new Map<string, string[]>();
      userRiads?.forEach(ur => { 
        if (!riadMap.has(ur.user_id)) riadMap.set(ur.user_id, []); 
        riadMap.get(ur.user_id)!.push(ur.riad_id); 
      });
      
      const userList = users.map(u => {
        const profile = profileMap.get(u.id);
        const isActive = profile?.is_active ?? true;
        const emailConfirmed = !!u.email_confirmed_at;
        
        // Determine user status
        let status: 'invited' | 'active' | 'disabled';
        if (!isActive) {
          status = 'disabled';
        } else if (!emailConfirmed) {
          status = 'invited';
        } else {
          status = 'active';
        }
        
        return {
          id: u.id,
          email: u.email,
          fullName: profile?.full_name || null,
          isActive,
          role: roleMap.get(u.id) || 'manager',
          riadIds: riadMap.get(u.id) || [],
          createdAt: u.created_at,
          emailConfirmedAt: u.email_confirmed_at,
          lastSignInAt: u.last_sign_in_at,
          status
        };
      });
      
      return new Response(JSON.stringify({ users: userList }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
