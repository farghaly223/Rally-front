import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api, APIError, type ProfileResponse } from '../api/client';
import type { Gender } from '../types';

/**
 * Signup, login, and session restore.
 *
 * The single rule this module exists to enforce: the password goes to Supabase
 * and nowhere else. Our own backend never receives one, never has an endpoint
 * that would accept one, and only ever sees the access token Supabase issued.
 */

export interface SignUpInput {
  phone: string;
  password: string;
  fullName: string;
  gender: Gender;
}

/**
 * A phone number is claimed permanently — never released on rejection,
 * suspension, or deletion — so a duplicate signup is final, not a retry.
 * Supabase reports it with its own wording; this replaces it with a message
 * that does not imply trying again will help.
 */
const PHONE_TAKEN =
  'This phone number is already registered. Each number can create one account only.';

function isPhoneTaken(error: AuthError): boolean {
  if (error.code === 'phone_exists' || error.code === 'user_already_exists') return true;
  // Older Supabase releases only carry the condition in the message text.
  return /already (registered|exists)|already been registered/i.test(error.message);
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Creates the Supabase identity, then the Rally profile.
 *
 * `fullName` and `gender` must ride in `options.data`: Supabase has no column
 * for either, and `complete-profile` reads them out of `user_metadata` to build
 * the profile. Without them the backend cannot decide male-auto-approve versus
 * female-pending.
 *
 * If the second call fails the account still exists, half-made. That is not
 * treated as fatal here — `restoreSession` retries it on the next load, and the
 * API client retries it on any 409 `PROFILE_INCOMPLETE` — so the error is
 * reported without discarding a session the member can still recover from.
 */
export async function signUp(input: SignUpInput): Promise<ProfileResponse> {
  const { error } = await supabase.auth.signUp({
    phone: input.phone,
    password: input.password,
    options: { data: { fullName: input.fullName, gender: input.gender } },
  });

  if (error) {
    throw new Error(isPhoneTaken(error) ? PHONE_TAKEN : error.message);
  }

  return api.auth.completeProfile();
}

export async function signIn(phone: string, password: string): Promise<ProfileResponse> {
  const { error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) throw new Error(error.message);

  // A session whose profile never got created still lands here; `me` answers
  // 409 PROFILE_INCOMPLETE and the API client completes it before retrying.
  return api.auth.me();
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
 */
export async function restoreSession(): Promise<ProfileResponse | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  try {
    return await api.auth.me();
  } catch (error) {
    // An unrecoverable session is worse than none: signing out clears it so the
    // next attempt starts from a clean login rather than a permanent spinner.
    if (error instanceof APIError && (error.statusCode === 401 || error.statusCode === 409)) {
      await signOut();
      return null;
    }
    throw error;
  }
}
