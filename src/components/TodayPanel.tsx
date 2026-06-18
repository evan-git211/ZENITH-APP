import { useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Sun, CheckCircle, Circle, Loader2, BookOpen, RefreshCw, CalendarDays, Trophy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Topic, ScheduledAssignment } from '../types/database';
import { EFFORT_META } from '../lib/effortColors';

interface TodayPanelProps {
  topics: Topic[];
  assignments: ScheduledAssignment[];
  updating: string | null;
  onToggle: (assignmentId: string, current: boolean) => void;
  onRecalculate: () => void;
}

export function TodayPanel({ topics, assignments, updating, onToggle, onRecalculate }: TodayPanelProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const prevAllTopicsComplete = useRef(false);

  const todayAssignments = assignments
    .filter((a) => a.assigned_date === todayStr)
    .sort((a, b) => a.order_in_day - b.order_in_day);

  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const todayTopics = todayAssignments
    .map((a) => ({ assignment: a, topic: topicMap.get(a.topic_id) }))
    .filter((item): item is { assignment: ScheduledAssignment; topic: Topic } => !!item.topic);

  const completed = todayTopics.filter((i) => i.assignment.is_completed).length;
  const total = todayTopics.length;
  const allDone = total > 0 && completed === total;

  // Derive empty-state context
  const allTopicsComplete = topics.length > 0 && topics.every((t) => t.is_completed);

  // Fire confetti on the transition from incomplete → all complete
  useEffect(() => {
    if (allTopicsComplete && !prevAllTopicsComplete.current) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#F5A623', '#FCD34D', '#FBBF24', '#ffffff', '#a3a3a3'],
      });
    }
    prevAllTopicsComplete.current = allTopicsComplete;
  }, [allTopicsComplete]);
  const futureAssignments = assignments.filter((a) => a.assigned_date > todayStr);
  const nextDate = futureAssignments.length > 0
    ? futureAssignments.reduce<string>(
        (min, a) => (a.assigned_date < min ? a.assigned_date : min),
        futureAssignments[0].assigned_date
      )
    : null;
  const nextDateTopicCount = nextDate
    ? futureAssignments.filter((a) => a.assigned_date === nextDate).length
    : 0;

  return (
    <div className={`rounded-xl border p-5 mb-6 transition-all ${
      allTopicsComplete
        ? 'bg-amber-500/10 border-amber-500/40'
        : allDone
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-neutral-900 border-neutral-800'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            allDone ? 'bg-amber-500' : 'bg-amber-500/10'
          }`}>
            {allDone
              ? <CheckCircle className="w-6 h-6 text-neutral-900" />
              : <Sun className="w-6 h-6 text-amber-500" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {allDone ? "Today's work is done!" : "Today's Plan"}
            </h3>
            <p className="text-sm text-neutral-400">
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="text-right">
            <span className="text-2xl font-bold text-white tabular-nums">
              {completed}
            </span>
            <span className="text-neutral-500 font-medium"> / {total}</span>
            <p className="text-xs text-neutral-500">topics done</p>
          </div>
        )}
      </div>

      {allTopicsComplete && (
        <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-4 py-3 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-neutral-900" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              Plan Complete! <Sparkles className="w-3.5 h-3.5" />
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              You've finished every topic in this study plan. Excellent work!
            </p>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="py-1">
          {allTopicsComplete ? (
            /* All done — day off variant */
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-neutral-400">Nothing more to study today.</p>
            </div>
          ) : nextDate ? (
            /* Day off — next session is known */
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CalendarDays className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Nothing scheduled today</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Next session:{' '}
                  <span className="text-amber-400 font-semibold">
                    {format(parseISO(nextDate), 'EEE, MMM d')}
                  </span>
                  {' '}— {nextDateTopicCount} topic{nextDateTopicCount !== 1 ? 's' : ''}.
                  Scroll down to see the full schedule.
                </p>
              </div>
            </div>
          ) : (
            /* No future sessions — schedule ran dry */
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen className="w-5 h-5 text-neutral-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">No sessions scheduled</p>
                <p className="text-xs text-neutral-400 mt-0.5 mb-2">
                  Your calendar is empty. Recalculate to redistribute remaining topics across your study days.
                </p>
                <button
                  onClick={onRecalculate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-900 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recalculate Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                allDone ? 'bg-amber-500' : 'bg-amber-500'
              }`}
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {todayTopics.map(({ topic, assignment }) => (
              <button
                key={assignment.id}
                onClick={() => onToggle(assignment.id, assignment.is_completed)}
                disabled={updating === assignment.id}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  assignment.is_completed
                    ? 'bg-amber-500/10 opacity-70'
                    : 'bg-neutral-800 hover:bg-neutral-700'
                }`}
              >
                <div className="flex-shrink-0">
                  {updating === assignment.id ? (
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  ) : assignment.is_completed ? (
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-600" />
                  )}
                </div>
                <span className={`flex-1 text-sm font-medium ${
                  assignment.is_completed
                    ? 'text-neutral-500 line-through'
                    : 'text-neutral-200'
                }`}>
                  {topic.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: topic.estimated_effort }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${EFFORT_META[topic.estimated_effort].dot}`}
                    />
                  ))}
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    assignment.phase === 'revision'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-orange-900/30 text-orange-400'
                  }`}>
                    {assignment.phase === 'revision' ? 'Rev' : 'New'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
