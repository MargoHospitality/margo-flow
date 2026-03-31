    -- ============================================
-- Margo Flow - Database Functions Migration
-- Generated: 2026-02-06
-- ============================================
-- ============================================
-- 1. UTILITY FUNCTIONS
-- ============================================
-- Function: update_updated_at_column
-- Purpose: Automatically update updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- Function: generate_transport_request_token
-- Purpose: Auto-generate a unique 16-char hex token for transport requests
CREATE OR REPLACE FUNCTION public.generate_transport_request_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  NEW.public_token := replace(gen_random_uuid()::text, '-', '')::text;
  NEW.public_token := substring(NEW.public_token from 1 for 16);
  RETURN NEW;
END;
$function$;
-- ============================================
-- 2. SECURITY DEFINER FUNCTIONS (RLS Helpers)
-- ============================================
-- Function: has_role
-- Purpose: Check if user has a specific role (used in RLS policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;
-- Function: has_riad_access
-- Purpose: Check if user has access to a specific riad
CREATE OR REPLACE FUNCTION public.has_riad_access(_user_id uuid, _riad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_riads
    WHERE user_id = _user_id
      AND riad_id = _riad_id
  ) OR public.has_role(_user_id, 'super_admin')
$function$;
-- Function: is_user_active
-- Purpose: Check if user profile is active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE user_id = _user_id),
    true
  )
$function$;
-- ============================================
-- 3. PUBLIC API FUNCTIONS (Guest-facing)
-- ============================================
-- Function: get_public_riads
-- Purpose: List active riads for guest dropdown
CREATE OR REPLACE FUNCTION public.get_public_riads()
RETURNS TABLE(id uuid, name text, is_active boolean, whatsapp_enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    r.id,
    r.name,
    r.is_active,
    r.whatsapp_enabled
  FROM public.riads r
  WHERE r.is_active = true;
$function$;
-- Function: get_public_riad
-- Purpose: Get single riad details for guest form
CREATE OR REPLACE FUNCTION public.get_public_riad(_riad_id uuid)
RETURNS TABLE(id uuid, name text, is_active boolean, whatsapp_enabled boolean, cloudbeds_property_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    r.id,
    r.name,
    r.is_active,
    r.whatsapp_enabled,
    r.cloudbeds_property_id
  FROM public.riads r
  WHERE r.id = _riad_id;
$function$;
-- Function: lookup_reservation_public
-- Purpose: Validate reservation for guest form (requires reservation_id, riad_id, check_in_date)
CREATE OR REPLACE FUNCTION public.lookup_reservation_public(
  _reservation_id text, 
  _riad_id uuid, 
  _check_in_date date
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
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
$function$;
-- Function: validate_reservation_exists
-- Purpose: Check if reservation exists (used by edge functions)
CREATE OR REPLACE FUNCTION public.validate_reservation_exists(
  _reservation_id text, 
  _property_id text DEFAULT NULL
)
RETURNS TABLE(exists_flag boolean, status reservation_status, check_in_date date, riad_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    true as exists_flag,
    r.status,
    r.check_in_date,
    r.riad_id
  FROM public.reservations r
  WHERE r.reservation_id = _reservation_id
    AND (_property_id IS NULL OR r.property_id = _property_id)
  LIMIT 1;
$function$;
-- Function: get_transport_request_by_reservation
-- Purpose: Check if transport request exists for a reservation
CREATE OR REPLACE FUNCTION public.get_transport_request_by_reservation(_reservation_id text)
RETURNS TABLE(
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
-- Function: get_transport_request_by_token
-- Purpose: Retrieve confirmed transport request by public token (for guest confirmation page)
CREATE OR REPLACE FUNCTION public.get_transport_request_by_token(_token text)
RETURNS TABLE(
  id uuid, 
  status request_status, 
  transport_date date, 
  transport_time time, 
  pax integer, 
  computed_price numeric, 
  payment_mode payment_mode, 
  transport_offer_id uuid, 
  is_free_transfer boolean, 
  payload_details jsonb, 
  guest_comment text, 
  property_name text, 
  transport_type text, 
  transport_name text, 
  reservation_id text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    tr.id,
    tr.status,
    tr.transport_date,
    tr.transport_time,
    tr.pax,
    tr.computed_price,
    tr.payment_mode,
    tr.transport_offer_id,
    tr.is_free_transfer,
    tr.payload_details,
    tr.guest_comment,
    r.name as property_name,
    tof.type::text as transport_type,
    tof.name as transport_name,
    tr.reservation_id
  FROM public.transport_requests tr
  JOIN public.riads r ON r.id = tr.riad_id
  JOIN public.transport_offers tof ON tof.id = tr.transport_offer_id
  WHERE tr.public_token = _token
    AND tr.status = 'confirmed'
  LIMIT 1;
$function$;
-- Function: create_transport_request_public
-- Purpose: Create transport request (called from edge function with validation)
CREATE OR REPLACE FUNCTION public.create_transport_request_public(
  _reservation_id text, 
  _riad_id uuid, 
  _transport_offer_id uuid, 
  _transport_date date, 
  _transport_time time, 
  _pax integer, 
  _computed_price numeric, 
  _payment_mode payment_mode, 
  _payload_details jsonb DEFAULT '{}'::jsonb, 
  _guest_comment text DEFAULT NULL, 
  _is_free_transfer boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  res_riad uuid;
  existing_request_id uuid;
  existing_status text;
BEGIN
  -- Basic server-side validation
  IF _reservation_id IS NULL OR length(trim(_reservation_id)) = 0 OR length(_reservation_id) > 64 THEN
    RAISE EXCEPTION 'Invalid reservation_id';
  END IF;
  IF _pax IS NULL OR _pax < 1 OR _pax > 20 THEN
    RAISE EXCEPTION 'Invalid pax';
  END IF;
  -- Ensure reservation exists and belongs to the provided riad_id
  SELECT r.riad_id INTO res_riad
  FROM public.reservations r
  WHERE r.reservation_id = _reservation_id
  LIMIT 1;
  IF res_riad IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF res_riad <> _riad_id THEN
    RAISE EXCEPTION 'Reservation/riad mismatch';
  END IF;
  -- DUPLICATE CHECK: Prevent creating a new request if one already exists with pending or confirmed status
  SELECT id, status::text INTO existing_request_id, existing_status
  FROM public.transport_requests
  WHERE reservation_id = _reservation_id
    AND status IN ('pending'::request_status, 'confirmed'::request_status)
  ORDER BY created_at DESC
  LIMIT 1;
  IF existing_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'A transport request already exists for this reservation (status: %)', existing_status;
  END IF;
  INSERT INTO public.transport_requests (
    reservation_id,
    riad_id,
    transport_offer_id,
    transport_date,
    transport_time,
    pax,
    computed_price,
    payment_mode,
    payload_details,
    guest_comment,
    status,
    is_free_transfer
  ) VALUES (
    _reservation_id,
    _riad_id,
    _transport_offer_id,
    _transport_date,
    _transport_time,
    _pax,
    _computed_price,
    _payment_mode,
    COALESCE(_payload_details, '{}'::jsonb),
    NULLIF(trim(_guest_comment), ''),
    'pending'::public.request_status,
    COALESCE(_is_free_transfer, false)
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;
-- ============================================
-- 4. AUTH TRIGGER FUNCTION
-- ============================================
-- Function: handle_new_user_role
-- Purpose: Auto-assign role and create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role app_role;
BEGIN
  -- Check if this is the bootstrap super admin email
  IF NEW.email = 'baptiste@margo-hospitality.com' THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'manager';
  END IF;
  
  -- Upsert the role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = CASE 
    WHEN NEW.email = 'baptiste@margo-hospitality.com' THEN 'super_admin'::app_role
    ELSE user_roles.role  -- Keep existing role for other users
  END;
  
  -- Also create a profile entry
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;
-- ============================================
-- 5. TRIGGERS
-- ============================================
-- Trigger: Auto-update updated_at on riads
CREATE TRIGGER update_riads_updated_at
  BEFORE UPDATE ON public.riads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on transport_offers
CREATE TRIGGER update_transport_offers_updated_at
  BEFORE UPDATE ON public.transport_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on riad_transport_offers
CREATE TRIGGER update_riad_transport_offers_updated_at
  BEFORE UPDATE ON public.riad_transport_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on reservations
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on transport_requests
CREATE TRIGGER update_transport_requests_updated_at
  BEFORE UPDATE ON public.transport_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-update updated_at on notification_attempts
CREATE TRIGGER update_notification_attempts_updated_at
  BEFORE UPDATE ON public.notification_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Trigger: Auto-generate public_token on transport_requests INSERT
CREATE TRIGGER generate_transport_request_token_trigger
  BEFORE INSERT ON public.transport_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_transport_request_token();
-- Trigger: Auto-assign role on auth.users INSERT
-- NOTE: This trigger must be created on auth.users table (Supabase-managed)
-- Run this in the SQL editor after migration:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user_role();