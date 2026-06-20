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
  Area,
} from 'recharts';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';

interface BurnDownChartProps {
  examDate: string;
  createdAt: string;
  totalTopics: number;
  completions: { date: string; count: number }[];
}

export function BurnDownChart({ examDate, createdAt, totalTopics, completions }: BurnDownChartProps) {
  const data = useMemo(() => {
    const start = startOfDay(new Date(createdAt));
    const end = startOfDay(new Date(examDate));
    const totalDays = differenceInDays(end, start);

    if (totalDays <= 0 || totalTopics === 0) return [];

    // Build data points for each day
    const points: { day: number; date: string; ideal: number; actual: number; displayDate: string }[] = [];
    const today = startOfDay(new Date());

    // Create completion lookup
    const completionMap = new Map<string, number>();
    let cumulativeCompleted = 0;

    // Sort completions by date
    const sortedCompletions = [...completions].sort((a, b) => a.date.localeCompare(b.date));

    // Build running total of completions
    sortedCompletions.forEach((c) => {
      cumulativeCompleted += c.count;
      completionMap.set(c.date, cumulativeCompleted);
    });

    for (let day = 0; day <= totalDays; day++) {
      const date = addDays(start, day);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Ideal line: straight from totalTopics to 0
      const ideal = Math.max(0, totalTopics * (1 - day / totalDays));

      // Actual remaining = total - cumulative completed up to this date
      const completedToDate = completionMap.get(dateStr) ?? cumulativeCompleted;
      const actual = Math.max(0, totalTopics - completedToDate);

      points.push({
        day,
        date: dateStr,
        ideal: Math.round(ideal * 10) / 10,
        actual: Math.round(actual * 10) / 10,
        displayDate: format(date, 'MMM d'),
      });
    }

    return points;
  }, [examDate, createdAt, totalTopics, completions]);

  const todayIndex = useMemo(() => {
    const start = startOfDay(new Date(createdAt));
    const today = startOfDay(new Date());
    return differenceInDays(today, start);
  }, [createdAt]);

  const totalDays = differenceInDays(new Date(examDate), new Date(createdAt));

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500">
        Not enough data to display chart
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="idealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-slate-200 dark:stroke-slate-700"
          />

          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#64748b' }}
            className="fill-slate-500 dark:fill-slate-400"
            interval="preserveStartEnd"
          />

          <YAxis
            label={{
              value: 'Topics Left',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#64748b' },
            }}
            tick={{ fontSize: 12 }}
            domain={[0, totalTopics]}
            tickLine={{ stroke: '#64748b' }}
            className="fill-slate-500 dark:fill-slate-400"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(30 41 59)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
            }}
            itemStyle={{ color: 'white' }}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              name === 'actual' ? 'Your Progress' : 'Target',
            ]}
            labelFormatter={(label) => `Date: ${label}`}
          />

          {/* Reference line for today */}
          {todayIndex >= 0 && todayIndex < data.length && (
            <ReferenceLine
              x={data[todayIndex]?.displayDate}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              label={{
                value: 'Today',
                fill: '#3b82f6',
                fontSize: 12,
                position: 'top',
              }}
            />
          )}

          {/* Ideal line */}
          <Area
            type="linear"
            dataKey="ideal"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#idealGradient)"
            name="ideal"
            dot={false}
          />

          {/* Actual line */}
          <Line
            type="stepAfter"
            dataKey="actual"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#f59e0b' }}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400">Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600 dark:text-slate-400">Your Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-px border-t-2 border-dashed border-blue-500" />
          <span className="text-slate-600 dark:text-slate-400">Today</span>
        </div>
      </div>
    </div>
  );
}
