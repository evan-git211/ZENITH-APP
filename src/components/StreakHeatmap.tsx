import { useMemo } from 'react';
import { format, subDays, startOfDay, getDay } from 'date-fns';

interface DayActivity {
  date: string;
  count: number;
}

interface StreakHeatmapProps {
  activity: DayActivity[];
  weeks?: number;
}

function intensityClass(count: number): string {
  if (count === 0) return 'bg-slate-800 border border-slate-700';
  if (count <= 1) return 'bg-amber-500/20 border border-amber-500/30';
  if (count <= 3) return 'bg-amber-500/50';
  if (count <= 6) return 'bg-amber-500/80';
  return 'bg-amber-500';
}

export function StreakHeatmap({ activity, weeks = 12 }: StreakHeatmapProps) {
  const { grid, months } = useMemo(() => {
    const totalDays = weeks * 7;
    const today = startOfDay(new Date());
    const activityMap = new Map<string, number>();
    activity.forEach((a) => activityMap.set(a.date, a.count));

    const days: { date: string; count: number; col: number; row: number }[] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    for (let i = 0; i < totalDays; i++) {
      const date = subDays(today, totalDays - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const col = Math.floor(i / 7);
      const row = getDay(date); // 0=Sun

      const month = date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: format(date, 'MMM'), col });
        lastMonth = month;
      }

      days.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0, col, row });
    }

    return { grid: days, months: monthLabels };
  }, [activity, weeks]);

  const totalTopics = grid.reduce((s, d) => s + d.count, 0);
  const activeDays = grid.filter((d) => d.count > 0).length;

  return (
    <div className="w-full">
      <div className="flex items-center gap-6 mb-3 text-sm">
        <div><span className="text-slate-400">Total topics </span><span className="font-semibold text-slate-100">{totalTopics}</span></div>
        <div><span className="text-slate-400">Active days </span><span className="font-semibold text-amber-400">{activeDays}</span></div>
      </div>

      {/* Month labels */}
      <div className="relative mb-1" style={{ paddingLeft: 24 }}>
        <div className="flex text-xs text-slate-500 gap-0">
          {Array.from({ length: weeks }, (_, col) => {
            const month = months.find((m) => m.col === col);
            return (
              <div key={col} className="w-[13px] flex-shrink-0 text-center">
                {month ? month.label : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-0" style={{ paddingLeft: 24 }}>
        {/* Day labels */}
        <div className="absolute flex flex-col gap-[1px] text-xs text-slate-600" style={{ marginLeft: -24 }}>
          {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
            <div key={i} className="h-[12px] text-right" style={{ lineHeight: '12px' }}>{d}</div>
          ))}
        </div>

        {/* Columns */}
        {Array.from({ length: weeks }, (_, col) => (
          <div key={col} className="flex flex-col gap-[1px] mr-[1px]">
            {Array.from({ length: 7 }, (_, row) => {
              const cell = grid.find((d) => d.col === col && d.row === row);
              if (!cell) return <div key={row} className="w-[12px] h-[12px]" />;
              return (
                <div
                  key={row}
                  title={`${cell.date}: ${cell.count} topic${cell.count !== 1 ? 's' : ''}`}
                  className={`w-[12px] h-[12px] rounded-sm cursor-default transition-opacity ${intensityClass(cell.count)}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500 justify-end">
        <span>Less</span>
        {[0, 1, 3, 5, 7].map((v) => (
          <div key={v} className={`w-[12px] h-[12px] rounded-sm ${intensityClass(v)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
