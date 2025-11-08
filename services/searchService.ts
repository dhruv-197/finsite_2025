import { GLAccount } from '../types';

interface SearchResult {
  handled: boolean;
  response: string;
}

const formatAccounts = (accounts: GLAccount[]): string =>
  accounts
    .slice(0, 10)
    .map(
      account =>
        `• ${account.glAccountNumber} – ${account.glAccount} (${account.responsibleDept}) ` +
        `status ${account.reviewStatus}` +
        `${account.thresholdLevel ? ` · severity ${account.thresholdLevel}` : ''}` +
        `${account.flagStatus ? ` · flag ${account.flagStatus}` : ''}` +
        `${
          account.percentVariance !== undefined ? ` · variance ${account.percentVariance.toFixed(2)}%` : ''
        }`
    )
    .join('\n');

const parseAmount = (text: string): number | null => {
  const match = text.match(/(-?\d[\d,]*(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[0].replace(/,/g, ''));
  return Number.isNaN(value) ? null : value;
};

const filterByDepartment = (query: string, accounts: GLAccount[]) => {
  const match = query.match(/dept[_\s]?id\s*(\w+)|department\s+([\w\s]+)/i);
  if (!match) {
    return null;
  }
  const deptId = (match[1] || '').toUpperCase();
  const deptName = (match[2] || '').trim().toLowerCase();
  const filtered = accounts.filter(account => {
    if (deptId && account.departmentId.toUpperCase() === deptId) {
      return true;
    }
    if (deptName && account.responsibleDept.toLowerCase().includes(deptName)) {
      return true;
    }
    return false;
  });
  return filtered;
};

export const runSemanticSearch = (query: string, accounts: GLAccount[]): SearchResult => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { handled: false, response: '' };
  }

  const severeLevel = normalizedQuery.includes('critical')
    ? 'C'
    : normalizedQuery.includes('medium')
    ? 'M'
    : normalizedQuery.includes('low')
    ? 'L'
    : null;

  if (severeLevel) {
    const filtered = accounts.filter(
      account => (account.thresholdLevel ?? '').toUpperCase() === severeLevel
    );
    if (filtered.length === 0) {
      return {
        handled: true,
        response: `I didn't find any GL accounts tagged as ${severeLevel === 'C' ? 'Critical' : severeLevel === 'M' ? 'Medium' : 'Low'} right now.`,
      };
    }
    return {
      handled: true,
      response: `Here are the top ${filtered.length} accounts marked ${severeLevel === 'C' ? 'Critical' : severeLevel === 'M' ? 'Medium' : 'Low'}:\n${formatAccounts(
        filtered
      )}`,
    };
  }

  const deptFiltered = filterByDepartment(normalizedQuery, accounts);
  if (deptFiltered && deptFiltered.length > 0) {
    return {
      handled: true,
      response: `Found ${deptFiltered.length} GL accounts for that department:\n${formatAccounts(deptFiltered)}`,
    };
  }

  if (normalizedQuery.includes('negative') || normalizedQuery.includes('credit balance')) {
    const negatives = accounts.filter(account => (account.normalizedBalance ?? 0) < 0);
    if (negatives.length === 0) {
      return {
        handled: true,
        response: 'No GL accounts currently show a negative balance.',
      };
    }
    return {
      handled: true,
      response: `These accounts carry negative balances:\n${formatAccounts(negatives)}`,
    };
  }

  if (normalizedQuery.includes('above') || normalizedQuery.includes('greater than')) {
    const amount = parseAmount(normalizedQuery);
    if (amount !== null) {
      const filtered = accounts.filter(account => (account.normalizedBalance ?? 0) > amount);
      if (filtered.length === 0) {
        return { handled: true, response: `No GL accounts exceed ${amount.toLocaleString()}.` };
      }
      return {
        handled: true,
        response: `GL accounts above ${amount.toLocaleString()}:\n${formatAccounts(filtered)}`,
      };
    }
  }

  if (normalizedQuery.includes('mismatch')) {
    const mismatches = accounts.filter(account => account.reviewStatus === 'Mismatch');
    if (mismatches.length === 0) {
      return { handled: true, response: 'All accounts are currently aligned. No mismatches detected.' };
    }
    return {
      handled: true,
      response: `Here are the current mismatches:\n${formatAccounts(mismatches)}`,
    };
  }

  return {
    handled: false,
    response: '',
  };
};

