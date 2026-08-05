import React from 'react';
import type { RallyEvent } from '../../types';

interface EventDeleteDialogProps {
  event: RallyEvent;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Names the film and its registration count, because deleting an event
 * cascades its registrations server-side. An admin should not have to guess
 * how many people that affects.
 */
export const EventDeleteDialog: React.FC<EventDeleteDialogProps> = ({
  event,
  busy,
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-event-title"
  >
    <div className="w-full max-w-md rounded-[32px] border border-zinc-800 bg-[#09090b]/95 p-8 shadow-2xl">
      <div className="mb-5 flex items-start gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
          <span className="material-symbols-outlined text-xl">delete_forever</span>
        </span>
        <div>
          <h2 id="delete-event-title" className="font-headline-md text-lg text-white">
            Delete this screening?
          </h2>
          <p className="mt-1 font-body-md text-sm text-zinc-400">
            <span className="font-semibold text-white">{event.movieName}</span>
            {event.cinema ? ` at ${event.cinema}` : ''}.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="font-body-md text-sm text-zinc-300">
          {event.registeredCount === 0 ? (
            <>No one has registered for this screening yet.</>
          ) : (
            <>
              <span className="font-bold text-amber-400">
                {event.registeredCount} registration{event.registeredCount === 1 ? '' : 's'}
              </span>{' '}
              will be deleted with it. This cannot be undone.
            </>
          )}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-full border border-zinc-700 py-3 font-label-caps text-xs font-bold uppercase tracking-wider text-zinc-300 transition-all hover:text-white hover:border-zinc-600 disabled:opacity-40 cursor-pointer"
        >
          Keep It
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="btn-danger flex-1 py-3 font-label-caps text-xs font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);
