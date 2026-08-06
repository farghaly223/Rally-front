import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api, APIError, type ProfileResponse } from '../api/client';
import type { Gender } from '../types';

/**
 * Signup, login, email verification, and session restore.
 *
 * The single rule this module exists to enforce: the password goes to Supabase
 * and nowhere else. Our own backend never receives one, never has an endpoint
 * that would accept one, and only ever sees the access token Supabase issued.
 *
 * The credential is the email address. Verification is a **6-digit code typed
 * into the app** — never a link. Nothing here reads a token out of the URL, and
 * `detectSessionInUrl` is off in `./supabase`, so a redirect back into the app
 * carries no session and no verification ever depends on one.
 *
 * The phone number travels with signup as profile data only — Rally sends no SMS
 * and never claims the number is verified.
 */

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  gender: Gender;
  username?: string;
}

/**
 * What a signup produced.
 *
 * `profile` is null when Supabase created the identity but withheld a session
 * pending email verification — the ordinary path when confirmations are on.
 * There is no token yet, so no profile can be created, and the caller must show
 * the code-entry screen rather than treating this as a failure.
 */
export interface SignUpResult {
  needsEmailConfirmation: boolean;
  email: string;
  profile: ProfileResponse | null;
}

/**
 * Duplicate details are refused without naming the field that collided.
 *
 * Saying "this email is registered" confirms to anyone who asks that a given
 * address holds an account here, which turns the signup form into a membership
 * oracle. The backend already refuses generically for the same reason; this
 * keeps the Supabase-side wording consistent with it.
 *
 * A phone number is claimed permanently — never released on rejection,
 * suspension, or deletion — so this is a final answer, not a retry.
 */
const DETAILS_TAKEN = 'These account details are already registered.';

function isAlreadyRegistered(error: AuthError): boolean {
  if (
    error.code === 'user_already_exists' ||
    error.code === 'email_exists' ||
    error.code === 'phone_exists'
  ) {
    return true;
  }
  // Older Supabase releases only carry the condition in the message text.
  return /already (registered|exists)|already been registered/i.test(error.message);
}

/**
 * A wrong or stale code is reported with one message covering both.
 *
 * Supabase distinguishes "invalid" from "expired", but the member's next action
 * is identical either way — request a new code — and a message that confirmed
 * "that code was right but arrived too late" would tell an attacker their guess
 * had hit. One wording removes that signal without costing anything real.
 */
const CODE_REJECTED = 'That code is incorrect or has expired. Request a new one.';

function isBadCode(error: AuthError): boolean {
  if (error.code === 'otp_expired' || error.code === 'otp_disabled') return true;
  return /token has expired|invalid|expired|not found/i.test(error.message);
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Whether an error means "your email is not confirmed yet".
 *
 * Two different layers can say it, and both must be recognised: Supabase
 * refuses the sign-in outright with `email_not_confirmed`, while our backend
 * answers 403 `EMAIL_NOT_VERIFIED` when a session that predates confirmation
 * reaches a protected route. Either way the remedy is the same screen.
 */
export function isEmailNotVerified(error: unknown): boolean {
  if (error instanceof APIError) return error.code === 'EMAIL_NOT_VERIFIED';
  if (error instanceof Error) {
    return /email.*(not|un)\s*confirm|not confirmed/i.test(error.message);
  }
  return false;
}

/**
 * Creates the Supabase identity, then the Rally profile if a session exists.
 *
 * `fullName`, `gender`, `phone` and `username` ride in `options.data`: Supabase
 * has no column for any of them, and `complete-profile` reads them out of
 * `user_metadata` to build the profile. Without `gender` the backend cannot
 * decide male-auto-approve versus female-pending.
 *
 * With email confirmation enabled, Supabase returns no session here and emails a
 * 6-digit code instead. The profile cannot be created until that code is
 * verified, which is exactly the point: an unverified address would otherwise
 * permanently claim a phone number and an email nobody has proven they control.
 *
 * `emailRedirectTo` is deliberately not passed. Supplying it would make Supabase
 * build a confirmation link, which is the flow this app does not use.
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        fullName: input.fullName,
        gender: input.gender,
        phone: input.phone,
        ...(input.username ? { username: input.username } : {}),
      },
    },
  });

  if (error) {
    throw new Error(isAlreadyRegistered(error) ? DETAILS_TAKEN : error.message);
  }

  // No session means Supabase is waiting on the emailed code.
  if (!data.session) {
    return { needsEmailConfirmation: true, email, profile: null };
  }

  return {
    needsEmailConfirmation: false,
    email,
    profile: await api.auth.completeProfile(),
  };
}

/**
 * Exchanges the emailed 6-digit code for a session.
 *
 * `type: 'signup'` is the code `signUp` produced — not `'email'`, which belongs
 * to the passwordless `signInWithOtp` flow and would be rejected here.
 *
 * On success Supabase issues a real, confirmed session, so the profile is
 * created immediately: this is the first moment a token exists that our backend
 * will accept, and leaving it uncreated would strand the account at 409
 * `PROFILE_INCOMPLETE`.
 */
export async function verifyEmailCode(email: string, code: string): Promise<ProfileResponse> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'signup',
  });

  if (error) {
    // Already confirmed elsewhere: `verifyOtp` reports this as an invalid or
    // expired token, because the pending code really was consumed. Telling the
    // member to request a new one would be advice that cannot work, so this is
    // separated out and the screen offers a sign-in instead.
    if (isAlreadyConfirmed(error)) throw new AlreadyVerifiedError();
    throw new Error(isBadCode(error) ? CODE_REJECTED : error.message);
  }

  // Defensive: a verification that reports success without a session would mean
  // every following request goes out unauthenticated and fails as a confusing
  // 401 instead of naming the real problem here.
  if (!data.session) {
    throw new Error('Verification did not return a session. Please request a new code.');
  }

  return api.auth.completeProfile();
}

export async function signIn(email: string, password: string): Promise<ProfileResponse> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(error.message);

  // A session whose profile never got created still lands here; `me` answers
  // 409 PROFILE_INCOMPLETE and the API client completes it before retrying.
  return api.auth.me();
}

/**
 * Raised when the address is already confirmed and there is nothing to send.
 *
 * Distinct from the silent path below because it is not a failure — it means the
 * member is finished and simply holding a token minted before confirmation. The
 * screen turns this into "sign in again" rather than leaving them waiting for an
 * email Supabase will never send.
 */
export class AlreadyVerifiedError extends Error {
  constructor() {
    super('This email is already verified. Sign in to continue.');
    this.name = 'AlreadyVerifiedError';
  }
}

function isAlreadyConfirmed(error: AuthError): boolean {
  if (error.code === 'email_already_confirmed' || error.code === 'user_already_exists') return true;
  return /already (been )?(confirmed|verified|registered)/i.test(error.message);
}

/**
 * Asks Supabase to email a fresh 6-digit code.
 *
 * Every refusal is surfaced. An earlier version rethrew only for rate limiting
 * and an already-confirmed address and let everything else fall off the end as a
 * silent success — so the screen showed "New code sent" for a request Supabase
 * had rejected, and a genuinely broken mailer was indistinguishable from a slow
 * one. That is the failure mode this function must not have: the member's whole
 * problem is that no mail arrives, and swallowing the reason leaves them
 * refreshing an inbox forever.
 *
 * The enumeration argument that justified the silence does not apply here.
 * Signup takes an arbitrary address from a stranger, so naming "no such account"
 * there would turn the form into a membership oracle. This screen only ever
 * resends to the address on the caller's own session — an address they already
 * hold a token for — so there is nothing left to disclose.
 *
 * Supabase enforces one send per 60 seconds per address, and the built-in mailer
 * caps the whole project at a few per hour. Both arrive as `RateLimitError`; the
 * countdown in the UI is a courtesy that saves a click, and the server limit is
 * the real one.
 */
export async function resendVerificationCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (!error) return;
  if (isRateLimited(error)) throw new RateLimitError(secondsToWait(error.message));
  if (isAlreadyConfirmed(error)) throw new AlreadyVerifiedError();

  // Anything else is a real fault — a misconfigured or exhausted mailer, a
  // template Supabase cannot render, a project setting that forbids the send.
  // None of it is the member's doing and none of it is fixable by waiting, so it
  // is reported rather than hidden behind a success banner.
  throw new Error(error.message);
}

/** Raised when Supabase refuses a resend because one was sent too recently. */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Please wait ${String(retryAfterSeconds)} second${retryAfterSeconds === 1 ? '' : 's'} before requesting another code.`,
    );
    this.name = 'RateLimitError';
  }
}

function isRateLimited(error: AuthError): boolean {
  if (error.code === 'over_email_send_rate_limit') return true;
  return /rate limit|too many|after \d+ seconds?/i.test(error.message);
}

/**
 * Pulls the wait out of Supabase's message ("... after 47 seconds").
 *
 * Falls back to the documented 60-second window when the message carries no
 * number, which is the safe direction to be wrong in: waiting slightly too long
 * costs a moment, while waiting too little produces another refusal.
 */
function secondsToWait(message: string): number {
  const match = /(\d+)\s*seconds?/i.exec(message);
  const parsed = match?.[1] !== undefined ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Restores the session on load, or `null` when there is none.
 *
 * Supabase persists and refreshes its own session, so the only work left is
 * fetching the profile — including the case where signup created the identity
 * but not the profile, which the API client repairs transparently.
 *
 * An unconfirmed session is NOT discarded. It is a real session that becomes
 * usable the moment the member enters the emailed code, so signing it out would
 * throw away the one piece of state the code-entry screen needs — the address
 * to resend to.
 */
export async function restoreSession(): Promise<ProfileResponse | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  try {
    return await api.auth.me();
  } catch (error) {
    if (isEmailNotVerified(error)) throw error;

    // An unrecoverable session is worse than none: signing out clears it so the
    // next attempt starts from a clean login rather than a permanent spinner.
    if (error instanceof APIError && (error.statusCode === 401 || error.statusCode === 409)) {
      await signOut();
      return null;
    }
    throw error;
  }
}

/** The address on the current session, for the resend button. */
export async function currentSessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}
