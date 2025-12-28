-- =============================================
-- FIX: Add proper SELECT policies for authenticated users
-- While keeping public access restricted to security functions
-- =============================================

-- 1. RIADS TABLE - Add authenticated access policies
-- Super admins already have ALL access, managers need to view riads they have access to
CREATE POLICY "Managers can view their assigned riads"
ON public.riads
FOR SELECT
USING (
  has_riad_access(auth.uid(), id)
);

-- 2. RESERVATIONS TABLE - Add authenticated access
-- Super admins already have ALL access via existing policy
-- Managers policy already exists (Managers can view their riad reservations)
-- No additional policy needed for reservations

-- 3. TRANSPORT_REQUESTS TABLE - Authenticated access already exists via:
-- - Managers can view their riad requests (SELECT)
-- - Super admins can manage all requests (ALL)
-- No additional policy needed

-- 4. Fix notification_attempts - change policy to proper check
-- The current policy "Service role can manage notification attempts" uses (auth.uid() IS NULL)
-- which incorrectly allows anonymous access. Service role bypasses RLS anyway.
DROP POLICY IF EXISTS "Service role can manage notification attempts" ON public.notification_attempts;

-- Service role doesn't need a policy - it bypasses RLS
-- Only super admins should see notification attempts via authenticated access
-- (Policy "Super admins can view notification attempts" already exists)

-- 5. Add service role INSERT policies for logging tables
-- Note: Service role actually bypasses RLS, but these policies are for documentation
-- The issue is the edge functions need to insert - and they use service role key

-- 6. Fix cloudbeds_webhook_logs duplicate policies
DROP POLICY IF EXISTS "Super admins can manage webhook logs" ON public.cloudbeds_webhook_logs;
-- Keep only the SELECT policy for super admins