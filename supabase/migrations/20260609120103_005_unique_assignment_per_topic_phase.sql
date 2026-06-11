-- Ensure each topic appears at most once per phase per exam
-- This prevents duplicate assignments from concurrent recalculations
ALTER TABLE scheduled_assignments
  ADD CONSTRAINT uq_assignment_topic_phase UNIQUE (exam_id, topic_id, phase);