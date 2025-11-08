import React, { useState, useMemo } from 'react';
import { GLAccount, ReviewStatus, User, UserRole } from '../types';
import StatusBadge from './StatusBadge';
import { Check, X, ChevronsUpDown, Search, History, Pencil, FileText, Lightbulb } from 'lucide-react';

interface GLAccountTableProps {
  accounts: GLAccount[];
  currentUser: User;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onViewHistory: (account: GLAccount) => void;
  onEdit?: (account: GLAccount) => void;
  onViewReport: (account: GLAccount) => void;
  onOpenLogicExplain: (account: GLAccount) => void;
}

const GLAccountTable: React.FC<GLAccountTableProps> = ({
  accounts,
  currentUser,
  onApprove,
  onReject,
  onViewHistory,
  onEdit,
  onViewReport,
  onOpenLogicExplain,
}) => {
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof GLAccount | 'currentChecker'; direction: 'ascending' | 'descending' } | null>(null);

  // FIX: Use UserRole enum for type safety instead of a magic string.
  const isCFO = currentUser.role === UserRole.CFO;

  const visibleAccounts = useMemo(() => {
    if (isCFO) {
      return accounts.filter(account => account.currentChecker === UserRole.CFO);
    }
    return accounts.filter(account => account.currentChecker === currentUser.role);
  }, [accounts, currentUser.role, isCFO]);

  const sortedAccounts = useMemo(() => {
    let sortableAccounts = [...visibleAccounts];
    if (sortConfig !== null) {
      sortableAccounts.sort((a, b) => {
        const aValue = sortConfig.key === 'currentChecker' ? (a.currentChecker || 'Finalized') : a[sortConfig.key];
        const bValue = sortConfig.key === 'currentChecker' ? (b.currentChecker || 'Finalized') : b[sortConfig.key];
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableAccounts;
  }, [visibleAccounts, sortConfig]);
  
  const filteredAccounts = sortedAccounts.filter(account =>
    Object.values(account).some(value =>
      String(value).toLowerCase().includes(filter.toLowerCase())
    )
  );

  const requestSort = (key: keyof GLAccount | 'currentChecker') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader = ({ tkey, label }: { tkey: keyof GLAccount | 'currentChecker', label: string }) => (
    <th
      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300/80 cursor-pointer"
      onClick={() => requestSort(tkey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </div>
    </th>
  );
  const approveTitle = isCFO ? 'Finalize' : 'Approve';

  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-cyan-500/5" aria-hidden="true" />
       <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold text-white">GL Account Review Workflow</h3>
        <div className="relative w-full md:w-auto md:min-w-[260px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/10 py-2.5 pl-12 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
          />
        </div>
      </div>
      <div className="relative mt-6 overflow-x-auto rounded-2xl border border-white/5">
        <table className="min-w-[960px] divide-y divide-white/5">
          <thead className="bg-white/5 backdrop-blur">
            <tr>
              <SortableHeader tkey="glAccountNumber" label="GL Account #" />
              <SortableHeader tkey="glAccount" label="GL Account Name" />
              <SortableHeader tkey="responsibleDept" label="Department" />
              <SortableHeader tkey="currentChecker" label="Current Stage" />
              <SortableHeader tkey="reviewStatus" label="Status" />
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 backdrop-blur">
            {filteredAccounts.map((account) => {
              const canTakeAction = currentUser.role === account.currentChecker && account.reviewStatus !== ReviewStatus.Finalized;
              return (
              <tr key={account.id} className="transition-colors hover:bg-white/5">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-slate-200">{account.glAccountNumber}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">{account.glAccount}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                  <div className="flex flex-col">
                    <span>{account.responsibleDept}</span>
                    {account.inputDepartment && account.inputDepartment !== account.responsibleDept && (
                      <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        Input: {account.inputDepartment}
                      </span>
                    )}
                    {account.thresholdLevel && (
                      <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">
                        Severity {account.thresholdLevel}
                      </span>
                    )}
                  </div>
                </td>
                 <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-200">{account.currentChecker || 'Finalized'}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge status={account.reviewStatus} />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-xs font-medium text-center">
                  <div className="flex w-max items-center gap-2 rounded-full bg-white/5 px-2 py-2">
                    <button
                      onClick={() => onOpenLogicExplain(account)}
                      className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-200 transition-colors hover:bg-white/10"
                      title="Explain classification logic"
                    >
                      <Lightbulb size={16} />
                      Explain
                    </button>
                    <button
                        onClick={() => onViewHistory(account)}
                        className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-200 transition-colors hover:bg-white/10"
                        title="View full audit trail"
                    >
                        <History size={16} />
                        History
                    </button>
                    {isCFO && onEdit && (
                      <button
                        onClick={() => onEdit(account)}
                        className="flex flex-shrink-0 items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] uppercase tracking-wide text-cyan-200 transition-colors hover:bg-cyan-500/20"
                        title="Edit account details"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                    )}
                    <button
                        onClick={() => onViewReport(account)}
                        className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-wide transition-colors ${account.reportUrl ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20' : 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'}`}
                        title={account.reportUrl ? 'Open supporting report' : 'No report available'}
                        disabled={!account.reportUrl}
                    >
                        <FileText size={16} />
                        Report
                    </button>
                    <button
                        onClick={() => onApprove(account.id)}
                        disabled={!canTakeAction}
                        className={`flex flex-shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] uppercase tracking-wide transition-colors ${canTakeAction ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20' : 'border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'}`}
                        title={approveTitle}
                    >
                        <Check size={16} />
                        {approveTitle}
                    </button>
                    <button
                        onClick={() => onReject(account.id)}
                        disabled={!canTakeAction}
                        className={`flex flex-shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] uppercase tracking-wide transition-colors ${canTakeAction ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'}`}
                        title="Reject / Flag mismatch with reason"
                    >
                        <X size={16} />
                        Flag
                    </button>
                  </div>
                  {canTakeAction && (
                    <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      Rejection requires a reason
                    </p>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GLAccountTable;
