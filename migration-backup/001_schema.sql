-- ============================================
-- Margo Flow - Database Schema Migration
-- Generated: 2026-02-06
-- Source: Lovable Cloud (fnbqegolwitkgjmlesbc)
-- Target: Self-hosted Supabase
-- ============================================
-- ============================================
-- 1. CUSTOM ENUM TYPES
-- ============================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'manager', 'pending');
CREATE TYPE public.payment_mode AS ENUM ('at_riad', 'to_driver');
CREATE TYPE public.request_status AS ENUM (
  'pending', 
  'confirmed', 
  'rejected', 
  'canceled_due_to_reservation', 
  'cancelled'
);
CREATE TYPE public.reservation_status AS ENUM (
  'confirmed', 
  'checked_in', 
  'checked_out', 
  'canceled', 
  'no_show'
);
CREATE TYPE public.transport_type AS ENUM (
  'airport_pickup', 
  'train_station_pickup', 
  'hotel_pickup', 
  'bus_station_pickup'
);
-- ============================================
-- 2. TABLES
-- ============================================
-- --------------------
-- Table: riads
-- --------------------
CREATE TABLE public.riads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT,
  manager_whatsapp TEXT,
  cloudbeds_property_id TEXT UNIQUE,
  cloudbeds_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- --------------------
-- Table: transport_offers
-- --------------------
CREATE TABLE public.transport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_fr TEXT,
  type public.transport_type NOT NULL,
  fields_schema JSONB DEFAULT '[]'::jsonb,
  default_day_price NUMERIC NOT NULL,
  default_night_price NUMERIC NOT NULL,
  default_base_pax INTEGER NOT NULL DEFAULT 3,
  default_extra_pax_price NUMERIC NOT NULL DEFAULT 0,
  default_payment_mode public.payment_mode NOT NULL DEFAULT 'at_riad',
  day_start_time TIME NOT NULL DEFAULT '08:00:00',
  day_end_time TIME NOT NULL DEFAULT '20:00:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- --------------------
-- Table: riad_transport_offers
-- --------------------
CREATE TABLE public.riad_transport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riad_id UUID NOT NULL REFERENCES public.riads(id) ON DELETE CASCADE,
  transport_offer_id UUID NOT NULL REFERENCES public.transport_offers(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  override_day_price NUMERIC,
  override_night_price NUMERIC,
  override_base_pax INTEGER,
  override_extra_pax_price NUMERIC,
  override_payment_mode public.payment_mode,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (riad_id, transport_offer_id)
);
-- --------------------
-- Table: reservations
-- --------------------
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id TEXT NOT NULL UNIQUE,
  property_id TEXT NOT NULL,
  riad_id UUID REFERENCES public.riads(id),
  guest_last_name TEXT NOT NULL,
  guest_first_name TEXT,
  guest_country_code TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE,
  nights INTEGER,
  status public.reservation_status NOT NULL DEFAULT 'confirmed',
  source TEXT,
  cloudbeds_raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, reservation_id)
);
-- --------------------
-- Table: transport_requests
-- --------------------
CREATE TABLE public.transport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id TEXT NOT NULL REFERENCES public.reservations(reservation_id),
  riad_id UUID NOT NULL REFERENCES public.riads(id),
  transport_offer_id UUID NOT NULL REFERENCES public.transport_offers(id),
  transport_date DATE NOT NULL,
  transport_time TIME NOT NULL,
  pax INTEGER NOT NULL,
  computed_price NUMERIC NOT NULL,
  payment_mode public.payment_mode NOT NULL,
  payload_details JSONB DEFAULT '{}'::jsonb,
  guest_comment TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  is_free_transfer BOOLEAN NOT NULL DEFAULT false,
  public_token TEXT UNIQUE,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- --------------------
-- Table: profiles
-- --------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- --------------------
-- Table: user_roles
-- --------------------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
-- --------------------
-- Table: user_riads
-- --------------------
CREATE TABLE public.user_riads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  riad_id UUID NOT NULL REFERENCES public.riads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, riad_id)
);
-- --------------------
-- Table: notification_attempts
-- --------------------
CREATE TABLE public.notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_request_id UUID REFERENCES public.transport_requests(id),
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  template_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  provider_message_id TEXT,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- --------------------
-- Table: cloudbeds_sync_runs
-- --------------------
CREATE TABLE public.cloudbeds_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'reconciliation',
  status TEXT NOT NULL DEFAULT 'running',
  reservations_processed INTEGER DEFAULT 0,
  reservations_created INTEGER DEFAULT 0,
  reservations_updated INTEGER DEFAULT 0,
  transport_requests_cancelled INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
-- --------------------
-- Table: cloudbeds_webhook_logs
-- --------------------
CREATE TABLE public.cloudbeds_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  reservation_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================
-- 3. INDEXES
-- ============================================
-- Performance indexes for cloudbeds_sync_runs
CREATE INDEX idx_sync_runs_property ON public.cloudbeds_sync_runs USING btree (property_id);
CREATE INDEX idx_sync_runs_started ON public.cloudbeds_sync_runs USING btree (started_at DESC);
-- Performance indexes for cloudbeds_webhook_logs
CREATE INDEX idx_webhook_logs_created ON public.cloudbeds_webhook_logs USING btree (created_at DESC);
CREATE INDEX idx_webhook_logs_property ON public.cloudbeds_webhook_logs USING btree (property_id);
-- Performance indexes for notification_attempts
CREATE INDEX idx_notification_attempts_created_at ON public.notification_attempts USING btree (created_at DESC);
CREATE INDEX idx_notification_attempts_status ON public.notification_attempts USING btree (status);
CREATE INDEX idx_notification_attempts_transport_request ON public.notification_attempts USING btree (transport_request_id);
-- Performance index for transport_requests
CREATE INDEX idx_transport_requests_public_token ON public.transport_requests USING btree (public_token);
-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.riads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riad_transport_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_riads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudbeds_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudbeds_webhook_logs ENABLE ROW LEVEL SECURITY;