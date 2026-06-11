-- Add notes column to topics table
ALTER TABLE topics ADD COLUMN IF NOT EXISTS notes text;

-- Add study_streaks table to track daily completions
CREATE TABLE IF NOT EXISTS study_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date date NOT NULL,
  topics_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, study_date)
);

ALTER TABLE study_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_streaks" ON study_streaks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_streaks" ON study_streaks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_streaks" ON study_streaks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_streaks" ON study_streaks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_study_streaks_user_date ON study_streaks(user_id, study_date);