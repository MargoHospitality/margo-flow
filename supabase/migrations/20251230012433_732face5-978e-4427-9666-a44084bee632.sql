-- Fix the generate_transport_request_token trigger function
-- The gen_random_bytes function is in the extensions schema, not public
CREATE OR REPLACE FUNCTION public.generate_transport_request_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Generate a random 16-character hex token using gen_random_uuid() which is safer
  NEW.public_token := replace(gen_random_uuid()::text, '-', '')::text;
  NEW.public_token := substring(NEW.public_token from 1 for 16);
  RETURN NEW;
END;
$function$;