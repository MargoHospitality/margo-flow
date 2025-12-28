-- Add 'cancelled' to request_status enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add cancellation fields to transport_requests table
ALTER TABLE public.transport_requests 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;