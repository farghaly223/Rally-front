import React, { useEffect, useState } from 'react';
import { APIError, api, type DashboardStats as Stats } from '../../api/client';

interface Tile {
  label: string;
  value: number;
  icon: string;
  accent: string;
}

export const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await api.admin.dashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof APIError ? err.message : 'Failed to load statistics.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="font-body-md text-sm text-zinc-400">Loading overview…</p>;
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-body-md text-sm text-red-300">
        {error ?? 'Statistics unavailable.'}
      </div>
    );
  }

  const tiles: Tile[] = [
    { label: 'Members', value: stats.totalUsers, icon: 'group', accent: 'text-indigo-400' },
    {
      label: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: 'pending_actions',
      accent: 'text-amber-400',
    },
    { label: 'Screenings', value: stats.totalEvents, icon: 'movie', accent: 'text-indigo-400' },
    {
      label: 'Open Screenings',
      value: stats.openEvents,
      icon: 'event_available',
      accent: 'text-emerald-400',
    },
    {
      label: 'Registrations',
      value: stats.totalRegistrations,
      icon: 'how_to_reg',
      accent: 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="bento-card rounded-[28px] border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4"
        >
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
              {tile.label}
            </span>
            <span className={`material-symbols-outlined text-xl ${tile.accent}`}>{tile.icon}</span>
          </div>
          <span className={`font-display-lg text-4xl ${tile.accent}`}>
            {tile.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};
