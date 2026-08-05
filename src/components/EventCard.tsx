import React from 'react';
import {
  formatEventDate,
  formatEventTime,
  formatVenue,
  isDetailLocked,
  type RallyEvent,
} from '../types';

interface EventCardProps {
  event: RallyEvent;
  isSaved: boolean;
  onToggleBookmark: (id: string) => void;
  onSelectEvent: (event: RallyEvent) => void;
  ctaLabel?: string;
  ctaIcon?: string;
}

const statusBadge: Record<RallyEvent['status'], { label: string; className: string }> = {
  OPEN: {
    label: 'Open',
    className: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-zinc-900/80 border-zinc-700/80 text-zinc-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-500/20 border-red-500/40 text-red-300',
  },
};

/**
 * Memoized: the search box lives in a parent, so without this every card
 * re-rendered on every keystroke. The handlers passed in must be stable
 * (`useCallback`) for the memo to hold.
 */
const EventCardBase: React.FC<EventCardProps> = ({
  event,
  isSaved,
  onToggleBookmark,
  onSelectEvent,
  ctaLabel = 'Join Squad & RSVP',
  ctaIcon = 'groups',
}) => {
  const badge = statusBadge[event.status];
  const isFull = event.registeredCount >= event.capacity;

  // Read off the payload, not off the viewer. The server decides; the card only
  // reports what it was given.
  const locked = isDetailLocked(event);

  return (
    <article className="bento-card group relative flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/40 shadow-xl transition-all duration-300 hover:-translate-y-1">
      {event.posterUrl ? (
        <img
          src={event.posterUrl}
          alt={event.movieName}
          width={480}
          height={640}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-950">
          <span className="material-symbols-outlined text-6xl text-zinc-700">movie</span>
        </div>
      )}

      <div className="glass-gradient-bottom pointer-events-none absolute inset-0 z-10" />

      <div className="relative z-20 flex flex-col gap-3.5 p-6">
        <div className="flex items-start justify-between">
          <span
            className={`font-label-caps rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase backdrop-blur-md ${badge.className}`}
          >
            {badge.label}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(event.id);
            }}
            className={`cursor-pointer rounded-full border p-2 backdrop-blur-md transition-all ${
              isSaved
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white'
            }`}
            title={isSaved ? 'Remove Bookmark' : 'Bookmark Event'}
          >
            <span
              className="material-symbols-outlined block text-lg"
              style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
            >
              bookmark
            </span>
          </button>
        </div>

        <div>
          <h3 className="font-headline-lg mb-1 text-2xl text-white shadow-black drop-shadow-md">
            {event.movieName}
          </h3>
          <p className="font-body-md mb-3 flex items-center gap-1.5 text-xs text-zinc-300">
            <span
              className={`material-symbols-outlined text-sm ${
                locked ? 'text-amber-400' : 'text-indigo-400'
              }`}
            >
              {locked ? 'lock' : 'location_on'}
            </span>
            {locked ? 'Venue revealed after verification' : formatVenue(event)}
          </p>

          <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-3 text-xs backdrop-blur-sm">
            <div className="flex gap-3">
              <div className="flex flex-col">
                <span className="font-label-caps text-[9px] font-bold uppercase text-zinc-500">
                  Date
                </span>
                <span
                  className={`font-body-md font-medium ${
                    locked ? 'text-amber-400/80' : 'text-zinc-200'
                  }`}
                >
                  {formatEventDate(event.startsAt)}
                </span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="font-label-caps text-[9px] font-bold uppercase text-zinc-500">
                  Time
                </span>
                <span
                  className={`font-body-md font-medium ${
                    locked ? 'text-amber-400/80' : 'text-zinc-200'
                  }`}
                >
                  {formatEventTime(event.startsAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-label-caps text-[9px] font-bold uppercase text-zinc-500">
                Attending
              </span>
              <span
                className={`font-body-md text-xs font-bold ${
                  isFull ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {event.registeredCount} / {event.capacity}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectEvent(event);
          }}
          className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 py-3 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20"
        >
          <span>{locked ? 'Verify to Unlock Details' : ctaLabel}</span>
          <span className="material-symbols-outlined text-base">
            {locked ? 'lock_open' : ctaIcon}
          </span>
        </button>
      </div>
    </article>
  );
};

export const EventCard = React.memo(EventCardBase);
