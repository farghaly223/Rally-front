export type Gender = 'MALE' | 'FEMALE';
export type EventStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

/**
 * Mirrors the backend's Event model exactly.
 *
 * Timestamps are ISO strings — the server's representation — and are parsed at
 * the point of display. The previous freeform `date`/`time` strings ('Oct 24',
 * 'Tonight') could not be sorted or compared.
 *
 * `gender` is informational for admins only: member-facing lists are already
 * scoped server-side, so the client never filters on it.
 *
 * The nine fields typed `| null` are the ones the server withholds from a
 * member it has not cleared (see `isDetailLocked`). They arrive as `null`, never
 * absent — the response shape is identical either way — so the client cannot
 * infer anything from a key's presence, and TypeScript forces every render site
 * to handle the locked case rather than printing "null" into the DOM.
 */
export interface RallyEvent {
  id: string;
  movieName: string;
  cinema: string | null;
  location: string | null;
  googleMapsUrl?: string | null;
  startsAt: string | null;
  endsAt?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  capacity: number;
  registeredCount: number;
  whatsappInviteLink?: string | null;
  gender: Gender;
  status: EventStatus;
  description?: string | null;
  bookingUrl?: string | null;
  posterUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Whether the server withheld this event's venue and timing.
 *
 * Derived from the payload, never from the viewer. The rule that decides who
 * may see a venue — male members always, female members only once approved —
 * lives in `src/domain/event-visibility.policy.ts` on the backend and is
 * deliberately not reimplemented here: a client-side copy would be a second
 * source of truth that could disagree with the first, and the disagreement
 * would be invisible until it mattered.
 *
 * `startsAt` is the sentinel because it is the one restricted field that is
 * non-optional on an unredacted event, so `null` can only mean redaction.
 */
export function isDetailLocked(event: Pick<RallyEvent, 'startsAt'>): boolean {
  return event.startsAt === null;
}

/**
 * Mirrors the backend's authenticated user.
 *
 * Deliberately has no selfieUrl / idDocumentUrl: identity photos are never
 * addressable by a client. They are proxied to admins only, behind a password
 * re-entry, and hard-deleted once a decision is made.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  username: string;
  gender: Gender;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'DELETED';
}

/**
 * A local record of an RSVP.
 *
 * Still client-side: a real registration needs a row-locked capacity
 * transaction on the server, which is Phase 5.
 */
export interface TicketBooking {
  id: string;
  eventId: string;
  eventTitle: string;
  cinema: string | null;
  location: string | null;
  startsAt: string | null;
  posterUrl?: string | null;
  bookingCode: string;
  bookedAt: string;
  whatsappInviteLink?: string | null;
  bookingUrl?: string | null;
}

export type ActiveTab =
  | 'discover'
  | 'join-premiere'
  | 'verification'
  | 'bookings'
  | 'saved'
  | 'profile';

/** Verification is a server-side decision, not a client-held flag. */
export function isVerified(user: Pick<UserProfile, 'approvalStatus'>): boolean {
  return user.approvalStatus === 'APPROVED';
}

export function isAdmin(user: Pick<UserProfile, 'role'>): boolean {
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
}

/**
 * Shown wherever a restricted field was withheld.
 *
 * Distinct from the '—' used for genuinely absent data: "Locked" tells a member
 * the information exists and verifying will reveal it, which is the whole point
 * of showing her the event at all.
 */
export const LOCKED_PLACEHOLDER = 'Locked';

/** 'Fri, 24 Oct · 21:00' — one place, so every view formats identically. */
export function formatEventDateTime(iso: string | null | undefined): string {
  if (!iso) return LOCKED_PLACEHOLDER;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return LOCKED_PLACEHOLDER;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return LOCKED_PLACEHOLDER;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** 'Grand Cinema, Cairo' — or the locked placeholder when either half is withheld. */
export function formatVenue(
  event: Pick<RallyEvent, 'cinema' | 'location'>,
): string {
  const parts = [event.cinema, event.location].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.length > 0 ? parts.join(', ') : LOCKED_PLACEHOLDER;
}
