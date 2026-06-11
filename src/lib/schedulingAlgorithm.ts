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

// Distribute topics across learning slots:
// - Sort topics by effort DESC (heaviest first)
// - Sort slots by weight DESC (highest-capacity days first)
// - Match heaviest topics to highest-weight days
function distributeByWeight(
  topics: TopicInput[],
  slots: DaySlot[],
  phase: 'learning' | 'revision'
): AssignmentOutput[] {
  if (slots.length === 0 || topics.length === 0) return [];

  const totalCapacity = slots.reduce((s, d) => s + d.weight, 0);
  const totalEffort = topics.reduce((s, t) => s + t.estimatedEffort, 0);
  const capacityPerEffortUnit = totalCapacity / totalEffort;

  // Work on a fresh copy of slots sorted by weight DESC
  const sortedSlots: DaySlot[] = [...slots]
    .sort((a, b) => b.weight - a.weight)
    .map((s) => ({ ...s })); // deep copy so we don't mutate originals

  const sortedTopics = [...topics].sort((a, b) => b.estimatedEffort - a.estimatedEffort);
  const assignments: AssignmentOutput[] = [];

  for (const topic of sortedTopics) {
    const required = topic.estimatedEffort * capacityPerEffortUnit;
    // Prefer the highest-weight slot that still has enough room
    let chosen = sortedSlots.find((s) => s.remaining >= required * 0.5);
    if (!chosen) {
      // Fallback: the slot with the most remaining capacity
      chosen = sortedSlots.reduce((a, b) => (a.remaining >= b.remaining ? a : b));
    }
    assignments.push({
      topicId: topic.id,
      assignedDate: chosen.dateStr,
      recommendedDate: chosen.dateStr,
      phase,
      orderInDay: 0,
    });
    chosen.remaining -= required;
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
  const getDayWeight = (d: Date): number => weightMap.get(getDay(d)) ?? 1;

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
