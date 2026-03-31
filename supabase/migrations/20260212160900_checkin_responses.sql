-- Migration: Check-in Responses Storage
-- Date: 2026-02-12
-- Purpose: Store guest check-in responses (transport, restauration, bedding, other requests)

-- Table: checkin_responses
-- Stores all check-in data collected from guests
CREATE TABLE IF NOT EXISTS checkin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id TEXT NOT NULL UNIQUE,
  property_id TEXT NOT NULL,
  token TEXT NOT NULL,
  
  -- Transport details
  transport_status TEXT, -- "confirmed" | "pending" | "none" | "manual"
  transport_method TEXT, -- "flight" | "train" | "bus" | "car" | "taxi" | "other"
  transport_details TEXT,
  arrival_time TEXT, -- Will be synced to Cloudbeds native field
  
  -- Guest details (stored here temporarily, then pushed to Cloudbeds)
  guests JSONB DEFAULT '[]'::jsonb, -- Array of {firstName, lastName, nationality, passportNumber}
  
  -- Restauration preferences
  restauration_preferences TEXT,
  
  -- Bedding preferences
  bedding_preferences TEXT, -- "double" | "twin" | "other"
  bedding_details TEXT,
  
  -- Other requests
  other_requests TEXT,
  
  -- Aggregated note (sent to Cloudbeds via postNote)
  cloudbeds_note TEXT,
  
  -- Sync status
  synced_to_cloudbeds BOOLEAN DEFAULT false,
  cloudbeds_sync_at TIMESTAMPTZ,
  cloudbeds_sync_error TEXT,
  
  -- Metadata
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_token FOREIGN KEY (token) REFERENCES guest_tokens(token) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_checkin_responses_reservation ON checkin_responses(reservation_id);
CREATE INDEX idx_checkin_responses_property ON checkin_responses(property_id);
CREATE INDEX idx_checkin_responses_token ON checkin_responses(token);
CREATE INDEX idx_checkin_responses_sync ON checkin_responses(synced_to_cloudbeds, cloudbeds_sync_at);

-- RPC: Upsert check-in response (partial updates allowed)
CREATE OR REPLACE FUNCTION upsert_checkin_response(
  p_token TEXT,
  p_transport_status TEXT DEFAULT NULL,
  p_transport_method TEXT DEFAULT NULL,
  p_transport_details TEXT DEFAULT NULL,
  p_arrival_time TEXT DEFAULT NULL,
  p_guests JSONB DEFAULT NULL,
  p_restauration_preferences TEXT DEFAULT NULL,
  p_bedding_preferences TEXT DEFAULT NULL,
  p_bedding_details TEXT DEFAULT NULL,
  p_other_requests TEXT DEFAULT NULL,
  p_completed BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation_id TEXT;
  v_property_id TEXT;
  v_result JSON;
BEGIN
  -- Get reservation and property from token
  SELECT reservation_id, property_id 
  INTO v_reservation_id, v_property_id
  FROM guest_tokens 
  WHERE token = p_token AND is_active = true AND expires_at > NOW();
  
  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;
  
  -- Upsert response
  INSERT INTO checkin_responses (
    reservation_id,
    property_id,
    token,
    transport_status,
    transport_method,
    transport_details,
    arrival_time,
    guests,
    restauration_preferences,
    bedding_preferences,
    bedding_details,
    other_requests,
    completed_at,
    updated_at
  )
  VALUES (
    v_reservation_id,
    v_property_id,
    p_token,
    p_transport_status,
    p_transport_method,
    p_transport_details,
    p_arrival_time,
    p_guests,
    p_restauration_preferences,
    p_bedding_preferences,
    p_bedding_details,
    p_other_requests,
    CASE WHEN p_completed THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (reservation_id)
  DO UPDATE SET
    transport_status = COALESCE(p_transport_status, checkin_responses.transport_status),
    transport_method = COALESCE(p_transport_method, checkin_responses.transport_method),
    transport_details = COALESCE(p_transport_details, checkin_responses.transport_details),
    arrival_time = COALESCE(p_arrival_time, checkin_responses.arrival_time),
    guests = COALESCE(p_guests, checkin_responses.guests),
    restauration_preferences = COALESCE(p_restauration_preferences, checkin_responses.restauration_preferences),
    bedding_preferences = COALESCE(p_bedding_preferences, checkin_responses.bedding_preferences),
    bedding_details = COALESCE(p_bedding_details, checkin_responses.bedding_details),
    other_requests = COALESCE(p_other_requests, checkin_responses.other_requests),
    completed_at = CASE WHEN p_completed AND checkin_responses.completed_at IS NULL THEN NOW() ELSE checkin_responses.completed_at END,
    updated_at = NOW()
  RETURNING to_json(checkin_responses.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- RPC: Get check-in response by token
CREATE OR REPLACE FUNCTION get_checkin_response(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT to_json(cr.*)
  INTO v_result
  FROM checkin_responses cr
  WHERE cr.token = p_token;
  
  RETURN v_result;
END;
$$;

-- RPC: Generate aggregated Cloudbeds note
CREATE OR REPLACE FUNCTION generate_cloudbeds_note(p_reservation_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_note TEXT := '';
  v_response RECORD;
BEGIN
  SELECT * INTO v_response
  FROM checkin_responses
  WHERE reservation_id = p_reservation_id;
  
  IF v_response IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_note := '=== CHECK-IN GUEST APP ===' || E'\n\n';
  
  -- Transport
  IF v_response.transport_status IS NOT NULL THEN
    v_note := v_note || '🚗 TRANSPORT' || E'\n';
    v_note := v_note || 'Status: ' || v_response.transport_status || E'\n';
    IF v_response.transport_method IS NOT NULL THEN
      v_note := v_note || 'Method: ' || v_response.transport_method || E'\n';
    END IF;
    IF v_response.transport_details IS NOT NULL THEN
      v_note := v_note || 'Details: ' || v_response.transport_details || E'\n';
    END IF;
    IF v_response.arrival_time IS NOT NULL THEN
      v_note := v_note || 'Arrival time: ' || v_response.arrival_time || E'\n';
    END IF;
    v_note := v_note || E'\n';
  END IF;
  
  -- Restauration
  IF v_response.restauration_preferences IS NOT NULL THEN
    v_note := v_note || '🍽️ RESTAURATION' || E'\n';
    v_note := v_note || v_response.restauration_preferences || E'\n\n';
  END IF;
  
  -- Bedding
  IF v_response.bedding_preferences IS NOT NULL THEN
    v_note := v_note || '🛏️ BEDDING' || E'\n';
    v_note := v_note || 'Preference: ' || v_response.bedding_preferences || E'\n';
    IF v_response.bedding_details IS NOT NULL THEN
      v_note := v_note || 'Details: ' || v_response.bedding_details || E'\n';
    END IF;
    v_note := v_note || E'\n';
  END IF;
  
  -- Other requests
  IF v_response.other_requests IS NOT NULL THEN
    v_note := v_note || '📝 OTHER REQUESTS' || E'\n';
    v_note := v_note || v_response.other_requests || E'\n\n';
  END IF;
  
  v_note := v_note || '---' || E'\n';
  v_note := v_note || 'Completed: ' || COALESCE(v_response.completed_at::TEXT, 'In progress');
  
  -- Store note in table
  UPDATE checkin_responses
  SET cloudbeds_note = v_note
  WHERE reservation_id = p_reservation_id;
  
  RETURN v_note;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON checkin_responses TO anon, authenticated;

-- Comments
COMMENT ON TABLE checkin_responses IS 'Guest check-in responses collected via Guest App';
COMMENT ON FUNCTION upsert_checkin_response IS 'Create or update check-in response (partial updates allowed)';
COMMENT ON FUNCTION get_checkin_response IS 'Retrieve check-in response by token';
COMMENT ON FUNCTION generate_cloudbeds_note IS 'Generate formatted note for Cloudbeds from check-in data';
