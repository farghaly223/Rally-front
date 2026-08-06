import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  ActiveTab,
  RallyEvent,
  UserProfile,
  VerificationContact,
  isAdmin,
  isDetailLocked,
  isVerified,
} from './types';
import { api, type AuthUser, type MemberRegistration } from './api/client';
import { currentSessionEmail, isEmailNotVerified, restoreSession, signOut } from './lib/auth';
import { useEvents } from './hooks/useEvents';
import { JoinPremiere } from './components/JoinPremiere';
import { VerifyEmail } from './components/VerifyEmail';
import { VerificationPending } from './components/VerificationPending';
import { DiscoverPremieres } from './components/DiscoverPremieres';
import { MyBookings } from './components/MyBookings';
import { SavedPremieres } from './components/SavedPremieres';
import { UserProfileView } from './components/UserProfileView';
import { Navigation } from './components/Navigation';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// The admin surface and the ticket modal are the two largest views a given
// user may never open, so both are split out of the initial bundle.
const AdminDashboard = lazy(async () => ({
  default: (await import('./components/admin/AdminDashboard')).AdminDashboard,
}));
const TicketModal = lazy(async () => ({
  default: (await import('./components/TicketModal')).TicketModal,
}));

/**
 * Where bookings used to be cached, before Phase 5 moved them to the server.
 *
 * Retained only so the stale copy can be evicted on sign-out. Nothing reads it.
 */
const LEGACY_BOOKINGS_KEY = 'rally_user_bookings';
const SAVED_KEY = 'rally_saved_events';

/**
 * Maps the backend's user onto the shape the UI renders.
 *
 * `username` is a display-only convenience the backend does not model, so it is
 * derived rather than invented — nothing depends on it for authorization.
 */
function toProfile(user: AuthUser): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    username:
      user.username?.trim() ||
      user.fullName.trim().split(/\s+/)[0]?.toLowerCase() ||
      'member',
    gender: user.gender,
    role: user.role,
    approvalStatus: user.approvalStatus,
  };
}

function readStored<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt cache — start clean rather than crash the app shell.
    return fallback;
  }
}

const viewFallback = (
  <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] font-body-md text-sm text-zinc-400">
    Loading…
  </div>
);

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  /**
   * Who to message to get verified — supplied by the server, never hardcoded.
   *
   * `null` for anyone the server does not consider owed one, which is how a male
   * member ends up never seeing verification UI without the client knowing the
   * rule that exempts him.
   */
  const [verificationContact, setVerificationContact] =
    useState<VerificationContact | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  /**
   * The address awaiting verification, or null.
   *
   * Held separately from `user` because this state has no profile behind it —
   * the account exists at Supabase but our backend refuses every route until
   * the emailed code is entered, so there is nothing to build a `UserProfile`
   * from.
   */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const admin = user ? isAdmin(user) : false;

  /*
   * Bookings are server-owned as of Phase 5.
   *
   * They are NOT cached in localStorage and are not seeded from it: a booking is
   * a claim on a limited number of seats, so the only trustworthy copy is the
   * one the database holds under the capacity lock. A locally-stored booking
   * could be edited in devtools to invent a seat at a full screening, and would
   * survive a cancellation made from another device.
   *
   * Bookmarks stay local. They are a private convenience with no capacity, no
   * scarcity, and nothing to forge.
   */
  const [bookings, setBookings] = useState<MemberRegistration[]>([]);
  const [savedEventIds, setSavedEventIds] = useState<string[]>(() =>
    readStored<string[]>(SAVED_KEY, []),
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [selectedEventForModal, setSelectedEventForModal] = useState<RallyEvent | null>(null);

  // Search and status live here because the server applies them, not the client:
  // `cinema`/`location` are redacted for an unverified member, so a local filter
  // would silently never match them.
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RallyEvent['status'] | 'all'>('all');

  // Events are server-owned as of Phase 4 and are never cached in
  // localStorage: capacity and status must not be forgeable in devtools.
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    searchRefused,
  } = useEvents(
    user && !admin
      ? {
          pageSize: 12,
          search: searchQuery.trim() || undefined,
          ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        }
      : {},
  );

  /**
   * Restores the session on load.
   *
   * Supabase persists and refreshes its own session, so there is no token to
   * rehydrate here — only the profile to fetch. `restoreSession` also covers the
   * half-made account (auth identity created, profile not): the API client
   * retries `complete-profile` on 409 `PROFILE_INCOMPLETE`, and a session that
   * still cannot be repaired is signed out rather than left spinning.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const profile = await restoreSession();
        if (cancelled) return;
        if (profile) {
          setUser(toProfile(profile.user));
          setVerificationContact(profile.verificationContact);
        } else {
          setUser(null);
          setActiveTab('join-premiere');
        }
      } catch (error) {
        if (cancelled) return;

        // A live session whose email is unverified. Not signed out: it becomes
        // usable the moment the emailed code is entered, and the address on it
        // is what the resend button needs.
        if (isEmailNotVerified(error)) {
          setUnverifiedEmail((await currentSessionEmail()) ?? '');
          setUser(null);
        } else {
          setUser(null);
          setActiveTab('join-premiere');
        }
      } finally {
        if (!cancelled) {
          setSessionChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Loads the caller's bookings from the server.
   *
   * Replaces the old `localStorage.setItem(BOOKINGS_KEY, …)` write. Admins are
   * skipped — they never mount the member surface — and so is the logged-out
   * state, where there is nobody to fetch for.
   *
   * A failure here is left silent on purpose: an empty bookings tab with a
   * working Discover is a better outcome than a page-level error, and every
   * booking action below reports its own failure where the member can see it.
   */
  useEffect(() => {
    if (!user || admin) {
      setBookings([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const page = await api.events.myRegistrations({ pageSize: 50 });
        if (!cancelled) setBookings(page.items);
      } catch {
        if (!cancelled) setBookings([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, admin]);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedEventIds));
  }, [savedEventIds]);

  const handleToggleBookmark = useCallback((id: string) => {
    setSavedEventIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleSelectEvent = useCallback((event: RallyEvent) => {
    setSelectedEventForModal(event);
  }, []);

  /**
   * Books a seat, server-side.
   *
   * The returned registration replaces any local row for that event rather than
   * being merged into it: the server is the only thing that knows whether the
   * booking was created, revived from a cancellation, or already existed, and
   * guessing here is what would let a full screening look booked.
   *
   * Errors are rethrown for the modal to render — a 409 ("This screening is
   * full") is information the member needs, not something to swallow.
   */
  const handleConfirmBooking = useCallback(
    async (event: RallyEvent): Promise<MemberRegistration> => {
      const registration = await api.events.register(event.id);

      setBookings((prev) => [
        registration,
        ...prev.filter((b) => b.eventId !== registration.eventId),
      ]);

      return registration;
    },
    [],
  );

  /**
   * Cancels a booking and frees the seat.
   *
   * Takes an event id rather than a registration id because that is what the
   * endpoint is keyed on — a member acts on "this screening", and the server
   * resolves which of their registrations that means.
   */
  const handleCancelBooking = useCallback(async (eventId: string): Promise<void> => {
    const cancelled = await api.events.cancelRegistration(eventId);
    setBookings((prev) => prev.map((b) => (b.eventId === eventId ? cancelled : b)));
  }, []);

  /**
   * Signup or login succeeded.
   *
   * Where to land is decided by the server's answer, not by the form that was
   * submitted: anyone still awaiting a decision goes to the verification screen,
   * everyone else straight to Discover.
   */
  const handleAuthSuccess = useCallback(
    (nextUser: UserProfile, contact: VerificationContact | null) => {
      setUser(nextUser);
      setVerificationContact(contact);
      setActiveTab(isVerified(nextUser) || !contact ? 'discover' : 'verification');
    },
    [],
  );

  /**
   * Re-reads the profile after the member has been off messaging the verifying
   * account. Only an admin can move someone to APPROVED, so the status is
   * fetched rather than assumed.
   */
  const refreshProfile = useCallback(() => {
    void (async () => {
      try {
        const profile = await api.auth.me();
        setUser(toProfile(profile.user));
        setVerificationContact(profile.verificationContact);
      } catch {
        // Keep the current profile; the next request will surface a dead session.
      }
      setActiveTab('discover');
    })();
  }, []);

  const handleLogout = useCallback(() => {
    void (async () => {
      await signOut();
      setUser(null);
      setVerificationContact(null);
      setBookings([]);
      setSavedEventIds([]);
      // Bookings live on the server now; clearing the old key evicts any copy
      // left in a browser from before that change, which would otherwise sit
      // there indefinitely holding venue details for a signed-out account.
      localStorage.removeItem(LEGACY_BOOKINGS_KEY);
      localStorage.removeItem(SAVED_KEY);
      setActiveTab('join-premiere');
    })();
  }, []);

  const navigateToDiscover = useCallback(() => {
    setActiveTab('discover');
  }, []);

  const navigateToVerification = useCallback(() => {
    setActiveTab('verification');
  }, []);

  // Avoid a flash of the sign-in screen while the stored session is still being
  // exchanged for a profile.
  if (!sessionChecked) {
    return viewFallback;
  }

  // An account whose address is unverified. Checked before the sign-in branch
  // below: a login screen here would be a loop with no exit, because signing in
  // again produces the same unverified session.
  if (unverifiedEmail !== null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#e5e2e1] flex flex-col font-body-md antialiased selection:bg-[#e50914] selection:text-white">
        <VerifyEmail
          email={unverifiedEmail}
          onVerified={(profile) => {
            // The code produced a confirmed session and the profile now exists,
            // so this lands exactly where a normal login does — including the
            // verification screen for a female member still awaiting approval.
            setUnverifiedEmail(null);
            handleAuthSuccess(toProfile(profile.user), profile.verificationContact);
          }}
          onBack={() => {
            setUnverifiedEmail(null);
            setActiveTab('join-premiere');
          }}
        />
      </div>
    );
  }

  // No session: the only reachable view is authentication.
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#e5e2e1] flex flex-col font-body-md antialiased selection:bg-[#e50914] selection:text-white">
        <JoinPremiere onSuccess={handleAuthSuccess} onEmailUnverified={setUnverifiedEmail} />
      </div>
    );
  }

  /**
   * Admins get a full replacement view. They never mount Discover, MyBookings,
   * SavedPremieres, or TicketModal — the member surface is not theirs to use,
   * and the dashboard carries its own header and Sign Out. Which sections the
   * dashboard offers is decided from the role inside it.
   */
  if (admin) {
    return (
      <ErrorBoundary label="The admin dashboard">
        <Suspense fallback={viewFallback}>
          <AdminDashboard user={user} onLogout={handleLogout} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const verified = isVerified(user);

  /**
   * Whether to invite this member to verify.
   *
   * Driven by the payload, not by the rule: the prompt appears when the server
   * actually withheld something, or refused a search, and only when the server
   * also supplied someone to message. A male member is never redacted and is
   * never issued a contact, so he is never nagged — without the client needing
   * to know that male members are exempt. If the backend policy changes, this
   * follows it with no edit here.
   */
  const showVerificationPrompt =
    !verified &&
    verificationContact !== null &&
    (searchRefused || events.some((event) => isDetailLocked(event)));

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e5e2e1] flex flex-col font-body-md antialiased selection:bg-[#e50914] selection:text-white">
      {activeTab !== 'join-premiere' && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          user={user}
          bookingCount={bookings.length}
          savedCount={savedEventIds.length}
        />
      )}

      <div className="flex-1">
        {activeTab === 'join-premiere' && (
          <JoinPremiere onSuccess={handleAuthSuccess} onEmailUnverified={setUnverifiedEmail} />
        )}

        {activeTab === 'verification' && (
          <VerificationPending
            contact={verificationContact}
            onBack={navigateToDiscover}
            onRefresh={refreshProfile}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverPremieres
            events={events}
            loading={eventsLoading}
            error={eventsError}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchRefused={searchRefused}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            savedEventIds={savedEventIds}
            onToggleBookmark={handleToggleBookmark}
            onSelectEvent={handleSelectEvent}
            onNavigateToVerification={navigateToVerification}
            showVerificationPrompt={showVerificationPrompt}
          />
        )}

        {activeTab === 'bookings' && (
          <MyBookings
            bookings={bookings}
            onNavigateToDiscover={navigateToDiscover}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {activeTab === 'saved' && (
          <SavedPremieres
            events={events}
            savedEventIds={savedEventIds}
            onToggleBookmark={handleToggleBookmark}
            onSelectEvent={handleSelectEvent}
            onNavigateToDiscover={navigateToDiscover}
          />
        )}

        {activeTab === 'profile' && (
          <UserProfileView
            user={user}
            verificationContact={verificationContact}
            onNavigateToVerification={navigateToVerification}
            onLogout={handleLogout}
          />
        )}
      </div>

      {selectedEventForModal && (
        <Suspense fallback={null}>
          <TicketModal
            event={selectedEventForModal}
            onClose={() => {
              setSelectedEventForModal(null);
            }}
            onConfirmBooking={handleConfirmBooking}
            onNavigateToBookings={() => {
              setSelectedEventForModal(null);
              setActiveTab('bookings');
            }}
            detailLocked={isDetailLocked(selectedEventForModal)}
            onRequireVerification={() => {
              setSelectedEventForModal(null);
              setActiveTab('verification');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
