import { format } from 'date-fns';
import { Sun, CheckCircle, Circle, Loader2, BookOpen } from 'lucide-react';
import type { Topic, ScheduledAssignment } from '../types/database';

interface TodayPanelProps {
  topics: Topic[];
  assignments: ScheduledAssignment[];
  updating: string | null;
  onToggle: (assignmentId: string, current: boolean) => void;
}

const EFFORT_DOTS: Record<number, string> = {
  1: 'bg-emerald-400',
  2: 'bg-blue-400',
  3: 'bg-amber-400',
  4: 'bg-orange-400',
  5: 'bg-red-400',
};

export function TodayPanel({ topics, assignments, updating, onToggle }: TodayPanelProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Get today's assignments in order
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

  return (
    <div className={`rounded-xl border p-5 mb-6 transition-all ${
      allDone
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            allDone ? 'bg-emerald-500' : 'bg-amber-100 dark:bg-amber-900/40'
          }`}>
            {allDone
              ? <CheckCircle className="w-6 h-6 text-white" />
              : <Sun className="w-6 h-6 text-amber-500" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              {allDone ? "Today's work is done!" : "Today's Plan"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {completed}
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-medium"> / {total}</span>
            <p className="text-xs text-slate-400 dark:text-slate-500">topics done</p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-2">
          <BookOpen className="w-4 h-4" />
          <span>No topics assigned for today. Enjoy your day off!</span>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                allDone ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>

          {/* Topic list */}
          <div className="space-y-2">
            {todayTopics.map(({ topic, assignment }) => (
              <button
                key={assignment.id}
                onClick={() => onToggle(assignment.id, assignment.is_completed)}
                disabled={updating === assignment.id}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  assignment.is_completed
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 opacity-70'
                    : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex-shrink-0">
                  {updating === assignment.id ? (
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                  ) : assignment.is_completed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <span className={`flex-1 text-sm font-medium ${
                  assignment.is_completed
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-slate-700 dark:text-slate-200'
                }`}>
                  {topic.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Effort dots */}
                  {Array.from({ length: topic.estimated_effort }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${EFFORT_DOTS[topic.estimated_effort]}`}
                    />
                  ))}
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    assignment.phase === 'revision'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
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
