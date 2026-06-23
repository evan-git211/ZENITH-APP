import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PhaseBreakdownProps {
  learningCompleted: number;
  learningTotal: number;
  revisionCompleted: number;
  revisionTotal: number;
  unassigned: number;
}

export function PhaseBreakdown({
  learningCompleted,
  learningTotal,
  revisionCompleted,
  revisionTotal,
  unassigned,
}: PhaseBreakdownProps) {
  const data = [
    { name: 'Learning Done', value: learningCompleted, color: '#10b981' },
    { name: 'Learning Left', value: Math.max(0, learningTotal - learningCompleted), color: '#34d399' },
    { name: 'Revision Done', value: revisionCompleted, color: '#f59e0b' },
    { name: 'Revision Left', value: Math.max(0, revisionTotal - revisionCompleted), color: '#fbbf24' },
    { name: 'Unassigned', value: unassigned, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500">
        No topics to display
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(30 41 59)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [value != null ? `${value} topics` : '0 topics', '']}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 dark:text-slate-400">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
