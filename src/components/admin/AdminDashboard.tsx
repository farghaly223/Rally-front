import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  canManageAdmins,
  canManageEvents,
  canVerifyMembers,
  type UserProfile,
} from '../../types';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ToastStack, useToasts } from '../ui/Toast';
import { DashboardStats } from './DashboardStats';
import { EventManager } from './EventManager';
import { PendingMembers } from './PendingMembers';
import { VerificationContactSettings } from './VerificationContactSettings';
import { UserManager } from './UserManager';
import { ReportManager } from './ReportManager';
import { RegistrationManager } from './RegistrationManager';
import { AuditLog } from './AuditLog';

// Only a super admin ever opens this, so it stays out of every other admin's
// initial payload.
const AdminManager = lazy(async () => ({
  default: (await import('./AdminManager')).AdminManager,
}));

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

type Section =
  | 'overview'
  | 'events'
  | 'pending'
  | 'verification-contact'
  | 'reports'
  | 'admins'
  | 'users'
  | 'registrations'
  | 'audit';

interface SectionDef {
  id: Section;
  label: string;
  icon: string;
}

const sectionFallback = <p className="font-body-md text-sm text-zinc-400">Loading section…</p>;

/**
 * Which sections a role is offered.
 *
 * This is a usability courtesy, not a security control. Every one of these
 * endpoints answers 403 to a role that may not use it whatever the client
 * renders, and those refusals are shown as messages rather than pre-empted —
 * hiding a tab only spares an admin a button that could never work.
 */
function sectionsFor(role: UserProfile['role']): SectionDef[] {
  const events = canManageEvents(role);
  const verify = canVerifyMembers(role);
  const admins = canManageAdmins(role);

  const sections: SectionDef[] = [{ id: 'overview', label: 'Overview', icon: 'insights' }];

  if (events) sections.push({ id: 'events', label: 'Events', icon: 'movie' });

  if (verify) {
    sections.push(
      { id: 'pending', label: 'Pending Members', icon: 'how_to_reg' },
      { id: 'verification-contact', label: 'Verification Contact', icon: 'alternate_email' },
      { id: 'reports', label: 'Reports', icon: 'flag' },
    );
  }

  if (admins) {
    sections.push(
      { id: 'admins', label: 'Admin Management', icon: 'shield_person' },
      { id: 'users', label: 'Members', icon: 'group' },
      { id: 'registrations', label: 'Registrations', icon: 'confirmation_number' },
      { id: 'audit', label: 'Audit Log', icon: 'history' },
    );
  }

  return sections;
}

/**
 * The admin's entire application.
 *
 * Admins never mount the member surface, so this carries its own header —
 * including Sign Out, which the member navigation would otherwise be the only
 * route to.
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const sections = useMemo(() => sectionsFor(user.role), [user.role]);
  const [section, setSection] = useState<Section>('overview');
  const { toasts, push, dismiss } = useToasts();

  // A role that lost access to the open section (or was never offered it) falls
  // back to Overview rather than rendering a panel it cannot use.
  const active = sections.some((item) => item.id === section) ? section : 'overview';

  return (
    <div className="bg-cinematic min-h-screen bg-[#09090b] text-zinc-100">
      <header className="fixed left-0 top-0 z-50 w-full border-b border-zinc-800 bg-[#09090b]/80 shadow-xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/30">
              R
            </div>
            <span className="font-display-lg text-2xl tracking-tight text-white">RALLY</span>
            <span className="font-label-caps rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="font-headline-md text-xs text-zinc-200">{user.fullName}</div>
              <div className="font-label-caps text-[10px] text-zinc-500">{user.role}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="font-label-caps flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-700 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-24 pt-20 md:px-10 md:pt-28">
        <div className="bento-card mb-8 rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="font-label-caps text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Admin Command Center
            </span>
          </div>
          <h1 className="font-display-lg text-3xl tracking-tight text-white md:text-4xl">
            Rally Operations
          </h1>
          <p className="font-body-md mt-1 max-w-xl text-xs text-zinc-400 md:text-sm">
            Everything your role can act on. Anything it cannot is refused by the server,
            not merely hidden here.
          </p>
        </div>

        <nav className="scrollbar-none mb-8 flex gap-2 overflow-x-auto pb-1">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
              }}
              aria-current={active === item.id ? 'page' : undefined}
              className={`font-label-caps flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-xs transition-all ${
                active === item.id
                  ? 'border-indigo-500 bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/20'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/*
          Every section is wrapped, not just the lazy one.

          A render-time throw anywhere in here would otherwise unmount the whole
          React root and leave the bare page background — the "black screen" this
          boundary exists to end. `resetKey` is the active section, so switching
          away from a failed panel clears the error rather than carrying it into
          the next one.
        */}
        <ErrorBoundary
          label={sections.find((item) => item.id === active)?.label ?? 'This section'}
          resetKey={active}
        >
          <Suspense fallback={sectionFallback}>
            {active === 'overview' && <DashboardStats />}
            {active === 'events' && <EventManager notify={push} />}
            {active === 'pending' && <PendingMembers notify={push} />}
            {active === 'verification-contact' && <VerificationContactSettings notify={push} />}
            {active === 'reports' && <ReportManager notify={push} />}
            {active === 'admins' && <AdminManager notify={push} />}
            {active === 'users' && <UserManager />}
            {active === 'registrations' && <RegistrationManager />}
            {active === 'audit' && <AuditLog />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default AdminDashboard;
