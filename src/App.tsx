import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  ActiveTab,
  RallyEvent,
  TicketBooking,
  UserProfile,
  VerificationContact,
  isAdmin,
  isDetailLocked,
  isVerified,
} from './types';
import { api, type AuthUser } from './api/client';
import { restoreSession, signOut } from './lib/auth';
import { useEvents } from './hooks/useEvents';
import { JoinPremiere } from './components/JoinPremiere';
import { VerificationPending } from './components/VerificationPending';
import { DiscoverPremieres } from './components/DiscoverPremieres';
import { MyBookings } from './components/MyBookings';
import { SavedPremieres } from './components/SavedPremieres';
import { UserProfileView } from './components/UserProfileView';
import { Navigation } from './components/Navigation';

// The admin surface and the ticket modal are the two largest views a given
// user may never open, so both are split out of the initial bundle.
const AdminDashboard = lazy(async () => ({
  default: (await import('./components/admin/AdminDashboard')).AdminDashboard,
}));
const TicketModal = lazy(async () => ({
  default: (await import('./components/TicketModal')).TicketModal,
}));

const BOOKINGS_KEY = 'rally_user_bookings';
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

  const admin = user ? isAdmin(user) : false;

  // Bookings and bookmarks remain local. A real registration needs a
  // row-locked capacity transaction on the server, which is Phase 5.
  const [bookings, setBookings] = useState<TicketBooking[]>(() =>
    readStored<TicketBooking[]>(BOOKINGS_KEY, []),
  );
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
      } catch {
        if (!cancelled) {
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

  useEffect(() => {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }, [bookings]);

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

  const handleConfirmBooking = useCallback(
    (event: RallyEvent): TicketBooking => {
      const existing = bookings.find((b) => b.eventId === event.id);
      if (existing) return existing;

      const booking: TicketBooking = {
        id: `booking-${String(Date.now())}`,
        eventId: event.id,
        eventTitle: event.movieName,
        cinema: event.cinema,
        location: event.location,
        startsAt: event.startsAt,
        posterUrl: event.posterUrl,
        bookingCode: `RLY-${String(Math.floor(100000 + Math.random() * 900000))}`,
        bookedAt: new Date().toISOString(),
        whatsappInviteLink: event.whatsappInviteLink,
        bookingUrl: event.bookingUrl,
      };

      setBookings((prev) =>
        prev.some((b) => b.eventId === event.id) ? prev : [booking, ...prev],
      );
      return booking;
    },
    [bookings],
  );

  const handleCancelBooking = useCallback((bookingId: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
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
      localStorage.removeItem(BOOKINGS_KEY);
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

  // No session: the only reachable view is authentication.
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#e5e2e1] flex flex-col font-body-md antialiased selection:bg-[#e50914] selection:text-white">
        <JoinPremiere onSuccess={handleAuthSuccess} />
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
      <Suspense fallback={viewFallback}>
        <AdminDashboard user={user} onLogout={handleLogout} />
      </Suspense>
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
        {activeTab === 'join-premiere' && <JoinPremiere onSuccess={handleAuthSuccess} />}

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
