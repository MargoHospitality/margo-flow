-- Add cloudbeds_sync_enabled column to riads table
ALTER TABLE public.riads 
ADD COLUMN cloudbeds_sync_enabled boolean NOT NULL DEFAULT false;

-- Enable sync for Massiba by default
UPDATE public.riads 
SET cloudbeds_sync_enabled = true 
WHERE cloudbeds_property_id = '9462';

-- Add comment for documentation
COMMENT ON COLUMN public.riads.cloudbeds_sync_enabled IS 'When OFF: webhooks ignored, scheduled/manual reconciliation disabled';