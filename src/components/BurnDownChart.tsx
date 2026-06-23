import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { usePreferences, type AccentColor } from '../contexts/PreferencesContext';

const ACCENT_HEX: Record<AccentColor, string> = {
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  rose:    '#f43f5e',
};

interface BurnDownChartProps {
  examDate: string;
  createdAt: string;
  totalTopics: number;
  completions: { date: string; count: number }[];
}

export function BurnDownChart({ examDate, createdAt, totalTopics, completions }: BurnDownChartProps) {
  const { accentColor } = usePreferences();
  const lineColor = ACCENT_HEX[accentColor];

  const data = useMemo(() => {
    const start = startOfDay(new Date(createdAt));
    const end = startOfDay(new Date(examDate));
    const totalDays = differenceInDays(end, start);

    if (totalDays <= 0 || totalTopics === 0) return [];

    // Build cumulative completion map
    const completionMap = new Map<string, number>();
    let cumulative = 0;
    [...completions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((c) => {
        cumulative += c.count;
        completionMap.set(c.date, cumulative);
      });

    const today = startOfDay(new Date());
    const points: { day: number; displayDate: string; completed: number | null }[] = [];

    for (let day = 0; day <= totalDays; day++) {
      const date = addDays(start, day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const isPast = date <= today;

      // Only plot actual data up to today — future stays null (no line drawn)
      const completedToDate = completionMap.get(dateStr) ?? cumulative;
      points.push({
        day,
        displayDate: format(date, 'MMM d'),
        completed: isPast ? completedToDate : null,
      });
    }

    return points;
  }, [examDate, createdAt, totalTopics, completions]);

  const todayIndex = useMemo(() => {
    const start = startOfDay(new Date(createdAt));
    return differenceInDays(startOfDay(new Date()), start);
  }, [createdAt]);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400">
        Not enough data to display chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          domain={[0, totalTopics]}
          label={{
            value: 'Topics Done',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 11, fill: '#64748b' },
          }}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15,23,42,0.95)',
            border: `1px solid ${lineColor}33`,
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: 13,
          }}
          itemStyle={{ color: lineColor }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [value != null ? value : '—', 'Topics completed']}
          labelFormatter={(label) => `${label}`}
        />

        {/* Today marker */}
        {todayIndex >= 0 && todayIndex < data.length && (
          <ReferenceLine
            x={data[todayIndex]?.displayDate}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4 4"
            label={{ value: 'Today', fill: '#64748b', fontSize: 11, position: 'top' }}
          />
        )}

        <Line
          type="monotone"
          dataKey="completed"
          stroke={lineColor}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: lineColor, strokeWidth: 0 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
