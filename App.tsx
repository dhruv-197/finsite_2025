import React, { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import Header, { View } from './components/Header';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ChatInterface from './components/ChatInterface';
import WorkflowModal from './components/WorkflowModal';
import EditAccountModal from './components/EditAccountModal';
import ReportViewerModal from './components/ReportViewerModal';
import LogicExplainModal from './components/LogicExplainModal';
import {
  User,
  GLAccount,
  ReviewStatus,
  UserRole,
  UploadCompletionPayload,
  UploadSession,
  DepartmentClassification,
  ThresholdMetric,
  ErrorLogEntry,
  BalanceSheetSummary,
  ReportSchedule,
  ReportJob,
  CorrectionLogEntry,
  ReportFrequency,
} from './types';
import { INITIAL_ACCOUNTS } from './constants';
import toast from './services/notificationService';
import {
  buildBalanceSheetSummary,
  calculateNextRunDate,
  calculatePriorityScore,
  collectNumberIssues,
  computeThresholdMetrics,
  createCorrectionLogEntry,
  determineThresholdLevel,
  normalizeAmount,
} from './services/analyticsService';
import { generateReportWorkbook } from './services/reportService';

const STORAGE_KEY = 'finsight.accounts.state';
const SESSION_STORAGE_KEY = 'finsight.upload.sessions';
const ACTIVE_UPLOAD_KEY = 'finsight.upload.active';
const SCHEDULE_STORAGE_KEY = 'finsight.report.schedules';
const REPORT_HISTORY_KEY = 'finsight.report.history';
const CORRECTION_STORAGE_KEY = 'finsight.corrections';

const sortAccounts = (list: GLAccount[]) =>
  [...list].sort((a, b) => {
    const nameCompare = a.glAccount.localeCompare(b.glAccount, undefined, { sensitivity: 'base' });
    if (nameCompare !== 0) {
      return nameCompare;
    }
    const deptCompare = a.responsibleDept.localeCompare(b.responsibleDept, undefined, { sensitivity: 'base' });
    if (deptCompare !== 0) {
      return deptCompare;
    }
    return a.glAccountNumber.localeCompare(b.glAccountNumber, undefined, { sensitivity: 'base' });
  });

const VALID_CLASSIFICATION_SOURCES: DepartmentClassification['source'][] = [
  'historical',
  'rule',
  'manual',
  'fallback',
];

const hydrateAccount = (rawAccount: any): GLAccount => {
  const classificationSource: DepartmentClassification['source'] = VALID_CLASSIFICATION_SOURCES.includes(
    rawAccount?.classificationSource
  )
    ? rawAccount.classificationSource
    : 'fallback';

  const normalization = normalizeAmount(
    rawAccount?.balanceRaw ??
      (typeof rawAccount?.normalizedBalance === 'number' ? String(rawAccount.normalizedBalance) : undefined),
    rawAccount?.currency
  );

  const normalizedBalance =
    typeof rawAccount?.normalizedBalance === 'number' ? rawAccount.normalizedBalance : normalization.normalized;
  const currency = rawAccount?.currency ?? normalization.currency;
  const balanceIssues = Array.isArray(rawAccount?.balanceIssues) ? rawAccount.balanceIssues : normalization.issues;

  const baseAccount: GLAccount = {
    ...rawAccount,
    glAccountNumber: rawAccount.glAccountNumber ?? '',
    glAccount: rawAccount.glAccount ?? 'Unnamed',
    responsibleDept: rawAccount.responsibleDept ?? 'Unassigned',
    departmentId: rawAccount.departmentId ?? 'UNCLASS',
    logicId: rawAccount.logicId ?? 'GEN-UNCL-0000',
    mainHead: rawAccount.mainHead ?? 'Unknown',
    subHead: rawAccount.subHead ?? 'Unknown',
    bsPl: rawAccount.bsPl ?? 'BS',
    statusCategory: rawAccount.statusCategory ?? 'Assets',
    spoc: rawAccount.spoc ?? 'Unassigned',
    reviewer: rawAccount.reviewer ?? 'Unassigned',
    reviewStatus: rawAccount.reviewStatus ?? ReviewStatus.Pending,
    currentChecker: rawAccount.currentChecker ?? UserRole.Checker1,
    auditLog: rawAccount.auditLog ?? [],
    mistakeCount: rawAccount.mistakeCount ?? 0,
    reportUrl: rawAccount.reportUrl ?? '',
    classificationConfidence:
      typeof rawAccount.classificationConfidence === 'number' ? rawAccount.classificationConfidence : 0.4,
    classificationSource,
    classificationEvidence: Array.isArray(rawAccount.classificationEvidence)
      ? rawAccount.classificationEvidence
      : [],
    classificationNotes: rawAccount.classificationNotes,
    classificationKeywords: Array.isArray(rawAccount.classificationKeywords)
      ? rawAccount.classificationKeywords
      : [],
    classificationPatterns: Array.isArray(rawAccount.classificationPatterns)
      ? rawAccount.classificationPatterns
      : [],
    inputDepartment: rawAccount.inputDepartment ?? rawAccount.responsibleDept ?? 'Unassigned',
    balanceRaw: rawAccount.balanceRaw ?? normalization.cleanedValue ?? rawAccount.balanceRaw,
    normalizedBalance,
    currency,
    balanceIssues,
    balanceDate: rawAccount.balanceDate ?? null,
    thresholdLevel: rawAccount.thresholdLevel,
    priorityScore: rawAccount.priorityScore,
    varianceAgainstPrevious: rawAccount.varianceAgainstPrevious ?? 0,
    frequencyBucket: rawAccount.frequencyBucket ?? rawAccount.thresholdLevel,
  };

  const thresholdLevel = rawAccount.thresholdLevel ?? determineThresholdLevel(baseAccount);
  const priorityScore = rawAccount.priorityScore ?? calculatePriorityScore(baseAccount, thresholdLevel);

  return {
    ...baseAccount,
    thresholdLevel,
    priorityScore,
    frequencyBucket: baseAccount.frequencyBucket ?? thresholdLevel,
  };
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeIdLoaded, setActiveIdLoaded] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [modalState, setModalState] = useState<{ mode: 'history' | 'reject'; account: GLAccount } | null>(null);
  const [editAccount, setEditAccount] = useState<GLAccount | null>(null);
  const [reportAccount, setReportAccount] = useState<GLAccount | null>(null);
  const [logicExplainAccount, setLogicExplainAccount] = useState<GLAccount | null>(null);
  const [thresholdMetrics, setThresholdMetrics] = useState<ThresholdMetric[]>([]);
  const [numberIssues, setNumberIssues] = useState<ErrorLogEntry[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSheetSummary | null>(null);
  const [correctionLog, setCorrectionLog] = useState<CorrectionLogEntry[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportJob[]>([]);

  const workflowSequence: (UserRole | null)[] = [
    UserRole.Checker1,
    UserRole.Checker2,
    UserRole.Checker3,
    UserRole.Checker4,
    UserRole.CFO,
    null, // Represents Finalized
  ];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: GLAccount[] = JSON.parse(stored).map(hydrateAccount);
        setAccounts(sortAccounts(parsed));
        return;
      }
    } catch (error) {
      console.error('Failed to load accounts from storage, using defaults.', error);
    }
    setAccounts(sortAccounts(INITIAL_ACCOUNTS.map(hydrateAccount)));
  }, []);

  useEffect(() => {
    try {
      if (accounts.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      }
    } catch (error) {
      console.error('Failed to persist accounts to storage.', error);
    }
  }, [accounts]);

  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSessions) {
        const parsed: UploadSession[] = JSON.parse(storedSessions);
        setUploadSessions(parsed);
      }
      const storedActive = localStorage.getItem(ACTIVE_UPLOAD_KEY);
      if (storedActive) {
        setActiveUploadId(storedActive);
      }
    } catch (error) {
      console.error('Failed to load upload sessions from storage.', error);
    }
    setSessionsLoaded(true);
    setActiveIdLoaded(true);
  }, []);

  useEffect(() => {
    if (!sessionsLoaded) {
      return;
    }
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(uploadSessions));
    } catch (error) {
      console.error('Failed to persist upload sessions to storage.', error);
    }
  }, [uploadSessions, sessionsLoaded]);

  useEffect(() => {
    if (!activeIdLoaded) {
      return;
    }
    try {
      if (activeUploadId) {
        localStorage.setItem(ACTIVE_UPLOAD_KEY, activeUploadId);
      } else {
        localStorage.removeItem(ACTIVE_UPLOAD_KEY);
      }
    } catch (error) {
      console.error('Failed to persist active upload identifier.', error);
    }
  }, [activeUploadId, activeIdLoaded]);

  useEffect(() => {
    try {
      const storedSchedules = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (storedSchedules) {
        setReportSchedules(JSON.parse(storedSchedules));
      }
      const storedHistory = localStorage.getItem(REPORT_HISTORY_KEY);
      if (storedHistory) {
        setReportHistory(JSON.parse(storedHistory));
      }
      const storedCorrections = localStorage.getItem(CORRECTION_STORAGE_KEY);
      if (storedCorrections) {
        setCorrectionLog(JSON.parse(storedCorrections));
      }
    } catch (error) {
      console.error('Failed to load reporting artefacts from storage.', error);
    }
  }, []);

  useEffect(() => {
    if (accounts.length === 0) {
      setThresholdMetrics([]);
      setNumberIssues([]);
      setBalanceSummary(null);
      return;
    }
    setThresholdMetrics(computeThresholdMetrics(accounts));
    setNumberIssues(collectNumberIssues(accounts));
    setBalanceSummary(buildBalanceSheetSummary(accounts));
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(reportSchedules));
    } catch (error) {
      console.error('Failed to persist report schedules.', error);
    }
  }, [reportSchedules]);

  useEffect(() => {
    try {
      localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(reportHistory));
    } catch (error) {
      console.error('Failed to persist report history.', error);
    }
  }, [reportHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(CORRECTION_STORAGE_KEY, JSON.stringify(correctionLog));
    } catch (error) {
      console.error('Failed to persist correction log.', error);
    }
  }, [correctionLog]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveView('dashboard');
    toast.success(`Welcome, ${user.name}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleNavigate = (view: View) => {
    setActiveView(view);
  };

  const handleGenerateReport = useCallback(
    (scheduleId?: string) => {
      if (!balanceSummary) {
        toast.error('Balance summary not ready for reporting.');
        return;
      }
      try {
        const reportName = generateReportWorkbook({
          accounts,
          metrics: thresholdMetrics,
          balanceSummary,
          corrections: correctionLog,
          sessions: uploadSessions,
        });
        const newJob: ReportJob = {
          id: `RPT-${Date.now().toString(36).toUpperCase()}`,
          generatedAt: new Date().toISOString(),
          reportName,
          status: 'Success',
          scheduleId,
        };
        setReportHistory(prev => [newJob, ...prev].slice(0, 25));
        toast.success(`Report ${reportName} generated.`);
      } catch (error) {
        console.error('Failed generating report workbook.', error);
        const failedJob: ReportJob = {
          id: `RPT-${Date.now().toString(36).toUpperCase()}`,
          generatedAt: new Date().toISOString(),
          reportName: 'Report generation failed',
          status: 'Failed',
          scheduleId,
          notes: error instanceof Error ? error.message : 'Unknown error',
        };
        setReportHistory(prev => [failedJob, ...prev].slice(0, 25));
        toast.error('Failed to generate report.');
      }
    },
    [accounts, thresholdMetrics, balanceSummary, correctionLog, uploadSessions]
  );

  const handleCreateSchedule = (frequency: ReportFrequency, recipients: string[]) => {
    const schedule: ReportSchedule = {
      id: `SCH-${Date.now().toString(36).toUpperCase()}`,
      frequency,
      nextRun: calculateNextRunDate(frequency).toISOString(),
      recipients,
      active: true,
    };
    setReportSchedules(prev => [...prev, schedule]);
    toast.success(`Scheduled ${frequency} report.`);
  };

  const handleToggleSchedule = (id: string) => {
    setReportSchedules(prev =>
      prev.map(schedule => (schedule.id === id ? { ...schedule, active: !schedule.active } : schedule))
    );
  };

  const handleRemoveSchedule = (id: string) => {
    setReportSchedules(prev => prev.filter(schedule => schedule.id !== id));
    toast.success('Report schedule removed.');
  };

  useEffect(() => {
    if (reportSchedules.length === 0) {
      return;
    }
    const interval = setInterval(() => {
      const now = new Date();
      setReportSchedules(prev => {
        let changed = false;
        const updated = prev.map(schedule => {
          if (!schedule.active) {
            return schedule;
          }
          if (new Date(schedule.nextRun) <= now) {
            changed = true;
            handleGenerateReport(schedule.id);
            const nextRunDate = calculateNextRunDate(schedule.frequency, now);
            return {
              ...schedule,
              lastRun: now.toISOString(),
              nextRun: nextRunDate.toISOString(),
            };
          }
          return schedule;
        });
        return changed ? updated : prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [reportSchedules, handleGenerateReport]);

  const handleApprove = (id: number) => {
    if (!currentUser) {
      toast.error('You need to be signed in to take action.');
      return;
    }

    const targetAccount = accounts.find(acc => acc.id === id);

    if (!targetAccount) {
      toast.error('Account not found.');
      return;
    }

    if (targetAccount.reviewStatus === ReviewStatus.Finalized) {
      toast.error('This account has already been finalized.');
      return;
    }

    if (targetAccount.currentChecker !== currentUser.role) {
      toast.error('You are not assigned to review this account.');
      return;
    }

    setAccounts(prev => prev.map(acc => {
      if (acc.id === id) {
        const currentStageIndex = workflowSequence.findIndex(role => role === acc.currentChecker);
        const nextChecker = currentStageIndex !== -1 ? workflowSequence[currentStageIndex + 1] : null;

        let newStatus: ReviewStatus;
        if (nextChecker === null) {
          newStatus = ReviewStatus.Finalized;
        } else if (nextChecker === UserRole.CFO) {
          newStatus = ReviewStatus.Approved;
        } else {
          newStatus = ReviewStatus.Pending;
        }
        
        return {
          ...acc,
          reviewStatus: newStatus,
          currentChecker: nextChecker,
          auditLog: [...acc.auditLog, {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            role: currentUser.role,
            action: `Approved by ${currentUser.role}`,
            from: acc.currentChecker!,
            to: nextChecker ? nextChecker : 'Finalized',
          }]
        };
      }
      return acc;
    }));
    if (targetAccount.currentChecker === UserRole.CFO) {
      toast.success('Account finalized.');
    } else {
      toast.success('Account approved and moved to the next stage.');
    }
  };

  const handleReject = (reason: string, accountId: number) => {
    if (!currentUser) {
      toast.error('You need to be signed in to take action.');
      return;
    }

    const targetAccount = accounts.find(acc => acc.id === accountId);

    if (!targetAccount) {
      toast.error('Account not found.');
      setModalState(null);
      return;
    }

    if (targetAccount.currentChecker !== currentUser.role) {
      toast.error('You are not assigned to review this account.');
      setModalState(null);
      return;
    }

    setAccounts(prev => prev.map(acc => {
      if (acc.id === accountId) {
        return {
          ...acc,
          reviewStatus: ReviewStatus.Mismatch,
          currentChecker: UserRole.Checker1, // Reset to Checker 1
          mistakeCount: acc.mistakeCount + 1,
          auditLog: [...acc.auditLog, {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            role: currentUser.role,
            action: `Rejected by ${currentUser.role}`,
            from: acc.currentChecker!,
            to: UserRole.Checker1,
            reason: reason,
          }]
        };
      }
      return acc;
    }));
    toast.error('Account flagged as mismatch and sent back to Checker 1.');
    setModalState(null);
  };

  const handleCompleteUpload = (payload: UploadCompletionPayload) => {
    const uploadId = `UPL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setUploadSessions(prev => {
      const archived = prev.map(session => ({
        ...session,
        status: 'Archived',
      }));
      const normalizedFiles = payload.files ?? [];
      const newSession: UploadSession = {
        uploadId,
        userId: currentUser?.id,
        timestamp: new Date().toISOString(),
        files: normalizedFiles,
        recordsCount: payload.accounts.length,
        status: 'Active',
        message: payload.clearPrevious
          ? 'Started new session with fresh dataset.'
          : 'Appended data to existing session.',
      };
      return [...archived, newSession];
    });
    setActiveUploadId(uploadId);

    const normalizedAccounts = sortAccounts(payload.accounts.map(hydrateAccount));

    if (payload.clearPrevious) {
      setAccounts(normalizedAccounts);
      toast.success(`Upload ${uploadId} processed. Previous session data cleared.`);
    } else {
      setAccounts(prev => sortAccounts([...prev, ...normalizedAccounts]));
      toast.success(`Upload ${uploadId} processed. Data appended to existing session.`);
    }
    setActiveView('dashboard');
  };

  const handleResetUploads = () => {
    setAccounts([]);
    setUploadSessions(prev => prev.map(session => ({ ...session, status: 'Archived' })));
    setActiveUploadId(null);
    toast.success('Previous upload data cleared. Ready for a fresh dataset.');
  };
  
  const openRejectModal = (account: GLAccount) => {
    setModalState({ mode: 'reject', account });
  };

  const openHistoryModal = (account: GLAccount) => {
    setModalState({ mode: 'history', account });
  };

  const openEditModal = (account: GLAccount) => {
    setEditAccount(account);
  };

  const openReportModal = (account: GLAccount) => {
    setReportAccount(account);
  };

  const closeReportModal = () => {
    setReportAccount(null);
  };

  const handleSaveAccountEdits = (updates: Partial<GLAccount>) => {
    if (!editAccount || !currentUser) {
      return;
    }

    setAccounts(prev => prev.map(acc => {
      if (acc.id !== editAccount.id) {
        return acc;
      }

      const updatedAccount = {
        ...acc,
        ...updates,
      };

      return {
        ...updatedAccount,
        auditLog: [
          ...acc.auditLog,
          {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            role: currentUser.role,
            action: 'Details updated by CFO',
            from: acc.currentChecker ? acc.currentChecker : 'Finalized',
            to: acc.currentChecker ? acc.currentChecker : 'Finalized',
          },
        ],
      };
    }));

    toast.success('Account details updated successfully.');
    setEditAccount(null);
  };

  const handleApplyCorrection = ({ accountId, amount, reason }: { accountId: number; amount: number; reason: string }) => {
    if (!currentUser) {
      toast.error('You need to be signed in to log corrections.');
      return;
    }

    const targetAccount = accounts.find(acc => acc.id === accountId);
    if (!targetAccount) {
      toast.error('Account not found for correction.');
      return;
    }

    const correctionEntry = createCorrectionLogEntry({
      account: targetAccount,
      amountAfter: amount,
      user: currentUser.name,
      reason,
    });

    setAccounts(prev =>
      sortAccounts(
        prev.map(acc => {
          if (acc.id !== accountId) {
            return acc;
          }
          const thresholdLevel = determineThresholdLevel({ ...acc, normalizedBalance: amount });
          const priorityScore = calculatePriorityScore(
            { ...acc, normalizedBalance: amount, thresholdLevel },
            thresholdLevel
          );
          return {
            ...acc,
            normalizedBalance: amount,
            balanceIssues: [],
            thresholdLevel,
            priorityScore,
            varianceAgainstPrevious: Number(((amount - (acc.normalizedBalance ?? 0)) / (Math.abs(acc.normalizedBalance ?? 1) || 1)).toFixed(4)),
            mistakeCount: acc.mistakeCount + 1,
            auditLog: [
              ...acc.auditLog,
              {
                timestamp: new Date().toISOString(),
                user: currentUser.name,
                role: currentUser.role,
                action: 'Balance adjusted',
                from: acc.currentChecker ? acc.currentChecker : 'Finalized',
                to: acc.currentChecker ? acc.currentChecker : 'Finalized',
                reason,
              },
            ],
          };
        })
      )
    );
    setCorrectionLog(prev => [correctionEntry, ...prev]);
    toast.success('Correction captured and logged.');
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <Header currentUser={currentUser} onLogout={handleLogout} activeView={activeView} onNavigate={handleNavigate} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {activeView === 'dashboard' && (
          <Dashboard
            accounts={accounts}
            currentUser={currentUser}
            onApprove={handleApprove}
            onReject={(id) => openRejectModal(accounts.find(a => a.id === id)!)}
            onViewHistory={openHistoryModal}
            onEdit={openEditModal}
            onViewReport={openReportModal}
            onOpenLogicExplain={setLogicExplainAccount}
            thresholdMetrics={thresholdMetrics}
            numberIssues={numberIssues}
            balanceSummary={balanceSummary}
            onGenerateReport={() => handleGenerateReport()}
            reportSchedules={reportSchedules}
            onCreateSchedule={handleCreateSchedule}
            onToggleSchedule={handleToggleSchedule}
            onRemoveSchedule={handleRemoveSchedule}
            reportHistory={reportHistory}
            correctionLog={correctionLog}
            onApplyCorrection={handleApplyCorrection}
            uploadSessions={uploadSessions}
          />
        )}
        {activeView === 'upload' && (
          <UploadView
            onCompleteUpload={handleCompleteUpload}
            onResetUploads={handleResetUploads}
            currentAccounts={accounts}
            activeUploadId={activeUploadId}
            hasPreviousUploads={accounts.length > 0}
          />
        )}
        {activeView === 'chat' && <ChatInterface glAccounts={accounts} />}
      </main>
      {modalState && (
        <WorkflowModal
          account={modalState.account}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
          onSubmitReason={(reason) => handleReject(reason, modalState.account.id)}
          currentUser={currentUser}
        />
      )}
      {editAccount && (
        <EditAccountModal
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSave={handleSaveAccountEdits}
        />
      )}
      {reportAccount && (
        <ReportViewerModal
          account={reportAccount}
          onClose={closeReportModal}
        />
      )}
      {logicExplainAccount && (
        <LogicExplainModal
          account={logicExplainAccount}
          onClose={() => setLogicExplainAccount(null)}
        />
      )}
    </div>
  );
};

export default App;

