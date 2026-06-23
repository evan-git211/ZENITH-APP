import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface StudySession {
  date: string;
  minutes: number;
}

interface StudyTimeChartProps {
  sessions: StudySession[];
  weeks?: number;
}

export function StudyTimeChart({ sessions, weeks = 2 }: StudyTimeChartProps) {
  const data = useMemo(() => {
    const days = weeks * 7;
    const today = startOfDay(new Date());
    const sessionMap = new Map<string, number>();
    sessions.forEach((s) => sessionMap.set(s.date, (sessionMap.get(s.date) ?? 0) + s.minutes));

    return Array.from({ length: days }, (_, i) => {
      const date = subDays(today, days - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        dateStr,
        label: format(date, 'EEE d'),
        minutes: sessionMap.get(dateStr) ?? 0,
        isToday: i === days - 1,
      };
    });
  }, [sessions, weeks]);

  const maxMinutes = Math.max(...data.map((d) => d.minutes), 30);
  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);
  const avgMinutes = Math.round(totalMinutes / (weeks * 7));

  if (sessions.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        Complete topics with the timer to see study time data
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-6 mb-4 text-sm">
        <div>
          <span className="text-slate-400">Total (2 weeks) </span>
          <span className="font-semibold text-slate-100">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
        </div>
        <div>
          <span className="text-slate-400">Daily avg </span>
          <span className="font-semibold text-amber-400">{avgMinutes}m</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            domain={[0, maxMinutes + 10]}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [v != null ? `${v} min` : '0 min', 'Study time']}
            cursor={{ fill: '#1e293b' }}
          />
          <Bar dataKey="minutes" radius={[3, 3, 0, 0]} maxBarSize={24}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isToday ? '#f59e0b' : entry.minutes > 0 ? '#3b82f6' : '#1e293b'}
                opacity={entry.minutes > 0 ? 1 : 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Past days</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Today</div>
      </div>
    </div>
  );
}
