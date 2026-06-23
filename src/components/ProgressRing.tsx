import { useEffect, useState } from 'react';
import { usePreferences, type AccentColor } from '../contexts/PreferencesContext';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
}

const ACCENT_HEX: Record<AccentColor, string> = {
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  rose:    '#f43f5e',
};

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  label,
  showPercentage = true,
}: ProgressRingProps) {
  const { accentColor } = usePreferences();
  const hex = ACCENT_HEX[accentColor];
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
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
          stroke="rgba(100,116,139,0.3)"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: hex, transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <span className="text-2xl font-bold" style={{ color: hex }}>
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
