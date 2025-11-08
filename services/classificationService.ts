import { ClassificationEvidence, DepartmentClassification } from '../types';

type DepartmentKey =
  | 'FINANCE'
  | 'SALES'
  | 'OPERATIONS'
  | 'PROCUREMENT'
  | 'HR'
  | 'IT'
  | 'UNASSIGNED';

interface DepartmentDirectoryEntry {
  deptId: string;
  deptName: string;
  defaultLogicId: string;
}

interface ClassificationRule {
  key: DepartmentKey;
  logicId: string;
  patterns?: RegExp[];
  keywords?: string[];
  weight?: number;
  notes?: string;
}

interface HistoricalMapping {
  key: DepartmentKey;
  logicId?: string;
  confidence?: number;
  notes?: string;
}

const DEPARTMENT_DIRECTORY: Record<DepartmentKey, DepartmentDirectoryEntry> = {
  FINANCE: { deptId: 'FIN001', deptName: 'Finance', defaultLogicId: 'FIN-CORE-0001' },
  SALES: { deptId: 'SAL001', deptName: 'Sales', defaultLogicId: 'SAL-REV-0001' },
  OPERATIONS: { deptId: 'OPR001', deptName: 'Operations', defaultLogicId: 'OPS-CORE-0001' },
  PROCUREMENT: { deptId: 'PUR001', deptName: 'Procurement', defaultLogicId: 'PUR-LIAB-0001' },
  HR: { deptId: 'HR001', deptName: 'Human Resources', defaultLogicId: 'HR-EXP-0001' },
  IT: { deptId: 'IT001', deptName: 'Information Technology', defaultLogicId: 'IT-OPS-0001' },
  UNASSIGNED: { deptId: 'UNCLASS', deptName: 'Unassigned', defaultLogicId: 'GEN-UNCL-0000' },
};

const DEPARTMENT_SYNONYMS: Record<string, DepartmentKey> = {
  finance: 'FINANCE',
  treasury: 'FINANCE',
  'financial control': 'FINANCE',
  sales: 'SALES',
  revenue: 'SALES',
  'accounts receivable': 'SALES',
  operations: 'OPERATIONS',
  manufacturing: 'OPERATIONS',
  production: 'OPERATIONS',
  procurement: 'PROCUREMENT',
  purchasing: 'PROCUREMENT',
  'accounts payable': 'PROCUREMENT',
  hr: 'HR',
  'human resources': 'HR',
  payroll: 'HR',
  it: 'IT',
  technology: 'IT',
  'information technology': 'IT',
};

const HISTORICAL_ACCOUNT_MAP: Record<string, HistoricalMapping> = {
  '101000': { key: 'FINANCE', logicId: 'FIN-CORE-0001', confidence: 0.96, notes: 'Cash cluster' },
  '121000': { key: 'SALES', logicId: 'SAL-REV-0001', confidence: 0.93, notes: 'Receivable control' },
  '201000': { key: 'PROCUREMENT', logicId: 'PUR-LIAB-0003', confidence: 0.91, notes: 'Payable ledger' },
  '401000': { key: 'SALES', logicId: 'SAL-REV-0401', confidence: 0.97, notes: 'Revenue direct' },
  '505000': { key: 'OPERATIONS', logicId: 'OPS-COGS-0505', confidence: 0.9, notes: 'COGS allocation' },
};

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    key: 'FINANCE',
    logicId: 'FIN-CORE-0002',
    patterns: [/^1(0|1)\d{4}$/],
    keywords: ['cash', 'bank', 'treasury', 'liquidity', 'investment'],
    notes: 'Liquidity & treasury driven accounts',
  },
  {
    key: 'SALES',
    logicId: 'SAL-REV-0099',
    patterns: [/^4\d{5}$/],
    keywords: ['sales', 'revenue', 'receivable', 'invoice'],
    notes: 'Revenue recognition & receivables',
  },
  {
    key: 'PROCUREMENT',
    logicId: 'PUR-LIAB-0099',
    patterns: [/^2(0|1)\d{4}$/],
    keywords: ['payable', 'supplier', 'vendor', 'procurement'],
    notes: 'Supplier liabilities and procurement',
  },
  {
    key: 'OPERATIONS',
    logicId: 'OPS-COGS-0099',
    patterns: [/^5\d{5}$/],
    keywords: ['cogs', 'inventory', 'operations', 'logistics', 'plant'],
    notes: 'Cost of goods and operational spend',
  },
  {
    key: 'HR',
    logicId: 'HR-EXP-0099',
    patterns: [/^6\d{5}$/],
    keywords: ['salary', 'payroll', 'benefit', 'hr', 'compensation'],
    notes: 'People cost centres',
  },
  {
    key: 'IT',
    logicId: 'IT-OPS-0099',
    patterns: [/^7\d{5}$/],
    keywords: ['software', 'license', 'it', 'technology', 'hardware'],
    notes: 'Technology infrastructure & spend',
  },
];

interface ClassificationInput {
  glAccountNumber: string;
  glAccountName: string;
  providedDept?: string;
}

const clampConfidence = (value: number) => Math.min(0.99, Math.max(0.2, Number.parseFloat(value.toFixed(2))));

const buildEvidence = (
  type: ClassificationEvidence['type'],
  value: string,
  weight: number,
  confidence: number
): ClassificationEvidence => ({
  type,
  value,
  weight,
  confidence,
});

const resolveDepartmentFromProvided = (provided?: string): DepartmentKey | null => {
  if (!provided) {
    return null;
  }
  const normalised = provided.trim().toLowerCase();
  if (normalised in DEPARTMENT_SYNONYMS) {
    return DEPARTMENT_SYNONYMS[normalised];
  }
  const directMatch = (Object.keys(DEPARTMENT_DIRECTORY) as DepartmentKey[]).find(
    key => DEPARTMENT_DIRECTORY[key].deptName.toLowerCase() === normalised
  );
  return directMatch ?? null;
};

export const classifyGLAccount = ({
  glAccountNumber,
  glAccountName,
  providedDept,
}: ClassificationInput): DepartmentClassification => {
  const cleanedNumber = glAccountNumber.trim();
  const nameLower = glAccountName.toLowerCase();

  // 1) Historical mapping has the highest precedence
  const historical = HISTORICAL_ACCOUNT_MAP[cleanedNumber];
  if (historical) {
    const directoryEntry = DEPARTMENT_DIRECTORY[historical.key];
    const evidence: ClassificationEvidence[] = [
      buildEvidence('historical', `Historical match: ${cleanedNumber}`, 1, historical.confidence ?? 0.95),
    ];
    if (historical.notes) {
      evidence.push(buildEvidence('keyword', historical.notes, 0.4, (historical.confidence ?? 0.95) * 0.8));
    }
    return {
      deptName: directoryEntry.deptName,
      deptId: directoryEntry.deptId,
      logicId: historical.logicId ?? directoryEntry.defaultLogicId,
      confidence: clampConfidence(historical.confidence ?? 0.95),
      source: 'historical',
      evidence,
      notes: historical.notes,
      keywordsMatched: [],
      patternsMatched: [],
    };
  }

  // 2) Manual hint from provided department (if recognised)
  const providedKey = resolveDepartmentFromProvided(providedDept);
  if (providedKey && providedKey !== 'UNASSIGNED') {
    const directoryEntry = DEPARTMENT_DIRECTORY[providedKey];
    const evidence = [buildEvidence('provided', `Provided department: ${providedDept}`, 0.8, 0.88)];
    return {
      deptName: directoryEntry.deptName,
      deptId: directoryEntry.deptId,
      logicId: directoryEntry.defaultLogicId,
      confidence: clampConfidence(0.88),
      source: 'manual',
      evidence,
      notes: 'Resolved using supplied department hint.',
      keywordsMatched: [],
      patternsMatched: [],
    };
  }

  // 3) Rule-based scoring
  let bestRule: ClassificationRule | null = null;
  let bestScore = 0;
  let bestEvidence: ClassificationEvidence[] = [];
  let bestKeywords: string[] = [];
  let bestPatterns: string[] = [];

  CLASSIFICATION_RULES.forEach(rule => {
    let score = rule.weight ?? 0.4;
    let localPatternHits = 0;
    const localEvidence: ClassificationEvidence[] = [];
    const localKeywords: string[] = [];
    const localPatterns: string[] = [];

    rule.patterns?.forEach(pattern => {
      if (pattern.test(cleanedNumber)) {
        score += 0.2;
        localPatternHits += 1;
        localPatterns.push(pattern.source);
        localEvidence.push(buildEvidence('pattern', `Pattern ${pattern.source}`, 0.2, 0.75));
      }
    });

    let localKeywordHits = 0;
    rule.keywords?.forEach(keyword => {
      if (nameLower.includes(keyword)) {
        score += 0.18;
        localKeywordHits += 1;
        localKeywords.push(keyword);
        localEvidence.push(buildEvidence('keyword', `Keyword ${keyword}`, 0.18, 0.72));
      }
    });

    // Slight boost for combined pattern + keyword hits
    if (localPatternHits > 0 && localKeywordHits > 0) {
      score += 0.15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
      bestEvidence = localEvidence;
      bestKeywords = localKeywords;
      bestPatterns = localPatterns;
    }
  });

  if (bestRule) {
    const directoryEntry = DEPARTMENT_DIRECTORY[bestRule.key];
    const baseConfidence = 0.62 + Math.min(0.25, bestScore / 4);
    return {
      deptName: directoryEntry.deptName,
      deptId: directoryEntry.deptId,
      logicId: bestRule.logicId ?? directoryEntry.defaultLogicId,
      confidence: clampConfidence(baseConfidence),
      source: 'rule',
      evidence: bestEvidence,
      notes: bestRule.notes,
      keywordsMatched: bestKeywords,
      patternsMatched: bestPatterns,
    };
  }

  // 4) Fallback
  const fallbackEntry = DEPARTMENT_DIRECTORY.UNASSIGNED;
  return {
    deptName: fallbackEntry.deptName,
    deptId: fallbackEntry.deptId,
    logicId: fallbackEntry.defaultLogicId,
    confidence: clampConfidence(0.35),
    source: 'fallback',
    evidence: [buildEvidence('fallback', 'No matching rule or history', 0.3, 0.35)],
    notes: 'Consider manual review to assign department.',
    keywordsMatched: [],
    patternsMatched: [],
  };
};

export const classifyAccountsBatch = (
  accounts: Array<{ glAccountNumber: string; glAccount: string; providedDept?: string }>
): DepartmentClassification[] =>
  accounts.map(({ glAccountNumber, glAccount, providedDept }) =>
    classifyGLAccount({ glAccountNumber, glAccountName: glAccount, providedDept })
  );

