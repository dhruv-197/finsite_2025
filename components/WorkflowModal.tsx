import React, { useState } from 'react';
import { GLAccount, User, AuditLogEntry } from '../types';
import { X, Check, Clock, AlertTriangle, MessageSquare } from 'lucide-react';

interface WorkflowModalProps {
  account: GLAccount;
  mode: 'history' | 'reject';
  onClose: () => void;
  onSubmitReason: (reason: string) => void;
  currentUser: User;
}

const AuditEntry: React.FC<{log: AuditLogEntry}> = ({log}) => {
    const getIcon = () => {
        if(log.action.includes('Approve')) return <Check className="h-4 w-4 text-green-500" />;
        if(log.action.includes('Reject')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
        if(log.action.includes('Ingestion')) return <Clock className="h-4 w-4 text-gray-500" />;
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
    return (
        <li className="mb-6 ms-6">
            <span className="absolute flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full -start-4 ring-4 ring-white">
                {getIcon()}
            </span>
            <div className="ml-4">
                <p className="font-semibold text-gray-900">{log.action} by {log.user} ({log.role})</p>
                <time className="block mb-2 text-sm font-normal leading-none text-gray-500">{new Date(log.timestamp).toLocaleString()}</time>
                <p className="text-sm text-gray-600">Stage: <span className="font-medium">{log.from} → {log.to}</span></p>
                {log.reason && <p className="mt-1 text-sm text-red-700 bg-red-50 p-2 rounded-md">Reason: {log.reason}</p>}
            </div>
        </li>
    )
}

const WorkflowModal: React.FC<WorkflowModalProps> = ({ account, mode, onClose, onSubmitReason, currentUser }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onSubmitReason(reason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
                {mode === 'history' ? 'Audit History' : 'Flag Mismatch'}
            </h3>
            <p className="text-sm text-gray-500 font-mono">{account.glAccountNumber} - {account.glAccount}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
        {mode === 'history' ? (
             <ol className="relative border-s border-gray-200">
                {account.auditLog.slice().reverse().map((log, index) => <AuditEntry key={index} log={log} />)}
             </ol>
        ) : (
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Please provide a reason for flagging this item as a mismatch:
            </label>
            <textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder={`As ${currentUser.name} (${currentUser.role}), I am flagging this because...`}
            />
          </div>
        )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          {mode === 'reject' ? (
            <button
              onClick={handleSubmit}
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              Submit Mismatch
            </button>
          ) : (
            <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700"
            >
                Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;
