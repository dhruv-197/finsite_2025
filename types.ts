// Create type definitions for the application.
export enum UserRole {
  Checker1 = 'Checker 1',
  Checker2 = 'Checker 2',
  Checker3 = 'Checker 3',
  Checker4 = 'Checker 4',
  CFO = 'CFO',
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
}

export enum ReviewStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Mismatch = 'Mismatch',
  Finalized = 'Finalized',
}

export type ThresholdLevel = 'C' | 'M' | 'L';

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  from: string;
  to: string;
  reason?: string;
}

export interface GLAccount {
  id: number;
  glAccountNumber: string;
  glAccount: string;
  responsibleDept: string;
  departmentId: string;
  logicId: string;
  mainHead: string;
  subHead: string;
  bsPl: string;
  statusCategory: string;
  spoc: string;
  reviewer: string;
  reviewStatus: ReviewStatus;
  currentChecker: UserRole | null;
  auditLog: AuditLogEntry[];
  mistakeCount: number;
  reportUrl?: string;
  classificationConfidence: number;
  classificationSource: DepartmentClassification['source'];
  classificationEvidence: ClassificationEvidence[];
  classificationNotes?: string;
  classificationKeywords: string[];
  classificationPatterns: string[];
  inputDepartment?: string;
  balanceRaw?: string;
  normalizedBalance?: number;
  currency?: string;
  balanceIssues?: string[];
  balanceDate?: string;
  thresholdLevel?: ThresholdLevel;
  priorityScore?: number;
  varianceAgainstPrevious?: number;
  frequencyBucket?: ThresholdLevel;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

export interface UploadError {
    row: number;
    message: string;
    data: string;
}

export interface ClassificationEvidence {
  type: 'historical' | 'pattern' | 'keyword' | 'provided' | 'fallback';
  value: string;
  weight: number;
  confidence: number;
}

export interface DepartmentClassification {
  deptName: string;
  deptId: string;
  logicId: string;
  confidence: number;
  source: 'historical' | 'rule' | 'manual' | 'fallback';
  evidence: ClassificationEvidence[];
  notes?: string;
  keywordsMatched: string[];
  patternsMatched: string[];
}

export type UploadStatus = 'Active' | 'Archived';

export interface UploadFileSummary {
  name: string;
  size: number;
  type: string;
  sheetName: string;
  recordsScanned: number;
  recordsImported: number;
  issues: UploadError[];
}

export interface UploadSession {
  uploadId: string;
  userId?: number;
  timestamp: string;
  files: UploadFileSummary[];
  recordsCount: number;
  status: UploadStatus;
  message?: string;
}

export interface UploadCompletionPayload {
  accounts: GLAccount[];
  files: UploadFileSummary[];
  clearPrevious: boolean;
}

export interface ThresholdMetric {
  deptId: string;
  deptName: string;
  counts: Record<ThresholdLevel, number>;
  averageConfidence: number;
  totalAccounts: number;
  criticalValue: number;
  mediumValue: number;
  lowValue: number;
}

export interface ErrorLogEntry {
  id: string;
  glAccountId: number;
  glAccountNumber: string;
  message: string;
  severity: ThresholdLevel;
  checker?: string;
  timestamp: string;
  source?: string;
}

export interface CorrectionLogEntry {
  changeId: string;
  glAccountId: number;
  deptId: string;
  amountBefore: number;
  amountAfter: number;
  user: string;
  reason: string;
  timestamp: string;
  impact: number;
}

export interface BalanceSheetSummary {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  delta: number;
  status: 'Balanced' | 'Mismatch';
  suggestions: string[];
  generatedAt: string;
}

export type ReportFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly';

export interface ReportSchedule {
  id: string;
  frequency: ReportFrequency;
  nextRun: string;
  recipients: string[];
  active: boolean;
  lastRun?: string;
}

export interface ReportJob {
  id: string;
  generatedAt: string;
  reportName: string;
  status: 'Success' | 'Failed';
  scheduleId?: string;
  notes?: string;
  downloadUrl?: string;
}

export interface UploadHistoryRecord extends UploadSession {
  variance?: number;
  versionTag?: string;
}