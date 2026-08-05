import React from 'react';
import { UserProfile, isVerified } from '../types';

interface UserProfileViewProps {
  user: UserProfile;
  onNavigateToVerification: () => void;
  onLogout: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  onNavigateToVerification,
  onLogout,
}) => {
  const verified = isVerified(user);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 pt-20 md:pt-28 pb-32 px-5 md:px-10 max-w-4xl mx-auto">
      <div className="bento-card rounded-[32px] p-8 border border-zinc-800 shadow-2xl relative overflow-hidden bg-zinc-900/40">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 border-b border-zinc-800 pb-8">
          {/* Initials, not a photo: the identity selfie is never retrievable by
              a client and is destroyed once an admin decides. */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500 shadow-lg shadow-indigo-500/20 bg-zinc-800 flex items-center justify-center">
            <span className="font-display-lg text-3xl text-indigo-300">
              {user.fullName.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h2 className="font-headline-lg text-2xl text-white">{user.fullName}</h2>
              {verified ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-label-caps text-[11px] font-bold uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Verified Member
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-label-caps text-[11px] font-bold uppercase">
                  {user.approvalStatus === 'PENDING' ? 'Pending Review' : user.approvalStatus}
                </span>
              )}
            </div>

            <p className="font-label-caps text-xs text-zinc-500 mt-1 font-bold">@{user.username}</p>
            <p className="font-body-md text-sm text-zinc-400 mt-3">
              Role: <strong className="text-indigo-400 uppercase font-label-caps">{user.role}</strong>
            </p>
          </div>
        </div>

        {/* Verification Status Box */}
        {!verified ? (
          <div className="my-8 bg-zinc-950/80 rounded-2xl p-6 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-4xl text-amber-400">id_card</span>
              <div>
                <h4 className="font-headline-md text-base text-white">Complete Identity Verification</h4>
                <p className="font-body-md text-xs text-zinc-400 mt-0.5">
                  Verify your selfie and official ID to gain instant velvet-rope access to premieres.
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToVerification}
              className="btn-primary px-6 py-3 rounded-full font-headline-md text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer shadow-lg shadow-indigo-600/25"
            >
              Verify Now
            </button>
          </div>
        ) : (
          <div className="my-8 bg-zinc-950/80 rounded-2xl p-6 border border-zinc-800 flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-emerald-400">shield_lock</span>
            <div>
              <h4 className="font-headline-md text-base text-white">Verification Status Active</h4>
              <p className="font-body-md text-xs text-zinc-400">
                End-to-end identity proof active. You hold clear VIP access for all scheduled screenings.
              </p>
            </div>
          </div>
        )}

        {/* User Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm font-body-md">
          <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
            <span className="font-label-caps text-[10px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
              Phone Number
            </span>
            <span className="font-medium text-zinc-200">{user.phone}</span>
          </div>

          <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
            <span className="font-label-caps text-[10px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
              Gender
            </span>
            <span className="font-medium text-zinc-200 capitalize">
              {user.gender.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onLogout}
            className="px-6 py-3 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-headline-md text-xs uppercase tracking-wider cursor-pointer font-bold"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
