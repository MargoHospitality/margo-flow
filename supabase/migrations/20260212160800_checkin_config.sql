-- Migration: Check-in Configuration per Property
-- Date: 2026-02-12
-- Purpose: Allow customization of check-in steps by property

-- Table: checkin_config
-- Stores which steps are enabled for each property
CREATE TABLE IF NOT EXISTS checkin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL UNIQUE,
  
  -- Step toggles
  step_transport_enabled BOOLEAN DEFAULT true,
  step_guest_details_enabled BOOLEAN DEFAULT true,
  step_restauration_enabled BOOLEAN DEFAULT true,
  step_bedding_enabled BOOLEAN DEFAULT true,
  step_other_requests_enabled BOOLEAN DEFAULT true,
  
  -- Multi-guest config
  first_guest_mandatory BOOLEAN DEFAULT true,
  additional_guests_optional BOOLEAN DEFAULT true,
  max_additional_guests INTEGER DEFAULT 10,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES riads(property_id) ON DELETE CASCADE
);

-- Index for fast property lookup
CREATE INDEX idx_checkin_config_property ON checkin_config(property_id);

-- RPC: Get check-in config for a property (with defaults)
CREATE OR REPLACE FUNCTION get_checkin_config(p_property_id TEXT)
RETURNS TABLE (
  property_id TEXT,
  step_transport_enabled BOOLEAN,
  step_guest_details_enabled BOOLEAN,
  step_restauration_enabled BOOLEAN,
  step_bedding_enabled BOOLEAN,
  step_other_requests_enabled BOOLEAN,
  first_guest_mandatory BOOLEAN,
  additional_guests_optional BOOLEAN,
  max_additional_guests INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(cc.property_id, p_property_id) as property_id,
    COALESCE(cc.step_transport_enabled, true) as step_transport_enabled,
    COALESCE(cc.step_guest_details_enabled, true) as step_guest_details_enabled,
    COALESCE(cc.step_restauration_enabled, true) as step_restauration_enabled,
    COALESCE(cc.step_bedding_enabled, true) as step_bedding_enabled,
    COALESCE(cc.step_other_requests_enabled, true) as step_other_requests_enabled,
    COALESCE(cc.first_guest_mandatory, true) as first_guest_mandatory,
    COALESCE(cc.additional_guests_optional, true) as additional_guests_optional,
    COALESCE(cc.max_additional_guests, 10) as max_additional_guests
  FROM (SELECT p_property_id as property_id) base
  LEFT JOIN checkin_config cc ON cc.property_id = p_property_id;
END;
$$;

-- RPC: Upsert check-in config
CREATE OR REPLACE FUNCTION upsert_checkin_config(
  p_property_id TEXT,
  p_step_transport_enabled BOOLEAN DEFAULT NULL,
  p_step_guest_details_enabled BOOLEAN DEFAULT NULL,
  p_step_restauration_enabled BOOLEAN DEFAULT NULL,
  p_step_bedding_enabled BOOLEAN DEFAULT NULL,
  p_step_other_requests_enabled BOOLEAN DEFAULT NULL,
  p_first_guest_mandatory BOOLEAN DEFAULT NULL,
  p_additional_guests_optional BOOLEAN DEFAULT NULL,
  p_max_additional_guests INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO checkin_config (
    property_id,
    step_transport_enabled,
    step_guest_details_enabled,
    step_restauration_enabled,
    step_bedding_enabled,
    step_other_requests_enabled,
    first_guest_mandatory,
    additional_guests_optional,
    max_additional_guests,
    updated_at
  )
  VALUES (
    p_property_id,
    COALESCE(p_step_transport_enabled, true),
    COALESCE(p_step_guest_details_enabled, true),
    COALESCE(p_step_restauration_enabled, true),
    COALESCE(p_step_bedding_enabled, true),
    COALESCE(p_step_other_requests_enabled, true),
    COALESCE(p_first_guest_mandatory, true),
    COALESCE(p_additional_guests_optional, true),
    COALESCE(p_max_additional_guests, 10),
    NOW()
  )
  ON CONFLICT (property_id) 
  DO UPDATE SET
    step_transport_enabled = COALESCE(p_step_transport_enabled, checkin_config.step_transport_enabled),
    step_guest_details_enabled = COALESCE(p_step_guest_details_enabled, checkin_config.step_guest_details_enabled),
    step_restauration_enabled = COALESCE(p_step_restauration_enabled, checkin_config.step_restauration_enabled),
    step_bedding_enabled = COALESCE(p_step_bedding_enabled, checkin_config.step_bedding_enabled),
    step_other_requests_enabled = COALESCE(p_step_other_requests_enabled, checkin_config.step_other_requests_enabled),
    first_guest_mandatory = COALESCE(p_first_guest_mandatory, checkin_config.first_guest_mandatory),
    additional_guests_optional = COALESCE(p_additional_guests_optional, checkin_config.additional_guests_optional),
    max_additional_guests = COALESCE(p_max_additional_guests, checkin_config.max_additional_guests),
    updated_at = NOW()
  RETURNING to_json(checkin_config.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant permissions (adjust based on your RLS policies)
GRANT SELECT ON checkin_config TO anon, authenticated;
GRANT INSERT, UPDATE ON checkin_config TO authenticated;

-- Comment
COMMENT ON TABLE checkin_config IS 'Per-property check-in step configuration';
COMMENT ON FUNCTION get_checkin_config IS 'Retrieve check-in config with fallback to defaults';
COMMENT ON FUNCTION upsert_checkin_config IS 'Create or update check-in config for a property';
