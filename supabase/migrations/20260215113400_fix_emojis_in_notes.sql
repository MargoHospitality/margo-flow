-- Migration: Remove emojis from Cloudbeds notes
-- Date: 2026-02-15
-- Reason: Cloudbeds truncates notes containing UTF-8 emojis

-- Update generate_cloudbeds_note function to remove emojis
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
  
  -- Transport (no emoji)
  IF v_response.transport_status IS NOT NULL THEN
    v_note := v_note || 'TRANSPORT' || E'\n';
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
  
  -- Restauration (no emoji)
  IF v_response.restauration_preferences IS NOT NULL THEN
    v_note := v_note || 'RESTAURATION' || E'\n';
    v_note := v_note || v_response.restauration_preferences || E'\n\n';
  END IF;
  
  -- Bedding (no emoji)
  IF v_response.bedding_preferences IS NOT NULL THEN
    v_note := v_note || 'BEDDING' || E'\n';
    v_note := v_note || 'Preference: ' || v_response.bedding_preferences || E'\n';
    IF v_response.bedding_details IS NOT NULL THEN
      v_note := v_note || 'Details: ' || v_response.bedding_details || E'\n';
    END IF;
    v_note := v_note || E'\n';
  END IF;
  
  -- Other requests (no emoji)
  IF v_response.other_requests IS NOT NULL THEN
    v_note := v_note || 'OTHER REQUESTS' || E'\n';
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

COMMENT ON FUNCTION generate_cloudbeds_note IS 'Generate formatted note for Cloudbeds from check-in data (no emojis - Cloudbeds truncates UTF-8)';
