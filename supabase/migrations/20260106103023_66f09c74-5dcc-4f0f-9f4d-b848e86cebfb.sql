-- Add duplicate prevention to create_transport_request_public function
CREATE OR REPLACE FUNCTION public.create_transport_request_public(
  _reservation_id text, 
  _riad_id uuid, 
  _transport_offer_id uuid, 
  _transport_date date, 
  _transport_time time without time zone, 
  _pax integer, 
  _computed_price numeric, 
  _payment_mode payment_mode, 
  _payload_details jsonb DEFAULT '{}'::jsonb, 
  _guest_comment text DEFAULT NULL::text, 
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