-- Migration: Add restaurant prices to checkin_config
-- Created: 2026-02-13
-- Purpose: Allow dynamic pricing display for lunch/dinner in check-in flow

ALTER TABLE checkin_config
ADD COLUMN lunch_price NUMERIC(10, 2),
ADD COLUMN dinner_price NUMERIC(10, 2),
ADD COLUMN currency TEXT DEFAULT 'MAD';

COMMENT ON COLUMN checkin_config.lunch_price IS 'Price for lunch in local currency (nullable if not offered)';
COMMENT ON COLUMN checkin_config.dinner_price IS 'Price for dinner in local currency (nullable if not offered)';
COMMENT ON COLUMN checkin_config.currency IS 'Currency code (e.g., MAD, EUR, USD)';
