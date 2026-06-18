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

    const points: { day: number; date: string; ideal: number; actual: number; displayDate: string }[] = [];

    const completionMap = new Map<string, number>();
    let cumulativeCompleted = 0;

    const sortedCompletions = [...completions].sort((a, b) => a.date.localeCompare(b.date));

    sortedCompletions.forEach((c) => {
      cumulativeCompleted += c.count;
      completionMap.set(c.date, cumulativeCompleted);
    });

    for (let day = 0; day <= totalDays; day++) {
      const date = addDays(start, day);
      const dateStr = format(date, 'yyyy-MM-dd');

      const ideal = Math.max(0, totalTopics * (1 - day / totalDays));
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
      <div className="h-64 flex items-center justify-center text-neutral-500">
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
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-neutral-800"
          />

          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#525252' }}
            className="fill-neutral-500"
            interval="preserveStartEnd"
          />

          <YAxis
            label={{
              value: 'Topics Left',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#737373' },
            }}
            tick={{ fontSize: 12 }}
            domain={[0, totalTopics]}
            tickLine={{ stroke: '#525252' }}
            className="fill-neutral-500"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#171717',
              border: '1px solid #262626',
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

          {/* Target line — gold */}
          <Area
            type="linear"
            dataKey="ideal"
            stroke="#D4AF37"
            strokeWidth={2}
            fill="url(#idealGradient)"
            name="ideal"
            dot={false}
          />

          {/* Actual progress line — blue */}
          <Line
            type="stepAfter"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#3b82f6' }}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-neutral-400">Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-neutral-400">Your Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-px border-t-2 border-dashed border-blue-500" />
          <span className="text-neutral-400">Today</span>
        </div>
      </div>
    </div>
  );
}
