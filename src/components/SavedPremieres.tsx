import React, { useCallback, useMemo } from 'react';
import type { RallyEvent } from '../types';
import { EventCard } from './EventCard';

interface SavedPremieresProps {
  events: RallyEvent[];
  savedEventIds: string[];
  onToggleBookmark: (id: string) => void;
  onSelectEvent: (event: RallyEvent) => void;
  onNavigateToDiscover: () => void;
}

export const SavedPremieres: React.FC<SavedPremieresProps> = ({
  events,
  savedEventIds,
  onToggleBookmark,
  onSelectEvent,
  onNavigateToDiscover,
}) => {
  const savedEvents = useMemo(() => {
    const saved = new Set(savedEventIds);
    return events.filter((event) => saved.has(event.id));
  }, [events, savedEventIds]);

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

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-[#09090b] px-5 pt-20 pb-32 text-zinc-100 md:px-10 md:pt-28">
      <div className="bento-card mb-8 rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          <span className="font-label-caps text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Bookmarked Watchlist
          </span>
        </div>
        <h1 className="font-display-lg mb-2 mt-1 text-3xl text-white md:text-5xl">
          Saved Screenings
        </h1>
        <p className="font-body-md max-w-xl text-sm text-zinc-400">
          Keep track of upcoming screenings you plan to attend.
        </p>
      </div>

      {savedEvents.length === 0 ? (
        <div className="bento-card my-6 flex flex-col items-center justify-center gap-4 rounded-[32px] border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-zinc-600">bookmark_border</span>
          <h3 className="font-headline-lg text-2xl text-white">No Saved Screenings</h3>
          <p className="font-body-md max-w-md text-sm text-zinc-400">
            Tap the bookmark icon on any card in the Discover feed to save it here.
          </p>
          <button
            type="button"
            onClick={onNavigateToDiscover}
            className="btn-primary font-headline-md mt-2 cursor-pointer rounded-full px-7 py-3 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25"
          >
            Explore Screenings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isSaved
              onToggleBookmark={handleToggleBookmark}
              onSelectEvent={handleSelectEvent}
              ctaLabel="Reserve Ticket Pass"
              ctaIcon="local_activity"
            />
          ))}
        </div>
      )}
    </div>
  );
};
