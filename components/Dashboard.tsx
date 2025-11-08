import React, { useMemo, useState } from 'react';
import {
  GLAccount,
  User,
  ReviewStatus,
  UserRole,
  ThresholdMetric,
  ErrorLogEntry,
  BalanceSheetSummary,
  ReportSchedule,
  ReportFrequency,
  ReportJob,
  CorrectionLogEntry,
  UploadSession,
} from '../types';
import MetricsCard from './MetricsCard';
import ChartComponent from './ChartComponent';
import GLAccountTable from './GLAccountTable';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  List,
  FileCheck2,
  UserX,
  AlertTriangle,
  CalendarClock,
  Download,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';

interface DashboardProps {
  accounts: GLAccount[];
  currentUser: User;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onViewHistory: (account: GLAccount) => void;
  onEdit: (account: GLAccount) => void;
  onViewReport: (account: GLAccount) => void;
  onOpenLogicExplain: (account: GLAccount) => void;
  thresholdMetrics: ThresholdMetric[];
  numberIssues: ErrorLogEntry[];
  balanceSummary: BalanceSheetSummary | null;
  onGenerateReport: () => void;
  reportSchedules: ReportSchedule[];
  onCreateSchedule: (frequency: ReportFrequency, recipients: string[]) => void;
  onToggleSchedule: (id: string) => void;
  onRemoveSchedule: (id: string) => void;
  reportHistory: ReportJob[];
  correctionLog: CorrectionLogEntry[];
  onApplyCorrection: (payload: { accountId: number; amount: number; reason: string }) => void;
  uploadSessions: UploadSession[];
}

const Dashboard: React.FC<DashboardProps> = ({
  accounts,
  currentUser,
  onApprove,
  onReject,
  onViewHistory,
  onEdit,
  onViewReport,
  onOpenLogicExplain,
  thresholdMetrics,
  numberIssues,
  balanceSummary,
  onGenerateReport,
  reportSchedules,
  onCreateSchedule,
  onToggleSchedule,
  onRemoveSchedule,
  reportHistory,
  correctionLog,
  onApplyCorrection,
  uploadSessions,
}) => {
  const [scheduleFrequency, setScheduleFrequency] = useState<ReportFrequency>('Monthly');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [correctionAccountId, setCorrectionAccountId] = useState<number | ''>('');
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const visibleAccounts = useMemo(() => {
    if (currentUser.role === UserRole.CFO) {
      return accounts.filter(account => account.currentChecker === UserRole.CFO);
    }
    return accounts.filter(account => account.currentChecker === currentUser.role);
  }, [accounts, currentUser.role]);

  const metrics = useMemo(() => {
    const total = visibleAccounts.length;
    const pending = visibleAccounts.filter(a => a.reviewStatus === ReviewStatus.Pending).length;
    const mismatch = visibleAccounts.filter(a => a.reviewStatus === ReviewStatus.Mismatch).length;
    const finalized = visibleAccounts.filter(a => a.reviewStatus === ReviewStatus.Finalized).length;
    return { total, pending, mismatch, finalized };
  }, [visibleAccounts]);

  const globalMetrics = useMemo(() => {
    const total = accounts.length;
    const pending = accounts.filter(a => a.reviewStatus === ReviewStatus.Pending).length;
    const mismatch = accounts.filter(a => a.reviewStatus === ReviewStatus.Mismatch).length;
    const finalized = accounts.filter(a => a.reviewStatus === ReviewStatus.Finalized).length;
    const rejectedSet = new Set<number>();
    accounts.forEach(account => {
      if (account.auditLog.some(log => log.action.includes('Rejected'))) {
        rejectedSet.add(account.id);
      }
    });
    return { total, pending, mismatch, finalized, rejected: rejectedSet.size };
  }, [accounts]);

  const roleSummary = useMemo(() => {
    const roles: UserRole[] = [
      UserRole.Checker1,
      UserRole.Checker2,
      UserRole.Checker3,
      UserRole.Checker4,
      UserRole.CFO,
    ];

    const approvalSets = new Map<UserRole, Set<number>>();
    const rejectionSets = new Map<UserRole, Set<number>>();
    roles.forEach(role => {
      approvalSets.set(role, new Set());
      rejectionSets.set(role, new Set());
    });

    accounts.forEach(account => {
      account.auditLog.forEach(entry => {
        if (roles.includes(entry.role)) {
          if (entry.action.includes('Approved')) {
            approvalSets.get(entry.role)?.add(account.id);
          }
          if (entry.action.includes('Rejected')) {
            rejectionSets.get(entry.role)?.add(account.id);
          }
        }
      });
    });

    return roles.map(role => ({
      role,
      approvals: approvalSets.get(role)?.size ?? 0,
      rejections: rejectionSets.get(role)?.size ?? 0,
    }));
  }, [accounts]);

  const severityOrder: Record<string, number> = { C: 0, M: 1, L: 2 };

  const priorityQueue = useMemo(
    () =>
      accounts
        .map(account => ({
          account,
          level: account.thresholdLevel ?? 'L',
          priority: account.priorityScore ?? 0,
        }))
        .sort((a, b) => {
          const levelDiff = (severityOrder[a.level] ?? 3) - (severityOrder[b.level] ?? 3);
          if (levelDiff !== 0) {
            return levelDiff;
          }
          return b.priority - a.priority;
        })
        .slice(0, 6),
    [accounts]
  );

  const outstandingIssues = useMemo(() => numberIssues.slice(0, 6), [numberIssues]);
  const recentCorrections = useMemo(() => correctionLog.slice(0, 5), [correctionLog]);
  const recentReports = useMemo(() => reportHistory.slice(0, 5), [reportHistory]);
  const recentUploads = useMemo(() => uploadSessions.slice(-5).reverse(), [uploadSessions]);

  const handleScheduleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const recipients = scheduleRecipients
      .split(',')
      .map(recipient => recipient.trim())
      .filter(Boolean);
    onCreateSchedule(scheduleFrequency, recipients);
    setScheduleRecipients('');
  };

  const handleCorrectionSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (correctionAccountId === '' || correctionAmount.trim() === '' || correctionReason.trim() === '') {
      return;
    }
    const parsed = Number.parseFloat(correctionAmount);
    if (Number.isNaN(parsed)) {
      return;
    }
    onApplyCorrection({
      accountId: correctionAccountId,
      amount: parsed,
      reason: correctionReason,
    });
    setCorrectionAccountId('');
    setCorrectionAmount('');
    setCorrectionReason('');
  };

  const chartData = useMemo(() => {
    const statusCounts = visibleAccounts.reduce((acc, account) => {
      acc[account.reviewStatus] = (acc[account.reviewStatus] || 0) + 1;
      return acc;
    }, {} as Record<ReviewStatus, number>);

    const statusOrder: ReviewStatus[] = [
      ReviewStatus.Pending,
      ReviewStatus.Mismatch,
      ReviewStatus.Approved,
      ReviewStatus.Finalized,
    ];

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name as ReviewStatus,
      value,
    }))
    .sort((a, b) => statusOrder.indexOf(a.name) - statusOrder.indexOf(b.name));
  }, [visibleAccounts]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/20 via-slate-900 to-slate-950 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.60)]">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-cyan-400/30 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-200/80">Workflow Pulse</p>
            <h2 className="text-3xl font-semibold text-white">Auditor&rsquo;s Mission Control</h2>
            <p className="text-sm text-slate-200/80">
              Monitor balance-sheet assurance in real time. Track bottlenecks across checkers, surface mismatches instantly,
              and send clean accounts to the CFO with confidence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 shadow-inner">
            <div>
              <p className="text-xs font-medium text-slate-300/80 uppercase tracking-wide">Pending</p>
              <p className="text-2xl font-semibold text-white">{globalMetrics.pending}</p>
              <span className="text-[11px] uppercase tracking-wide text-cyan-200/80">Requires attention</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300/80 uppercase tracking-wide">Mismatches</p>
              <p className="text-2xl font-semibold text-white">{globalMetrics.mismatch}</p>
              <span className="text-[11px] uppercase tracking-wide text-rose-200/80">Escalated items</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300/80 uppercase tracking-wide">Finalized</p>
              <p className="text-2xl font-semibold text-white">{globalMetrics.finalized}</p>
              <span className="text-[11px] uppercase tracking-wide text-emerald-200/80">Ready for reporting</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300/80 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-semibold text-white">{globalMetrics.total}</p>
              <span className="text-[11px] uppercase tracking-wide text-slate-200/80">Actively tracked</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Global portfolio</p>
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricsCard title="All Accounts" value={globalMetrics.total} icon={<List size={24} className="text-cyan-300" />} color="bg-cyan-500/10" />
            <MetricsCard title="All Pending" value={globalMetrics.pending} icon={<Clock size={24} className="text-amber-300" />} color="bg-amber-500/10" />
            <MetricsCard title="All Mismatches" value={globalMetrics.mismatch} icon={<AlertCircle size={24} className="text-rose-300" />} color="bg-rose-500/10" />
            <MetricsCard title="Finalized (Overall)" value={globalMetrics.finalized} icon={<CheckCircle size={24} className="text-emerald-300" />} color="bg-emerald-500/10" />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">My review queue</p>
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricsCard title="Assigned to Me" value={metrics.total} icon={<List size={24} className="text-indigo-300" />} color="bg-indigo-500/10" />
            <MetricsCard title="Pending in My Queue" value={metrics.pending} icon={<Clock size={24} className="text-yellow-200" />} color="bg-yellow-500/10" />
            <MetricsCard title="Mismatches in My Queue" value={metrics.mismatch} icon={<AlertCircle size={24} className="text-rose-200" />} color="bg-rose-500/10" />
            <MetricsCard title="Finalized in My Queue" value={metrics.finalized} icon={<CheckCircle size={24} className="text-emerald-200" />} color="bg-emerald-500/10" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <h3 className="text-lg font-semibold text-white">Lifecycle Totals</h3>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Real-time across all accounts</p>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileCheck2 className="h-5 w-5 text-emerald-300" />
                <span className="text-sm text-slate-200">Finalized Accounts</span>
              </div>
              <span className="text-lg font-semibold text-white">{globalMetrics.finalized}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-rose-300" />
                <span className="text-sm text-slate-200">Total Rejections Logged</span>
              </div>
              <span className="text-lg font-semibold text-white">{globalMetrics.rejected}</span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur lg:col-span-2">
          <h3 className="text-lg font-semibold text-white">Stage Contribution Summary</h3>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Unique accounts touched by each role</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-slate-300/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.3em]">Role</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em]">Approved</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em]">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {roleSummary.map(({ role, approvals, rejections }) => (
                  <tr key={role}>
                    <td className="px-4 py-3 font-medium">{role}</td>
                    <td className="px-4 py-3 text-right text-emerald-200">{approvals}</td>
                    <td className="px-4 py-3 text-right text-rose-200">{rejections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Threshold Severity Overview</h3>
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">C · M · L breakdown by department</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-slate-300/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.3em]">Department</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">C</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200">M</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">L</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.3em]">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {thresholdMetrics.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-400" colSpan={5}>
                      No threshold metrics available yet.
                    </td>
                  </tr>
                )}
                {thresholdMetrics.map(metric => (
                  <tr key={metric.deptId}>
                    <td className="px-4 py-3 font-medium text-white">{metric.deptName}</td>
                    <td className="px-4 py-3 text-right text-rose-300">{metric.counts.C}</td>
                    <td className="px-4 py-3 text-right text-amber-200">{metric.counts.M}</td>
                    <td className="px-4 py-3 text-right text-emerald-200">{metric.counts.L}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {(metric.averageConfidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Priority Queue</h3>
            <ClipboardCheck className="h-5 w-5 text-cyan-300" />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Critical GLs requiring immediate review</p>
          <ul className="mt-4 space-y-3">
            {priorityQueue.length === 0 && (
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300/80">
                No accounts in queue.
              </li>
            )}
            {priorityQueue.map(item => (
              <li
                key={item.account.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-white">{item.account.glAccount}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {item.account.glAccountNumber} · {item.account.responsibleDept}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      item.level === 'C'
                        ? 'bg-rose-500/10 text-rose-200 border border-rose-400/30'
                        : item.level === 'M'
                        ? 'bg-amber-500/10 text-amber-200 border border-amber-400/30'
                        : 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/30'
                    }`}
                  >
                    {item.level}
                  </span>
                  <p className="mt-1 text-xs text-slate-300/80">Priority {item.priority.toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Balance Sheet Health</h3>
            <BarChart3 className="h-5 w-5 text-emerald-300" />
          </div>
          {balanceSummary ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Total Assets</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {balanceSummary.totalAssets.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Liabilities + Equity</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {(balanceSummary.totalLiabilities + balanceSummary.totalEquity).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Variance</p>
                <p
                  className={`mt-1 text-2xl font-semibold ${
                    balanceSummary.status === 'Balanced' ? 'text-emerald-200' : 'text-rose-200'
                  }`}
                >
                  {balanceSummary.delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Status</p>
                <p className="mt-1 text-lg font-semibold text-white">{balanceSummary.status}</p>
                {balanceSummary.suggestions.map((suggestion, index) => (
                  <p key={index} className="mt-1 text-xs text-slate-400">
                    • {suggestion}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300/80">No balance summary available.</p>
          )}
          <button
            onClick={onGenerateReport}
            className="mt-6 inline-flex items-center rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-900 shadow-lg transition-colors hover:bg-cyan-400"
          >
            <Download className="mr-2 h-4 w-4" />
            Generate Consolidated Report
          </button>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <h3 className="text-lg font-semibold text-white">Manual Corrections</h3>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Adjustment trail & quick actions</p>
          {currentUser.role === UserRole.CFO ? (
            <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.25em] text-slate-300/70">GL Account</label>
              <select
                value={correctionAccountId}
                onChange={event => setCorrectionAccountId(event.target.value ? Number(event.target.value) : '')}
                className="w-full rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              >
                <option value="">Select account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.glAccountNumber} · {account.glAccount}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.25em] text-slate-300/70">Adjusted Balance</label>
                  <input
                    value={correctionAmount}
                    onChange={event => setCorrectionAmount(event.target.value)}
                    placeholder="Enter normalized value"
                    className="mt-1 w-full rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.25em] text-slate-300/70">Reason</label>
                  <input
                    value={correctionReason}
                    onChange={event => setCorrectionReason(event.target.value)}
                    placeholder="Explain the adjustment"
                    className="mt-1 w-full rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-emerald-400"
              >
                Log Correction
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-300/80">
              Corrections can be initiated by the CFO. Contact the finance team for escalation.
            </p>
          )}
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Recent Adjustments</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {recentCorrections.length === 0 && (
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300/80">
                  No corrections logged yet.
                </li>
              )}
              {recentCorrections.map(entry => (
                <li key={entry.changeId} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span>{entry.changeId}</span>
                    <span className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Δ {entry.impact.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {entry.reason}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Report Automation</h3>
            <CalendarClock className="h-5 w-5 text-cyan-300" />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Schedule recurring CFO-ready packs</p>
          <form onSubmit={handleScheduleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={scheduleFrequency}
              onChange={event => setScheduleFrequency(event.target.value as ReportFrequency)}
              className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Half-Yearly">Half-Yearly</option>
            </select>
            <input
              value={scheduleRecipients}
              onChange={event => setScheduleRecipients(event.target.value)}
              placeholder="Recipients (comma separated)"
              className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:col-span-2"
            />
            <button
              type="submit"
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-400 sm:col-span-3"
            >
              Add Schedule
            </button>
          </form>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {reportSchedules.length === 0 && (
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300/80">
                No active schedules. Create one above.
              </li>
            )}
            {reportSchedules.map(schedule => (
              <li key={schedule.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{schedule.frequency}</p>
                    <p className="text-xs text-slate-400">
                      Next run {new Date(schedule.nextRun).toLocaleString()} ·{' '}
                      {schedule.recipients.join(', ') || 'No recipients'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSchedule(schedule.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        schedule.active
                          ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                          : 'border border-slate-400/30 bg-white/5 text-slate-300'
                      }`}
                    >
                      {schedule.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSchedule(schedule.id)}
                      className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Recent Reports</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {recentReports.length === 0 && <li>No reports generated yet.</li>}
              {recentReports.map(job => (
                <li key={job.id} className="flex items-center justify-between text-slate-200">
                  <span>{job.reportName}</span>
                  <span className="text-slate-400">{new Date(job.generatedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <h3 className="text-lg font-semibold text-white">Upload History</h3>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Latest ingestion events</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-slate-300/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.3em]">Upload ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.3em]">Timestamp</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.3em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {recentUploads.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-400" colSpan={3}>
                      No upload history yet.
                    </td>
                  </tr>
                )}
                {recentUploads.map(session => (
                  <tr key={session.uploadId}>
                    <td className="px-4 py-3 font-semibold text-white">{session.uploadId}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(session.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{session.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Validation Issues</h3>
            <AlertCircle className="h-5 w-5 text-rose-300" />
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {outstandingIssues.length === 0 && (
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300/80">
                No outstanding normalization alerts.
              </li>
            )}
            {outstandingIssues.map(issue => (
              <li key={issue.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{issue.glAccountNumber}</span>
                  <span className="text-xs text-slate-400">{new Date(issue.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-300/80">{issue.message}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <h3 className="text-lg font-semibold text-white">Report History</h3>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">Last generated artefacts</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {recentReports.length === 0 && (
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300/80">
                No reports generated yet.
              </li>
            )}
            {recentReports.map(job => (
              <li key={job.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{job.reportName}</span>
                  <span className="text-xs text-slate-400">{new Date(job.generatedAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400">Status: {job.status}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <GLAccountTable
            accounts={accounts}
            currentUser={currentUser}
            onApprove={onApprove}
            onReject={onReject}
            onViewHistory={onViewHistory}
            onEdit={onEdit}
            onViewReport={onViewReport}
            onOpenLogicExplain={onOpenLogicExplain}
          />
        </div>
        <ChartComponent data={chartData} />
      </div>
    </div>
  );
};

export default Dashboard;
