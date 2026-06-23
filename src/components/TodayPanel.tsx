import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Sun, CheckCircle, Circle, Loader2, Trophy, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Topic, ScheduledAssignment } from '../types/database';
import { EFFORT_META } from '../lib/effortColors';
import { usePreferences, type AccentColor } from '../contexts/PreferencesContext';

const ACCENT_CONFETTI_COLORS: Record<AccentColor, string[]> = {
  amber:   ['#F5A623', '#FCD34D', '#FBBF24', '#ffffff', '#a3a3a3'],
  blue:    ['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#a3a3a3'],
  violet:  ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ffffff', '#a3a3a3'],
  emerald: ['#10b981', '#34d399', '#6ee7b7', '#ffffff', '#a3a3a3'],
  rose:    ['#f43f5e', '#fb7185', '#fda4af', '#ffffff', '#a3a3a3'],
};

const EMPTY_STATE_MESSAGES = [
  { icon: '🎉', title: 'Free day!', sub: 'No topics scheduled — take a breather.' },
  { icon: '☕', title: 'Rest day', sub: 'Recharge and come back stronger tomorrow.' },
  { icon: '🌿', title: 'No study today', sub: 'Enjoy your day off, you\'ve earned it.' },
];

interface TodayPanelProps {
  topics: Topic[];
  assignments: ScheduledAssignment[];
  updating: string | null;
  onToggle: (assignmentId: string, current: boolean) => void;
  onRecalculate?: () => void;
}

export function TodayPanel({ topics, assignments, updating, onToggle, onRecalculate }: TodayPanelProps) {
  const { confettiEnabled, accentColor } = usePreferences();
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
  const allTopicsComplete = total > 0 && completed === total;

  useEffect(() => {
    if (allTopicsComplete && !prevAllTopicsComplete.current && confettiEnabled) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ACCENT_CONFETTI_COLORS[accentColor],
      });
    }
    prevAllTopicsComplete.current = allTopicsComplete;
  }, [allTopicsComplete, confettiEnabled, accentColor]);

  // Pick a deterministic empty-state variant based on day of week
  const dayOfWeek = new Date().getDay();
  const emptyMsg = EMPTY_STATE_MESSAGES[dayOfWeek % EMPTY_STATE_MESSAGES.length];

  return (
    <div className={`glass-surface rounded-2xl p-5 mb-6 transition-all ${
      allTopicsComplete ? '!border-amber-500/30 bg-amber-500/[0.04]' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            allTopicsComplete ? 'bg-amber-500/20' : 'bg-amber-500/10'
          }`}>
            {allTopicsComplete
              ? <Trophy className="w-5 h-5 text-amber-400" />
              : <Sun className="w-5 h-5 text-amber-400" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-neutral-100">
              {allTopicsComplete ? "All done for today!" : "Today's Plan"}
            </h3>
            <p className="text-sm text-neutral-500">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="text-right">
              <span className="text-2xl font-bold text-neutral-100 tabular-nums">{completed}</span>
              <span className="text-neutral-500 font-medium"> / {total}</span>
              <p className="text-xs text-neutral-500">topics</p>
            </div>
          )}
          {onRecalculate && !allTopicsComplete && total > 0 && (
            <button
              onClick={onRecalculate}
              title="Recalculate schedule"
              className="p-2 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* All done celebration banner */}
      {allTopicsComplete && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-amber-400 font-semibold text-sm">🏆 You crushed today's session! Streak's alive.</p>
        </div>
      )}

      {total === 0 ? (
        <div className="flex items-center gap-3 text-sm text-neutral-500 py-3">
          <span className="text-2xl">{emptyMsg.icon}</span>
          <div>
            <p className="font-medium text-neutral-400">{emptyMsg.title}</p>
            <p className="text-xs">{emptyMsg.sub}</p>
          </div>
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              className="ml-auto flex items-center gap-1.5 text-xs text-neutral-500 hover:text-amber-400 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recalculate
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-700 bg-amber-500"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>

          {/* Topic list */}
          <div className="space-y-2">
            {todayTopics.map(({ topic, assignment }) => {
              const effortMeta = EFFORT_META[topic.estimated_effort] ?? EFFORT_META[3];
              return (
                <button
                  key={assignment.id}
                  onClick={() => onToggle(assignment.id, assignment.is_completed)}
                  disabled={updating === assignment.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    assignment.is_completed
                      ? 'bg-white/[0.03] opacity-60'
                      : 'bg-white/[0.05] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {updating === assignment.id ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
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

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Effort dots */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: topic.estimated_effort }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${effortMeta.dot}`} />
                      ))}
                    </div>
                    {/* Phase badge */}
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      assignment.phase === 'revision'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-orange-900/30 text-orange-400'
                    }`}>
                      {assignment.phase === 'revision' ? 'Rev' : 'New'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Effort legend at bottom */}
      {total > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(EFFORT_META).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${v.dot}`} />
              <span className="text-xs text-neutral-600">{v.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
