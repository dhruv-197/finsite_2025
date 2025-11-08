
import React from 'react';

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur">
      <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">{title}</p>
          <p className="text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default MetricsCard;
