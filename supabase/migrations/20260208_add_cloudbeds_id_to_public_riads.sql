-- Add cloudbeds_property_id to get_public_riads function
-- This allows pre-selecting riads by Cloudbeds property ID in URL params

CREATE OR REPLACE FUNCTION public.get_public_riads()
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
  WHERE r.is_active = true;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_public_riads TO anon, authenticated;
