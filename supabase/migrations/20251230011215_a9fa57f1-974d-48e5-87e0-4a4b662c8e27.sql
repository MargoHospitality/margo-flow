-- Add public_token column for client confirmation links
ALTER TABLE public.transport_requests 
ADD COLUMN public_token TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_transport_requests_public_token ON public.transport_requests(public_token);

-- Create function to generate public token on insert
CREATE OR REPLACE FUNCTION public.generate_transport_request_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a random 16-character hex token
  NEW.public_token := encode(gen_random_bytes(8), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate token on insert
CREATE TRIGGER set_transport_request_token
BEFORE INSERT ON public.transport_requests
FOR EACH ROW
WHEN (NEW.public_token IS NULL)
EXECUTE FUNCTION public.generate_transport_request_token();

-- Create public function to get transport request by token (read-only, minimal data)
CREATE OR REPLACE FUNCTION public.get_transport_request_by_token(_token text)
RETURNS TABLE (
  id uuid,
  status request_status,
  transport_date date,
  transport_time time without time zone,
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
$$;

-- Backfill existing transport requests with tokens
UPDATE public.transport_requests 
SET public_token = encode(gen_random_bytes(8), 'hex')
WHERE public_token IS NULL;