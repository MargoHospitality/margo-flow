ALTER TABLE public.reservation_payments
ADD COLUMN payment_flow TEXT NOT NULL DEFAULT 'manual_backoffice',
ADD COLUMN stripe_checkout_session_id TEXT UNIQUE,
ADD COLUMN stripe_checkout_url TEXT,
ADD COLUMN checkout_expires_at TIMESTAMPTZ,
ADD COLUMN client_whatsapp TEXT,
ADD COLUMN link_sent_at TIMESTAMPTZ,
ADD COLUMN link_last_sent_at TIMESTAMPTZ,
ADD COLUMN link_sent_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_whatsapp_message_id TEXT,
ADD COLUMN whatsapp_error_message TEXT;

CREATE INDEX idx_reservation_payments_flow ON public.reservation_payments (payment_flow);
CREATE INDEX idx_reservation_payments_checkout_session_id ON public.reservation_payments (stripe_checkout_session_id);
