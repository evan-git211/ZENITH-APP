import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type StatusType = 'ahead' | 'on-track' | 'behind';

interface StatusBadgeProps {
  status: StatusType;
  daysDiff?: number;
}

interface StatusConfig {
  label: string;
  icon: typeof TrendingUp;
  classes: string;
  description: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  ahead: {
    label: 'Ahead',
    icon: TrendingUp,
    classes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    description: 'You\'re ahead of schedule! Keep it up!',
  },
  'on-track': {
    label: 'On Track',
    icon: Minus,
    classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    description: 'You\'re right on track. Keep going!',
  },
  behind: {
    label: 'Behind',
    icon: TrendingDown,
    classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    description: 'You\'re behind schedule. Time to catch up!',
  },
};

export function StatusBadge({ status, daysDiff }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${config.classes}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="font-medium">{config.label}</div>
        {daysDiff !== undefined && daysDiff !== 0 && (
          <div className="text-xs opacity-80">
            {status === 'ahead'
              ? `${Math.abs(daysDiff)} days early`
              : status === 'behind'
              ? `${Math.abs(daysDiff)} days behind`
              : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusDescription({ status }: { status: StatusType }) {
  const config = STATUS_CONFIG[status];
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {config.description}
    </p>
  );
}

// Calculate status based on progress vs expected progress
export function calculateStatus(
  progressPercentage: number,
  daysElapsed: number,
  totalDays: number
): StatusType {
  if (totalDays <= 0) return 'on-track';

  const expectedProgress = (daysElapsed / totalDays) * 100;
  const diff = progressPercentage - expectedProgress;

  if (diff >= 5) return 'ahead';
  if (diff <= -10) return 'behind';
  return 'on-track';
}
