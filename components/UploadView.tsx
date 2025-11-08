import React, { useState, useCallback, useMemo } from 'react';
import {
  GLAccount,
  ReviewStatus,
  UploadCompletionPayload,
  UploadError,
  UploadFileSummary,
  UserRole,
} from '../types';
import {
  UploadCloud,
  AlertTriangle,
  ListChecks,
  ArrowLeft,
  Trash2,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { classifyGLAccount } from '../services/classificationService';
import {
  calculatePriorityScore,
  calculateVarianceInsights,
  DEFAULT_VARIANCE_THRESHOLD,
  determineThresholdLevel,
  normalizeAmount,
} from '../services/analyticsService';

interface UploadViewProps {
  onCompleteUpload: (payload: UploadCompletionPayload) => void;
  onResetUploads: () => void;
  currentAccounts: GLAccount[];
  activeUploadId: string | null;
  hasPreviousUploads: boolean;
}

type UploadStep = 'select' | 'preview' | 'result';

interface ParsedFileResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  sheetName: string;
  headerMapping: Record<string, string>;
  accounts: GLAccount[];
  errors: UploadError[];
  recordsScanned: number;
  recordsImported: number;
}

const REQUIRED_HEADERS_ALIASES: Record<string, string[]> = {
  glAccountNumber: ['G/L Account Number', 'GL Account Number', 'GL Acct No', 'GL #'],
  glAccount: ['G/L Acct', 'GL Account Name', 'GL Account', 'Account Name'],
  responsibleDept: ['Responsible Department', 'Department', 'Dept', 'Cost Center'],
  mainHead: ['Main Head', 'Primary Head'],
  subHead: ['Sub head', 'Sub Head', 'Secondary Head'],
  bsPl: ['BS/PL', 'Statement Type'],
  statusCategory: ['Status', 'Category'],
  spoc: ['Departement SPOC', 'SPOC', 'Contact', 'Department SPOC'],
  reviewer: ['Departement Reviewer', 'Reviewer'],
  departmentReviewer: ['Department Reviewer'],
  reviewCheckpointAbex: ['Review Check Point at ABEX', 'ABEX Checkpoint'],
  analysisRequired: ['Analysis Required'],
  typeOfReport: ['Type of Report'],
  flagStatus: ['Flag', 'Flag (Green / Red)', 'Flag (Green/Red)'],
  percentVariance: ['% Variance', 'Percent Variance'],
  reconStatus: ['Recon / Non Recon', 'Reconciliation Status'],
  confirmationSource: ['Confirmation (Internal / External)', 'Confirmation Source'],
  workingNeeded: ['Working Needed'],
  queryType: ['Query type / Action points', 'Query Type', 'Action Points'],
  cml: ['C/M/L', 'Severity'],
  balance: ['Balance', 'Ending Balance', 'Amount', 'Closing Balance'],
  currency: ['Currency', 'Curr', 'Ccy'],
  balanceDate: ['Balance Date', 'As Of Date', 'Posting Date', 'Date'],
};

const REQUIRED_INTERNAL_KEYS: string[] = ['glAccountNumber', 'glAccount', 'responsibleDept'];

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

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

const parseNumberFromString = (value?: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const numeric = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numeric) ? undefined : numeric;
};

const UploadView: React.FC<UploadViewProps> = ({
  onCompleteUpload,
  onResetUploads,
  currentAccounts,
  activeUploadId,
  hasPreviousUploads,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parsedData, setParsedData] = useState<GLAccount[]>([]);
  const [fileSummaries, setFileSummaries] = useState<ParsedFileResult[]>([]);
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('select');
  const [clearPrevious, setClearPrevious] = useState(true);

  const hasSelections = selectedFiles.length > 0;

  const classificationSnapshot = useMemo(() => {
    if (parsedData.length === 0) {
      return null;
    }

    const map = new Map<
      string,
      {
        deptName: string;
        deptId: string;
        count: number;
        confidenceSum: number;
        sources: Set<string>;
      }
    >();

    let totalConfidence = 0;

    parsedData.forEach(account => {
      const key = `${account.departmentId}|${account.responsibleDept}`;
      if (!map.has(key)) {
        map.set(key, {
          deptName: account.responsibleDept,
          deptId: account.departmentId,
          count: 0,
          confidenceSum: 0,
          sources: new Set(),
        });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      entry.confidenceSum += account.classificationConfidence;
      entry.sources.add(account.classificationSource);
      totalConfidence += account.classificationConfidence;
    });

    const departments = Array.from(map.values())
      .map(entry => ({
        deptName: entry.deptName,
        deptId: entry.deptId,
        count: entry.count,
        avgConfidence: entry.confidenceSum / entry.count,
        sources: Array.from(entry.sources),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total: parsedData.length,
      averageConfidence: totalConfidence / parsedData.length,
      departments,
    };
  }, [parsedData]);

  const existingAccountNumbers = useMemo(() => {
    return new Set(clearPrevious ? [] : currentAccounts.map(acc => acc.glAccountNumber));
  }, [clearPrevious, currentAccounts]);

  const handleResetState = useCallback(() => {
    setSelectedFiles([]);
    setParsedData([]);
    setFileSummaries([]);
    setErrors([]);
    setIsProcessing(false);
    setUploadStep('select');
    setClearPrevious(true);
  }, []);

  const isAllowedFile = (file: File) => {
    if (ALLOWED_MIME_TYPES.includes(file.type)) {
      return true;
    }
    return ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) {
      return;
    }
    addFiles(Array.from(event.dataTransfer.files));
    event.dataTransfer.clearData();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    addFiles(Array.from(event.target.files));
  };

  const addFiles = (files: File[]) => {
    const newErrors: UploadError[] = [];
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(file => file.name));
      const merged = [...prev];
      files.forEach(file => {
        if (!isAllowedFile(file)) {
          newErrors.push({
            row: 0,
            message: `Invalid file type for '${file.name}'. Please upload .xlsx, .xls, or .csv files.`,
            data: file.name,
          });
          return;
        }
        if (existingNames.has(file.name)) {
          newErrors.push({
            row: 0,
            message: `File '${file.name}' is already selected. Ignoring duplicate.`,
            data: file.name,
          });
          return;
        }
        merged.push(file);
      });
      return merged;
    });
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
      setUploadStep('select');
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  const parseWorkbookFile = useCallback(
    async (
      file: File,
      getNextId: () => number,
      existingNumbers: Set<string>,
      seenNumbers: Map<string, { fileName: string; rows: number[] }>
    ): Promise<ParsedFileResult> => {
      const fileErrors: UploadError[] = [];
      const headerMapping: Record<string, string> = {};
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });

      let bestSheetName = '';
      let bestSheetData: any[][] = [];
      let bestHeaderRowIndex = -1;
      let maxMatchCount = -1;

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        if (data.length === 0) {
          return;
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(data.length, 10); i += 1) {
          const row = data[i] as any[];
          const nonNullCount = row.filter(cell => cell !== null && String(cell).trim() !== '').length;
          if (nonNullCount > 2) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          return;
        }

        const headers = (data[headerRowIndex] as any[]).map(h => String(h ?? '').trim().toLowerCase());
        let currentMatchCount = 0;
        Object.values(REQUIRED_HEADERS_ALIASES)
          .flat()
          .forEach(alias => {
            if (headers.includes(alias.toLowerCase())) {
              currentMatchCount += 1;
            }
          });

        if (currentMatchCount > maxMatchCount) {
          maxMatchCount = currentMatchCount;
          bestSheetName = sheetName;
          bestSheetData = data.slice(headerRowIndex);
          bestHeaderRowIndex = headerRowIndex;
        }
      });

      if (maxMatchCount < 3 || bestSheetData.length === 0) {
        fileErrors.push({
          row: 0,
          message: `Could not find a valid sheet with required headers in '${file.name}'.`,
          data: file.name,
        });
        return {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'N/A',
          sheetName: bestSheetName || 'Not detected',
          headerMapping,
          accounts: [],
          errors: fileErrors,
          recordsScanned: 0,
          recordsImported: 0,
        };
      }

      const headers = bestSheetData[0].map(h => String(h ?? '').trim());
      const dataRows = bestSheetData.slice(1);

      const foundHeaders: Set<string> = new Set();
      Object.entries(REQUIRED_HEADERS_ALIASES).forEach(([internalKey, aliases]) => {
        aliases.some(alias => {
          const headerIndex = headers.findIndex(h => h.toLowerCase() === alias.toLowerCase());
          if (headerIndex !== -1) {
            headerMapping[headers[headerIndex]] = internalKey;
            foundHeaders.add(internalKey);
            return true;
          }
          return false;
        });
      });

      const missingHeaders = REQUIRED_INTERNAL_KEYS.filter(key => !foundHeaders.has(key));
      if (missingHeaders.length > 0) {
        fileErrors.push({
          row: 0,
          message: `Missing required headers in '${file.name}': ${missingHeaders.join(
            ', '
          )}. Found headers: [${headers.join(', ')}]`,
          data: file.name,
        });
        return {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'N/A',
          sheetName: bestSheetName,
          headerMapping,
          accounts: [],
          errors: fileErrors,
          recordsScanned: dataRows.length,
          recordsImported: 0,
        };
      }

      const glAccountNumberIndex = headers.findIndex(h => headerMapping[h] === 'glAccountNumber');
      const duplicateRowsByAccount = new Map<string, number[]>();

      dataRows.forEach((row, index) => {
        const accNumRaw = glAccountNumberIndex >= 0 ? row[glAccountNumberIndex] : '';
        const accNum = String(accNumRaw ?? '').trim();
        if (!accNum) {
          return;
        }
        const originalRowNum = bestHeaderRowIndex + index + 2;
        if (!duplicateRowsByAccount.has(accNum)) {
          duplicateRowsByAccount.set(accNum, []);
        }
        duplicateRowsByAccount.get(accNum)!.push(originalRowNum);
      });

      const duplicateAccountNumbers = new Set<string>();
      duplicateRowsByAccount.forEach((rows, accNum) => {
        if (rows.length > 1) {
          duplicateAccountNumbers.add(accNum);
          fileErrors.push({
            row: 0,
            message: `Duplicate G/L Account '${accNum}' in '${file.name}' on rows ${rows.join(
              ', '
            )}. Rows ignored.`,
            data: file.name,
          });
        }
      });

      const accounts: GLAccount[] = [];
      dataRows.forEach((row, index) => {
        const originalRowNum = bestHeaderRowIndex + index + 2;
        const rowData: Record<string, string> = {};
        headers.forEach((headerLabel, headerIndex) => {
          const internalKey = headerMapping[headerLabel];
          if (internalKey) {
            rowData[internalKey] = String(row[headerIndex] ?? '').trim();
          }
        });

        if (
          Object.values(rowData).every(value => value === '') ||
          duplicateAccountNumbers.has(rowData.glAccountNumber ?? '')
        ) {
          return;
        }

        if (
          REQUIRED_INTERNAL_KEYS.some(key => !rowData[key] || String(rowData[key]).trim() === '')
        ) {
          fileErrors.push({
            row: originalRowNum,
            message: `Row ${originalRowNum} in '${file.name}' is missing one or more required fields and was ignored.`,
            data: `Row ${originalRowNum}`,
          });
          return;
        }

        const accountNumber = rowData.glAccountNumber!;

        if (existingNumbers.has(accountNumber)) {
          fileErrors.push({
            row: originalRowNum,
            message: `G/L Account '${accountNumber}' already exists in the current workflow and was skipped.`,
            data: `Row ${originalRowNum}`,
          });
          return;
        }

        if (seenNumbers.has(accountNumber)) {
          const seen = seenNumbers.get(accountNumber)!;
          seen.rows.push(originalRowNum);
          fileErrors.push({
            row: originalRowNum,
            message: `G/L Account '${accountNumber}' already loaded from '${seen.fileName}' (rows ${seen.rows.join(
              ', '
            )}). Duplicate ignored.`,
            data: `Row ${originalRowNum}`,
          });
          return;
        }

        const classification = classifyGLAccount({
          glAccountNumber: accountNumber,
          glAccountName: rowData.glAccount ?? '',
          providedDept: rowData.responsibleDept,
        });

        const amountResult = normalizeAmount(rowData.balance, rowData.currency);
        if (amountResult.issues.length > 0) {
          amountResult.issues.forEach(issue =>
            fileErrors.push({
              row: originalRowNum,
              message: `Balance issue in '${accountNumber}': ${issue}`,
              data: `Row ${originalRowNum}`,
            })
          );
        }

        const previousAccount = currentAccounts.find(acc => acc.glAccountNumber === accountNumber);
        const providedVariance = parseNumberFromString(rowData.percentVariance);
        const varianceInfo = calculateVarianceInsights(
          amountResult.normalized,
          previousAccount?.normalizedBalance ?? previousAccount?.previousBalance ?? null,
          DEFAULT_VARIANCE_THRESHOLD
        );
        const manualFlag =
          rowData.flagStatus && rowData.flagStatus.toLowerCase().includes('red')
            ? 'Red'
            : rowData.flagStatus && rowData.flagStatus.toLowerCase().includes('green')
            ? 'Green'
            : undefined;
        const derivedPercent = providedVariance ?? varianceInfo.percentVariance;
        let flagFromInsights = varianceInfo.flagStatus;
        if (providedVariance !== undefined && !manualFlag) {
          flagFromInsights = Math.abs(providedVariance) > DEFAULT_VARIANCE_THRESHOLD * 100 ? 'Red' : 'Green';
        }
        const derivedFlag = manualFlag ?? flagFromInsights;

        const normalizedRecon = rowData.reconStatus
          ? rowData.reconStatus
          : previousAccount?.reconStatus ?? 'Recon';
        const normalizedConfirmation = rowData.confirmationSource
          ? rowData.confirmationSource
          : previousAccount?.confirmationSource ?? 'Internal';
        const normalizedTypeOfReport = rowData.typeOfReport || previousAccount?.typeOfReport || '';
        const normalizedAnalysis =
          rowData.analysisRequired ||
          (derivedPercent !== undefined && Math.abs(derivedPercent) > DEFAULT_VARIANCE_THRESHOLD * 100 ? 'Yes' : 'No');
        const normalizedWorkingNeeded =
          rowData.workingNeeded ||
          (normalizedAnalysis === 'Yes' ? 'Review variance details' : previousAccount?.workingNeeded ?? '');
        const normalizedQueryType =
          rowData.queryType || previousAccount?.queryType || (normalizedAnalysis === 'Yes' ? 'Variance Review' : '');
        const normalizedCheckpoint =
          rowData.reviewCheckpointAbex ||
          previousAccount?.reviewCheckpointAbex ||
          (normalizedAnalysis === 'Yes' ? 'Pending' : 'Complete');
        const departmentReviewer =
          rowData.departmentReviewer || rowData.reviewer || previousAccount?.departmentReviewer || previousAccount?.reviewer || '';

        const account: GLAccount = {
          id: getNextId(),
          glAccountNumber: accountNumber,
          glAccount: rowData.glAccount ?? 'N/A',
          responsibleDept: classification.deptName,
          departmentId: classification.deptId,
          logicId: classification.logicId,
          mainHead: rowData.mainHead || 'N/A',
          subHead: rowData.subHead || 'N/A',
          bsPl: rowData.bsPl || 'BS',
          statusCategory: rowData.statusCategory || 'Assets',
          spoc: rowData.spoc || 'N/A',
          reviewer: rowData.reviewer || 'N/A',
          reviewStatus: ReviewStatus.Pending,
          currentChecker: UserRole.Checker1,
          auditLog: [
            {
              timestamp: new Date().toISOString(),
              user: 'System',
              role: UserRole.Checker1,
              action: 'Data Ingestion',
              from: 'N/A',
              to: UserRole.Checker1,
            },
          ],
          mistakeCount: 0,
          reportUrl: '',
          classificationConfidence: classification.confidence,
          classificationSource: classification.source,
          classificationEvidence: classification.evidence,
          classificationNotes: classification.notes,
          classificationKeywords: classification.keywordsMatched,
          classificationPatterns: classification.patternsMatched,
          inputDepartment: rowData.responsibleDept,
          balanceRaw: rowData.balance,
          normalizedBalance: amountResult.normalized,
          currency: amountResult.currency,
          balanceIssues: amountResult.issues,
          balanceDate: rowData.balanceDate ? new Date(rowData.balanceDate).toISOString() : undefined,
          reviewCheckpointAbex: normalizedCheckpoint,
          analysisRequired: normalizedAnalysis,
          typeOfReport: normalizedTypeOfReport,
          flagStatus: derivedFlag,
          percentVariance: derivedPercent,
          previousBalance: varianceInfo.previousBalance ?? previousAccount?.normalizedBalance,
          reconStatus: normalizedRecon,
          confirmationSource: normalizedConfirmation,
          workingNeeded: normalizedWorkingNeeded,
          queryType: normalizedQueryType,
          departmentReviewer,
        };

        const thresholdLevel = determineThresholdLevel(account);
        const manualSeverity = rowData.cml ? rowData.cml.trim().toUpperCase() : undefined;
        account.thresholdLevel =
          manualSeverity === 'C' || manualSeverity === 'M' || manualSeverity === 'L'
            ? (manualSeverity as typeof account.thresholdLevel)
            : thresholdLevel;
        account.priorityScore = calculatePriorityScore(account, account.thresholdLevel ?? thresholdLevel);
        if (!account.flagStatus && account.percentVariance !== undefined) {
          account.flagStatus =
            Math.abs(account.percentVariance) > DEFAULT_VARIANCE_THRESHOLD * 100 ? 'Red' : 'Green';
        }
        if (!account.reconStatus && previousAccount?.reconStatus) {
          account.reconStatus = previousAccount.reconStatus;
        }
        if (!account.confirmationSource && previousAccount?.confirmationSource) {
          account.confirmationSource = previousAccount.confirmationSource;
        }
        if (!account.frequencyBucket) {
          account.frequencyBucket = account.thresholdLevel;
        }
        if (departmentReviewer) {
          account.reviewer = departmentReviewer;
          account.departmentReviewer = departmentReviewer;
        } else if (!account.departmentReviewer) {
          account.departmentReviewer = account.reviewer;
        }

        accounts.push(account);
        seenNumbers.set(accountNumber, { fileName: file.name, rows: [originalRowNum] });
      });

      return {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'N/A',
        sheetName: bestSheetName,
        headerMapping,
        accounts,
        errors: fileErrors,
        recordsScanned: dataRows.length,
        recordsImported: accounts.length,
      };
    },
    []
  );

  const processFilesData = useCallback(async () => {
    if (!hasSelections) {
      return;
    }
    setIsProcessing(true);
    setErrors([]);
    try {
      const seenAccountNumbers = new Map<string, { fileName: string; rows: number[] }>();
      const existingNumbers = new Set(existingAccountNumbers);
      const maxExistingId = clearPrevious
        ? 0
        : Math.max(0, ...currentAccounts.map(acc => acc.id));
      let nextIdCounter = maxExistingId + 1;
      const getNextId = () => nextIdCounter++;

      const results: ParsedFileResult[] = [];
      const aggregatedAccounts: GLAccount[] = [];
      const aggregatedErrors: UploadError[] = [];

      for (const file of selectedFiles) {
        try {
          const result = await parseWorkbookFile(file, getNextId, existingNumbers, seenAccountNumbers);
          results.push(result);
          aggregatedAccounts.push(...result.accounts);
          aggregatedErrors.push(...result.errors);
          result.accounts.forEach(account => existingNumbers.add(account.glAccountNumber));
        } catch (error) {
          aggregatedErrors.push({
            row: 0,
            message: `Failed to process '${file.name}': ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            data: file.name,
          });
        }
      }

      const sortedAccounts = sortAccounts(aggregatedAccounts);
      setParsedData(sortedAccounts);
      setFileSummaries(results);
      setErrors(aggregatedErrors);

      if (sortedAccounts.length === 0) {
        setUploadStep('result');
      } else {
        setUploadStep('preview');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    clearPrevious,
    currentAccounts,
    existingAccountNumbers,
    hasSelections,
    parseWorkbookFile,
    selectedFiles,
  ]);

  const handleConfirm = () => {
    if (parsedData.length === 0) {
      setErrors([
        {
          row: 0,
          message: 'No records available to import. Please process files again.',
          data: '',
        },
      ]);
      setUploadStep('result');
      return;
    }

    const summaries: UploadFileSummary[] = fileSummaries.map(file => ({
      name: file.fileName,
      size: file.fileSize,
      type: file.fileType,
      sheetName: file.sheetName,
      recordsScanned: file.recordsScanned,
      recordsImported: file.recordsImported,
      issues: file.errors,
    }));

    const payload: UploadCompletionPayload = {
      accounts: parsedData,
      files: summaries,
      clearPrevious,
    };

    onCompleteUpload(payload);
    handleResetState();
  };

  const renderSelectedFiles = () => {
    if (!hasSelections) {
      return null;
    }
    return (
      <div className="mt-6 space-y-3">
        {selectedFiles.map(file => (
          <div
            key={file.name}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
          >
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB · {file.type || 'Unknown type'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveFile(file.name)}
              className="inline-flex items-center rounded-full border border-rose-400/30 px-3 py-1 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-300 hover:text-rose-100"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderFileSummaries = () => {
    if (fileSummaries.length === 0) {
      return null;
    }

    return (
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {fileSummaries.map(summary => (
          <div
            key={summary.fileName}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{summary.fileName}</p>
                <p className="text-xs text-slate-400">
                  Sheet: {summary.sheetName || 'Not detected'} · Imported {summary.recordsImported} of{' '}
                  {summary.recordsScanned} rows
                </p>
              </div>
              {summary.recordsImported > 0 ? (
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              )}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/40">
              <table className="min-w-full divide-y divide-white/10 text-xs">
                <thead className="bg-white/5 text-slate-300/80">
                  <tr>
                    <th className="px-2 py-2 text-left uppercase tracking-wide">File Header</th>
                    <th className="px-2 py-2 text-left uppercase tracking-wide">Mapped Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {Object.keys(summary.headerMapping).length === 0 && (
                    <tr>
                      <td className="px-2 py-2 text-slate-400" colSpan={2}>
                        No headers mapped.
                      </td>
                    </tr>
                  )}
                  {Object.entries(summary.headerMapping).map(([fileHeader, systemField]) => (
                    <tr key={`${summary.fileName}-${fileHeader}`}>
                      <td className="px-2 py-1 font-medium">{fileHeader}</td>
                      <td className="px-2 py-1 font-mono text-cyan-300">{systemField}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.errors.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <p className="flex items-center text-xs font-semibold text-amber-200">
                  <AlertTriangle className="mr-1 h-4 w-4" /> Issues ({summary.errors.length})
                </p>
                <ul className="mt-1 space-y-1 text-xs text-amber-100">
                  {summary.errors.slice(0, 3).map((err, index) => (
                    <li key={`${summary.fileName}-err-${index}`}>{err.message}</li>
                  ))}
                  {summary.errors.length > 3 && (
                    <li className="text-amber-200/90">
                      ...and {summary.errors.length - 3} more warnings
                    </li>
                  )}
                </ul>
              </div>
            )}
            {summary.accounts.length > 0 && (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                {(() => {
                  const deptCounter = summary.accounts.reduce<
                    Record<string, { deptName: string; deptId: string; count: number; confidenceSum: number }>
                  >((acc, account) => {
                    if (!acc[account.departmentId]) {
                      acc[account.departmentId] = {
                        deptName: account.responsibleDept,
                        deptId: account.departmentId,
                        count: 0,
                        confidenceSum: 0,
                      };
                    }
                    acc[account.departmentId].count += 1;
                    acc[account.departmentId].confidenceSum += account.classificationConfidence;
                    return acc;
                  }, {});
                  const sorted = Object.values(deptCounter).sort((a, b) => b.count - a.count);
                  const top = sorted[0];
                  if (!top) {
                    return <span>No classification insights detected.</span>;
                  }
                  return (
                    <span>
                      Top classification: <strong>{top.deptName}</strong> ({top.deptId}) ·{' '}
                      {(top.confidenceSum / top.count * 100).toFixed(0)}% avg confidence
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSampleTable = () => {
    if (parsedData.length === 0) {
      return null;
    }
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-slate-300/80">
            <tr>
              <th className="px-3 py-2 text-left uppercase tracking-wide">GL Account #</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide">GL Account Name</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-200">
            {parsedData.slice(0, 5).map(account => (
              <tr key={account.id}>
                <td className="px-3 py-2 font-mono">{account.glAccountNumber}</td>
                <td className="px-3 py-2">{account.glAccount}</td>
                <td className="px-3 py-2 text-slate-300/80">{account.responsibleDept}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-[0_40px_120px_-60px_rgba(14,165,233,0.5)] backdrop-blur">
      <h2 className="mb-2 text-2xl font-semibold text-white">Data Ingestion</h2>
      <p className="text-sm text-slate-300/80">
        Upload multiple balance sheet extracts, clean them automatically, and launch a fresh review
        session.
      </p>

      {activeUploadId && (
        <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          <p>
            Active Upload ID: <span className="font-semibold text-white">{activeUploadId}</span>
          </p>
          <p className="text-xs text-cyan-100/80">
            Starting a new upload with session reset will archive this ID automatically.
          </p>
        </div>
      )}

      {uploadStep === 'select' && (
        <>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <label className="flex items-center space-x-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-400/30 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                checked={clearPrevious}
                onChange={() => setClearPrevious(prev => !prev)}
              />
              <span>Clear previous session data before importing (recommended)</span>
            </label>
            {hasPreviousUploads && (
              <button
                type="button"
                onClick={onResetUploads}
                className="text-xs font-semibold text-rose-200 underline-offset-4 transition-colors hover:text-rose-100"
              >
                Remove existing workflow data
              </button>
            )}
          </div>

          <div
            className="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-white/15 bg-white/5 p-8 text-center transition-colors hover:border-cyan-400/60 hover:bg-white/10"
            onDragOver={event => event.preventDefault()}
            onDrop={handleFileDrop}
          >
            <UploadCloud className="mx-auto h-12 w-12 text-cyan-300" />
            <label htmlFor="file-upload" className="mt-4 font-semibold text-cyan-300">
              Click to upload files
              <span className="font-normal text-slate-300/80"> or drag and drop multiples</span>
            </label>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              multiple
              onChange={handleFileChange}
            />
            <p className="mt-2 text-xs text-slate-400">
              Supported: Excel (.xlsx, .xls) and CSV extracts. Each file is scanned independently.
            </p>
          </div>

          {renderSelectedFiles()}

          {errors.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <h4 className="flex items-center font-semibold text-amber-200">
                <AlertTriangle className="mr-2 h-5 w-5" /> Selection Warnings
              </h4>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {errors.map((err, index) => (
                  <li key={`select-error-${index}`}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={processFilesData}
              disabled={!hasSelections || isProcessing}
              className="mx-auto flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3 font-semibold text-slate-900 shadow-lg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {isProcessing ? (
                'Processing...'
              ) : (
                <>
                  Process & Preview <ListChecks className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </>
      )}

      {uploadStep === 'preview' && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-white">Preview & Confirm</h3>
          <p className="mt-1 text-sm text-slate-300/80">
            {parsedData.length} GL accounts prepared across {fileSummaries.length} files. Review the
            header mappings, warnings, and sample records before confirming.
          </p>

          {renderFileSummaries()}

          {classificationSnapshot && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-inner">
              <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                Classification Overview
              </h4>
              <p className="mt-2 text-xs text-slate-400">
                {classificationSnapshot.total} accounts classified · Average confidence{' '}
                {(classificationSnapshot.averageConfidence * 100).toFixed(0)}%
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {classificationSnapshot.departments.slice(0, 4).map(dept => (
                  <div
                    key={`${dept.deptId}-${dept.deptName}`}
                    className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{dept.deptName}</p>
                        <p className="text-xs text-cyan-200/80">{dept.deptId}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                        {dept.count} entries
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300/80">
                      <span>Confidence {(dept.avgConfidence * 100).toFixed(0)}%</span>
                      <span>
                        {dept.sources.length > 0 ? dept.sources.join(', ').toUpperCase() : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <h4 className="flex items-center text-sm font-semibold text-amber-200">
                <AlertTriangle className="mr-2" /> Warnings detected ({errors.length})
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-100/90">
                {errors.slice(0, 6).map((err, index) => (
                  <li key={`preview-error-${index}`}>{err.message}</li>
                ))}
                {errors.length > 6 && (
                  <li className="text-amber-200/90">
                    ...and {errors.length - 6} additional warnings logged.
                  </li>
                )}
              </ul>
            </div>
          )}

          {renderSampleTable()}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={handleResetState}
              className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2 font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel & Re-upload
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2 font-semibold text-slate-900 shadow-lg transition-colors hover:bg-cyan-400"
            >
              Confirm & Register {parsedData.length} Accounts
            </button>
          </div>
        </div>
      )}

      {uploadStep === 'result' && errors.length > 0 && (
        <div className="mt-8">
          <h3 className="flex items-center text-xl font-semibold text-rose-200">
            <AlertTriangle className="mr-2" /> Upload Validation Failed
          </h3>
          <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100/90">
            <ul className="space-y-2">
              {errors.map((err, index) => (
                <li key={`failure-${index}`}>{err.message}</li>
              ))}
            </ul>
          </div>
          <div className="mt-6">
            <button
              onClick={handleResetState}
              className="flex items-center rounded-full border border-white/10 bg-white/5 px-6 py-2 font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadView;
