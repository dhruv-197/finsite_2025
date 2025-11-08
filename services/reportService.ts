import * as XLSX from 'xlsx';
import {
  BalanceSheetSummary,
  CorrectionLogEntry,
  GLAccount,
  ThresholdMetric,
  UploadSession,
} from '../types';

const buildAccountsSheet = (accounts: GLAccount[]) => {
  const data = accounts.map(account => ({
    'GL Account Number': account.glAccountNumber,
    'GL Account Name': account.glAccount,
    Department: account.responsibleDept,
    'Dept ID': account.departmentId,
    'Logic ID': account.logicId,
    'Current Stage': account.currentChecker ?? 'Finalized',
    Status: account.reviewStatus,
    'Mistake Count': account.mistakeCount,
    'Threshold Level': account.thresholdLevel,
    'Priority Score': account.priorityScore,
    'Normalized Balance': account.normalizedBalance,
    Currency: account.currency,
    'Balance Date': account.balanceDate,
  }));
  return XLSX.utils.json_to_sheet(data);
};

const buildThresholdSheet = (metrics: ThresholdMetric[]) => {
  const data = metrics.map(metric => ({
    Department: metric.deptName,
    'Dept ID': metric.deptId,
    'Critical Count': metric.counts.C,
    'Medium Count': metric.counts.M,
    'Low Count': metric.counts.L,
    'Average Confidence': Number((metric.averageConfidence * 100).toFixed(1)),
    'Critical Value': metric.criticalValue,
    'Medium Value': metric.mediumValue,
    'Low Value': metric.lowValue,
  }));
  return XLSX.utils.json_to_sheet(data);
};

const buildBalanceSheetTab = (summary: BalanceSheetSummary) => {
  const data = [
    {
      'Total Assets': summary.totalAssets,
      'Total Liabilities': summary.totalLiabilities,
      'Total Equity': summary.totalEquity,
      Delta: summary.delta,
      Status: summary.status,
      Suggestions: summary.suggestions.join('; '),
      Generated: summary.generatedAt,
    },
  ];
  return XLSX.utils.json_to_sheet(data);
};

const buildCorrectionsSheet = (corrections: CorrectionLogEntry[]) => {
  const data = corrections.map(correction => ({
    'Change ID': correction.changeId,
    'GL Account ID': correction.glAccountId,
    'Dept ID': correction.deptId,
    'Amount Before': correction.amountBefore,
    'Amount After': correction.amountAfter,
    Impact: correction.impact,
    User: correction.user,
    Reason: correction.reason,
    Timestamp: correction.timestamp,
  }));
  return XLSX.utils.json_to_sheet(data);
};

const buildUploadHistorySheet = (sessions: UploadSession[]) => {
  const data = sessions.map(session => ({
    'Upload ID': session.uploadId,
    'User ID': session.userId ?? 'N/A',
    Timestamp: session.timestamp,
    Status: session.status,
    Files: session.files.map(file => file.name).join(', '),
    Records: session.recordsCount,
    Message: session.message ?? '',
  }));
  return XLSX.utils.json_to_sheet(data);
};

export interface ReportBundleArgs {
  accounts: GLAccount[];
  metrics: ThresholdMetric[];
  balanceSummary: BalanceSheetSummary;
  corrections: CorrectionLogEntry[];
  sessions: UploadSession[];
}

export const generateReportWorkbook = ({
  accounts,
  metrics,
  balanceSummary,
  corrections,
  sessions,
}: ReportBundleArgs) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildAccountsSheet(accounts), 'GL Accounts');
  XLSX.utils.book_append_sheet(workbook, buildThresholdSheet(metrics), 'Threshold Metrics');
  XLSX.utils.book_append_sheet(workbook, buildBalanceSheetTab(balanceSummary), 'Balance Sheet');
  if (corrections.length > 0) {
    XLSX.utils.book_append_sheet(workbook, buildCorrectionsSheet(corrections), 'Corrections');
  }
  if (sessions.length > 0) {
    XLSX.utils.book_append_sheet(workbook, buildUploadHistorySheet(sessions), 'Upload History');
  }

  const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
  const fileName = `FinSight_Report_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return fileName;
};

