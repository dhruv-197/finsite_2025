import React from 'react';
import { GLAccount } from '../types';
import { X } from 'lucide-react';

interface ReportViewerModalProps {
  account: GLAccount;
  onClose: () => void;
}

const ReportViewerModal: React.FC<ReportViewerModalProps> = ({ account, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Supporting Report</h3>
            <p className="text-sm text-slate-300/80">
              {account.glAccountNumber} &mdash; {account.glAccount}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {account.reportUrl && (
              <a
                href={account.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition-colors hover:bg-cyan-500/20"
              >
                Open in New Tab
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 bg-slate-900/80">
          {account.reportUrl ? (
            <iframe
              key={account.reportUrl}
              src={account.reportUrl}
              title={`Report for ${account.glAccount}`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-lg font-semibold text-white">No report attached</p>
              <p className="max-w-sm text-sm text-slate-300/80">
                This account does not yet have a supporting document. Please upload one or provide a link in the data ingestion sheet.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReportViewerModal;





