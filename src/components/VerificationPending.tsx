import React from 'react';
import {
  VERIFICATION_PLATFORM_LABEL,
  verificationContactUrl,
  type VerificationContact,
} from '../types';

interface VerificationPendingProps {
  /**
   * Who to message. Comes from the API on every load so the verifying account
   * can be rotated without a deploy — never hardcoded, never cached across
   * sessions.
   */
  contact: VerificationContact | null;
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  /**
   * Re-reads the profile from the server. Approval happens off-platform and
   * out of band, so nothing pushes the news to a waiting member — without a
   * way to ask again, she would have to sign out and back in to discover she
   * was approved an hour ago.
   */
  onRefresh: () => void;
}

const PLATFORM_ICON: Record<VerificationContact['platform'], string> = {
  INSTAGRAM: 'photo_camera',
  TELEGRAM: 'send',
  TIKTOK: 'music_note',
};

/**
 * Shown to a member the server has left PENDING.
 *
 * Verification is a conversation with a real person on another platform. No
 * document is uploaded, no photo is taken, and nothing here promises a
 * turnaround time — a human decides when they decide, and inventing a deadline
 * we do not control would only be a lie with a clock on it.
 */
export const VerificationPending: React.FC<VerificationPendingProps> = ({
  contact,
  loading = false,
  error = null,
  onBack,
  onRefresh,
}) => {
  const href = contact ? verificationContactUrl(contact) : null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#09090b] text-zinc-100 selection:bg-indigo-600 selection:text-white">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-zinc-800/20 blur-[150px]" />
      </div>

      <main className="relative z-10 flex min-h-screen flex-grow items-center justify-center px-5 py-16 md:px-10">
        <div className="bento-card relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl md:p-12">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

          <div className="mb-10 text-center">
            <div className="font-label-caps mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase text-amber-300">
              <span className="material-symbols-outlined text-sm">hourglass_top</span>
              Awaiting Verification
            </div>
            <h1 className="font-display-lg mb-3 text-3xl text-white md:text-4xl">
              One Conversation Away
            </h1>
            <p className="font-body-md mx-auto max-w-md text-sm text-zinc-400">
              Rally verifies members by talking to them, not by collecting documents.
              Message the account below and a real person will take it from there.
            </p>
          </div>

          {loading ? (
            <p className="font-body-md text-center text-sm text-zinc-400">
              Loading contact details…
            </p>
          ) : error ? (
            <div
              role="alert"
              className="font-body-md flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
            >
              <span className="material-symbols-outlined text-lg leading-none">error</span>
              <span>{error}</span>
            </div>
          ) : contact ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                  <span className="material-symbols-outlined text-2xl">
                    {PLATFORM_ICON[contact.platform]}
                  </span>
                </span>

                <div>
                  <span className="font-label-caps block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    {VERIFICATION_PLATFORM_LABEL[contact.platform]}
                  </span>
                  <span className="font-headline-md text-lg text-white">
                    {contact.handleOrUrl}
                  </span>
                </div>

                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary font-headline-md flex items-center justify-center gap-2 rounded-full px-7 py-3 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30"
                  >
                    <span>
                      Message on {VERIFICATION_PLATFORM_LABEL[contact.platform]}
                    </span>
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                  </a>
                )}
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                <span className="material-symbols-outlined mt-0.5 text-2xl text-indigo-400">
                  no_photography
                </span>
                <div>
                  <h3 className="font-headline-md mb-0.5 text-sm text-white">
                    Nothing is uploaded here
                  </h3>
                  <p className="font-body-md text-xs leading-relaxed text-zinc-400">
                    Rally never asks for a selfie or an ID document, and stores no
                    images of you. Verification happens entirely in that conversation.
                  </p>
                </div>
              </div>

              <p className="font-body-md text-center text-xs text-zinc-500">
                You can keep browsing screenings meanwhile — venue and showtimes appear
                once you are approved.
              </p>
            </div>
          ) : (
            <p className="font-body-md text-center text-sm text-zinc-400">
              No verification contact is published right now. Please check back shortly.
            </p>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 border-t border-zinc-800 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="btn-primary font-label-caps cursor-pointer rounded-full px-8 py-3 text-xs font-bold disabled:opacity-50"
            >
              {loading ? 'Checking…' : "I've Been Verified"}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="font-label-caps cursor-pointer rounded-full border border-zinc-800 px-8 py-3 text-xs font-bold text-zinc-400 transition-all hover:border-zinc-700 hover:text-white"
            >
              Back to Screenings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
