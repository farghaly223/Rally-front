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
 * What an account may do, independent of whether it may act at all.
 *
 * Approving a member changes `approvalStatus` and leaves `role` untouched, so a
 * suspended admin keeps its role and is refused on status alone.
 */
export type Role = 'USER' | 'EVENTS_ADMIN' | 'VERIFICATION_ADMIN' | 'SUPER_ADMIN';

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DELETED';

/**
 * Mirrors the backend's authenticated user.
 *
 * No identity-document fields of any kind: verification happens off-platform
 * between the member and a real person, and no image is ever uploaded to Rally
 * for that purpose.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  username: string;
  gender: Gender;
  role: Role;
  approvalStatus: ApprovalStatus;
}

/** Platforms the verifying account can live on. */
export type VerificationPlatform = 'INSTAGRAM' | 'TELEGRAM' | 'TIKTOK';

/**
 * Who a pending member messages to get verified.
 *
 * Always read from the API and never hardcoded, so the verifying account can be
 * rotated without a deploy. `null` for males and for approved females — the
 * server decides who is owed one.
 */
export interface VerificationContact {
  platform: VerificationPlatform;
  handleOrUrl: string;
}

export type ActiveTab =
  | 'discover'
  | 'join-premiere'
  | 'verification'
  | 'bookings'
  | 'saved'
  | 'profile';

/**
 * Where to send someone who wants to act on a `verificationContact`.
 *
 * Instagram and TikTok handles resolve to a profile URL; Telegram handles do
 * too. Anything already absolute is passed through untouched. Returns `null`
 * when no link can be formed, so the caller renders plain text rather than a
 * dead anchor.
 */
export function verificationContactUrl(contact: VerificationContact): string | null {
  const raw = contact.handleOrUrl.trim();
  if (raw === '') return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const handle = raw.replace(/^@/, '');
  if (handle === '') return null;

  switch (contact.platform) {
    case 'INSTAGRAM':
      return `https://instagram.com/${handle}`;
    case 'TELEGRAM':
      return `https://t.me/${handle}`;
    case 'TIKTOK':
      return `https://tiktok.com/@${handle}`;
  }
}

export const VERIFICATION_PLATFORM_LABEL: Record<VerificationPlatform, string> = {
  INSTAGRAM: 'Instagram',
  TELEGRAM: 'Telegram',
  TIKTOK: 'TikTok',
};

/** Verification is a server-side decision, not a client-held flag. */
export function isVerified(user: Pick<UserProfile, 'approvalStatus'>): boolean {
  return user.approvalStatus === 'APPROVED';
}

/** Any non-member role gets the admin surface instead of the member one. */
export function isAdmin(user: Pick<UserProfile, 'role'>): boolean {
  return user.role !== 'USER';
}

/**
 * Which admin sections to *offer* a role.
 *
 * Presentation only. The backend answers 403 on every route regardless of what
 * is rendered here, and those refusals are surfaced rather than pre-empted —
 * this exists so an Events Admin is not shown a Pending Members tab that can
 * only ever fail, not to enforce anything.
 */
export function canManageEvents(role: Role): boolean {
  return role === 'EVENTS_ADMIN' || role === 'SUPER_ADMIN';
}

export function canVerifyMembers(role: Role): boolean {
  return role === 'VERIFICATION_ADMIN' || role === 'SUPER_ADMIN';
}

export function canManageAdmins(role: Role): boolean {
  return role === 'SUPER_ADMIN';
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
