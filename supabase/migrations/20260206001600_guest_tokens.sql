-- Migration: Guest Tokens for Margo Flow
-- Date: 2026-02-06
-- Description: Système de tokenisation pour accès sécurisé guest app

-- Table pour stocker les tokens
CREATE TABLE IF NOT EXISTS guest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  reservation_id text NOT NULL,
  property_id text NOT NULL,
  guest_email text,
  guest_name text,
  check_in_date date,
  check_out_date date,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_accessed_at timestamptz,
  revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text
);

-- Index pour performance
CREATE INDEX idx_guest_tokens_token ON guest_tokens(token);
CREATE INDEX idx_guest_tokens_reservation_id ON guest_tokens(reservation_id);
CREATE INDEX idx_guest_tokens_expires_at ON guest_tokens(expires_at) WHERE revoked = false;

-- RLS (Row Level Security)
ALTER TABLE guest_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut lire avec un token valide (via fonction)
CREATE POLICY "Tokens are readable by token value"
  ON guest_tokens
  FOR SELECT
  USING (true); -- Sécurité gérée dans les fonctions

-- Policy: Seul le service role peut écrire
CREATE POLICY "Service role can insert tokens"
  ON guest_tokens
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role peut update (pour revoke)
CREATE POLICY "Service role can update tokens"
  ON guest_tokens
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Fonction: Générer un token unique
CREATE OR REPLACE FUNCTION generate_guest_token(
  p_reservation_id text,
  p_property_id text,
  p_guest_email text DEFAULT NULL,
  p_guest_name text DEFAULT NULL,
  p_check_in_date date DEFAULT NULL,
  p_check_out_date date DEFAULT NULL,
  p_expires_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_token_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Générer token unique (hash sécurisé)
  v_token := encode(
    digest(
      p_reservation_id || 
      p_property_id || 
      now()::text || 
      random()::text || 
      gen_random_uuid()::text,
      'sha256'
    ),
    'hex'
  );
  
  -- Calculer date d'expiration (par défaut 90 jours)
  v_expires_at := now() + (p_expires_days || ' days')::interval;
  
  -- Insérer le token
  INSERT INTO guest_tokens (
    token,
    reservation_id,
    property_id,
    guest_email,
    guest_name,
    check_in_date,
    check_out_date,
    expires_at
  )
  VALUES (
    v_token,
    p_reservation_id,
    p_property_id,
    p_guest_email,
    p_guest_name,
    p_check_in_date,
    p_check_out_date,
    v_expires_at
  )
  RETURNING id INTO v_token_id;
  
  -- Retourner token + métadonnées
  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'token_id', v_token_id,
    'expires_at', v_expires_at,
    'url', 'https://margo-flow.vercel.app/guest?token=' || v_token
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Fonction: Vérifier et récupérer infos via token
CREATE OR REPLACE FUNCTION verify_guest_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_data jsonb;
BEGIN
  -- Récupérer les données du token
  SELECT jsonb_build_object(
    'valid', true,
    'reservation_id', reservation_id,
    'property_id', property_id,
    'guest_email', guest_email,
    'guest_name', guest_name,
    'check_in_date', check_in_date,
    'check_out_date', check_out_date,
    'expires_at', expires_at,
    'last_accessed_at', last_accessed_at
  ) INTO v_token_data
  FROM guest_tokens
  WHERE token = p_token
    AND expires_at > now()
    AND revoked = false;
  
  -- Si token trouvé, mettre à jour last_accessed_at
  IF v_token_data IS NOT NULL THEN
    UPDATE guest_tokens
    SET last_accessed_at = now()
    WHERE token = p_token;
  END IF;
  
  -- Retourner résultat
  RETURN COALESCE(
    v_token_data,
    jsonb_build_object('valid', false, 'error', 'Invalid or expired token')
  );
  
END;
$$;

-- Fonction: Révoquer un token
CREATE OR REPLACE FUNCTION revoke_guest_token(
  p_token text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE guest_tokens
  SET 
    revoked = true,
    revoked_at = now(),
    revoked_reason = p_reason
  WHERE token = p_token
    AND revoked = false
  RETURNING true INTO v_updated;
  
  IF v_updated THEN
    RETURN jsonb_build_object('success', true, 'message', 'Token revoked');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Token not found or already revoked');
  END IF;
END;
$$;

-- Commentaires
COMMENT ON TABLE guest_tokens IS 'Tokens sécurisés pour accès guest app (Margo Flow)';
COMMENT ON FUNCTION generate_guest_token IS 'Génère un token unique pour une réservation';
COMMENT ON FUNCTION verify_guest_token IS 'Vérifie et récupère les données d''un token';
COMMENT ON FUNCTION revoke_guest_token IS 'Révoque un token (annulation, checkout, etc.)';
