import React, { useCallback, useEffect, useState } from 'react';
import { APIError, type Paginated } from '../../api/client';

interface PaginatedTableProps<T> {
  title: string;
  description: string;
  columns: string[];
  /** Fetches one page. Stable identity matters — wrap in `useCallback`. */
  load: (page: number, pageSize: number) => Promise<Paginated<T>>;
  renderRow: (row: T) => React.ReactNode;
  rowKey: (row: T) => string;
  emptyMessage: string;
  pageSize?: number;
}

/**
 * The read-only admin tables (users, registrations, login history, audit log)
 * differ only in their columns and their loader, so the paging, loading, and
 * error handling live here once.
 */
export function PaginatedTable<T>({
  title,
  description,
  columns,
  load,
  renderRow,
  rowKey,
  emptyMessage,
  pageSize = 20,
}: PaginatedTableProps<T>): React.ReactElement {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await load(page, pageSize);
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof APIError ? err.message : 'Failed to load records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, page, pageSize]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  return (
    <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-1 border-b border-zinc-800/80 pb-4">
        <h2 className="font-headline-md text-xl text-white">{title}</h2>
        <p className="font-body-md text-sm text-zinc-400">{description}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-body-md text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body-md text-sm text-zinc-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-body-md text-sm text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                {columns.map((column) => (
                  <th
                    key={column}
                    className="pb-3 pr-4 font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-zinc-800/60 last:border-0">
                  {renderRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
        <span className="font-label-caps text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
          {total} record{total === 1 ? '' : 's'} · page {page} of {lastPage}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={page <= 1 || loading}
            className="rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={page >= lastPage || loading}
            className="rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

/** Shared cell padding so every admin table lines up. */
export const cellClass = 'py-3 pr-4 font-body-md text-sm text-zinc-300 align-top';
