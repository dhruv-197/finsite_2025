import React from 'react';
import { ReviewStatus } from '../types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusStyles: { [key in ReviewStatus]: string } = {
    [ReviewStatus.Approved]: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    [ReviewStatus.Pending]: 'border border-amber-400/30 bg-amber-500/10 text-amber-200',
    [ReviewStatus.Rejected]: 'border border-rose-400/30 bg-rose-500/10 text-rose-200',
    [ReviewStatus.Mismatch]: 'border border-orange-400/30 bg-orange-500/10 text-orange-200',
    [ReviewStatus.Finalized]: 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
