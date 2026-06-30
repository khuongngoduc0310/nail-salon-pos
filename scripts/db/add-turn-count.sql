-- Migration: Add turn_count to services and turns, add salon_settings table
-- Run against the salon_pos database

BEGIN;

-- 1. Add turn_count to services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS turn_count INT NOT NULL DEFAULT 1;

-- 2. Add turn_count to turns
ALTER TABLE turns
  ADD COLUMN IF NOT EXISTS turn_count INT NOT NULL DEFAULT 1;

-- 3. Create salon_settings singleton table
CREATE TABLE IF NOT EXISTS salon_settings (
  id                        VARCHAR(32) NOT NULL DEFAULT 'default' PRIMARY KEY,
  turn_count_threshold_cents INT NOT NULL DEFAULT 3000,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Insert default row if none exists
INSERT INTO salon_settings (id, turn_count_threshold_cents)
VALUES ('default', 3000)
ON CONFLICT (id) DO NOTHING;

COMMIT;