-- Ensure all required columns exist on todos table
-- This migration is safe to run even if columns already exist
ALTER TABLE todos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE todos ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0 CHECK (priority BETWEEN 0 AND 3);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS total_time_seconds integer DEFAULT 0;

-- Ensure RLS is enabled
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Recreate policies (DROP IF EXISTS first to avoid conflicts)
DROP POLICY IF EXISTS "select_own_todos" ON todos;
DROP POLICY IF EXISTS "insert_own_todos" ON todos;
DROP POLICY IF EXISTS "update_own_todos" ON todos;
DROP POLICY IF EXISTS "delete_own_todos" ON todos;

CREATE POLICY "select_own_todos" ON todos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_todos" ON todos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_todos" ON todos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_todos" ON todos FOR DELETE TO authenticated USING (auth.uid() = user_id);
