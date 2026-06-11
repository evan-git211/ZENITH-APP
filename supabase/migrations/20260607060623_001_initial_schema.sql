-- Exams table: stores exam details for each user
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  revision_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Topics table: stores study topics for each exam
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  estimated_effort INTEGER CHECK (estimated_effort >= 1 AND estimated_effort <= 5) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Day weights table: stores study intensity for each day of week
CREATE TABLE day_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE day_weights ENABLE ROW LEVEL SECURITY;

-- Scheduled assignments table: stores which topic is assigned to which day
CREATE TABLE scheduled_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  assigned_date DATE NOT NULL,
  recommended_date DATE NOT NULL,
  phase TEXT CHECK (phase IN ('learning', 'revision')) NOT NULL,
  order_in_day INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scheduled_assignments ENABLE ROW LEVEL SECURITY;

-- Todos table: user's personal task list
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  timer_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Milestones table: user's countdown milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exams
CREATE POLICY "select_own_exams" ON exams FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_exams" ON exams FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_exams" ON exams FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_exams" ON exams FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for topics
CREATE POLICY "select_own_topics" ON topics FOR SELECT
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_topics" ON topics FOR INSERT
  TO authenticated WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "update_own_topics" ON topics FOR UPDATE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid())) 
  WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_topics" ON topics FOR DELETE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));

-- RLS Policies for day_weights
CREATE POLICY "select_own_day_weights" ON day_weights FOR SELECT
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_day_weights" ON day_weights FOR INSERT
  TO authenticated WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "update_own_day_weights" ON day_weights FOR UPDATE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()))
  WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_day_weights" ON day_weights FOR DELETE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));

-- RLS Policies for scheduled_assignments
CREATE POLICY "select_own_assignments" ON scheduled_assignments FOR SELECT
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_assignments" ON scheduled_assignments FOR INSERT
  TO authenticated WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "update_own_assignments" ON scheduled_assignments FOR UPDATE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()))
  WITH CHECK (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_assignments" ON scheduled_assignments FOR DELETE
  TO authenticated USING (exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid()));

-- RLS Policies for todos
CREATE POLICY "select_own_todos" ON todos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_todos" ON todos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_todos" ON todos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_todos" ON todos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for milestones
CREATE POLICY "select_own_milestones" ON milestones FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_milestones" ON milestones FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_milestones" ON milestones FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_milestones" ON milestones FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for better query performance
CREATE INDEX idx_exams_user_id ON exams(user_id);
CREATE INDEX idx_topics_exam_id ON topics(exam_id);
CREATE INDEX idx_day_weights_exam_id ON day_weights(exam_id);
CREATE INDEX idx_assignments_exam_id ON scheduled_assignments(exam_id);
CREATE INDEX idx_assignments_topic_id ON scheduled_assignments(topic_id);
CREATE INDEX idx_assignments_date ON scheduled_assignments(assigned_date);
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_milestones_user_id ON milestones(user_id);