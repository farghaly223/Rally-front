import React, { useCallback, useState } from 'react';
import { api, type MemberRow, type ApprovalStatus } from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';

const statusColor: Record<string, string> = {
  APPROVED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  REJECTED: 'text-red-400',
  SUSPENDED: 'text-red-400',
  DELETED: 'text-zinc-500',
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  warning?: string;
  actionLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  warning,
  actionLabel,
  busy,
  onConfirm,
  onCancel,
  danger = true,
}) => (
  <div
    className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
    role="dialog"
    aria-modal="true"
  >
    <div className="w-full max-w-md rounded-[32px] border border-zinc-800 bg-[#09090b]/95 p-8 shadow-2xl">
      <div className="mb-5 flex items-start gap-4">
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${
            danger
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          }`}
        >
          <span className="material-symbols-outlined text-xl">
            {danger ? 'warning' : 'info'}
          </span>
        </span>
        <div>
          <h2 className="font-headline-md text-lg text-white">{title}</h2>
          <p className="mt-1 font-body-md text-sm text-zinc-400">{message}</p>
        </div>
      </div>

      {warning && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="font-body-md text-sm text-zinc-300">{warning}</p>
        </div>
      )}

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
          onClick={onConfirm}
          disabled={busy}
          className={`flex-1 py-3 font-label-caps text-xs font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer ${
            danger ? 'btn-danger' : 'rounded-full border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {busy ? 'Working…' : actionLabel}
        </button>
      </div>
    </div>
  </div>
);

export const UserManager: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'block' | 'delete' | 'reinstate';
    member: MemberRow;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    (page: number, pageSize: number) => {
      return api.moderation.listMembers({
        page,
        pageSize,
        status: statusFilter,
        search: searchQuery || undefined,
      });
    },
    [statusFilter, searchQuery],
  );

  const handleBlock = async (member: MemberRow) => {
    setBusy(true);
    try {
      await api.moderation.blockMember(member.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const handleReinstate = async (member: MemberRow) => {
    setBusy(true);
    try {
      await api.moderation.reinstateMember(member.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Reinstate failed:', err);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const handleDelete = async (member: MemberRow) => {
    setBusy(true);
    try {
      await api.moderation.deleteMember(member.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 font-body-md text-sm"
        />
        <select
          value={statusFilter ?? ''}
          onChange={(e) =>
            setStatusFilter((e.target.value as ApprovalStatus | undefined) || undefined)
          }
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-white font-body-md text-sm cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
          <option value="DELETED">Deleted</option>
        </select>
      </div>

      <PaginatedTable<MemberRow>
        key={refreshKey}
        title="Members"
        description="Every registered account, newest first."
        columns={['Name', 'Phone', 'Gender', 'Role', 'Status', 'Joined', 'Actions']}
        load={load}
        rowKey={(row) => row.id}
        emptyMessage="No members match the filters."
        renderRow={(row) => (
          <>
            <td className={`${cellClass} text-white font-medium`}>{row.fullName}</td>
            <td className={cellClass}>{row.phone}</td>
            <td className={cellClass}>{row.gender}</td>
            <td className={cellClass}>{row.role}</td>
            <td className={`${cellClass} font-bold ${statusColor[row.approvalStatus] ?? ''}`}>
              {row.approvalStatus}
            </td>
            <td className={cellClass}>{new Date(row.createdAt).toLocaleDateString()}</td>
            <td className={`${cellClass} space-x-2`}>
              {row.approvalStatus === 'APPROVED' && (
                <button
                  onClick={() => setConfirmAction({ type: 'block', member: row })}
                  className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-full font-label-caps font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Block
                </button>
              )}
              {row.approvalStatus === 'SUSPENDED' && (
                <button
                  onClick={() => setConfirmAction({ type: 'reinstate', member: row })}
                  className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-label-caps font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Reinstate
                </button>
              )}
              {row.approvalStatus !== 'DELETED' && (
                <button
                  onClick={() => setConfirmAction({ type: 'delete', member: row })}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-full font-label-caps font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Delete
                </button>
              )}
            </td>
          </>
        )}
      />

      {confirmAction && confirmAction.type === 'block' && (
        <ConfirmDialog
          title="Block Member"
          message={`${confirmAction.member.fullName} · ${confirmAction.member.phone}`}
          warning="They will not be able to sign in or participate in events until reinstated."
          actionLabel="Block"
          busy={busy}
          onConfirm={() => handleBlock(confirmAction.member)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction && confirmAction.type === 'reinstate' && (
        <ConfirmDialog
          title="Reinstate Member"
          message={`${confirmAction.member.fullName} · ${confirmAction.member.phone}`}
          warning="Their account will be restored to approved status and they can sign in again."
          actionLabel="Reinstate"
          busy={busy}
          danger={false}
          onConfirm={() => handleReinstate(confirmAction.member)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction && confirmAction.type === 'delete' && (
        <ConfirmDialog
          title="Delete Member"
          message={`${confirmAction.member.fullName} · ${confirmAction.member.phone}`}
          warning="This cannot be undone. Their phone and email will remain claimed permanently so the credentials cannot be reused."
          actionLabel="Delete"
          busy={busy}
          onConfirm={() => handleDelete(confirmAction.member)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};
