-- Create enhanced public reservation lookup function (security definer)
-- This replaces direct SELECT on reservations table for public guest flow
CREATE OR REPLACE FUNCTION public.lookup_reservation_public(
  _reservation_id text,
  _riad_id uuid,
  _check_in_date date
)
RETURNS TABLE (
  reservation_id text,
  guest_first_name text,
  guest_last_name text,
  check_in_date date,
  status reservation_status,
  riad_id uuid,
  riad_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.reservation_id,
    r.guest_first_name,
    r.guest_last_name,
    r.check_in_date,
    r.status,
    r.riad_id,
    ri.name as riad_name
  FROM public.reservations r
  JOIN public.riads ri ON ri.id = r.riad_id
  WHERE r.reservation_id = _reservation_id
    AND r.riad_id = _riad_id
    AND r.check_in_date = _check_in_date
  LIMIT 1;
$$;

-- Drop existing restrictive policies and recreate as permissive
-- notification_attempts: only super_admin can SELECT
DROP POLICY IF EXISTS "Super admins can view notification attempts" ON public.notification_attempts;
CREATE POLICY "Super admins can view notification attempts"
ON public.notification_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- reservations: super_admin full access, managers can view their riad reservations
DROP POLICY IF EXISTS "Super admins can manage reservations" ON public.reservations;
DROP POLICY IF EXISTS "Managers can view their riad reservations" ON public.reservations;

CREATE POLICY "Super admins can manage reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can view their riad reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));