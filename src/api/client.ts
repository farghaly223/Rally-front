export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

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

/** In-memory only. localStorage is readable by any XSS payload. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

interface FetchOptions extends RequestInit {
  elevationToken?: string;
}

/**
 * Wraps fetch with credentials (so the HttpOnly refresh cookie is sent) and a
 * single automatic refresh-and-retry on 401.
 */
async function fetchAPI(path: string, init: FetchOptions = {}): Promise<Response> {
  const { elevationToken, headers, ...rest } = init;

  const build = (): Record<string, string> => {
    const merged: Record<string, string> = {
      ...(headers as Record<string, string> | undefined),
      ...authHeaders(),
    };
    if (elevationToken) {
      merged['X-Review-Elevation'] = elevationToken;
    }
    return merged;
  };

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: build(),
  });

  // One refresh attempt, then give up — avoids an infinite loop when the
  // refresh token itself is dead.
  if (response.status === 401 && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        credentials: 'include',
        headers: build(),
      });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    throw new APIError(
      body.error?.message ?? 'Request failed',
      response.status,
      body.error?.code,
    );
  }

  return response;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const json = (await res.json()) as { data: { accessToken: string } };
    setAccessToken(json.data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── Types mirroring the backend contract ─────────────────

export type Gender = 'MALE' | 'FEMALE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'DELETED';
export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  gender: Gender;
  role: Role;
  approvalStatus: ApprovalStatus;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

/** Note: no image URLs. The backend never sends any. */
export interface PendingUser {
  id: string;
  fullName: string;
  phone: string;
  gender: Gender;
  createdAt: string;
  hasSelfie: boolean;
  hasNationalId: boolean;
}

export interface DecisionResult {
  status: ApprovalStatus;
  assetsDeleted: number;
  assetsPending: number;
  elevationConsumed: boolean;
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

export interface RegistrationRow {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
  status?: string;
  user?: { fullName: string; phone: string } | null;
  event?: { movieName: string; startsAt: string } | null;
}

export interface LoginHistoryRow {
  id: string;
  userId?: string | null;
  phone?: string | null;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { fullName: string; phone: string } | null;
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

export const api = {
  auth: {
    async register(input: {
      phone: string;
      password: string;
      fullName: string;
      gender: Gender;
    }): Promise<AuthResponse> {
      const res = await fetchAPI('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await unwrap<AuthResponse>(res);
      setAccessToken(data.accessToken);
      return data;
    },

    async login(input: { phone: string; password: string }): Promise<AuthResponse> {
      const res = await fetchAPI('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await unwrap<AuthResponse>(res);
      setAccessToken(data.accessToken);
      return data;
    },

    async me(): Promise<AuthUser> {
      return unwrap<AuthUser>(await fetchAPI('/auth/me'));
    },

    async logout(): Promise<void> {
      await fetchAPI('/auth/logout', { method: 'POST' }).catch(() => undefined);
      setAccessToken(null);
    },
  },

  identity: {
    async upload(selfie: File, nationalId: File): Promise<{ uploaded: string[] }> {
      const form = new FormData();
      form.append('selfie', selfie);
      form.append('nationalId', nationalId);

      // No Content-Type header: the browser must set the multipart boundary.
      const res = await fetchAPI('/uploads/identity', { method: 'POST', body: form });
      return unwrap<{ uploaded: string[] }>(res);
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
    async listPending(): Promise<PendingUser[]> {
      return unwrap<PendingUser[]>(await fetchAPI('/admin/users/pending'));
    },

    /** Exchanges the admin's password for an elevation scoped to one user. */
    async elevate(
      targetUserId: string,
      password: string,
    ): Promise<{ elevationToken: string; expiresAt: string }> {
      const res = await fetchAPI(`/admin/users/${targetUserId}/elevate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return unwrap<{ elevationToken: string; expiresAt: string }>(res);
    },

    /**
     * Fetches an identity image as a blob URL.
     *
     * The elevation token goes in a header, never a query string — query
     * params leak into browser history and server access logs. The returned
     * blob: URL is local to this document and must be revoked after use.
     */
    async fetchIdentityImage(
      targetUserId: string,
      kind: 'selfie' | 'national-id',
      elevationToken: string,
    ): Promise<string> {
      const res = await fetchAPI(`/admin/users/${targetUserId}/identity/${kind}`, {
        elevationToken,
      });
      return URL.createObjectURL(await res.blob());
    },

    async approve(targetUserId: string, elevationToken: string): Promise<DecisionResult> {
      const res = await fetchAPI(`/admin/users/${targetUserId}/approve`, {
        method: 'POST',
        elevationToken,
      });
      return unwrap<DecisionResult>(res);
    },

    async reject(targetUserId: string, elevationToken: string): Promise<DecisionResult> {
      const res = await fetchAPI(`/admin/users/${targetUserId}/reject`, {
        method: 'POST',
        elevationToken,
      });
      return unwrap<DecisionResult>(res);
    },

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

    async listLoginHistory(query: PageQuery = {}): Promise<Paginated<LoginHistoryRow>> {
      const qs = queryString({ page: query.page, pageSize: query.pageSize });
      return unwrap<Paginated<LoginHistoryRow>>(await fetchAPI(`/admin/login-history${qs}`));
    },

    async listAuditLogs(query: PageQuery = {}): Promise<Paginated<AuditLogRow>> {
      const qs = queryString({ page: query.page, pageSize: query.pageSize });
      return unwrap<Paginated<AuditLogRow>>(await fetchAPI(`/admin/audit-logs${qs}`));
    },
  },
};
