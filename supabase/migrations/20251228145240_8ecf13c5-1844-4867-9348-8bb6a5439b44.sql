-- =============================================
-- SECURITY FIX: Remove overly permissive public access
-- =============================================

-- 1. RESERVATIONS TABLE
-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can validate reservations" ON public.reservations;

-- Create a restrictive policy that only allows checking existence by specific reservation_id
-- This prevents bulk enumeration and only returns minimal data for validation
CREATE POLICY "Public can validate specific reservation by id"
ON public.reservations
FOR SELECT
USING (
  -- Only allow access when querying by specific reservation_id
  -- The frontend must provide reservation_id in the query
  -- RLS will filter, but we rely on the query structure to limit exposure
  true
);

-- Actually, the above still allows bulk access. We need a different approach.
-- Since RLS can't inspect the query, we need to use a security definer function instead.
-- Let's drop that policy and create a proper one.

DROP POLICY IF EXISTS "Public can validate specific reservation by id" ON public.reservations;

-- Create a security definer function for public reservation validation
-- This function only returns existence and basic status, never PII
CREATE OR REPLACE FUNCTION public.validate_reservation_exists(
  _reservation_id text,
  _property_id text DEFAULT NULL
)
RETURNS TABLE (
  exists_flag boolean,
  status reservation_status,
  check_in_date date,
  riad_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    true as exists_flag,
    r.status,
    r.check_in_date,
    r.riad_id
  FROM public.reservations r
  WHERE r.reservation_id = _reservation_id
    AND (_property_id IS NULL OR r.property_id = _property_id)
  LIMIT 1;
$$;

-- No public SELECT policy on reservations - all public access goes through the function
-- Authenticated managers/admins still have their existing policies

-- 2. TRANSPORT_REQUESTS TABLE
-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can view own transport request by reservation" ON public.transport_requests;

-- Create a function for public transport request lookup by reservation_id only
CREATE OR REPLACE FUNCTION public.get_transport_request_by_reservation(
  _reservation_id text
)
RETURNS TABLE (
  id uuid,
  status request_status,
  transport_date date,
  transport_time time,
  pax integer,
  computed_price numeric,
  payment_mode payment_mode,
  transport_offer_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tr.id,
    tr.status,
    tr.transport_date,
    tr.transport_time,
    tr.pax,
    tr.computed_price,
    tr.payment_mode,
    tr.transport_offer_id
  FROM public.transport_requests tr
  WHERE tr.reservation_id = _reservation_id;
$$;

-- No public SELECT policy - all public access goes through the function

-- 3. RIADS TABLE
-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can view riads" ON public.riads;

-- Create a function that returns only non-sensitive riad data
CREATE OR REPLACE FUNCTION public.get_public_riads()
RETURNS TABLE (
  id uuid,
  name text,
  is_active boolean,
  whatsapp_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.name,
    r.is_active,
    r.whatsapp_enabled
  FROM public.riads r
  WHERE r.is_active = true;
$$;

-- Create a function to get a single riad's public data
CREATE OR REPLACE FUNCTION public.get_public_riad(
  _riad_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  is_active boolean,
  whatsapp_enabled boolean,
  cloudbeds_property_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.name,
    r.is_active,
    r.whatsapp_enabled,
    r.cloudbeds_property_id
  FROM public.riads r
  WHERE r.id = _riad_id;
$$;

-- Grant execute permissions on these functions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_reservation_exists TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_transport_request_by_reservation TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_riads TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_riad TO anon, authenticated;