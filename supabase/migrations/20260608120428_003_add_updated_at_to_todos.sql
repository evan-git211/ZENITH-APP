-- Add missing columns to todos table
ALTER TABLE todos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE todos ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0 CHECK (priority BETWEEN 0 AND 3);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS total_time_seconds integer DEFAULT 0;