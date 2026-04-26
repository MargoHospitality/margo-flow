ALTER TABLE public.riads
ADD COLUMN IF NOT EXISTS arrivals_home_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.riads.arrivals_home_enabled IS
'When true, managers assigned to this property can use the Arrivals home view instead of the legacy transport home.';
