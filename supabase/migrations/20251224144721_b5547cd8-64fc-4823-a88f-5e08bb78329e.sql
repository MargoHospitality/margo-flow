-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'manager');

-- Create transport_type enum
CREATE TYPE public.transport_type AS ENUM ('airport_pickup', 'train_station_pickup', 'hotel_pickup', 'bus_station_pickup');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'confirmed', 'rejected', 'canceled_due_to_reservation');

-- Create payment_mode enum
CREATE TYPE public.payment_mode AS ENUM ('at_riad', 'to_driver');

-- Create reservation_status enum
CREATE TYPE public.reservation_status AS ENUM ('confirmed', 'checked_in', 'checked_out', 'canceled', 'no_show');

-- Riads table
CREATE TABLE public.riads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT,
  manager_whatsapp TEXT,
  cloudbeds_property_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (for admin/manager roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- User-Riad mapping (which users can manage which riads)
CREATE TABLE public.user_riads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  riad_id UUID REFERENCES public.riads(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, riad_id)
);

-- Reservations from Cloudbeds
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL UNIQUE,
  guest_last_name TEXT NOT NULL,
  guest_first_name TEXT,
  check_in_date DATE NOT NULL,
  status reservation_status NOT NULL DEFAULT 'confirmed',
  guest_country_code TEXT,
  riad_id UUID REFERENCES public.riads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transport offers (global reference)
CREATE TABLE public.transport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_fr TEXT,
  type transport_type NOT NULL,
  fields_schema JSONB DEFAULT '[]'::jsonb,
  default_day_price DECIMAL(10,2) NOT NULL,
  default_night_price DECIMAL(10,2) NOT NULL,
  default_base_pax INTEGER NOT NULL DEFAULT 3,
  default_extra_pax_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  default_payment_mode payment_mode NOT NULL DEFAULT 'at_riad',
  day_start_time TIME NOT NULL DEFAULT '08:00',
  day_end_time TIME NOT NULL DEFAULT '20:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Riad-specific transport offer overrides
CREATE TABLE public.riad_transport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riad_id UUID REFERENCES public.riads(id) ON DELETE CASCADE NOT NULL,
  transport_offer_id UUID REFERENCES public.transport_offers(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  override_day_price DECIMAL(10,2),
  override_night_price DECIMAL(10,2),
  override_base_pax INTEGER,
  override_extra_pax_price DECIMAL(10,2),
  override_payment_mode payment_mode,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (riad_id, transport_offer_id)
);

-- Transport requests
CREATE TABLE public.transport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id TEXT NOT NULL REFERENCES public.reservations(reservation_id) ON DELETE CASCADE,
  riad_id UUID NOT NULL REFERENCES public.riads(id) ON DELETE CASCADE,
  transport_offer_id UUID NOT NULL REFERENCES public.transport_offers(id) ON DELETE CASCADE,
  transport_date DATE NOT NULL,
  transport_time TIME NOT NULL,
  pax INTEGER NOT NULL,
  computed_price DECIMAL(10,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  payload_details JSONB DEFAULT '{}'::jsonb,
  status request_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.riads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_riads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riad_transport_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check if user has access to a riad
CREATE OR REPLACE FUNCTION public.has_riad_access(_user_id UUID, _riad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_riads
    WHERE user_id = _user_id
      AND riad_id = _riad_id
  ) OR public.has_role(_user_id, 'super_admin')
$$;

-- RLS Policies for riads
CREATE POLICY "Public can view riads" ON public.riads FOR SELECT USING (true);
CREATE POLICY "Super admins can manage riads" ON public.riads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for user_riads
CREATE POLICY "Users can view own riad mappings" ON public.user_riads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage riad mappings" ON public.user_riads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for reservations (public read for guest validation, managers can see their riads)
CREATE POLICY "Public can validate reservations" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Managers can view their riad reservations" ON public.reservations FOR SELECT TO authenticated USING (public.has_riad_access(auth.uid(), riad_id));
CREATE POLICY "Super admins can manage reservations" ON public.reservations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for transport_offers
CREATE POLICY "Public can view transport offers" ON public.transport_offers FOR SELECT USING (true);
CREATE POLICY "Super admins can manage transport offers" ON public.transport_offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for riad_transport_offers
CREATE POLICY "Public can view active riad transport offers" ON public.riad_transport_offers FOR SELECT USING (is_active = true);
CREATE POLICY "Managers can view their riad offers" ON public.riad_transport_offers FOR SELECT TO authenticated USING (public.has_riad_access(auth.uid(), riad_id));
CREATE POLICY "Super admins can manage riad transport offers" ON public.riad_transport_offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for transport_requests
CREATE POLICY "Public can insert transport requests" ON public.transport_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view own transport request by reservation" ON public.transport_requests FOR SELECT USING (true);
CREATE POLICY "Managers can view their riad requests" ON public.transport_requests FOR SELECT TO authenticated USING (public.has_riad_access(auth.uid(), riad_id));
CREATE POLICY "Managers can update their riad requests" ON public.transport_requests FOR UPDATE TO authenticated USING (public.has_riad_access(auth.uid(), riad_id));
CREATE POLICY "Super admins can manage all requests" ON public.transport_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_riads_updated_at BEFORE UPDATE ON public.riads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_offers_updated_at BEFORE UPDATE ON public.transport_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_riad_transport_offers_updated_at BEFORE UPDATE ON public.riad_transport_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transport_requests_updated_at BEFORE UPDATE ON public.transport_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default transport offers
INSERT INTO public.transport_offers (name, name_fr, type, fields_schema, default_day_price, default_night_price, default_base_pax, default_extra_pax_price, default_payment_mode) VALUES
('Airport Pickup', 'Transfert Aéroport', 'airport_pickup', '[{"key": "flight_number", "label": "Flight Number", "label_fr": "Numéro de vol", "type": "text", "required": true}, {"key": "arrival_time", "label": "Flight Arrival Time", "label_fr": "Heure d''arrivée du vol", "type": "time", "required": true}]'::jsonb, 25.00, 35.00, 3, 5.00, 'at_riad'),
('Train Station Pickup', 'Transfert Gare', 'train_station_pickup', '[{"key": "train_number", "label": "Train Number", "label_fr": "Numéro de train", "type": "text", "required": false}, {"key": "arrival_time", "label": "Train Arrival Time", "label_fr": "Heure d''arrivée du train", "type": "time", "required": true}]'::jsonb, 15.00, 20.00, 3, 3.00, 'at_riad'),
('Hotel Pickup', 'Transfert Hôtel', 'hotel_pickup', '[{"key": "hotel_name", "label": "Hotel Name", "label_fr": "Nom de l''hôtel", "type": "text", "required": true}, {"key": "hotel_address", "label": "Hotel Address", "label_fr": "Adresse de l''hôtel", "type": "text", "required": true}]'::jsonb, 20.00, 30.00, 3, 4.00, 'at_riad'),
('Bus Station Pickup', 'Transfert Gare Routière', 'bus_station_pickup', '[{"key": "bus_company", "label": "Bus Company", "label_fr": "Compagnie de bus", "type": "text", "required": false}, {"key": "arrival_time", "label": "Bus Arrival Time", "label_fr": "Heure d''arrivée du bus", "type": "time", "required": true}]'::jsonb, 12.00, 18.00, 3, 3.00, 'at_riad');