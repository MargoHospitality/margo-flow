-- Add guest_comment column to transport_requests table
ALTER TABLE public.transport_requests 
ADD COLUMN IF NOT EXISTS guest_comment text;