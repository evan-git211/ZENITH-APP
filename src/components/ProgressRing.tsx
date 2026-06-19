import { useEffect, useState } from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'emerald' | 'blue' | 'amber' | 'red';
}

const COLOR_MAP = {
  emerald: {
    stroke: 'stroke-emerald-500',
    bg: 'stroke-slate-200 dark:stroke-slate-700',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    stroke: 'stroke-blue-500',
    bg: 'stroke-slate-200 dark:stroke-slate-700',
    text: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    stroke: 'stroke-amber-500',
    bg: 'stroke-slate-200 dark:stroke-slate-700',
    text: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    stroke: 'stroke-red-500',
    bg: 'stroke-slate-200 dark:stroke-slate-700',
    text: 'text-red-600 dark:text-red-400',
  },
};

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  label,
  showPercentage = true,
  color = 'emerald',
}: ProgressRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const colors = COLOR_MAP[color];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    // Animate from 0 to actual percentage
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          className={colors.bg}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          className={`${colors.stroke} transition-all duration-1000 ease-out`}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <span className={`text-2xl font-bold ${colors.text}`}>
            {Math.round(animatedPercentage)}%
          </span>
        )}
        {label && (
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</span>
        )}
      </div>
    </div>
  );
}
