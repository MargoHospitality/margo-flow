import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    const body = await req.json();
    const { action } = body;
    
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
      
      // Invite the bootstrap user
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(BOOTSTRAP_EMAIL, {
        redirectTo: `${req.headers.get('origin') || supabaseUrl}/auth`
      });
      
      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
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
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: `${req.headers.get('origin') || supabaseUrl}/auth` });
      if (inviteError) return new Response(JSON.stringify({ error: inviteError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const newUserId = inviteData.user.id;
      await supabaseAdmin.from('profiles').upsert({ user_id: newUserId, full_name: fullName || null, is_active: true }, { onConflict: 'user_id' });
      await supabaseAdmin.from('user_roles').upsert({ user_id: newUserId, role }, { onConflict: 'user_id' });
      if (riadIds?.length > 0) {
        await supabaseAdmin.from('user_riads').delete().eq('user_id', newUserId);
        await supabaseAdmin.from('user_riads').insert(riadIds.map((riadId: string) => ({ user_id: newUserId, riad_id: riadId })));
      }
      return new Response(JSON.stringify({ success: true, userId: newUserId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // List all users
    if (action === 'list') {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
      const { data: roles } = await supabaseAdmin.from('user_roles').select('*');
      const { data: userRiads } = await supabaseAdmin.from('user_riads').select('user_id, riad_id');
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const riadMap = new Map<string, string[]>();
      userRiads?.forEach(ur => { if (!riadMap.has(ur.user_id)) riadMap.set(ur.user_id, []); riadMap.get(ur.user_id)!.push(ur.riad_id); });
      const userList = users.map(u => ({ id: u.id, email: u.email, fullName: profileMap.get(u.id)?.full_name || null, isActive: profileMap.get(u.id)?.is_active ?? true, role: roleMap.get(u.id) || 'manager', riadIds: riadMap.get(u.id) || [], createdAt: u.created_at }));
      return new Response(JSON.stringify({ users: userList }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});