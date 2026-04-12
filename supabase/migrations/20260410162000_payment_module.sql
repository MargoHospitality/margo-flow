-- Payment module configuration per property and payment audit trail

CREATE TABLE public.riad_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riad_id UUID NOT NULL REFERENCES public.riads(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  currency_code TEXT NOT NULL DEFAULT 'MAD',
  payment_label TEXT NOT NULL DEFAULT 'Card payment',
  stripe_publishable_key TEXT,
  stripe_secret_key_alias TEXT,
  cloudbeds_payment_method TEXT,
  cloudbeds_payment_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT riad_payment_settings_riad_id_key UNIQUE (riad_id),
  CONSTRAINT riad_payment_settings_currency_check CHECK (currency_code = upper(currency_code)),
  CONSTRAINT riad_payment_settings_enabled_requirements CHECK (
    NOT is_enabled OR (
      stripe_publishable_key IS NOT NULL
      AND stripe_secret_key_alias IS NOT NULL
      AND cloudbeds_payment_method IS NOT NULL
    )
  )
);

CREATE INDEX idx_riad_payment_settings_enabled ON public.riad_payment_settings (is_enabled);

CREATE TABLE public.reservation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riad_id UUID NOT NULL REFERENCES public.riads(id) ON DELETE CASCADE,
  reservation_id TEXT NOT NULL REFERENCES public.reservations(reservation_id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  created_by UUID NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'MAD',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL DEFAULT 'intent_created',
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_secret_key_alias TEXT NOT NULL,
  stripe_payment_method_summary TEXT,
  cloudbeds_payment_method TEXT NOT NULL,
  cloudbeds_payment_reference TEXT,
  cloudbeds_logged BOOLEAN NOT NULL DEFAULT false,
  cloudbeds_logged_at TIMESTAMPTZ,
  cloudbeds_error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservation_payments_riad_id ON public.reservation_payments (riad_id);
CREATE INDEX idx_reservation_payments_reservation_id ON public.reservation_payments (reservation_id);
CREATE INDEX idx_reservation_payments_created_at ON public.reservation_payments (created_at DESC);

ALTER TABLE public.riad_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view their riad payment settings"
ON public.riad_payment_settings
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

CREATE POLICY "Super admins can manage payment settings"
ON public.riad_payment_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can view their reservation payments"
ON public.reservation_payments
FOR SELECT
TO authenticated
USING (has_riad_access(auth.uid(), riad_id));

CREATE POLICY "Super admins can manage reservation payments"
ON public.reservation_payments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_riad_payment_settings_updated_at
  BEFORE UPDATE ON public.riad_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservation_payments_updated_at
  BEFORE UPDATE ON public.reservation_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
