-- Drop the current restrictive INSERT policy
DROP POLICY IF EXISTS "Public can insert transport requests" ON public.transport_requests;

-- Recreate as PERMISSIVE policy (the default)
CREATE POLICY "Public can insert transport requests" 
ON public.transport_requests 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);