-- Create notification_attempts table for logging all notification attempts
CREATE TABLE public.notification_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transport_request_id UUID REFERENCES public.transport_requests(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('client_confirmation', 'client_reminder', 'manager_new_request', 'manager_urgent')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient_phone TEXT,
  recipient_email TEXT,
  template_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'undelivered')),
  error_message TEXT,
  provider_message_id TEXT,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_notification_attempts_transport_request ON public.notification_attempts(transport_request_id);
CREATE INDEX idx_notification_attempts_status ON public.notification_attempts(status);
CREATE INDEX idx_notification_attempts_created_at ON public.notification_attempts(created_at DESC);

-- Enable RLS
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view notification attempts
CREATE POLICY "Super admins can view notification attempts"
ON public.notification_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage notification attempts"
ON public.notification_attempts
FOR ALL
USING (auth.uid() IS NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_attempts_updated_at
BEFORE UPDATE ON public.notification_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add whatsapp_enabled feature flag column to riads table
ALTER TABLE public.riads ADD COLUMN whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable WhatsApp for Massiba only
UPDATE public.riads SET whatsapp_enabled = true WHERE name ILIKE '%massiba%';