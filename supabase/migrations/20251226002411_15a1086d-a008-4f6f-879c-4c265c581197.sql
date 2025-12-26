-- Add is_active to riads table
ALTER TABLE public.riads ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add is_active to transport_offers table  
ALTER TABLE public.transport_offers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create profiles table for storing additional user info
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all profiles
CREATE POLICY "Super admins can manage profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

-- Trigger to update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update the handle_new_user_role function to also bootstrap super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  assigned_role app_role;
BEGIN
  -- Check if this is the bootstrap super admin email
  IF NEW.email = 'baptiste@margo-hospitality.com' THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'manager';
  END IF;
  
  -- Upsert the role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = CASE 
    WHEN NEW.email = 'baptiste@margo-hospitality.com' THEN 'super_admin'::app_role
    ELSE user_roles.role  -- Keep existing role for other users
  END;
  
  -- Also create a profile entry
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE user_id = _user_id),
    true
  )
$$;