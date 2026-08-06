import React, { useCallback, useState } from 'react';
import {
  api,
  type AdminReportRow,
  type ReportStatus,
  type ReportReason,
} from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';
import type { ToastKind } from '../ui/Toast';

interface ReportManagerProps {
  notify: (kind: ToastKind, text: string) => void;
}

const statusColor: Record<ReportStatus, string> = {
  OPEN: 'text-amber-400',
  REVIEWING: 'text-blue-400',
  RESOLVED: 'text-emerald-400',
  DISMISSED: 'text-zinc-500',
};

const reasonLabel: Record<ReportReason, string> = {
  HARASSMENT: 'Harassment',
  INAPPROPRIATE_BEHAVIOUR: 'Inappropriate Behavior',
  FAKE_PROFILE: 'Fake Profile',
  SPAM: 'Spam',
  SAFETY_CONCERN: 'Safety Concern',
  INCORRECT_EVENT_DETAILS: 'Incorrect Event Details',
  OTHER: 'Other',
};

interface UpdateDialogProps {
  report: AdminReportRow;
  busy: boolean;
  onConfirm: (status: ReportStatus, adminNote: string) => void;
  onCancel: () => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ report, busy, onConfirm, onCancel }) => {
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [adminNote, setAdminNote] = useState(report.adminNote ?? '');

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-[32px] border border-zinc-800 bg-[#09090b]/95 p-8 shadow-2xl">
        <div className="mb-5 flex items-start gap-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-500/40 bg-blue-500/10 text-blue-400">
            <span className="material-symbols-outlined text-xl">flag</span>
          </span>
          <div className="flex-1">
            <h2 className="font-headline-md text-lg text-white">Update Report Status</h2>
            <p className="mt-1 font-body-md text-sm text-zinc-400">
              {reasonLabel[report.reason]} ·{' '}
              {report.targetType === 'USER'
                ? (report.reportedUser?.fullName ??
                  (report.reportedUserQuery
                    ? `“${report.reportedUserQuery}” (no match)`
                    : 'Unknown'))
                : `${report.reportedEvent?.movieName ?? 'Unknown'}`}
            </p>
          </div>
        </div>

        {report.details && (
          <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
              Details
            </p>
            <p className="font-body-md text-sm text-zinc-300">{report.details}</p>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
            Reporter
          </p>
          <p className="font-body-md text-sm text-zinc-300">
            {report.reporter.fullName} · {report.reporter.phone}
          </p>
        </div>

        <div className="mb-4">
          <label className="font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReportStatus)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-white font-body-md text-sm cursor-pointer"
          >
            <option value="OPEN">Open</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 block">
            Admin Note (optional)
          </label>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 font-body-md text-sm resize-none"
            placeholder="Add context for other admins..."
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-zinc-700 py-3 font-label-caps text-xs font-bold uppercase tracking-wider text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(status, adminNote)}
            disabled={busy}
            className="flex-1 rounded-full border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 py-3 font-label-caps text-xs font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReportManager: React.FC<ReportManagerProps> = ({ notify }) => {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>();
  const [selectedReport, setSelectedReport] = useState<AdminReportRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    (page: number, pageSize: number) => {
      return api.reports.listAll({
        page,
        pageSize,
        status: statusFilter,
      });
    },
    [statusFilter],
  );

  const handleUpdate = async (status: ReportStatus, adminNote: string) => {
    if (!selectedReport) return;

    setBusy(true);
    try {
      await api.reports.updateStatus(selectedReport.id, {
        status,
        adminNote: adminNote.trim() || undefined,
      });
      notify('success', 'Report updated');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Update failed:', err);
      notify('error', 'Failed to update report');
    } finally {
      setBusy(false);
      setSelectedReport(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex gap-4 flex-wrap">
        <select
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter((e.target.value as ReportStatus | undefined) || undefined)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-white font-body-md text-sm cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      <PaginatedTable<AdminReportRow>
        key={refreshKey}
        title="Report Queue"
        description="Member reports of users and events, newest first."
        columns={['Reason', 'Target', 'Reporter', 'Status', 'Submitted', 'Actions']}
        load={load}
        rowKey={(row) => row.id}
        emptyMessage="No reports match the filters."
        renderRow={(row) => (
          <>
            <td className={`${cellClass} font-medium`}>{reasonLabel[row.reason]}</td>
            <td className={cellClass}>
              {row.targetType === 'USER' && row.reportedUser && (
                <div>
                  <div className="text-white">{row.reportedUser.fullName}</div>
                  <div className="text-zinc-500 text-xs">{row.reportedUser.phone}</div>
                </div>
              )}
              {row.targetType === 'USER' && !row.reportedUser && (
                <div>
                  <div className="text-white">{row.reportedUserQuery ?? 'Unknown'}</div>
                  <div className="text-amber-400/80 text-xs">No matching account</div>
                </div>
              )}
              {row.targetType === 'EVENT' && row.reportedEvent && (
                <div>
                  <div className="text-white">{row.reportedEvent.movieName}</div>
                  <div className="text-zinc-500 text-xs">
                    {new Date(row.reportedEvent.startsAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </td>
            <td className={cellClass}>
              <div>
                <div className="text-white">{row.reporter.fullName}</div>
                <div className="text-zinc-500 text-xs">{row.reporter.phone}</div>
              </div>
            </td>
            <td className={`${cellClass} font-bold ${statusColor[row.status]}`}>{row.status}</td>
            <td className={cellClass}>{new Date(row.createdAt).toLocaleDateString()}</td>
            <td className={`${cellClass}`}>
              <button
                onClick={() => setSelectedReport(row)}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full font-label-caps font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Update
              </button>
            </td>
          </>
        )}
      />

      {selectedReport && (
        <UpdateDialog
          report={selectedReport}
          busy={busy}
          onConfirm={handleUpdate}
          onCancel={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
};
