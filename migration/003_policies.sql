-- ============================================
-- Margo Flow - Row Level Security Policies
-- Generated: 2026-02-06
-- ============================================

-- ============================================
-- 1. RIADS POLICIES
-- ============================================

-- Super admins can manage all riads
CREATE POLICY "Super admins can manage riads"
ON public.riads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Managers can view their assigned riads
CREATE POLICY "Managers can view their assigned riads"
ON public.riads
FOR SELECT
TO public
USING (has_riad_access(auth.uid(), id));

-- ============================================
-- 2. TRANSPORT_OFFERS POLICIES
-- ============================================

-- Public can view transport offers (for guest form)
CREATE POLICY "Public can view transport offers"
ON public.transport_offers
FOR SELECT
TO public
USING (true);

-- Super admins can manage transport offers
CREATE POLICY "Super admins can manage transport offers"
ON public.transport_offers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 3. RIAD_TRANSPORT_OFFERS POLICIES
-- ============================================

-- Public can view active riad transport offers (for guest form pricing)
CREATE POLICY "Public can view active riad transport offers"
ON public.riad_transport_offers
FOR SELECT
TO public
USING (is_active = true);

-- Managers can view their riad offers
CREATE POLICY "Managers can view their riad offers"
ON public.riad_transport_offers
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

-- Super admins can manage riad transport offers
CREATE POLICY "Super admins can manage riad transport offers"
ON public.riad_transport_offers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 4. RESERVATIONS POLICIES
-- ============================================

-- Super admins can manage all reservations
CREATE POLICY "Super admins can manage reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Managers can view their riad reservations
CREATE POLICY "Managers can view their riad reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

-- ============================================
-- 5. TRANSPORT_REQUESTS POLICIES
-- ============================================

-- Public can insert transport requests (guest form submission)
CREATE POLICY "Public can insert transport requests"
ON public.transport_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Managers can view their riad requests
CREATE POLICY "Managers can view their riad requests"
ON public.transport_requests
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

-- Managers can update their riad requests
CREATE POLICY "Managers can update their riad requests"
ON public.transport_requests
FOR UPDATE
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

-- Super admins can manage all requests
CREATE POLICY "Super admins can manage all requests"
ON public.transport_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 6. PROFILES POLICIES
-- ============================================

-- Users can view own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- Super admins can manage profiles
CREATE POLICY "Super admins can manage profiles"
ON public.profiles
FOR ALL
TO public
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 7. USER_ROLES POLICIES
-- ============================================

-- Users can view own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Super admins can manage roles
CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 8. USER_RIADS POLICIES
-- ============================================

-- Users can view own riad mappings
CREATE POLICY "Users can view own riad mappings"
ON public.user_riads
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Super admins can manage riad mappings
CREATE POLICY "Super admins can manage riad mappings"
ON public.user_riads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 9. NOTIFICATION_ATTEMPTS POLICIES
-- ============================================

-- Super admins can view notification attempts (audit log)
CREATE POLICY "Super admins can view notification attempts"
ON public.notification_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 10. CLOUDBEDS_SYNC_RUNS POLICIES
-- ============================================

-- Super admins can view sync runs
CREATE POLICY "Super admins can view sync runs"
ON public.cloudbeds_sync_runs
FOR SELECT
TO public
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 11. CLOUDBEDS_WEBHOOK_LOGS POLICIES
-- ============================================

-- Super admins can view webhook logs
CREATE POLICY "Super admins can view webhook logs"
ON public.cloudbeds_webhook_logs
FOR SELECT
TO public
USING (has_role(auth.uid(), 'super_admin'::app_role));
