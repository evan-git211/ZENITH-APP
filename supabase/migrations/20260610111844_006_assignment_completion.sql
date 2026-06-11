-- Separate completion state per assignment so revision and learning phases are independent
ALTER TABLE scheduled_assignments
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;