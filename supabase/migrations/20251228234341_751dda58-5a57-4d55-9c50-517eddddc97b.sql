-- 1) notification_attempts: Ensure RLS is enabled and only super_admins can access
-- RLS should already be enabled, but let's make sure
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to recreate with correct settings)
DROP POLICY IF EXISTS "Super admins can view notification attempts" ON public.notification_attempts;

-- Create restrictive SELECT policy for super_admins only
CREATE POLICY "Super admins can view notification attempts"
ON public.notification_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Explicitly deny all other operations for non-super_admins
-- Note: Edge functions use service role which bypasses RLS entirely

-- 2) reservations: Ensure RLS denies public access explicitly
-- RLS should already be enabled, but confirm
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- The existing policies already use auth.uid() checks which return null for unauthenticated users
-- For extra safety, we'll verify the policies target 'authenticated' role only

-- Drop and recreate policies to ensure they're scoped to authenticated users
DROP POLICY IF EXISTS "Managers can view their riad reservations" ON public.reservations;
DROP POLICY IF EXISTS "Super admins can manage reservations" ON public.reservations;

-- Recreate with explicit 'authenticated' role targeting
CREATE POLICY "Managers can view their riad reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (public.has_riad_access(auth.uid(), riad_id));

CREATE POLICY "Super admins can manage reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));