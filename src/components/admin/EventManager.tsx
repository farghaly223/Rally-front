import React, { useCallback, useEffect, useState } from 'react';
import { APIError, api } from '../../api/client';
import { formatEventDateTime, type RallyEvent } from '../../types';
import { EventForm } from './EventForm';
import { EventDeleteDialog } from './EventDeleteDialog';
import type { ToastKind } from '../ui/Toast';

interface EventManagerProps {
  notify: (kind: ToastKind, text: string) => void;
}

const PAGE_SIZE = 20;

const statusStyle: Record<RallyEvent['status'], string> = {
  OPEN: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  CLOSED: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  CANCELLED: 'border-red-500/40 bg-red-500/10 text-red-400',
};

export const EventManager: React.FC<EventManagerProps> = ({ notify }) => {
  const [events, setEvents] = useState<RallyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<RallyEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RallyEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.events.list({ page, pageSize: PAGE_SIZE });
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setEvents([]);
      setTotal(0);
      setError(err instanceof APIError ? err.message : 'Failed to load screenings.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback(
    (saved: RallyEvent, savedMode: 'created' | 'updated') => {
      setEvents((prev) =>
        savedMode === 'created'
          ? [saved, ...prev]
          : prev.map((e) => (e.id === saved.id ? saved : e)),
      );
      if (savedMode === 'created') setTotal((t) => t + 1);
      setMode('list');
      setEditing(null);
      notify('success', `“${saved.movieName}” ${savedMode}.`);
    },
    [notify],
  );

  /**
   * Optimistic removal: the row disappears immediately, and the whole list is
   * restored from the pre-delete snapshot if the server refuses — which also
   * puts the row back at its original position.
   */
  const handleConfirmDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;

    const snapshot = events;
    const snapshotTotal = total;

    setDeleting(true);
    setEvents((prev) => prev.filter((e) => e.id !== target.id));
    setTotal((t) => Math.max(0, t - 1));

    try {
      await api.admin.events.remove(target.id);
      notify('success', `“${target.movieName}” deleted.`);
    } catch (err) {
      setEvents(snapshot);
      setTotal(snapshotTotal);
      notify(
        'error',
        err instanceof APIError
          ? `Could not delete “${target.movieName}”: ${err.message}`
          : `Could not delete “${target.movieName}”.`,
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [events, notify, pendingDelete, total]);

  const startCreate = useCallback(() => {
    setEditing(null);
    setMode('create');
  }, []);

  const cancelForm = useCallback(() => {
    setMode('list');
    setEditing(null);
  }, []);

  const handleFormError = useCallback(
    (message: string) => {
      notify('error', message);
    },
    [notify],
  );

  if (mode !== 'list') {
    return (
      <EventForm
        event={mode === 'edit' ? editing : null}
        onSaved={handleSaved}
        onCancel={cancelForm}
        onError={handleFormError}
      />
    );
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline-md text-xl text-white">Screenings</h2>
          <p className="font-body-md text-sm text-zinc-400">
            Every screening across both audiences.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="btn-primary flex items-center gap-2 self-start rounded-full px-5 py-2.5 font-label-caps text-xs font-bold shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New Screening
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-body-md text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body-md text-sm text-zinc-400">Loading screenings…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="material-symbols-outlined text-5xl text-zinc-600">movie_off</span>
          <p className="font-headline-md text-lg text-zinc-200">No screenings yet</p>
          <p className="font-body-md text-sm text-zinc-400">
            Create the first one to make it visible to members.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Film', 'Cinema', 'Starts', 'Audience', 'Registered', 'Status', ''].map(
                  (column, i) => (
                    <th
                      key={column || `actions-${String(i)}`}
                      className="pb-3 pr-4 font-label-caps text-[10px] font-bold uppercase tracking-wider text-zinc-500"
                    >
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-zinc-800/60 last:border-0">
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex items-center gap-3">
                      {event.posterUrl ? (
                        <img
                          src={event.posterUrl}
                          alt=""
                          width={36}
                          height={48}
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-9 flex-shrink-0 rounded-lg border border-zinc-800 object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-600">
                          <span className="material-symbols-outlined text-base">movie</span>
                        </span>
                      )}
                      <span className="font-body-md text-sm font-medium text-white">
                        {event.movieName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-middle font-body-md text-sm text-zinc-300">
                    {event.cinema ?? '—'}
                  </td>
                  <td className="py-3 pr-4 align-middle font-body-md text-sm text-zinc-300">
                    {formatEventDateTime(event.startsAt)}
                  </td>
                  <td className="py-3 pr-4 align-middle font-label-caps text-xs font-bold text-zinc-400">
                    {event.gender}
                  </td>
                  <td className="py-3 pr-4 align-middle font-body-md text-sm text-zinc-300">
                    {event.registeredCount} / {event.capacity}
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-label-caps text-[10px] font-bold uppercase ${statusStyle[event.status]}`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="py-3 align-middle">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(event);
                          setMode('edit');
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-3.5 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:text-white hover:border-zinc-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDelete(event);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-2 font-label-caps text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
        <span className="font-label-caps text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {total} screening{total === 1 ? '' : 's'} · page {page} of {lastPage}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page <= 1 || loading}
            className="rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setPage((p) => p + 1);
            }}
            disabled={page >= lastPage || loading}
            className="rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {pendingDelete && (
        <EventDeleteDialog
          event={pendingDelete}
          busy={deleting}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
          onCancel={() => {
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
};
