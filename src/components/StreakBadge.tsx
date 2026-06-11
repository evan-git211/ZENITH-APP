import { Flame, Trophy } from 'lucide-react';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  const isHot = currentStreak >= 3;
  const isOnFire = currentStreak >= 7;

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isOnFire
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          : isHot
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700'
      }`}>
        <Flame className={`w-5 h-5 ${
          isOnFire ? 'text-orange-500' : isHot ? 'text-amber-500' : 'text-slate-400'
        }`} />
        <div>
          <div className={`text-lg font-bold tabular-nums leading-none ${
            isOnFire ? 'text-orange-600 dark:text-orange-400'
            : isHot ? 'text-amber-600 dark:text-amber-400'
            : 'text-slate-600 dark:text-slate-400'
          }`}>
            {currentStreak}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 leading-none mt-0.5">
            day streak
          </div>
        </div>
      </div>

      {longestStreak > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
          <Trophy className="w-4 h-4 text-amber-500" />
          <div>
            <div className="text-lg font-bold tabular-nums leading-none text-slate-700 dark:text-slate-300">
              {longestStreak}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 leading-none mt-0.5">
              best streak
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
