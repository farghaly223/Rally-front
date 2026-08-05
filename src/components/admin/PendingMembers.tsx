import React, { useCallback, useEffect, useState } from 'react';
import { APIError, api, type PendingUser } from '../../api/client';
import type { ToastKind } from '../ui/Toast';

interface PendingMembersProps {
  notify: (kind: ToastKind, text: string) => void;
}

const PAGE_SIZE = 20;

/**
 * The verification queue.
 *
 * There is nothing to look at here but a name and a phone number, because that
 * is all this decision ever involves: the verifying admin already spoke to the
 * person off-platform, and this records the outcome. No document is fetched, no
 * image is rendered, and no password re-entry gates a view that shows nothing
 * sensitive.
 *
 * Rows are removed only after the server confirms. A refused decision leaves the
 * queue exactly as it was, so nobody disappears from it without being decided.
 */
export const PendingMembers: React.FC<PendingMembersProps> = ({ notify }) => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.verification.listPending({ page, pageSize: PAGE_SIZE });
      setPending(data.items);
      setTotal(data.total);
    } catch (err) {
      setPending([]);
      setTotal(0);
      setError(err instanceof APIError ? err.message : 'Failed to load the queue.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (user: PendingUser, decision: 'approve' | 'reject') => {
      setBusyId(user.id);
      try {
        if (decision === 'approve') {
          await api.admin.verification.approve(user.id);
        } else {
          await api.admin.verification.reject(user.id);
        }
        setPending((prev) => prev.filter((row) => row.id !== user.id));
        setTotal((t) => Math.max(0, t - 1));
        notify('success', `${user.fullName} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      } catch (err) {
        notify(
          'error',
          err instanceof APIError
            ? `Could not ${decision} ${user.fullName}: ${err.message}`
            : `Could not ${decision} ${user.fullName}.`,
        );
      } finally {
        setBusyId(null);
      }
    },
    [notify],
  );

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
      <div className="mb-6 border-b border-zinc-800/80 pb-4">
        <h2 className="font-headline-md text-xl text-white">Pending Members</h2>
        <p className="font-body-md mt-1 text-sm text-zinc-400">
          Approve or reject based on the conversation you already had. Rally holds no
          documents to review.
        </p>
      </div>

      {error && (
        <div className="font-body-md mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body-md text-sm text-zinc-400">Loading queue…</p>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="material-symbols-outlined text-5xl text-zinc-600">how_to_reg</span>
          <p className="font-headline-md text-lg text-zinc-200">Queue is clear</p>
          <p className="font-body-md text-sm text-zinc-400">
            Nobody is waiting on a decision right now.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-headline-md text-sm text-white">{user.fullName}</p>
                <p className="font-body-md text-xs text-zinc-400">
                  {user.phone} · {user.gender} · applied{' '}
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void decide(user, 'reject')}
                  disabled={busyId !== null}
                  className="font-label-caps cursor-pointer rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyId === user.id ? 'Working…' : 'Reject'}
                </button>
                <button
                  type="button"
                  onClick={() => void decide(user, 'approve')}
                  disabled={busyId !== null}
                  className="font-label-caps cursor-pointer rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyId === user.id ? 'Working…' : 'Approve'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
        <span className="font-label-caps text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {total} waiting · page {page} of {lastPage}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page <= 1 || loading}
            className="font-label-caps cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setPage((p) => p + 1);
            }}
            disabled={page >= lastPage || loading}
            className="font-label-caps cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};
