export interface Exam {
  id: string;
  user_id: string;
  name: string;
  exam_date: string;
  revision_days: number;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  exam_id: string;
  title: string;
  estimated_effort: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyStreak {
  id: string;
  user_id: string;
  study_date: string;
  topics_completed: number;
  created_at: string;
}

export interface DayWeight {
  id: string;
  exam_id: string;
  day_of_week: number;
  weight: number;
  created_at: string;
}

export interface ScheduledAssignment {
  id: string;
  exam_id: string;
  topic_id: string;
  assigned_date: string;
  recommended_date: string;
  phase: 'learning' | 'revision';
  order_in_day: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  timer_minutes: number | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  created_at: string;
}
