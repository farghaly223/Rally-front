import React, { useCallback, useMemo } from 'react';
import type { RallyEvent } from '../types';
import { EventCard } from './EventCard';

interface DiscoverPremieresProps {
  events: RallyEvent[];
  savedEventIds: string[];
  loading?: boolean;
  error?: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchRefused?: boolean;
  statusFilter: RallyEvent['status'] | 'all';
  onStatusFilterChange: (value: RallyEvent['status'] | 'all') => void;
  onToggleBookmark: (id: string) => void;
  onSelectEvent: (event: RallyEvent) => void;
  onNavigateToVerification?: () => void;
  showVerificationPrompt?: boolean;
}

const STATUS_FILTERS: { id: RallyEvent['status'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All Screenings' },
  { id: 'OPEN', label: 'Open' },
  { id: 'CLOSED', label: 'Closed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

/**
 * The member-facing feed.
 *
 * There is deliberately no gender filter and no audience chip here. The server
 * scopes `GET /events` to the caller's own gender, so an opposite-gender
 * screening is absent from the payload rather than hidden by the client — which
 * is what makes the isolation a guarantee instead of a UI convention.
 *
 * Search and status are lifted to the parent and sent to the server for the same
 * reason. Searching locally would match against `cinema` and `location`, which
 * are `null` for a member who has not verified — so a local filter would appear
 * broken to exactly the people the redaction protects, and would leak the venue
 * to anyone whose client did hold it.
 */
export const DiscoverPremieres: React.FC<DiscoverPremieresProps> = ({
  events,
  savedEventIds,
  loading = false,
  error = null,
  searchQuery,
  onSearchChange,
  searchRefused = false,
  statusFilter,
  onStatusFilterChange,
  onToggleBookmark,
  onSelectEvent,
  onNavigateToVerification,
  showVerificationPrompt = false,
}) => {
  const attendingTotal = useMemo(
    () => events.reduce((sum, event) => sum + event.registeredCount, 0),
    [events],
  );

  const savedSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);

  // Stable so the memoized cards do not re-render on each keystroke.
  const handleToggleBookmark = useCallback(
    (id: string) => {
      onToggleBookmark(id);
    },
    [onToggleBookmark],
  );

  const handleSelectEvent = useCallback(
    (event: RallyEvent) => {
      onSelectEvent(event);
    },
    [onSelectEvent],
  );

  const resetFilters = useCallback(() => {
    onStatusFilterChange('all');
    onSearchChange('');
  }, [onStatusFilterChange, onSearchChange]);

  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="bg-cinematic min-h-screen bg-[#09090b] pb-32 text-zinc-100">
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-20 md:px-10 md:pt-28">
        {showVerificationPrompt && onNavigateToVerification && (
          <div className="bento-card flex flex-col items-center justify-between gap-4 rounded-[24px] border border-indigo-500/30 bg-indigo-950/20 p-5 shadow-xl sm:flex-row">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-indigo-500/40 bg-indigo-500/20 text-indigo-400">
                <span className="material-symbols-outlined text-xl">verified_user</span>
              </div>
              <div>
                <h4 className="font-headline-md text-sm text-zinc-100">
                  Identity Verification Pending
                </h4>
                <p className="font-body-md mt-0.5 text-xs text-zinc-400">
                  Venue and showtimes stay hidden until an admin approves your photos.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToVerification}
              className="font-label-caps cursor-pointer whitespace-nowrap rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500"
            >
              Verify Identity Now
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div className="bento-card group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:col-span-2 md:p-8">
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl transition-all duration-500 group-hover:bg-indigo-600/20" />

            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Film Squad Directory
                </span>
              </div>
              <h1 className="font-display-lg mb-2 text-3xl tracking-tight text-white md:text-5xl">
                Find Movie Buddies &amp; RSVP
              </h1>
              <p className="font-body-md max-w-xl text-sm text-zinc-400 md:text-base">
                Connect with fellow film lovers attending upcoming screenings. Join the squad chat,
                meet up before the show, and buy official tickets directly from cinema links.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-4 border-t border-zinc-800/80 pt-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{events.length}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Screenings For You
                </span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-400">{attendingTotal}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Moviegoers Attending
                </span>
              </div>
            </div>
          </div>

          <div className="bento-card relative flex flex-col justify-between rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Social Meetup Platform
                </p>
                <h3 className="text-2xl font-bold text-white">Never Watch Alone</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-400">
                SQUAD
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-zinc-400">
                Rally connects moviegoers to discuss films and attend screenings together. Official
                tickets are reserved via the theatre&apos;s own link.
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <span>Direct Cinema Links</span>
                <span className="text-emerald-400">Free Squad RSVPs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bento-card flex flex-col justify-between gap-4 rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-4 md:flex-row md:items-center">
          <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  onStatusFilterChange(filter.id);
                }}
                className={`font-label-caps cursor-pointer whitespace-nowrap rounded-full border px-4 py-2 text-xs transition-all ${
                  statusFilter === filter.id
                    ? 'border-indigo-500 bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/20'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-zinc-500">
              search
            </span>
            <input
              type="text"
              placeholder="Search film, cinema, location…"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
              }}
              className="w-full rounded-full border border-zinc-800 bg-zinc-950/80 py-2 pl-10 pr-4 text-xs text-zinc-100 transition-all placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                }}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <h2 className="font-headline-lg flex items-center gap-2 text-lg text-zinc-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Screening Roster
          </h2>
          <span className="font-label-caps text-xs font-bold text-zinc-500">
            {events.length} Screening{events.length === 1 ? '' : 's'}
          </span>
        </div>

        {/*
          The server refused the search because this member is not verified.
          Presented as the one action that resolves it rather than as an error,
          because it is not a failure — it is the redaction working.
        */}
        {searchRefused && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-lg text-amber-400">lock</span>
              <p className="font-body-md text-xs text-amber-200">
                Searching by cinema or location needs a verified identity.
              </p>
            </div>
            {onNavigateToVerification && (
              <button
                type="button"
                onClick={onNavigateToVerification}
                className="font-label-caps cursor-pointer whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-[11px] font-bold text-amber-200 transition-all hover:bg-amber-500/30"
              >
                Verify Identity
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-body-md text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-body-md text-sm text-zinc-400">Loading screenings…</p>
        ) : events.length === 0 ? (
          <div className="bento-card flex flex-col items-center justify-center gap-3 rounded-[32px] border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-zinc-600">movie_off</span>
            <p className="font-headline-md text-lg text-zinc-200">
              {hasFilters ? 'No Screenings Match' : 'No Screenings Available Yet'}
            </p>
            <p className="font-body-md text-sm text-zinc-400">
              {hasFilters
                ? 'Try adjusting your search or status filter.'
                : 'New screenings appear here as soon as they are announced.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-label-caps mt-2 cursor-pointer text-xs text-indigo-400 hover:underline"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isSaved={savedSet.has(event.id)}
                onToggleBookmark={handleToggleBookmark}
                onSelectEvent={handleSelectEvent}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
