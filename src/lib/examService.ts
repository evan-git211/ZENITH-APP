import { supabase } from './supabase';
import type { Exam, Topic, DayWeight, ScheduledAssignment } from '../types/database';
import { scheduleTopicsBackward } from './schedulingAlgorithm';

// Create a new exam with all related data
export async function createExam(data: {
  name: string;
  examDate: Date;
  revisionDays: number;
  topics: { title: string; estimatedEffort: number }[];
  dayWeights: { dayOfWeek: number; weight: number }[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      user_id: user.id,
      name: data.name,
      exam_date: data.examDate.toISOString().split('T')[0],
      revision_days: data.revisionDays,
    })
    .select()
    .single();

  if (examError) throw examError;

  // Create topics
  const topicsToInsert = data.topics.map((t) => ({
    exam_id: exam.id,
    title: t.title,
    estimated_effort: t.estimatedEffort,
  }));

  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .insert(topicsToInsert)
    .select();

  if (topicsError) throw topicsError;

  // Create day weights
  const weightsToInsert = data.dayWeights.map((w) => ({
    exam_id: exam.id,
    day_of_week: w.dayOfWeek,
    weight: w.weight,
  }));

  const { error: weightsError } = await supabase
    .from('day_weights')
    .insert(weightsToInsert);

  if (weightsError) throw weightsError;

  // Schedule topics using the backward algorithm
  const assignments = scheduleTopicsBackward({
    examDate: data.examDate,
    revisionDays: data.revisionDays,
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      estimatedEffort: t.estimated_effort,
    })),
    dayWeights: data.dayWeights,
  });

  // Create scheduled assignments (upsert prevents duplicates on double-invoke)
  const assignmentsToInsert = assignments.map((a) => ({
    exam_id: exam.id,
    topic_id: a.topicId,
    assigned_date: a.assignedDate,
    recommended_date: a.recommendedDate,
    phase: a.phase,
    order_in_day: a.orderInDay,
  }));

  const { error: assignmentsError } = await supabase
    .from('scheduled_assignments')
    .upsert(assignmentsToInsert, { onConflict: 'exam_id,topic_id,phase' });

  if (assignmentsError) throw assignmentsError;

  return { exam, topics, assignments };
}

// Get all exams for the current user
export async function getExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('exam_date', { ascending: true });

  if (error) throw error;
  return data;
}

// Get a single exam with all related data
export async function getExamWithDetails(examId: string) {
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (examError) throw examError;

  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('*')
    .eq('exam_id', examId)
    .order('created_at', { ascending: true });

  if (topicsError) throw topicsError;

  const { data: dayWeights, error: weightsError } = await supabase
    .from('day_weights')
    .select('*')
    .eq('exam_id', examId);

  if (weightsError) throw weightsError;

  const { data: assignments, error: assignmentsError } = await supabase
    .from('scheduled_assignments')
    .select('*')
    .eq('exam_id', examId)
    .order('assigned_date', { ascending: true });

  if (assignmentsError) throw assignmentsError;

  return { exam, topics, dayWeights, assignments };
}

// Update topic completion status
export async function updateTopicCompletion(
  topicId: string,
  isCompleted: boolean
): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update revision assignment completion (independent from topic completion)
export async function updateAssignmentCompletion(
  assignmentId: string,
  isCompleted: boolean
): Promise<ScheduledAssignment> {
  const { data, error } = await supabase
    .from('scheduled_assignments')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update topic details
export async function updateTopic(
  topicId: string,
  updates: { title: string; estimatedEffort: number; notes?: string }
): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .update({
      title: updates.title,
      estimated_effort: updates.estimatedEffort,
      notes: updates.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a topic
export async function deleteTopic(topicId: string): Promise<void> {
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  if (error) throw error;
}

// Update topic assignment (for drag-and-drop)
export async function updateTopicAssignment(
  assignmentId: string,
  newDate: string
): Promise<ScheduledAssignment> {
  const { data, error } = await supabase
    .from('scheduled_assignments')
    .update({
      assigned_date: newDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete all assignments on a specific date/phase (for tile deletion)
export async function deleteAssignmentsOnDate(
  examId: string,
  date: string,
  phase: 'learning' | 'revision'
): Promise<void> {
  const { error } = await supabase
    .from('scheduled_assignments')
    .delete()
    .eq('exam_id', examId)
    .eq('assigned_date', date)
    .eq('phase', phase);
  if (error) throw error;
}

// Delete an exam and all its data
export async function deleteExam(examId: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) throw error;
}

// Recalculate schedule (redistribute incomplete topics).
// Uses upsert so concurrent calls are idempotent — no duplicate rows.
export async function recalculateSchedule(examId: string): Promise<void> {
  const { exam, topics, dayWeights } = await getExamWithDetails(examId);

  const incompleteTopics = topics.filter((t) => !t.is_completed);
  if (incompleteTopics.length === 0) return;

  const newAssignments = scheduleTopicsBackward({
    examDate: new Date(exam.exam_date),
    revisionDays: exam.revision_days,
    topics: incompleteTopics.map((t) => ({
      id: t.id,
      title: t.title,
      estimatedEffort: t.estimated_effort,
    })),
    dayWeights: dayWeights.map((w) => ({
      dayOfWeek: w.day_of_week,
      weight: w.weight,
    })),
  });

  const assignmentsToUpsert = newAssignments.map((a) => ({
    exam_id: examId,
    topic_id: a.topicId,
    assigned_date: a.assignedDate,
    recommended_date: a.recommendedDate,
    phase: a.phase,
    order_in_day: a.orderInDay,
  }));

  // onConflict: unique (exam_id, topic_id, phase) → update dates in place, never duplicates
  await supabase
    .from('scheduled_assignments')
    .upsert(assignmentsToUpsert, { onConflict: 'exam_id,topic_id,phase' });
}

// Reset all topics and recalculate
export async function resetSchedule(examId: string): Promise<void> {
  // Mark all topics incomplete
  await supabase
    .from('topics')
    .update({
      is_completed: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('exam_id', examId);

  // Delete all assignments
  await supabase.from('scheduled_assignments').delete().eq('exam_id', examId);

  // Recalculate
  await recalculateSchedule(examId);
}
