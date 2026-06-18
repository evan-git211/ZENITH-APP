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
          ? 'bg-orange-900/20 border-orange-800'
          : isHot
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-neutral-800 border-neutral-700'
      }`}>
        <Flame className={`w-5 h-5 ${
          isOnFire ? 'text-orange-500' : isHot ? 'text-amber-500' : 'text-neutral-500'
        }`} />
        <div>
          <div className={`text-lg font-bold tabular-nums leading-none ${
            isOnFire ? 'text-orange-400'
            : isHot ? 'text-amber-400'
            : 'text-neutral-400'
          }`}>
            {currentStreak}
          </div>
          <div className="text-xs text-neutral-500 leading-none mt-0.5">
            day streak
          </div>
        </div>
      </div>

      {longestStreak > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700">
          <Trophy className="w-4 h-4 text-amber-500" />
          <div>
            <div className="text-lg font-bold tabular-nums leading-none text-neutral-200">
              {longestStreak}
            </div>
            <div className="text-xs text-neutral-500 leading-none mt-0.5">
              best streak
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
