-- Add new columns to reservations table for Cloudbeds integration
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS check_out_date date,
ADD COLUMN IF NOT EXISTS nights integer,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS cloudbeds_raw jsonb DEFAULT '{}'::jsonb;

-- Create table to track Cloudbeds webhook events
CREATE TABLE IF NOT EXISTS public.cloudbeds_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  reservation_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on webhook logs
ALTER TABLE public.cloudbeds_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view webhook logs
CREATE POLICY "Super admins can view webhook logs"
ON public.cloudbeds_webhook_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Only super_admins can manage webhook logs
CREATE POLICY "Super admins can manage webhook logs"
ON public.cloudbeds_webhook_logs
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Create table to track reconciliation runs
CREATE TABLE IF NOT EXISTS public.cloudbeds_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  run_type text NOT NULL DEFAULT 'reconciliation', -- 'reconciliation', 'on_demand', 'webhook'
  status text NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  reservations_processed integer DEFAULT 0,
  reservations_created integer DEFAULT 0,
  reservations_updated integer DEFAULT 0,
  transport_requests_cancelled integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS on sync runs
ALTER TABLE public.cloudbeds_sync_runs ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view sync runs
CREATE POLICY "Super admins can view sync runs"
ON public.cloudbeds_sync_runs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Create index for faster lookups on webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_property ON public.cloudbeds_webhook_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON public.cloudbeds_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_property ON public.cloudbeds_sync_runs(property_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON public.cloudbeds_sync_runs(started_at DESC);

-- Add comment for documentation
COMMENT ON TABLE public.cloudbeds_webhook_logs IS 'Logs incoming Cloudbeds webhook events for auditing and debugging';
COMMENT ON TABLE public.cloudbeds_sync_runs IS 'Tracks Cloudbeds synchronization runs (reconciliation, on-demand, webhook-triggered)';