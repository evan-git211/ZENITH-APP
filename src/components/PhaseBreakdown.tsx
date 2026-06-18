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
    { name: 'Learning Done', value: learningCompleted, color: '#F59E0B' },
    { name: 'Learning Left', value: Math.max(0, learningTotal - learningCompleted), color: '#FCD34D' },
    { name: 'Revision Done', value: revisionCompleted, color: '#3B82F6' },
    { name: 'Revision Left', value: Math.max(0, revisionTotal - revisionCompleted), color: '#93C5FD' },
    { name: 'Unassigned', value: unassigned, color: '#404040' },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-neutral-500">
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
              backgroundColor: '#171717',
              border: '1px solid #262626',
              borderRadius: '8px',
              color: 'white',
            }}
            formatter={(value: number) => [`${value} topics`, '']}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-neutral-400">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
