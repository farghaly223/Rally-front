import React, { useState } from 'react';
import {
  authErrorMessage,
  isEmailNotVerified,
  signIn,
  signUp,
  type SignUpInput,
} from '../lib/auth';
import type { Gender, UserProfile, VerificationContact } from '../types';

interface JoinPremiereProps {
  /**
   * The contact is handed straight through from the signup response rather
   * than refetched. A female lands on the verification screen already knowing
   * who to message, and the app never briefly shows her a screen telling her
   * to contact nobody.
   */
  onSuccess: (user: UserProfile, verificationContact: VerificationContact | null) => void;
  /**
   * Raised when the account exists but its address is unconfirmed — after
   * signup, and on a login whose session Supabase or our backend refuses for
   * that reason. The parent swaps in the confirmation screen.
   */
  onEmailUnverified: (email: string) => void;
}

/** `username` is display-only; the backend does not model it. */
function toProfile(
  id: string,
  fullName: string,
  phone: string,
  gender: Gender,
  role: UserProfile['role'],
  approvalStatus: UserProfile['approvalStatus'],
  preferred: string,
): UserProfile {
  return {
    id,
    fullName,
    phone,
    username: preferred.trim() || fullName.trim().split(/\s+/)[0]?.toLowerCase() || 'member',
    gender,
    role,
    approvalStatus,
  };
}

export const JoinPremiere: React.FC<JoinPremiereProps> = ({ onSuccess, onEmailUnverified }) => {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isLoginMode) {
        const { user, verificationContact } = await signIn(email, password);
        setPassword('');
        onSuccess(
          toProfile(
            user.id,
            user.fullName,
            user.phone,
            user.gender,
            user.role,
            user.approvalStatus,
            username,
          ),
          verificationContact,
        );
      } else {
        if (gender === '') {
          setError('Please select your gender.');
          return;
        }

        const input: SignUpInput = {
          email,
          password,
          fullName,
          phone,
          gender,
          ...(username.trim() ? { username: username.trim() } : {}),
        };
        const result = await signUp(input);
        setPassword('');

        // The ordinary path when confirmations are on: Supabase issues no
        // session until the link is opened, so there is no profile to hand up.
        if (result.needsEmailConfirmation || !result.profile) {
          onEmailUnverified(result.email);
          return;
        }

        const { user, verificationContact } = result.profile;
        onSuccess(
          toProfile(
            user.id,
            user.fullName,
            user.phone,
            user.gender,
            user.role,
            user.approvalStatus,
            username,
          ),
          verificationContact,
        );
      }
    } catch (err) {
      // An unverified address is not a failed login — the credentials were
      // right. Showing the error here would leave the member retrying a form
      // that cannot succeed until they enter the emailed code.
      if (isEmailNotVerified(err)) {
        setPassword('');
        onEmailUnverified(email.trim().toLowerCase());
        return;
      }
      setError(authErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] p-5 font-body-md text-body-md md:p-10">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="h-full w-full bg-cover bg-center opacity-40 transition-opacity duration-1000"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAetIINZkPdizKrOumRPQ3pbSp_Zkgi6twLjELM72it4ujogXZvMKvuwQGiqbrV-Rbyb5EICID-NsDqugxsuZn3RmrdgnOO-ESW8Y1lF4GmFTSGvVRX0CGBkiPHSJ6rlrIX2wyAZFMwv7IKPLKefevYJ7WiUlpyehzCcM46nNVxHy3LOesZP18lDNS7A3JSu4JE8hL9ki4CqfNryCSSPQsGlEJqTw33uo2XuXYb_RDoqicq_xdGu7rZ')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/80 to-transparent" />
      </div>

      <div className="relative z-10 my-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display-lg mb-2 text-4xl tracking-tighter text-[#e50914] drop-shadow-[0_0_20px_rgba(229,9,20,0.5)] md:text-5xl">
            RALLY
          </h1>
          <p className="font-label-caps text-xs uppercase tracking-widest text-[#e9bcb6]">
            {isLoginMode ? 'Access Your Tickets' : 'Exclusive Access'}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="glass-card flex flex-col gap-5 rounded-xl border border-white/10 p-8 shadow-2xl"
        >
          {!isLoginMode && (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="fullName">
                Full Name
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-xl text-[#c9c6c5]">
                  person
                </span>
                <input
                  className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                  }}
                  required={!isLoginMode}
                  type="text"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="email">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-xl text-[#c9c6c5]">
                mail
              </span>
              <input
                className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                required
                autoComplete="email"
                type="email"
              />
            </div>
          </div>

          {!isLoginMode && (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="phone">
                Phone Number
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-xl text-[#c9c6c5]">
                  call
                </span>
                <input
                  className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                  id="phone"
                  placeholder="+201234567890"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                  }}
                  required={!isLoginMode}
                  autoComplete="tel"
                  type="tel"
                />
              </div>
              {/* Said plainly, because it is never verified and must not look
                  as though it were. */}
              <p className="font-body-md text-xs text-[#c9c6c5]/60">
                For your profile only — we never send you a text message.
              </p>
            </div>
          )}

          {!isLoginMode && (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="username">
                Display Name <span className="text-[#c9c6c5]/60">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-xl text-[#c9c6c5]">
                  alternate_email
                </span>
                <input
                  className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                  id="username"
                  placeholder="rally_fan"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  type="text"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-xl text-[#c9c6c5]">
                lock
              </span>
              <input
                className="input-glass w-full rounded py-3 pl-10 pr-10 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                required
                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
              />
              <button
                className="absolute right-3 text-[#c9c6c5] transition-colors hover:text-[#ffb4aa] focus:outline-none"
                type="button"
                onClick={() => {
                  setShowPassword(!showPassword);
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {!isLoginMode && (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="gender">
                Gender
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 z-10 text-xl text-[#c9c6c5]">
                  wc
                </span>
                <select
                  className="input-glass w-full cursor-pointer appearance-none rounded py-3 pl-10 pr-10 font-body-md text-[#e5e2e1]"
                  id="gender"
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as Gender | '');
                  }}
                  required={!isLoginMode}
                >
                  <option className="bg-[#2a2a2a] text-[#c9c6c5]" value="" disabled>
                    Select...
                  </option>
                  <option className="bg-[#2a2a2a] text-[#e5e2e1]" value="FEMALE">
                    Female
                  </option>
                  <option className="bg-[#2a2a2a] text-[#e5e2e1]" value="MALE">
                    Male
                  </option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 text-xl text-[#c9c6c5]">
                  expand_more
                </span>
              </div>
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

          <button
            className="btn-primary font-headline-md mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-4 text-lg disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Please wait…'
              : isLoginMode
                ? 'Access Tickets'
                : 'Join the Premiere'}
            <span className="material-symbols-outlined text-2xl">
              {isLoginMode ? 'confirmation_number' : 'movie_filter'}
            </span>
          </button>

          <p className="font-label-caps mt-2 text-center text-xs text-[#c9c6c5]">
            {isLoginMode ? "Don't have a ticket pass?" : 'Already have a ticket?'}
            <button
              type="button"
              className="ml-1.5 cursor-pointer text-[#ffb4aa] underline transition-colors hover:text-[#e50914]"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
              }}
            >
              {isLoginMode ? 'Register here' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};
