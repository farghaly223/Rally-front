import React from 'react';
import { ActiveTab, UserProfile, isVerified } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: UserProfile;
  bookingCount: number;
  savedCount: number;
}

/**
 * Member navigation.
 *
 * Admins never mount this — they get `AdminDashboard`, which carries its own
 * header and Sign Out. That also fixes the old mobile bug where the 4th slot
 * was admin-or-profile, leaving an admin no route to Sign Out.
 */
export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  user,
  bookingCount,
  savedCount,
}) => {
  const verified = isVerified(user);

  // Initials avatar: the identity selfie is never fetchable by a client, and
  // there is no separate profile-picture upload.
  const initial = user.fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      {/* Desktop & Mobile Top Header Bar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800 shadow-xl">
        <div className="flex justify-between items-center px-5 md:px-10 h-16 w-full max-w-7xl mx-auto">
          {/* Logo */}
          <button
            onClick={() => onSelectTab('discover')}
            className="font-display-lg text-2xl md:text-3xl tracking-tight text-white cursor-pointer flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-base font-bold shadow-lg shadow-indigo-600/30">
              R
            </div>
            <span>RALLY</span>
          </button>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onSelectTab('discover')}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'discover'
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
              title="Discover Premieres"
            >
              <span className="material-symbols-outlined text-xl block">explore</span>
            </button>

            <button
              onClick={() => onSelectTab('bookings')}
              className={`relative p-2.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'bookings'
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
              title="My Squad RSVPs"
            >
              <span className="material-symbols-outlined text-xl block">groups</span>
              {bookingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-label-caps text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-md">
                  {bookingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('verification')}
              className={`px-3.5 py-2 rounded-2xl font-label-caps text-xs flex items-center gap-2 cursor-pointer transition-all border ${
                verified
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {verified ? 'verified' : 'shield'}
              </span>
              <span className="hidden sm:inline">
                {verified ? 'Verified' : 'Verify ID'}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('profile')}
              className="p-0.5 rounded-full border border-zinc-700 hover:border-indigo-500 transition-all cursor-pointer ml-1"
              title="Profile Settings"
            >
              <span className="w-8 h-8 rounded-full bg-zinc-800 text-indigo-300 flex items-center justify-center font-bold text-sm">
                {initial}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Side Navigation Bar */}
      <aside className="hidden xl:flex fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-[#09090b]/90 border-r border-zinc-800/80 flex-col py-6 px-4 gap-3 z-40 backdrop-blur-xl">
        <div className="mb-2 px-3">
          <span className="font-label-caps text-[10px] text-zinc-500 uppercase tracking-[0.2em] block font-bold">
            Command Center
          </span>
          <span className="font-headline-md text-sm text-zinc-200">Cinematic Roster</span>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          <button
            onClick={() => onSelectTab('discover')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-body-md text-sm cursor-pointer border ${
              activeTab === 'discover'
                ? 'bg-zinc-800 border-zinc-700 text-white font-semibold shadow-md'
                : 'border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-xl">explore</span>
            <span>Discover</span>
          </button>

          <button
            onClick={() => onSelectTab('saved')}
            className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-body-md text-sm cursor-pointer border ${
              activeTab === 'saved'
                ? 'bg-zinc-800 border-zinc-700 text-white font-semibold shadow-md'
                : 'border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-xl">bookmark</span>
              <span>Saved</span>
            </div>
            {savedCount > 0 && (
              <span className="font-label-caps text-[10px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full font-bold">
                {savedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('bookings')}
            className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-body-md text-sm cursor-pointer border ${
              activeTab === 'bookings'
                ? 'bg-zinc-800 border-zinc-700 text-white font-semibold shadow-md'
                : 'border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-xl">groups</span>
              <span>My RSVPs</span>
            </div>
            {bookingCount > 0 && (
              <span className="font-label-caps text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-bold">
                {bookingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('verification')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-body-md text-sm cursor-pointer border ${
              activeTab === 'verification'
                ? 'bg-zinc-800 border-zinc-700 text-white font-semibold shadow-md'
                : 'border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-xl">badge</span>
            <span>Identity Proof</span>
          </button>
        </nav>

        {/* User Card Bento Tile */}
        <div className="pt-3 border-t border-zinc-800/80 px-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-800 overflow-hidden border border-zinc-700 flex-shrink-0 flex items-center justify-center">
            <span className="font-bold text-indigo-300 text-sm">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline-md text-xs text-zinc-200 truncate">{user.fullName}</div>
            <div className="font-label-caps text-[10px] text-zinc-500 truncate">@{user.username}</div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 h-20 bg-[#09090b]/95 backdrop-blur-xl rounded-t-[28px] shadow-2xl border-t border-zinc-800 xl:hidden">
        {/* Discover */}
        <button
          onClick={() => onSelectTab('discover')}
          className={`flex flex-col items-center justify-center transition-all duration-200 w-16 cursor-pointer ${
            activeTab === 'discover' ? 'text-indigo-400 font-bold scale-105' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span
            className="material-symbols-outlined text-2xl mb-1"
            style={{ fontVariationSettings: activeTab === 'discover' ? "'FILL' 1" : "'FILL' 0" }}
          >
            explore
          </span>
          <span className="font-label-caps text-[10px]">Discover</span>
        </button>

        {/* Saved */}
        <button
          onClick={() => onSelectTab('saved')}
          className={`flex flex-col items-center justify-center transition-all duration-200 w-16 cursor-pointer relative ${
            activeTab === 'saved' ? 'text-indigo-400 font-bold scale-105' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span
            className="material-symbols-outlined text-2xl mb-1"
            style={{ fontVariationSettings: activeTab === 'saved' ? "'FILL' 1" : "'FILL' 0" }}
          >
            bookmark
          </span>
          <span className="font-label-caps text-[10px]">Saved</span>
          {savedCount > 0 && (
            <span className="absolute top-0 right-3 bg-zinc-800 text-zinc-200 text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
              {savedCount}
            </span>
          )}
        </button>

        {/* RSVPs */}
        <button
          onClick={() => onSelectTab('bookings')}
          className={`flex flex-col items-center justify-center transition-all duration-200 w-16 cursor-pointer relative ${
            activeTab === 'bookings' ? 'text-indigo-400 font-bold scale-105' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span
            className="material-symbols-outlined text-2xl mb-1"
            style={{ fontVariationSettings: activeTab === 'bookings' ? "'FILL' 1" : "'FILL' 0" }}
          >
            groups
          </span>
          <span className="font-label-caps text-[10px]">My RSVPs</span>
          {bookingCount > 0 && (
            <span className="absolute top-0 right-3 bg-indigo-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
              {bookingCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center transition-all duration-200 w-16 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span
            className="material-symbols-outlined text-2xl mb-1"
            style={{
              fontVariationSettings: activeTab === 'profile' ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            person
          </span>
          <span className="font-label-caps text-[10px]">Profile</span>
        </button>
      </nav>
    </>
  );
};
