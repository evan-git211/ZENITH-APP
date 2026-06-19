import { supabase } from './supabase';
import type { Exam, Topic, DayWeight, ScheduledAssignment } from '../types/database';
import { scheduleTopicsBackward } from './schedulingAlgorithm';

// Create a new exam with all related data.
// On any failure after the exam row is created, the exam is deleted so child
// records cascade away — preventing orphaned data without a true DB transaction.
export async function createExam(data: {
  name: string;
  examDate: Date;
  revisionDays: number;
  topics: { title: string; estimatedEffort: number }[];
  dayWeights: { dayOfWeek: number; weight: number }[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let examId: string | null = null;
  try {
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
    examId = exam.id;

    // Create topics — sort_order preserves the wizard's drag-reorder sequence
    const topicsToInsert = data.topics.map((t, i) => ({
      exam_id: exam.id,
      title: t.title,
      estimated_effort: t.estimatedEffort,
      sort_order: i,
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
  } catch (err) {
    // Best-effort rollback: deleting the exam cascades to topics, weights, assignments
    if (examId) {
      await supabase.from('exams').delete().eq('id', examId);
    }
    throw err;
  }
}

export async function renameExam(examId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('exams')
    .update({ name: name.trim() })
    .eq('id', examId);
  if (error) throw error;
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

export interface ExamProgress {
  exam: Exam;
  totalAssignments: number;
  completedAssignments: number;
  currentPhase: 'learning' | 'revision' | 'complete';
  progressPercent: number;
  revisionTotal: number;
  revisionCompleted: number;
  revisionPercent: number;
}

type RawAssignment = { id: string; is_completed: boolean; phase: string; assigned_date: string };
interface RawExamRow extends Exam {
  scheduled_assignments: RawAssignment[];
}

// Get all exams with lightweight progress data — single round-trip via embedded select
export async function getExamsWithProgress(): Promise<ExamProgress[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*, scheduled_assignments(id, is_completed, phase, assigned_date)')
    .order('exam_date', { ascending: true });

  if (error) throw error;

  const today = new Date().toISOString().split('T')[0];

  return (data as RawExamRow[]).map((row) => {
    const assignments: RawAssignment[] = row.scheduled_assignments ?? [];

    // Learning phase progress
    const learningAssignments = assignments.filter((a) => a.phase === 'learning');
    const total = learningAssignments.length;
    const completed = learningAssignments.filter((a) => a.is_completed).length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Revision phase progress
    const revisionAssignments = assignments.filter((a) => a.phase === 'revision');
    const revisionTotal = revisionAssignments.length;
    const revisionCompleted = revisionAssignments.filter((a) => a.is_completed).length;
    const revisionPercent = revisionTotal > 0 ? Math.round((revisionCompleted / revisionTotal) * 100) : 0;

    // Determine current phase from today's schedule
    const todayAssignments = assignments.filter((a) => a.assigned_date === today);
    const hasRevisionToday = todayAssignments.some((a) => a.phase === 'revision');
    const hasLearningToday = todayAssignments.some((a) => a.phase === 'learning');

    let currentPhase: 'learning' | 'revision' | 'complete' = 'learning';
    if (total > 0 && completed === total) {
      currentPhase = 'complete';
    } else if (hasRevisionToday && !hasLearningToday) {
      currentPhase = 'revision';
    } else if (!hasRevisionToday && !hasLearningToday) {
      // Rest day — infer from next upcoming assignment
      const upcoming = assignments
        .filter((a) => !a.is_completed && a.assigned_date >= today)
        .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date));
      if (upcoming.length > 0) {
        currentPhase = upcoming[0].phase as 'learning' | 'revision';
      }
    }

    const { scheduled_assignments: _dropped, ...exam } = row;
    return { exam: exam as Exam, totalAssignments: total, completedAssignments: completed, currentPhase, progressPercent, revisionTotal, revisionCompleted, revisionPercent };
  });
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
    .order('sort_order', { ascending: true })
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

// Batch-complete or batch-uncomplete many assignments in a single UPDATE
export async function batchUpdateAssignmentCompletion(ids: string[], isCompleted: boolean): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('scheduled_assignments')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);
  if (error) throw error;
}

// Batch-complete or batch-uncomplete many topics in a single UPDATE
export async function batchUpdateTopicCompletion(topicIds: string[], isCompleted: boolean): Promise<void> {
  if (topicIds.length === 0) return;
  const { error } = await supabase
    .from('topics')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .in('id', topicIds);
  if (error) throw error;
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
  const { error: upsertError } = await supabase
    .from('scheduled_assignments')
    .upsert(assignmentsToUpsert, { onConflict: 'exam_id,topic_id,phase' });
  if (upsertError) throw upsertError;
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
