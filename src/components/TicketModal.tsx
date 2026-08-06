import React, { useState } from 'react';
import { formatEventDateTime, formatVenue, type RallyEvent } from '../types';
import { APIError, type MemberRegistration } from '../api/client';

interface TicketModalProps {
  event: RallyEvent;
  onClose: () => void;
  /**
   * Books the seat, server-side.
   *
   * Async and rejectable: capacity is decided in a locked transaction on the
   * server, so "this screening is full" can only be known by asking. The modal
   * renders whatever refusal comes back rather than pre-judging from
   * `registeredCount`, which is a snapshot that may already be stale.
   */
  onConfirmBooking: (event: RallyEvent) => Promise<MemberRegistration>;
  onNavigateToBookings: () => void;
  /**
   * The server withheld this event's venue and timing.
   *
   * Passed in as an observation about the payload rather than as a claim about
   * the viewer. The modal does not ask "is this user verified?" — it asks "did
   * the server give me a venue?", which is the only question it can answer
   * honestly, and which stays correct if the policy ever changes.
   */
  detailLocked?: boolean;
  onRequireVerification?: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  event,
  onClose,
  onConfirmBooking,
  onNavigateToBookings,
  detailLocked = false,
  onRequireVerification,
}) => {
  const [issuedTicket, setIssuedTicket] = useState<MemberRegistration | null>(null);
  const [activeTab, setActiveTab] = useState<'rsvp' | 'chat'>('rsvp');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaimPass = (): void => {
    if (detailLocked && onRequireVerification) {
      onRequireVerification();
      return;
    }

    setClaimError(null);
    setClaiming(true);

    void (async () => {
      try {
        setIssuedTicket(await onConfirmBooking(event));
      } catch (err) {
        // The server's own wording: "This screening is full", "Registration has
        // closed". Each tells the member something different about what to do
        // next, so none of them is worth flattening into a generic failure.
        setClaimError(
          err instanceof APIError ? err.message : 'Could not complete your RSVP. Try again.',
        );
      } finally {
        setClaiming(false);
      }
    })();
  };

  const isFull = event.registeredCount >= event.capacity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="bento-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-zinc-800 bg-[#09090b]/95 shadow-2xl">
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Hero */}
        <div className="relative h-44 flex-shrink-0">
          {event.posterUrl ? (
            <img
              src={event.posterUrl}
              alt={event.movieName}
              width={640}
              height={176}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-950">
              <span className="material-symbols-outlined text-5xl text-zinc-700">movie</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent" />
          <div className="absolute bottom-3 left-6 right-6 flex items-end justify-between">
            <div>
              <span className="font-label-caps mb-1 inline-block rounded-full border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-300 backdrop-blur-md">
                {event.status}
              </span>
              <h3 className="font-headline-lg text-2xl text-white drop-shadow-md">
                {event.movieName}
              </h3>
            </div>
            <div className="text-right">
              <span
                className={`font-label-caps block text-xs font-bold ${
                  isFull ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {event.registeredCount} / {event.capacity} Attending
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-y border-indigo-500/20 bg-indigo-950/40 px-6 py-2.5 text-xs text-indigo-200">
          <span className="material-symbols-outlined flex-shrink-0 text-base text-indigo-400">
            info
          </span>
          <p className="leading-snug">
            <strong>Rally is a social meetup platform.</strong> We connect moviegoers so you
            don&apos;t watch alone. Buy official tickets directly from the cinema link below.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50 px-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('rsvp');
            }}
            className={`font-label-caps flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'rsvp'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">groups</span>
            Meetup &amp; RSVP
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
            }}
            className={`font-label-caps flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'chat'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">forum</span>
            Film Discussion
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {activeTab === 'rsvp' ? (
            !issuedTicket ? (
              <div className="flex flex-col gap-5">
                <div className="font-body-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs">
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="font-label-caps flex items-center gap-1.5 font-bold uppercase text-zinc-400">
                      <span
                        className={`material-symbols-outlined text-sm ${
                          detailLocked ? 'text-amber-400' : 'text-indigo-400'
                        }`}
                      >
                        {detailLocked ? 'lock' : 'location_on'}
                      </span>
                      Cinema Venue
                    </span>
                    <span
                      className={`text-right font-semibold ${
                        detailLocked ? 'text-amber-400/90' : 'text-white'
                      }`}
                    >
                      {formatVenue(event)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="font-label-caps flex items-center gap-1.5 font-bold uppercase text-zinc-400">
                      <span
                        className={`material-symbols-outlined text-sm ${
                          detailLocked ? 'text-amber-400' : 'text-indigo-400'
                        }`}
                      >
                        {detailLocked ? 'lock' : 'schedule'}
                      </span>
                      Date &amp; Time
                    </span>
                    <span
                      className={`font-semibold ${
                        detailLocked ? 'text-amber-400/90' : 'text-white'
                      }`}
                    >
                      {formatEventDateTime(event.startsAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="font-label-caps flex items-center gap-1.5 font-bold uppercase text-zinc-400">
                      <span className="material-symbols-outlined text-sm text-emerald-400">
                        group
                      </span>
                      Rally Squad Attending
                    </span>
                    <span className="font-label-caps font-bold text-emerald-400">
                      {event.registeredCount} / {event.capacity}
                    </span>
                  </div>
                  {event.googleMapsUrl && (
                    <div className="flex items-center justify-between text-zinc-200">
                      <span className="font-label-caps flex items-center gap-1.5 font-bold uppercase text-zinc-400">
                        <span className="material-symbols-outlined text-sm text-indigo-400">
                          map
                        </span>
                        Directions
                      </span>
                      <a
                        href={event.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-indigo-400 hover:underline"
                      >
                        Open in Maps
                      </a>
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="font-body-md text-xs leading-relaxed text-zinc-400">
                    {event.description}
                  </p>
                )}

                {/* Step 1 — official ticket. Only rendered when one exists. */}
                {event.bookingUrl && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        Step 1. Get Official Cinema Ticket
                      </span>
                      <span className="text-[10px] text-zinc-500">Opens external booking</span>
                    </div>
                    <a
                      href={event.bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-label-caps flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-xs font-bold uppercase tracking-wider text-zinc-100 shadow-md transition-all hover:bg-zinc-700"
                    >
                      <span>Reserve on the Cinema Website</span>
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <span className="font-label-caps flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {event.bookingUrl ? 'Step 2. ' : ''}RSVP on Rally to Join the Squad
                  </span>

                  {detailLocked && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <span className="material-symbols-outlined text-lg text-amber-400">
                        lock
                      </span>
                      <p className="text-xs text-amber-300">
                        Verify your identity to see the venue and showtime, and to RSVP.
                      </p>
                    </div>
                  )}

                  {/*
                    The server's own words. A 409 here is real information the
                    member needs — "This screening is full" means the last seat
                    went to someone else between opening this modal and pressing
                    the button, and the stale count above it does not say that.
                  */}
                  {claimError && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                      <span className="material-symbols-outlined text-lg text-red-400">
                        error
                      </span>
                      <p className="text-xs text-red-300">{claimError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleClaimPass}
                    disabled={claiming || (!detailLocked && (event.status !== 'OPEN' || isFull))}
                    className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      {claiming
                        ? 'Reserving Your Seat…'
                        : detailLocked
                          ? 'Verify Identity to Unlock'
                          : event.status !== 'OPEN'
                            ? 'Registration Closed'
                            : isFull
                              ? 'Screening Full'
                              : "RSVP — I'm Attending"}
                    </span>
                    <span className="material-symbols-outlined text-lg">
                      {claiming ? 'hourglass_top' : detailLocked ? 'lock_open' : 'check_circle'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/20 text-emerald-400">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>

                <div>
                  <span className="font-label-caps block text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Movie Squad RSVP Confirmed
                  </span>
                  <h3 className="font-headline-lg mt-1 text-2xl text-white">
                    You&apos;re Attending This Screening
                  </h3>
                  <p className="font-body-md mt-1 max-w-md text-xs text-zinc-400">
                    You are now listed in the Rally squad for {issuedTicket.event.movieName}.
                  </p>
                </div>

                <div className="font-label-caps w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Squad RSVP Code
                  </span>
                  {/*
                    The registration's real id, matching MyBookings. The old
                    `RLY-######` was `Math.random()` and matched nothing on the
                    server, so an admin could not have looked it up.
                  */}
                  <span className="text-sm font-bold tracking-widest text-indigo-400">
                    {issuedTicket.id.slice(0, 8)}
                  </span>
                </div>

                <div className="flex w-full flex-col gap-2.5">
                  {event.bookingUrl && (
                    <a
                      href={event.bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-label-caps flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-200 hover:bg-zinc-700"
                    >
                      <span>Buy Official Ticket on Cinema Site</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}

                  {issuedTicket.event.whatsappInviteLink && (
                    <a
                      href={issuedTicket.event.whatsappInviteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-headline-md flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20"
                    >
                      <span className="material-symbols-outlined text-base">forum</span>
                      Join Attendees WhatsApp Group
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToBookings();
                    }}
                    className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25"
                  >
                    <span>View My Squad RSVPs</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Discussion happens in the WhatsApp group, not here. */
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="material-symbols-outlined text-5xl text-zinc-600">forum</span>
              <p className="font-body-md text-sm text-zinc-300">
                No discussion has started yet.
              </p>

              {event.whatsappInviteLink && (
                <a
                  href={event.whatsappInviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-headline-md flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20"
                >
                  <span className="material-symbols-outlined text-base">forum</span>
                  Join the WhatsApp Group
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketModal;
