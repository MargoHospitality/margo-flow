-- Rate Limiting System
-- Purpose: Prevent spam/abuse on public endpoints (guest form submissions)
-- Limit: 10 requests per 10 minutes per IP address

-- Table to track request counts per IP
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_request TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ip_address, endpoint)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Enable RLS (but allow public access via functions only)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage rate limits directly
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup old rate limit records (older than 1 hour)
-- This keeps the table size manageable
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;

-- Function to check rate limit
-- Returns true if request is allowed, false if rate limit exceeded
-- Configuration: 10 requests per 10 minutes (configurable via parameters)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _ip_address TEXT,
  _endpoint TEXT,
  _max_requests INTEGER DEFAULT 10,
  _window_minutes INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_record RECORD;
  window_expired BOOLEAN;
BEGIN
  -- Input validation
  IF _ip_address IS NULL OR length(trim(_ip_address)) = 0 THEN
    RAISE EXCEPTION 'IP address required';
  END IF;

  IF _endpoint IS NULL OR length(trim(_endpoint)) = 0 THEN
    RAISE EXCEPTION 'Endpoint required';
  END IF;

  -- Cleanup old records periodically (1% chance per request)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_old_rate_limits();
  END IF;

  -- Get current rate limit record for this IP + endpoint
  SELECT *
  INTO current_record
  FROM public.rate_limits
  WHERE ip_address = _ip_address
    AND endpoint = _endpoint
  FOR UPDATE; -- Lock row for update

  -- No existing record -> first request, allow it
  IF current_record IS NULL THEN
    INSERT INTO public.rate_limits (ip_address, endpoint, request_count, window_start, last_request)
    VALUES (_ip_address, _endpoint, 1, now(), now());
    RETURN true;
  END IF;

  -- Check if window has expired (older than X minutes)
  window_expired := (current_record.window_start < now() - make_interval(mins => _window_minutes));

  -- Window expired -> reset counter
  IF window_expired THEN
    UPDATE public.rate_limits
    SET request_count = 1,
        window_start = now(),
        last_request = now()
    WHERE ip_address = _ip_address
      AND endpoint = _endpoint;
    RETURN true;
  END IF;

  -- Window still active -> check if under limit
  IF current_record.request_count < _max_requests THEN
    -- Increment counter
    UPDATE public.rate_limits
    SET request_count = request_count + 1,
        last_request = now()
    WHERE ip_address = _ip_address
      AND endpoint = _endpoint;
    RETURN true;
  END IF;

  -- Rate limit exceeded
  -- Update last_request timestamp (for monitoring)
  UPDATE public.rate_limits
  SET last_request = now()
  WHERE ip_address = _ip_address
    AND endpoint = _endpoint;

  RETURN false;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

-- Comment for documentation
COMMENT ON TABLE public.rate_limits IS 'Rate limiting table: tracks request counts per IP address per endpoint. Limit: 10 req/10min per IP.';
COMMENT ON FUNCTION public.check_rate_limit IS 'Rate limit check: returns true if request allowed, false if limit exceeded. Used by Edge Functions.';
