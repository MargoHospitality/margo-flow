-- Migration: Fix upsert_checkin_response RPC function
-- Date: 2026-02-13
-- Purpose: Eliminate column ambiguity error in RETURNING clause

-- Drop old function (all possible signatures)
DROP FUNCTION IF EXISTS upsert_checkin_response(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN
);

DROP FUNCTION IF EXISTS upsert_checkin_response(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
);

-- Recreate with correct signature matching backend usage
CREATE OR REPLACE FUNCTION upsert_checkin_response(
  v_token text,
  v_reservation_id text,
  v_property_id text,
  v_transport_status text DEFAULT NULL,
  v_transport_method text DEFAULT NULL,
  v_transport_details text DEFAULT NULL,
  v_arrival_time text DEFAULT NULL,
  v_guests jsonb DEFAULT NULL,
  v_restauration_preferences text DEFAULT NULL,
  v_bedding_preferences text DEFAULT NULL,
  v_bedding_details text DEFAULT NULL,
  v_other_requests text DEFAULT NULL,
  v_cloudbeds_note text DEFAULT NULL,
  v_completed_at timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  token text,
  reservation_id text,
  property_id text,
  transport_status text,
  transport_method text,
  transport_details text,
  arrival_time text,
  guests jsonb,
  restauration_preferences text,
  bedding_preferences text,
  bedding_details text,
  other_requests text,
  cloudbeds_note text,
  synced_to_cloudbeds boolean,
  cloudbeds_sync_at timestamp with time zone,
  cloudbeds_sync_error text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH upserted AS (
    INSERT INTO checkin_responses (
      token,
      reservation_id,
      property_id,
      transport_status,
      transport_method,
      transport_details,
      arrival_time,
      guests,
      restauration_preferences,
      bedding_preferences,
      bedding_details,
      other_requests,
      cloudbeds_note,
      completed_at,
      updated_at
    )
    VALUES (
      v_token,
      v_reservation_id,
      v_property_id,
      v_transport_status,
      v_transport_method,
      v_transport_details,
      v_arrival_time,
      v_guests,
      v_restauration_preferences,
      v_bedding_preferences,
      v_bedding_details,
      v_other_requests,
      v_cloudbeds_note,
      v_completed_at,
      now()
    )
    ON CONFLICT (reservation_id) DO UPDATE SET
      transport_status = COALESCE(EXCLUDED.transport_status, checkin_responses.transport_status),
      transport_method = COALESCE(EXCLUDED.transport_method, checkin_responses.transport_method),
      transport_details = COALESCE(EXCLUDED.transport_details, checkin_responses.transport_details),
      arrival_time = COALESCE(EXCLUDED.arrival_time, checkin_responses.arrival_time),
      guests = COALESCE(EXCLUDED.guests, checkin_responses.guests),
      restauration_preferences = COALESCE(EXCLUDED.restauration_preferences, checkin_responses.restauration_preferences),
      bedding_preferences = COALESCE(EXCLUDED.bedding_preferences, checkin_responses.bedding_preferences),
      bedding_details = COALESCE(EXCLUDED.bedding_details, checkin_responses.bedding_details),
      other_requests = COALESCE(EXCLUDED.other_requests, checkin_responses.other_requests),
      cloudbeds_note = COALESCE(EXCLUDED.cloudbeds_note, checkin_responses.cloudbeds_note),
      completed_at = COALESCE(EXCLUDED.completed_at, checkin_responses.completed_at),
      updated_at = now()
    RETURNING *
  )
  SELECT * FROM upserted;
END;
$$;

COMMENT ON FUNCTION upsert_checkin_response IS 'Upsert check-in response with CTE to avoid column ambiguity (backend-compatible signature)';
