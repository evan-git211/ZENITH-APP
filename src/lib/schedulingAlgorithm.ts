import { addDays, differenceInDays, getDay, isBefore, isAfter, startOfDay, format } from 'date-fns';

interface TopicInput {
  id: string;
  title: string;
  estimatedEffort: number;
}

interface DayWeightInput {
  dayOfWeek: number;
  weight: number;
}

interface AssignmentOutput {
  topicId: string;
  assignedDate: string;
  recommendedDate: string;
  phase: 'learning' | 'revision';
  orderInDay: number;
}

interface SchedulingInput {
  examDate: Date;
  revisionDays: number;
  topics: TopicInput[];
  dayWeights: DayWeightInput[];
}

interface DaySlot {
  dateStr: string; // local-timezone date string (yyyy-MM-dd)
  weight: number;
  remaining: number;
}

// Build available day slots between [from, to).
// Uses local-timezone dates to avoid UTC shift bugs.
function buildDaySlots(
  from: Date,
  to: Date,
  getDayWeight: (d: Date) => number,
  inclusive: boolean
): DaySlot[] {
  const slots: DaySlot[] = [];
  for (
    let d = new Date(from);
    inclusive ? !isAfter(d, to) : isBefore(d, to);
    d = addDays(d, 1)
  ) {
    const weight = getDayWeight(d);
    if (weight > 0) {
      slots.push({ dateStr: format(d, 'yyyy-MM-dd'), weight, remaining: weight });
    }
  }
  return slots;
}

// Distribute topics across learning slots proportional to day weight.
// Each slot receives a target topic count of (weight / totalWeight) * topicCount.
// Topics are assigned greedily — heaviest first — to the slot most below its quota.
// This prevents piling and naturally routes high-effort topics to high-capacity days
// without letting any single day become overwhelmed.
function distributeByWeight(
  topics: TopicInput[],
  slots: DaySlot[],
  phase: 'learning' | 'revision'
): AssignmentOutput[] {
  if (slots.length === 0 || topics.length === 0) return [];

  const totalWeight = slots.reduce((s, d) => s + d.weight, 0);
  const sortedTopics = [...topics].sort((a, b) => b.estimatedEffort - a.estimatedEffort);

  const slotData = slots.map((s) => ({
    dateStr: s.dateStr,
    weight: s.weight,
    targetCount: (s.weight / totalWeight) * topics.length,
    assignedCount: 0,
  }));

  const assignments: AssignmentOutput[] = [];

  for (const topic of sortedTopics) {
    // Pick the slot with the largest remaining deficit (targetCount - assignedCount).
    // Ties broken by higher weight so heavy topics land on high-capacity days.
    const chosen = slotData.reduce((best, s) => {
      const deficit = s.targetCount - s.assignedCount;
      const bestDeficit = best.targetCount - best.assignedCount;
      if (deficit > bestDeficit + 1e-9) return s;
      if (Math.abs(deficit - bestDeficit) < 1e-9 && s.weight > best.weight) return s;
      return best;
    });
    assignments.push({
      topicId: topic.id,
      assignedDate: chosen.dateStr,
      recommendedDate: chosen.dateStr,
      phase,
      orderInDay: 0,
    });
    chosen.assignedCount++;
  }

  return assignments;
}

// Distribute revision topics backward from the exam:
// - The hardest topics land on dates closest to the exam
// - One topic per slot, filling from exam date backward
function backfillRevision(topics: TopicInput[], slots: DaySlot[]): AssignmentOutput[] {
  if (slots.length === 0 || topics.length === 0) return [];

  // Hardest first; closest-to-exam dates first
  const sortedTopics = [...topics].sort((a, b) => b.estimatedEffort - a.estimatedEffort);
  const slotsByDateDesc = [...slots].sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  const assignments: AssignmentOutput[] = [];

  for (let i = 0; i < sortedTopics.length; i++) {
    const topic = sortedTopics[i];
    // If there are more topics than slots, wrap around
    const slot = slotsByDateDesc[i % slotsByDateDesc.length];
    assignments.push({
      topicId: topic.id,
      assignedDate: slot.dateStr,
      recommendedDate: slot.dateStr,
      phase: 'revision',
      orderInDay: 0,
    });
  }

  return assignments;
}

// Main scheduling entry point
export function scheduleTopicsBackward(input: SchedulingInput): AssignmentOutput[] {
  const today = startOfDay(new Date());
  const examDate = startOfDay(input.examDate);
  const totalDays = differenceInDays(examDate, today);

  if (totalDays <= 0) throw new Error('Exam date must be in the future');
  if (input.revisionDays >= totalDays) throw new Error('Revision days must be less than total available days');
  if (input.topics.length === 0) return [];

  const hasStudyDay = input.dayWeights.some((w) => w.weight > 0);
  if (!hasStudyDay) throw new Error('At least one day must have weight > 0');

  const weightMap = new Map<number, number>();
  input.dayWeights.forEach((w) => weightMap.set(w.dayOfWeek, w.weight));
  const getDayWeight = (d: Date): number => weightMap.get(getDay(d)) ?? 0;

  // Learning phase: today → (examDate - revisionDays - 1)
  const learningPhaseEnd = addDays(examDate, -(input.revisionDays + 1));
  // Revision phase: (examDate - revisionDays) → (examDate - 1)
  const revisionPhaseStart = addDays(examDate, -input.revisionDays);

  const learningSlots = buildDaySlots(today, learningPhaseEnd, getDayWeight, true);
  const revisionSlots = buildDaySlots(revisionPhaseStart, examDate, getDayWeight, false);

  if (learningSlots.length === 0) throw new Error('No learning days available');

  const learningAssignments = distributeByWeight(input.topics, learningSlots, 'learning');
  const revisionAssignments = backfillRevision(input.topics, revisionSlots);

  // Combine, sort chronologically, assign order-within-day
  const all = [...learningAssignments, ...revisionAssignments];
  all.sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));

  const dateCount = new Map<string, number>();
  all.forEach((a) => {
    const count = dateCount.get(a.assignedDate) ?? 0;
    a.orderInDay = count;
    dateCount.set(a.assignedDate, count + 1);
  });

  return all;
}

export function calculateDailyStats(input: {
  examDate: Date;
  totalTopics: number;
  completedTopics: number;
  dayWeights: { dayOfWeek: number; weight: number }[];
}): {
  daysRemaining: number;
  topicsRemaining: number;
  dailyPace: number;
  progressPercentage: number;
} {
  const today = startOfDay(new Date());
  const examDate = startOfDay(input.examDate);
  const daysRemaining = Math.max(0, differenceInDays(examDate, today));
  const topicsRemaining = input.totalTopics - input.completedTopics;

  const weightMap = new Map<number, number>();
  input.dayWeights.forEach((w) => weightMap.set(w.dayOfWeek, w.weight));

  let studyDays = 0;
  for (let d = new Date(today); isBefore(d, examDate); d = addDays(d, 1)) {
    if ((weightMap.get(getDay(d)) ?? 1) > 0) studyDays++;
  }

  const dailyPace = studyDays > 0 && topicsRemaining > 0 ? Math.ceil(topicsRemaining / studyDays) : 0;
  const progressPercentage = input.totalTopics > 0
    ? Math.round((input.completedTopics / input.totalTopics) * 100)
    : 0;

  return { daysRemaining, topicsRemaining, dailyPace, progressPercentage };
}

export function isTopicMoved(assignedDate: string, recommendedDate: string): boolean {
  return assignedDate !== recommendedDate;
}
