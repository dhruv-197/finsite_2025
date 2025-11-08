import {
  BalanceSheetSummary,
  CorrectionLogEntry,
  ErrorLogEntry,
  GLAccount,
  ReportFrequency,
  ThresholdLevel,
  ThresholdMetric,
} from '../types';

export interface NormalizationResult {
  normalized: number;
  currency: string;
  issues: string[];
  cleanedValue: string;
}

const CURRENCY_SIGNS: Record<string, string> = {
  $: 'USD',
  '₹': 'INR',
  '£': 'GBP',
  '€': 'EUR',
  '¥': 'JPY',
};

const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_VARIANCE_THRESHOLD = 0.1;

const cleanNumericString = (value: string): string => {
  return value
    .replace(/[^\d.,()-]/g, '')
    .replace(/,/g, '')
    .trim();
};

export const normalizeAmount = (input: string | null | undefined, currencyHint?: string): NormalizationResult => {
  if (!input || input.trim() === '') {
    return {
      normalized: 0,
      currency: currencyHint || DEFAULT_CURRENCY,
      issues: ['Missing amount'],
      cleanedValue: '0',
    };
  }

  const issues: string[] = [];

  let detectedCurrency = currencyHint || DEFAULT_CURRENCY;
  const currencySymbol = input.trim().charAt(0);
  if (currencySymbol in CURRENCY_SIGNS) {
    detectedCurrency = CURRENCY_SIGNS[currencySymbol];
  } else if (/^[A-Z]{3}/.test(input.trim())) {
    detectedCurrency = input.trim().slice(0, 3);
  }

  const cleaned = cleanNumericString(input);

  const isNegativeViaParentheses = /^\(.*\)$/.test(cleaned);

  const numericString = cleaned.replace(/[()]/g, '');
  const parsed = Number.parseFloat(numericString);

  if (Number.isNaN(parsed)) {
    issues.push('Unable to parse numeric value');
    return {
      normalized: 0,
      currency: detectedCurrency,
      issues,
      cleanedValue: cleaned,
    };
  }

  const normalized = isNegativeViaParentheses ? -parsed : parsed;

  if (input.includes('.00') === false && !Number.isInteger(normalized)) {
    issues.push('Detected decimal precision');
  }

  return {
    normalized,
    currency: detectedCurrency,
    issues,
    cleanedValue: cleaned,
  };
};

const severityFromMistakes = (mistakeCount: number) => {
  if (mistakeCount >= 3) return 'C';
  if (mistakeCount === 2) return 'M';
  return 'L';
};

export const determineThresholdLevel = (account: GLAccount): ThresholdLevel => {
  const amount = Math.abs(account.normalizedBalance ?? 0);
  const mistakes = account.mistakeCount ?? 0;

  if (amount >= 5_000_000 || mistakes >= 4 || account.reviewStatus === 'Mismatch') {
    return 'C';
  }
  if (amount >= 1_000_000 || mistakes >= 2) {
    return 'M';
  }
  return severityFromMistakes(mistakes);
};

export const calculatePriorityScore = (account: GLAccount, threshold: ThresholdLevel): number => {
  const amount = Math.abs(account.normalizedBalance ?? 0);
  const mistakeWeight = (account.mistakeCount ?? 0) * 0.05;
  const sourceWeight = account.classificationSource === 'fallback' ? 0.1 : 0;
  const severityWeight = threshold === 'C' ? 1.4 : threshold === 'M' ? 1.1 : 0.7;
  const confidencePenalty = 1 - (account.classificationConfidence ?? 0.7);

  return Number(((amount / 1_000_000) * severityWeight + mistakeWeight + sourceWeight + confidencePenalty).toFixed(2));
};

export const calculateVarianceInsights = (
  currentBalance: number | undefined,
  previousBalance?: number | null,
  threshold: number = DEFAULT_VARIANCE_THRESHOLD
): { percentVariance?: number; flagStatus?: 'Green' | 'Red'; previousBalance?: number } => {
  if (currentBalance === undefined || currentBalance === null) {
    return {};
  }

  if (previousBalance === undefined || previousBalance === null) {
    return { previousBalance: undefined };
  }

  const baseline = previousBalance === 0 ? (currentBalance === 0 ? 1 : Math.abs(currentBalance)) : previousBalance;
  const variance = ((currentBalance - previousBalance) / baseline) * 100;
  const percentVariance = Number.isFinite(variance) ? Number(variance.toFixed(2)) : undefined;

  if (percentVariance === undefined) {
    return { previousBalance };
  }

  const flagStatus = Math.abs(percentVariance) > threshold * 100 ? 'Red' : 'Green';

  return {
    percentVariance,
    flagStatus,
    previousBalance,
  };
};

export const computeThresholdMetrics = (accounts: GLAccount[]): ThresholdMetric[] => {
  const byDept = new Map<
    string,
    {
      deptName: string;
      counts: Record<ThresholdLevel, number>;
      confidenceSum: number;
      totalAccounts: number;
      criticalValue: number;
      mediumValue: number;
      lowValue: number;
    }
  >();

  accounts.forEach(account => {
    const deptId = account.departmentId ?? 'UNCLASS';
    if (!byDept.has(deptId)) {
      byDept.set(deptId, {
        deptName: account.responsibleDept ?? 'Unassigned',
        counts: { C: 0, M: 0, L: 0 },
        confidenceSum: 0,
        totalAccounts: 0,
        criticalValue: 0,
        mediumValue: 0,
        lowValue: 0,
      });
    }

    const entry = byDept.get(deptId)!;
    const level = account.thresholdLevel ?? determineThresholdLevel(account);
    entry.counts[level] += 1;
    entry.totalAccounts += 1;
    entry.confidenceSum += account.classificationConfidence ?? 0.7;

    const amount = Math.abs(account.normalizedBalance ?? 0);
    if (level === 'C') entry.criticalValue += amount;
    if (level === 'M') entry.mediumValue += amount;
    if (level === 'L') entry.lowValue += amount;
  });

  return Array.from(byDept.entries()).map(([deptId, entry]) => ({
    deptId,
    deptName: entry.deptName,
    counts: entry.counts,
    averageConfidence: entry.totalAccounts ? entry.confidenceSum / entry.totalAccounts : 0,
    totalAccounts: entry.totalAccounts,
    criticalValue: entry.criticalValue,
    mediumValue: entry.mediumValue,
    lowValue: entry.lowValue,
  }));
};

export const collectNumberIssues = (accounts: GLAccount[]): ErrorLogEntry[] => {
  const issues: ErrorLogEntry[] = [];
  accounts.forEach(account => {
    account.balanceIssues?.forEach(message => {
      issues.push({
        id: `${account.id}-${issues.length + 1}`,
        glAccountId: account.id,
        glAccountNumber: account.glAccountNumber,
        message,
        severity: determineThresholdLevel(account),
        checker: account.currentChecker ?? undefined,
        timestamp: new Date().toISOString(),
        source: 'Normalization',
      });
    });
  });
  return issues;
};

const sumByCategory = (accounts: GLAccount[], category: string): number =>
  accounts
    .filter(account => account.statusCategory.toLowerCase() === category.toLowerCase())
    .reduce((acc, account) => acc + (account.normalizedBalance ?? 0), 0);

export const buildBalanceSheetSummary = (accounts: GLAccount[]): BalanceSheetSummary => {
  const totalAssets = sumByCategory(accounts, 'Assets');
  const totalLiabilities = sumByCategory(accounts, 'Liabilities');
  const totalEquity = sumByCategory(accounts, 'Equity');
  const delta = Number((totalAssets - (totalLiabilities + totalEquity)).toFixed(2));
  const status = Math.abs(delta) < 1 ? 'Balanced' as const : 'Mismatch' as const;

  const suggestions: string[] = [];
  if (status === 'Mismatch') {
    if (totalAssets < totalLiabilities + totalEquity) {
      suggestions.push('Review liability accruals – liabilities exceed assets.');
    } else {
      suggestions.push('Validate asset valuations – assets exceed liabilities + equity.');
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    delta,
    status,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
};

export const createCorrectionLogEntry = ({
  account,
  amountAfter,
  user,
  reason,
}: {
  account: GLAccount;
  amountAfter: number;
  user: string;
  reason: string;
}): CorrectionLogEntry => ({
  changeId: `COR-${Date.now().toString(36).toUpperCase()}`,
  glAccountId: account.id,
  deptId: account.departmentId,
  amountBefore: account.normalizedBalance ?? 0,
  amountAfter,
  user,
  reason,
  timestamp: new Date().toISOString(),
  impact: Number(Math.abs((account.normalizedBalance ?? 0) - amountAfter).toFixed(2)),
});

export const calculateNextRunDate = (frequency: ReportFrequency, fromDate = new Date()): Date => {
  const next = new Date(fromDate);
  if (frequency === 'Monthly') {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === 'Quarterly') {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setMonth(next.getMonth() + 6);
  }
  return next;
};

