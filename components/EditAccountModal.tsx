import React, { useState } from 'react';
import { GLAccount } from '../types';
import { X } from 'lucide-react';

type EditableAccountFields = Pick<
  GLAccount,
  | 'glAccountNumber'
  | 'glAccount'
  | 'responsibleDept'
  | 'mainHead'
  | 'subHead'
  | 'bsPl'
  | 'statusCategory'
  | 'spoc'
  | 'reviewer'
  | 'typeOfReport'
  | 'flagStatus'
  | 'percentVariance'
  | 'reconStatus'
  | 'confirmationSource'
  | 'analysisRequired'
  | 'workingNeeded'
  | 'queryType'
  | 'reviewCheckpointAbex'
  | 'departmentReviewer'
>;

interface EditAccountModalProps {
  account: GLAccount;
  onClose: () => void;
  onSave: (updates: Partial<GLAccount>) => void;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ account, onClose, onSave }) => {
  const [formState, setFormState] = useState<EditableAccountFields>({
    glAccountNumber: account.glAccountNumber,
    glAccount: account.glAccount,
    responsibleDept: account.responsibleDept,
    mainHead: account.mainHead,
    subHead: account.subHead,
    bsPl: account.bsPl,
    statusCategory: account.statusCategory,
    spoc: account.spoc,
    reviewer: account.reviewer,
    typeOfReport: account.typeOfReport ?? '',
    flagStatus: account.flagStatus ?? 'Green',
    percentVariance: account.percentVariance,
    reconStatus: account.reconStatus ?? 'Recon',
    confirmationSource: account.confirmationSource ?? 'Internal',
    analysisRequired: account.analysisRequired ?? 'No',
    workingNeeded: account.workingNeeded ?? '',
    queryType: account.queryType ?? '',
    reviewCheckpointAbex: account.reviewCheckpointAbex ?? '',
    departmentReviewer: account.departmentReviewer ?? account.reviewer,
  });

  const handleChange = (field: keyof EditableAccountFields, value: string) => {
    if (field === 'percentVariance') {
      const parsed = value === '' ? undefined : Number.parseFloat(value);
      setFormState(prev => ({
        ...prev,
        percentVariance: Number.isNaN(parsed as number) ? prev.percentVariance : parsed,
      }));
      return;
    }
    setFormState(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Edit Balance Sheet Entry</h3>
            <p className="text-sm text-gray-500 font-mono">{account.glAccountNumber} - {account.glAccount}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              GL Account Number
              <input
                value={formState.glAccountNumber}
                onChange={(e) => handleChange('glAccountNumber', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              GL Account Name
              <input
                value={formState.glAccount}
                onChange={(e) => handleChange('glAccount', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Responsible Department
              <input
                value={formState.responsibleDept}
                onChange={(e) => handleChange('responsibleDept', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Main Head
              <input
                value={formState.mainHead}
                onChange={(e) => handleChange('mainHead', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Sub Head
              <input
                value={formState.subHead}
                onChange={(e) => handleChange('subHead', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              BS / PL
              <input
                value={formState.bsPl}
                onChange={(e) => handleChange('bsPl', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Status Category
              <input
                value={formState.statusCategory}
                onChange={(e) => handleChange('statusCategory', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              SPOC
              <input
                value={formState.spoc}
                onChange={(e) => handleChange('spoc', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
              Reviewer
              <input
                value={formState.reviewer}
                onChange={(e) => handleChange('reviewer', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
              Department Reviewer
              <input
                value={formState.departmentReviewer ?? ''}
                onChange={(e) => handleChange('departmentReviewer', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Type of Report
              <select
                value={formState.typeOfReport}
                onChange={(e) => handleChange('typeOfReport', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not Set</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Recon / Non-Recon
              <select
                value={formState.reconStatus ?? ''}
                onChange={(e) => handleChange('reconStatus', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Recon">Recon</option>
                <option value="Non-Recon">Non-Recon</option>
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Confirmation (Internal / External)
              <select
                value={formState.confirmationSource ?? ''}
                onChange={(e) => handleChange('confirmationSource', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Internal">Internal</option>
                <option value="External">External</option>
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Review Check Point at ABEX
              <input
                value={formState.reviewCheckpointAbex ?? ''}
                onChange={(e) => handleChange('reviewCheckpointAbex', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Analysis Required
              <select
                value={formState.analysisRequired ?? 'No'}
                onChange={(e) => handleChange('analysisRequired', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Flag (Green / Red)
              <select
                value={formState.flagStatus ?? 'Green'}
                onChange={(e) => handleChange('flagStatus', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Green">Green</option>
                <option value="Red">Red</option>
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              % Variance
              <input
                value={formState.percentVariance !== undefined ? String(formState.percentVariance) : ''}
                onChange={(e) => handleChange('percentVariance', e.target.value)}
                placeholder="e.g., 5"
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
              Working Needed
              <input
                value={formState.workingNeeded ?? ''}
                onChange={(e) => handleChange('workingNeeded', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
              Query Type / Action Points
              <textarea
                value={formState.queryType ?? ''}
                onChange={(e) => handleChange('queryType', e.target.value)}
                rows={3}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold uppercase tracking-wide text-blue-900">Classification Snapshot</p>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase text-blue-600">Resolved Department</p>
                <p className="font-semibold">{account.responsibleDept}</p>
                <p className="text-xs text-blue-500">Dept ID: {account.departmentId}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase text-blue-600">Logic Identifier</p>
                <p className="font-semibold">{account.logicId}</p>
                <p className="text-xs text-blue-500">
                  {(account.classificationConfidence * 100).toFixed(0)}% confidence · {account.classificationSource.toUpperCase()}
                </p>
              </div>
            </div>
            {account.inputDepartment && account.inputDepartment !== account.responsibleDept && (
              <p className="mt-2 text-xs text-blue-600">
                Source upload provided department <strong>{account.inputDepartment}</strong>.
              </p>
            )}
            {account.classificationNotes && (
              <p className="mt-2 text-xs text-blue-600">Notes: {account.classificationNotes}</p>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAccountModal;

