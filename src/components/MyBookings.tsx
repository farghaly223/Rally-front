import React from 'react';
import { formatEventDateTime, formatVenue } from '../types';
import type { MemberRegistration } from '../api/client';

interface MyBookingsProps {
  bookings: MemberRegistration[];
  onNavigateToDiscover: () => void;
  /** Keyed by event, matching the endpoint — a member cancels "this screening". */
  onCancelBooking: (eventId: string) => void;
}

/**
 * The member's RSVPs, as the server holds them.
 *
 * Cancelled registrations are returned by the API and filtered out here rather
 * than being hidden server-side: the row has to survive so the unique constraint
 * on (user, event) keeps letting the member re-book, and the server is not in
 * the business of deciding which of a member's own bookings they may look at.
 */
export const MyBookings: React.FC<MyBookingsProps> = ({
  bookings,
  onNavigateToDiscover,
  onCancelBooking,
}) => {
  const active = bookings.filter((booking) => booking.status !== 'CANCELLED');

  return (
  <div className="mx-auto min-h-screen max-w-7xl bg-[#09090b] px-5 pt-20 pb-32 text-zinc-100 md:px-10 md:pt-28">
    <div className="bento-card mb-8 rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <span className="font-label-caps text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          Social Film Squads
        </span>
      </div>
      <h1 className="font-display-lg mb-2 mt-1 text-3xl text-white md:text-5xl">
        My Movie Meetups &amp; RSVPs
      </h1>
      <p className="font-body-md max-w-xl text-sm text-zinc-400">
        Connect with moviegoers going to the same screenings. Join group chats, discuss the film,
        and purchase official cinema tickets.
      </p>
    </div>

    {active.length === 0 ? (
      <div className="bento-card my-6 flex flex-col items-center justify-center gap-4 rounded-[32px] border border-zinc-800 bg-zinc-900/30 p-12 text-center">
        <span className="material-symbols-outlined text-6xl text-zinc-600">groups</span>
        <h3 className="font-headline-lg text-2xl text-white">No Movie Squad RSVPs Yet</h3>
        <p className="font-body-md max-w-md text-sm text-zinc-400">
          Explore active screenings, join a movie squad, and meet fellow cinema enthusiasts.
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {active.map((ticket) => (
          <div
            key={ticket.id}
            className="bento-card flex flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/40 shadow-xl transition-all hover:border-zinc-700 md:flex-row"
          >
            <div className="relative h-48 md:h-auto md:w-2/5">
              {ticket.event.posterUrl ? (
                <img
                  src={ticket.event.posterUrl}
                  alt={ticket.event.movieName}
                  width={320}
                  height={240}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-950">
                  <span className="material-symbols-outlined text-4xl text-zinc-700">movie</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] md:bg-gradient-to-r md:from-transparent md:to-[#09090b]/80" />
            </div>

            <div className="flex flex-col justify-between gap-4 p-6 md:w-3/5">
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <span className="font-label-caps rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    ATTENDING SQUAD
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onCancelBooking(ticket.eventId);
                    }}
                    className="font-label-caps cursor-pointer text-xs text-zinc-500 hover:text-red-400 hover:underline"
                  >
                    Cancel RSVP
                  </button>
                </div>

                <h3 className="font-headline-lg mb-2 text-xl text-white">
                  {ticket.event.movieName}
                </h3>

                <div className="space-y-1.5 text-xs text-zinc-400">
                  <p className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-400">
                      location_on
                    </span>
                    {formatVenue(ticket.event)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-400">
                      schedule
                    </span>
                    {formatEventDateTime(ticket.event.startsAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                <div>
                  <span className="font-label-caps block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Squad RSVP Code
                  </span>
                  {/*
                    The real registration id, not a generated code. The previous
                    `RLY-######` was `Math.random()` — it matched nothing on the
                    server, so an admin could not have looked it up.
                  */}
                  <span className="font-label-caps text-xs font-bold uppercase text-indigo-400">
                    {ticket.id.slice(0, 8)}
                  </span>
                </div>
                <span className="material-symbols-outlined text-xl text-zinc-400">badge</span>
              </div>

              <div className="flex flex-col gap-2">
                {ticket.event.bookingUrl && (
                  <a
                    href={ticket.event.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-label-caps flex w-full items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:bg-zinc-700"
                  >
                    <span>Buy Official Cinema Ticket</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </a>
                )}

                {ticket.event.whatsappInviteLink && (
                  <a
                    href={ticket.event.whatsappInviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-label-caps flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20"
                  >
                    <span className="material-symbols-outlined text-sm">forum</span>
                    Join Attendees WhatsApp Chat
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
    </div>
  );
};
