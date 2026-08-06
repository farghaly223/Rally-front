import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlreadyVerifiedError,
  RateLimitError,
  authErrorMessage,
  resendVerificationCode,
  signOut,
  verifyEmailCode,
} from '../lib/auth';
import type { ProfileResponse } from '../api/client';

interface VerifyEmailProps {
  /** The address the code was sent to, shown so a typo is visible. */
  email: string;
  /** The code was accepted and the profile exists. Carries the session forward. */
  onVerified: (profile: ProfileResponse) => void;
  /** Returns to the login form. Clears any half-made session first. */
  onBack: () => void;
}

/** Supabase issues 6 digits. */
const CODE_LENGTH = 6;

/**
 * Supabase's own resend window, used to start the countdown after a successful
 * send. The server enforces this regardless of what this number says.
 */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Code entry for email verification.
 *
 * Reached two ways, and both matter: straight after signup, and on any later
 * load where a real session hits our backend's 403 `EMAIL_NOT_VERIFIED`. The
 * second case is why this cannot be a transient banner on the signup form —
 * signing in again produces the same unverified session, so a login screen here
 * would be a loop with no exit.
 *
 * Nothing in this flow involves opening a link. The code is typed here, and the
 * session it produces is the first one our backend will accept.
 */
export const VerifyEmail: React.FC<VerifyEmailProps> = ({ email, onVerified, onBack }) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  /** Set when Supabase reports the address is already confirmed. */
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  /**
   * Tracks unmount, so a resolved request cannot set state on a dead component.
   *
   * It is set ONLY by the unmount cleanup below — never on the success path.
   * Setting it before handing off to `onVerified` looks equivalent, but that
   * callback can throw (the profile call it makes is a network request), and
   * then `finally` would skip resetting the spinner and jam the button on
   * "Verifying…" forever with no way out.
   */
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // One interval for the whole countdown rather than one per tick, so a rapid
  // re-render cannot leave a second timer running alongside the first.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [cooldown]);

  const handleVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSent(false);
      setIsVerifying(true);
      try {
        const profile = await verifyEmailCode(email, code);
        // Inside the try on purpose: this makes a network call of its own, and a
        // failure there must reach the catch rather than escape as an unhandled
        // rejection that leaves the form frozen mid-submit.
        onVerified(profile);
      } catch (err) {
        setError(authErrorMessage(err));
        if (err instanceof AlreadyVerifiedError) {
          setAlreadyVerified(true);
        } else {
          // The code is wrong or stale either way, so clearing it saves the
          // member from editing six characters they cannot reuse.
          setCode('');
        }
      } finally {
        if (mounted.current) setIsVerifying(false);
      }
    },
    [code, email, onVerified],
  );

  const handleResend = useCallback(async () => {
    setIsSending(true);
    setError(null);
    setSent(false);
    try {
      await resendVerificationCode(email);
      setSent(true);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(authErrorMessage(err));
      // Supabase said exactly how long is left; showing that beats a generic
      // "try later" the member has to guess at.
      if (err instanceof RateLimitError) setCooldown(err.retryAfterSeconds);
      // Already confirmed elsewhere — from the dashboard, or on another device.
      // No code is coming, so the only useful move is a fresh sign-in, which
      // mints a token carrying the confirmation this one predates.
      if (err instanceof AlreadyVerifiedError) setAlreadyVerified(true);
    } finally {
      setIsSending(false);
    }
  }, [email]);

  const handleBack = useCallback(async () => {
    // The session is real but unusable. Clearing it is what makes the login form
    // meaningful again rather than bouncing straight back here.
    await signOut();
    onBack();
  }, [onBack]);

  const canSubmit = code.length === CODE_LENGTH && !isVerifying;
  const resendDisabled = isSending || cooldown > 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] p-5 font-body-md text-body-md md:p-10">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/80 to-transparent" />
      </div>

      <div className="relative z-10 my-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display-lg mb-2 text-4xl tracking-tighter text-[#e50914] drop-shadow-[0_0_20px_rgba(229,9,20,0.5)] md:text-5xl">
            RALLY
          </h1>
          <p className="font-label-caps text-xs uppercase tracking-widest text-[#e9bcb6]">
            One Step Left
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleVerify(e);
          }}
          className="glass-card flex flex-col gap-5 rounded-xl border border-white/10 p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-5xl text-[#ffb4aa]">
              mark_email_unread
            </span>
            <h2 className="font-headline-md text-xl text-[#e5e2e1]">Enter your code</h2>
            <p className="font-body-md text-sm text-[#c9c6c5]">
              We sent a {CODE_LENGTH}-digit code to{' '}
              <span className="text-[#e5e2e1]">{email}</span>.
            </p>
            <p className="font-body-md text-xs text-[#c9c6c5]/70">
              Check your spam folder if it has not arrived in a minute.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-caps sr-only text-xs text-[#c9c6c5]" htmlFor="code">
              Verification code
            </label>
            <input
              className="input-glass w-full rounded py-4 text-center font-body-md text-2xl tracking-[0.5em] text-[#e5e2e1] placeholder-[#c9c6c5]/30"
              id="code"
              /*
               * `inputMode="numeric"` raises the digit keypad on phones without
               * `type="number"`, which would bring a spinner and strip a leading
               * zero — and codes can start with one.
               */
              inputMode="numeric"
              autoComplete="one-time-code"
              /* Lets iOS and Android offer the code straight from the message. */
              pattern="\d{6}"
              maxLength={CODE_LENGTH}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                // Strip everything but digits so a pasted "123 456" still fits.
                setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
              }}
              autoFocus
              required
            />
          </div>

          {sent && (
            <div
              role="status"
              className="font-body-md flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
            >
              <span className="material-symbols-outlined text-lg leading-none">check_circle</span>
              <span>New code sent. Give it a moment to arrive.</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="font-body-md flex items-start gap-2 rounded-lg border border-[#e50914]/40 bg-[#e50914]/10 px-4 py-3 text-sm text-[#ffb4aa]"
            >
              <span className="material-symbols-outlined text-lg leading-none">error</span>
              <span>{error}</span>
            </div>
          )}

          {alreadyVerified ? (
            <button
              className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-4 text-lg"
              type="button"
              onClick={() => {
                void handleBack();
              }}
            >
              Sign In Again
              <span className="material-symbols-outlined text-2xl">login</span>
            </button>
          ) : (
            <>
              <button
                className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-4 text-lg disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={!canSubmit}
              >
                {isVerifying ? 'Verifying…' : 'Verify Email'}
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </button>

              <button
                className="font-label-caps cursor-pointer text-center text-xs text-[#ffb4aa] underline transition-colors hover:text-[#e50914] disabled:cursor-not-allowed disabled:text-[#c9c6c5]/50 disabled:no-underline"
                type="button"
                disabled={resendDisabled}
                onClick={() => {
                  void handleResend();
                }}
              >
                {isSending
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend code in ${String(cooldown)}s`
                    : 'Resend Code'}
              </button>
            </>
          )}

          <button
            className="font-label-caps cursor-pointer text-center text-xs text-[#c9c6c5] underline transition-colors hover:text-[#ffb4aa]"
            type="button"
            onClick={() => {
              void handleBack();
            }}
          >
            Use a different account
          </button>
        </form>
      </div>
    </div>
  );
};
