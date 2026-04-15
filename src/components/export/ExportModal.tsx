import { useState } from 'react';
import { X, Download, Loader2, Calendar, Filter } from 'lucide-react';
import { exportToExcel } from '../../lib/exportService';
import type { ExportFilters } from '../../lib/exportService';
import type { FormStatus } from '../../types';

interface ExportModalProps {
  onClose: () => void;
}

type StatusOption = FormStatus | 'all' | 'not_started';

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: 'all',            label: 'All Statuses' },
  { value: 'not_started',    label: 'Not Started' },
  { value: 'draft',          label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'returned',       label: 'Returned' },
  { value: 'approved',       label: 'Approved' },
];

export default function ExportModal({ onClose }: ExportModalProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<StatusOption>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setError('');
    if (fromDate && toDate && fromDate > toDate) {
      setError('From date must be before To date.');
      return;
    }
    setLoading(true);
    try {
      const filters: ExportFilters = { status };
      if (fromDate) filters.fromDate = fromDate;
      if (toDate)   filters.toDate = toDate;
      await exportToExcel(filters);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Download size={15} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-gray-900">Export to Excel</h2>
              <p className="text-[11px] text-gray-400 font-body">2 sheets: Skill Data + Submission Tracker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 font-body">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold font-heading text-gray-700">
              <Filter size={12} className="text-gray-400" />
              Status Filter
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusOption)}
                className="w-full appearance-none px-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 bg-white outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all cursor-pointer"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold font-heading text-gray-700">
                <Calendar size={12} className="text-gray-400" />
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold font-heading text-gray-700">
                <Calendar size={12} className="text-gray-400" />
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
            <p className="text-[11px] font-semibold font-heading text-gray-600">What's included in the export:</p>
            <ul className="space-y-1">
              {[
                'Sheet 1 — Skill Data: full profile, skills, certifications, plans',
                'Sheet 2 — Submission Tracker: status, dates, days pending',
                'Headers styled in navy with white text',
                'Columns auto-sized, first row frozen',
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[11px] text-gray-500 font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold font-heading transition-all"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
