

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ReviewStatus } from '../types';

interface ChartComponentProps {
  data: { name: ReviewStatus; value: number }[];
}

// FIX: Added colors for all review statuses to ensure the chart can render all data.
const COLORS = {
  [ReviewStatus.Approved]: '#10B981', // Green-500
  [ReviewStatus.Pending]: '#F59E0B', // Amber-500
  [ReviewStatus.Rejected]: '#EF4444', // Red-500
  [ReviewStatus.Mismatch]: '#F97316', // Orange-500
  [ReviewStatus.Finalized]: '#22C55E', // Green-600
};

const ChartComponent: React.FC<ChartComponentProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  const sortedData = [...data].sort((a, b) => {
    const order: ReviewStatus[] = [
      ReviewStatus.Pending,
      ReviewStatus.Mismatch,
      ReviewStatus.Approved,
      ReviewStatus.Finalized,
    ];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-cyan-500/10" aria-hidden="true" />
      <div className="relative">
        <h3 className="text-lg font-semibold text-white">Review Status Overview</h3>
        <p className="text-xs text-slate-300/80">Real-time distribution across workflow stages</p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={sortedData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            cornerRadius={6}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            wrapperStyle={{ outline: 'none' }}
            contentStyle={{
              backgroundColor: 'rgba(15,23,42,0.95)',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E2E8F0',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ color: '#E2E8F0', fontSize: '12px', paddingTop: '16px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-center">
        <span className="text-xs uppercase tracking-wide text-slate-300/80">Accounts</span>
        <span className="text-3xl font-semibold text-white">{total}</span>
        <span className="text-[11px] text-slate-400">In workflow</span>
      </div>
    </div>
  );
};

export default ChartComponent;
