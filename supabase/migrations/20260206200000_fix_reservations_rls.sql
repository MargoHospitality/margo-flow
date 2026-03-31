-- Fix: Add public read policy for reservations (needed for Token page)
-- Date: 2026-02-06

-- Allow public to read reservations (for guest token access)
CREATE POLICY "Public can view reservations"
ON public.reservations
FOR SELECT
TO public
USING (true);
