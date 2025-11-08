import React from 'react';
import { GLAccount } from '../types';
import { X } from 'lucide-react';

interface LogicExplainModalProps {
  account: GLAccount;
  onClose: () => void;
}

const LogicExplainModal: React.FC<LogicExplainModalProps> = ({ account, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Logic Explain</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{account.glAccount} ({account.glAccountNumber})</h3>
            <p className="text-sm text-slate-300/80">
              Classified under <span className="font-semibold text-cyan-300">{account.responsibleDept}</span> · Dept ID{' '}
              <span className="font-semibold text-cyan-200">{account.departmentId}</span> · Logic ID{' '}
              <span className="font-semibold text-cyan-200">{account.logicId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300/70">Confidence</p>
            <p className="mt-2 text-3xl font-semibold text-white">{(account.classificationConfidence * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-400/90 uppercase tracking-[0.25em]">
              Source: {account.classificationSource.toUpperCase()}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300/70">Keywords & Patterns</p>
            <p className="mt-2 text-sm text-slate-200">
              {account.classificationKeywords?.length
                ? account.classificationKeywords.join(', ')
                : 'No keyword matches recorded.'}
            </p>
            <p className="mt-2 text-xs text-slate-400/90">
              Patterns: {account.classificationPatterns?.length ? account.classificationPatterns.join(', ') : 'N/A'}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Evidence Trail</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {(account.classificationEvidence ?? []).map((item, index) => (
              <li key={`${item.type}-${index}`} className="rounded-xl border border-white/5 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">
                  {item.type.toUpperCase()} · Confidence {(item.confidence * 100).toFixed(0)}%
                </p>
                <p className="mt-1 text-sm text-slate-100">{item.value}</p>
              </li>
            ))}
            {(!account.classificationEvidence || account.classificationEvidence.length === 0) && (
              <li className="rounded-xl border border-white/5 bg-slate-900/70 p-3 text-sm text-slate-300/80">
                No evidence captured for this classification.
              </li>
            )}
          </ul>
        </div>
        {account.classificationNotes && (
          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Notes</p>
            <p className="mt-2">{account.classificationNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogicExplainModal;

