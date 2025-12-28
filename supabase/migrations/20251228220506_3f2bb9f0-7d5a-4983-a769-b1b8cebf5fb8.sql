-- Add is_free_transfer boolean to transport_requests
ALTER TABLE public.transport_requests 
ADD COLUMN IF NOT EXISTS is_free_transfer boolean NOT NULL DEFAULT false;