import { supabase } from '../lib/supabase';
import type {
  ApprovalStatus,
  Gender,
  Role,
  VerificationContact,
  VerificationPlatform,
} from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface FetchOptions extends RequestInit {
  /**
   * Internal. Marks a call that is already a retry so a refusal cannot bounce
   * between refresh and re-request forever.
   */
  retried?: boolean;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(
  response: Response,
): Promise<{ message: string; code?: string }> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  };
  return {
    message: body.error?.message ?? 'Request failed',
    code: body.error?.code,
  };
}

/**
 * Every request to our backend, with the Supabase access token attached.
 *
 * Two recoverable refusals are retried exactly once each, and only once:
 *
 *  - **401** — the token expired. Supabase refreshes it; a failed refresh means
 *    the session is genuinely dead and the error propagates rather than looping.
 *  - **409 PROFILE_INCOMPLETE** — signup created the auth identity but the
 *    profile call did not land. Recreating the profile is idempotent server-
 *    side, so retrying is safe and turns a permanently broken shell into a
 *    self-healing one on the next page load.
 *
 * `retried` guards both: a retry that fails the same way surfaces the error.
 */
async function fetchAPI(path: string, init: FetchOptions = {}): Promise<Response> {
  const { retried = false, headers, ...rest } = init;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(headers as Record<string, string> | undefined),
      ...(await authHeader()),
    },
  });

  if (response.ok) return response;

  const { message, code } = await readError(response);

  if (!retried) {
    if (response.status === 401) {
      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        return fetchAPI(path, { ...init, retried: true });
      }
    }

    // Re-running complete-profile would recurse into this same branch, so it is
    // excluded by path rather than relying on the flag alone.
    if (
      response.status === 409 &&
      code === 'PROFILE_INCOMPLETE' &&
      path !== COMPLETE_PROFILE_PATH
    ) {
      await api.auth.completeProfile();
      return fetchAPI(path, { ...init, retried: true });
    }
  }

  throw new APIError(message, response.status, code);
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── Types mirroring the backend contract ─────────────────

export type { ApprovalStatus, Gender, Role, VerificationContact, VerificationPlatform };

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  gender: Gender;
  username: string | null;
  email: string | null;
  role: Role;
  approvalStatus: ApprovalStatus;
  approvalDate: string | null;
  createdAt: string;
}

/**
 * What `complete-profile` and `me` return.
 *
 * `verificationContact` is `null` for anyone the server does not consider owed
 * one — males, and females already approved. The client renders whichever it
 * gets and never derives who qualifies.
 */
export interface ProfileResponse {
  user: AuthUser;
  verificationContact: VerificationContact | null;
}

export interface PendingUser {
  id: string;
  fullName: string;
  phone: string;
  gender: Gender;
  createdAt: string;
}

export type EventStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

/**
 * An event as the server sends it.
 *
 * The nullable fields are the ones the backend redacts for a member it has not
 * cleared — venue, timing, directions, booking and group links. They are sent as
 * `null` rather than omitted so the shape never varies, and they are typed that
 * way here so a redacted event cannot be rendered as though it were complete.
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

export interface EventListResponse {
  events: RallyEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: EventStatus;
}

/**
 * Every writable event field. `undefined` means "not supplied"; the serializer
 * omits it so a partial update never clears a column by accident.
 */
export interface EventInput {
  movieName?: string;
  cinema?: string;
  location?: string;
  googleMapsUrl?: string;
  startsAt?: string;
  endsAt?: string;
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  capacity?: number;
  whatsappInviteLink?: string;
  gender?: Gender;
  status?: EventStatus;
  description?: string;
  bookingUrl?: string;
}

export interface DashboardStats {
  totalUsers: number;
  pendingApprovals: number;
  totalEvents: number;
  openEvents: number;
  totalRegistrations: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  phone: string;
  gender: Gender;
  role: Role;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

/** The two roles the API will mint. `SUPER_ADMIN` is rejected server-side. */
export type CreatableAdminRole = 'EVENTS_ADMIN' | 'VERIFICATION_ADMIN';

export interface AdminInput {
  phone: string;
  fullName: string;
  role: CreatableAdminRole;
}

export interface AdminPatch {
  role?: CreatableAdminRole;
  approvalStatus?: Extract<ApprovalStatus, 'APPROVED' | 'SUSPENDED'>;
}

export interface RegistrationRow {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
  status?: string;
  user?: { fullName: string; phone: string } | null;
  event?: { movieName: string; startsAt: string } | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actorId?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: { fullName: string; phone: string } | null;
}

const COMPLETE_PROFILE_PATH = '/auth/complete-profile';

/** Drops undefined/empty values so `?page=1&search=` never sends dead keys. */
function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

/**
 * Builds the request body for a create/update.
 *
 * With a poster this must be multipart, and the Content-Type header is
 * deliberately omitted so the browser can generate the boundary. Without one,
 * JSON is cheaper and keeps types intact server-side.
 */
function eventBody(
  input: EventInput,
  poster: File | null,
): { body: BodyInit; headers?: Record<string, string> } {
  if (poster) {
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      form.append(key, String(value));
    }
    form.append('poster', poster);
    return { body: form };
  }

  return {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
  };
}

function jsonBody(value: unknown): { body: string; headers: Record<string, string> } {
  return {
    body: JSON.stringify(value),
    headers: { 'Content-Type': 'application/json' },
  };
}

export const api = {
  /**
   * Profile endpoints only.
   *
   * There is no register or login here, and there must never be: Supabase owns
   * credentials, so a password reaching our own backend would mean the boundary
   * had been broken. See `src/lib/supabase.ts`.
   */
  auth: {
    /**
     * Creates the Prisma profile for the current Supabase identity.
     *
     * Idempotent server-side, which is what makes retrying it safe after a
     * signup that got as far as creating the auth user and no further.
     */
    async completeProfile(): Promise<ProfileResponse> {
      return unwrap<ProfileResponse>(
        await fetchAPI(COMPLETE_PROFILE_PATH, { method: 'POST' }),
      );
    },

    async me(): Promise<ProfileResponse> {
      return unwrap<ProfileResponse>(await fetchAPI('/auth/me'));
    },

    async verificationContact(): Promise<VerificationContact | null> {
      return unwrap<VerificationContact | null>(
        await fetchAPI('/auth/verification-contact'),
      );
    },
  },

  /**
   * Member-facing events.
   *
   * There is no gender parameter, by design: the server scopes every response
   * to the caller's own gender. An opposite-gender event is absent from the
   * payload, not merely hidden, so there is nothing here for a client to widen.
   *
   * `search` is sent to the server rather than applied locally. Filtering here
   * would be worse than useless: the fields worth searching (cinema, location)
   * are exactly the ones redacted for an uncleared member, so a local filter
   * would silently never match — and a client that *did* hold the venue could
   * binary-search it a character at a time. The server answers 403
   * (`code: 'FORBIDDEN'`) when an uncleared member searches; callers surface
   * that as a prompt to verify.
   */
  events: {
    async list(query: EventListQuery = {}): Promise<EventListResponse> {
      const qs = queryString({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        status: query.status,
      });
      return unwrap<EventListResponse>(await fetchAPI(`/events${qs}`));
    },

    async get(id: string): Promise<RallyEvent> {
      return unwrap<RallyEvent>(await fetchAPI(`/events/${id}`));
    },
  },

  admin: {
    /** Admin event CRUD. Unlike `api.events`, this is not gender-scoped. */
    events: {
      async list(query: PageQuery = {}): Promise<EventListResponse> {
        const qs = queryString({ page: query.page, pageSize: query.pageSize });
        return unwrap<EventListResponse>(await fetchAPI(`/admin/events${qs}`));
      },

      async create(input: EventInput, poster: File | null = null): Promise<RallyEvent> {
        const { body, headers } = eventBody(input, poster);
        return unwrap<RallyEvent>(
          await fetchAPI('/admin/events', { method: 'POST', body, headers }),
        );
      },

      async update(
        id: string,
        input: EventInput,
        poster: File | null = null,
      ): Promise<RallyEvent> {
        const { body, headers } = eventBody(input, poster);
        return unwrap<RallyEvent>(
          await fetchAPI(`/admin/events/${id}`, { method: 'PATCH', body, headers }),
        );
      },

      async remove(id: string): Promise<{ deleted: boolean }> {
        return unwrap<{ deleted: boolean }>(
          await fetchAPI(`/admin/events/${id}`, { method: 'DELETE' }),
        );
      },
    },

    /**
     * Member verification.
     *
     * Approve and reject carry no evidence and no documents: the decision was
     * already made off-platform, between the member and the verifying admin's
     * social account. This records the outcome, nothing more.
     */
    verification: {
      async listPending(query: PageQuery = {}): Promise<Paginated<PendingUser>> {
        const qs = queryString({ page: query.page, pageSize: query.pageSize });
        return unwrap<Paginated<PendingUser>>(await fetchAPI(`/admin/users/pending${qs}`));
      },

      async approve(userId: string): Promise<{ approvalStatus: ApprovalStatus }> {
        return unwrap<{ approvalStatus: ApprovalStatus }>(
          await fetchAPI(`/admin/users/${userId}/approve`, { method: 'POST' }),
        );
      },

      async reject(userId: string): Promise<{ approvalStatus: ApprovalStatus }> {
        return unwrap<{ approvalStatus: ApprovalStatus }>(
          await fetchAPI(`/admin/users/${userId}/reject`, { method: 'POST' }),
        );
      },

      async getContact(): Promise<VerificationContact | null> {
        return unwrap<VerificationContact | null>(
          await fetchAPI('/admin/verification-contact'),
        );
      },

      async updateContact(contact: VerificationContact): Promise<VerificationContact> {
        const { body, headers } = jsonBody(contact);
        return unwrap<VerificationContact>(
          await fetchAPI('/admin/verification-contact', { method: 'PUT', body, headers }),
        );
      },
    },

    /**
     * Admin account management — SUPER_ADMIN only.
     *
     * `SUPER_ADMIN` is absent from `CreatableAdminRole` because the API rejects
     * it: "exactly one account, ever" cannot hold if the endpoint can mint more.
     * Every write here can also come back 409 `LAST_SUPER_ADMIN`, whose message
     * callers show verbatim.
     */
    admins: {
      async list(query: PageQuery = {}): Promise<Paginated<AdminUserRow>> {
        const qs = queryString({ page: query.page, pageSize: query.pageSize });
        return unwrap<Paginated<AdminUserRow>>(await fetchAPI(`/admin/admins${qs}`));
      },

      async create(input: AdminInput): Promise<AdminUserRow> {
        const { body, headers } = jsonBody(input);
        return unwrap<AdminUserRow>(
          await fetchAPI('/admin/admins', { method: 'POST', body, headers }),
        );
      },

      async update(id: string, patch: AdminPatch): Promise<AdminUserRow> {
        const { body, headers } = jsonBody(patch);
        return unwrap<AdminUserRow>(
          await fetchAPI(`/admin/admins/${id}`, { method: 'PATCH', body, headers }),
        );
      },

      async revoke(id: string): Promise<AdminUserRow> {
        return unwrap<AdminUserRow>(
          await fetchAPI(`/admin/admins/${id}`, { method: 'DELETE' }),
        );
      },
    },

    async dashboardStats(): Promise<DashboardStats> {
      return unwrap<DashboardStats>(await fetchAPI('/admin/dashboard/stats'));
    },

    async listUsers(query: PageQuery = {}): Promise<Paginated<AdminUserRow>> {
      const qs = queryString({ page: query.page, pageSize: query.pageSize });
      return unwrap<Paginated<AdminUserRow>>(await fetchAPI(`/admin/users${qs}`));
    },

    async listRegistrations(query: PageQuery = {}): Promise<Paginated<RegistrationRow>> {
      const qs = queryString({ page: query.page, pageSize: query.pageSize });
      return unwrap<Paginated<RegistrationRow>>(await fetchAPI(`/admin/registrations${qs}`));
    },

    async listAuditLogs(query: PageQuery = {}): Promise<Paginated<AuditLogRow>> {
      const qs = queryString({ page: query.page, pageSize: query.pageSize });
      return unwrap<Paginated<AuditLogRow>>(await fetchAPI(`/admin/audit-logs${qs}`));
    },
  },
};
