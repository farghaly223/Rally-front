import React, { Suspense, lazy, useState } from 'react';
import type { UserProfile } from '../../types';
import { ToastStack, useToasts } from '../ui/Toast';
import { DashboardStats } from './DashboardStats';
import { EventManager } from './EventManager';
import { UserManager } from './UserManager';
import { RegistrationManager } from './RegistrationManager';
import { LoginHistory } from './LoginHistory';
import { AuditLog } from './AuditLog';

// The review queue pulls in the elevation/blob-fetch flow, which is only
// needed once an admin opens that section.
const IdentityReview = lazy(async () => ({
  default: (await import('../IdentityReview')).IdentityReview,
}));

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

type Section = 'overview' | 'events' | 'identity' | 'users' | 'registrations' | 'logins' | 'audit';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'insights' },
  { id: 'events', label: 'Events', icon: 'movie' },
  { id: 'identity', label: 'Identity Queue', icon: 'badge' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'registrations', label: 'Registrations', icon: 'how_to_reg' },
  { id: 'logins', label: 'Login History', icon: 'login' },
  { id: 'audit', label: 'Audit Log', icon: 'history' },
];

const sectionFallback = (
  <p className="font-body-md text-sm text-zinc-400">Loading section…</p>
);

/**
 * The admin's entire application.
 *
 * Admins never mount the member surface, so this carries its own header —
 * including Sign Out, which the member navigation would otherwise be the only
 * route to.
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [section, setSection] = useState<Section>('overview');
  const { toasts, push, dismiss } = useToasts();

  return (
    <div className="min-h-screen bg-cinematic bg-[#09090b] text-zinc-100">
      <header className="fixed top-0 left-0 z-50 w-full border-b border-zinc-800 bg-[#09090b]/80 shadow-xl backdrop-blur-xl">
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
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2 font-label-caps text-xs font-bold text-zinc-300 transition-all hover:border-zinc-700 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pt-20 pb-24 md:px-10 md:pt-28">
        <div className="mb-8 rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8 bento-card">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="font-label-caps text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Admin Command Center
            </span>
          </div>
          <h1 className="font-display-lg text-3xl tracking-tight text-white md:text-4xl">
            Rally Operations
          </h1>
          <p className="mt-1 max-w-xl font-body-md text-xs text-zinc-400 md:text-sm">
            Manage screenings, review identities, and audit everything that happens on the network.
          </p>
        </div>

        <nav className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
              }}
              aria-current={section === item.id ? 'page' : undefined}
              className={`flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 font-label-caps text-xs transition-all ${
                section === item.id
                  ? 'border-indigo-500 bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/20'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {section === 'overview' && <DashboardStats />}

        {section === 'events' && <EventManager notify={push} />}

        {section === 'identity' && (
          <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
            <div className="mb-6 border-b border-zinc-800/80 pb-4">
              <h2 className="font-headline-md text-xl text-white">Identity Review Queue</h2>
              <p className="mt-1 font-body-md text-sm text-zinc-400">
                Viewing a member&apos;s documents requires your password and is limited to that one
                member. Documents are permanently destroyed once you decide.
              </p>
            </div>
            <Suspense fallback={sectionFallback}>
              <IdentityReview />
            </Suspense>
          </section>
        )}

        {section === 'users' && <UserManager />}
        {section === 'registrations' && <RegistrationManager />}
        {section === 'logins' && <LoginHistory />}
        {section === 'audit' && <AuditLog />}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default AdminDashboard;
