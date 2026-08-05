import React, { useState } from 'react';
import { UserProfile } from '../types';
import { APIError, api, type AuthUser } from '../api/client';

interface JoinPremiereProps {
  onSuccess: (user: UserProfile, requireVerification?: boolean) => void;
  onNavigateToLogin?: () => void;
}

/** `username` is display-only; the backend does not model it. */
function toProfile(user: AuthUser, preferred: string): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    username: preferred.trim() || user.fullName.trim().split(/\s+/)[0]?.toLowerCase() || 'member',
    gender: user.gender,
    role: user.role,
    approvalStatus: user.approvalStatus,
  };
}

export const JoinPremiere: React.FC<JoinPremiereProps> = ({ onSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields — empty by default. Pre-filled credentials invite accidental
  // submission of someone else's placeholder identity.
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isLoginMode) {
        const { user } = await api.auth.login({ phone, password });
        setPassword('');
        // An already-approved user goes straight in; anyone else still owes
        // documents, and the server decides which.
        onSuccess(toProfile(user, username), user.approvalStatus !== 'APPROVED');
      } else {
        if (gender === '') {
          setError('Please select your gender.');
          return;
        }
        const { user } = await api.auth.register({ phone, password, fullName, gender });
        setPassword('');
        onSuccess(toProfile(user, username), true);
      }
    } catch (err) {
      setError(
        err instanceof APIError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 md:p-10 relative overflow-hidden font-body-md text-body-md bg-[#0A0A0A]">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="w-full h-full bg-cover bg-center opacity-40 transition-opacity duration-1000"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAetIINZkPdizKrOumRPQ3pbSp_Zkgi6twLjELM72it4ujogXZvMKvuwQGiqbrV-Rbyb5EICID-NsDqugxsuZn3RmrdgnOO-ESW8Y1lF4GmFTSGvVRX0CGBkiPHSJ6rlrIX2wyAZFMwv7IKPLKefevYJ7WiUlpyehzCcM46nNVxHy3LOesZP18lDNS7A3JSu4JE8hL9ki4CqfNryCSSPQsGlEJqTw33uo2XuXYb_RDoqicq_xdGu7rZ')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/80 to-transparent" />
      </div>

      {/* Registration Card */}
      <div className="relative z-10 w-full max-w-md my-8">
        {/* Brand / Header */}
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl md:text-5xl text-[#e50914] tracking-tighter mb-2 drop-shadow-[0_0_20px_rgba(229,9,20,0.5)]">
            RALLY
          </h1>
          <p className="font-label-caps text-xs text-[#e9bcb6] uppercase tracking-widest">
            {isLoginMode ? 'Access Your Tickets' : 'Exclusive Access'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-8 shadow-2xl flex flex-col gap-5 border border-white/10">
          {!isLoginMode && (
            <>
              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="fullName">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[#c9c6c5] text-xl">
                    person
                  </span>
                  <input
                    className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLoginMode}
                    type="text"
                  />
                </div>
              </div>
            </>
          )}

          {/* Phone — the credential the backend authenticates on, so it is
              required in both modes. */}
          <div className="flex flex-col gap-2">
            <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="phone">
              Phone Number
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#c9c6c5] text-xl">
                call
              </span>
              <input
                className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                id="phone"
                placeholder="+201234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                type="tel"
              />
            </div>
          </div>

          {!isLoginMode && (
            /* Username — display only. Optional, because the backend does not
               store it and nothing authorizes on it. */
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="username">
                Display Name <span className="text-[#c9c6c5]/60">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[#c9c6c5] text-xl">
                  alternate_email
                </span>
                <input
                  className="input-glass w-full rounded py-3 pl-10 pr-4 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                  id="username"
                  placeholder="rally_fan"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#c9c6c5] text-xl">
                lock
              </span>
              <input
                className="input-glass w-full rounded py-3 pl-10 pr-10 font-body-md text-[#e5e2e1] placeholder-[#c9c6c5]/50"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
              />
              <button
                className="absolute right-3 text-[#c9c6c5] hover:text-[#ffb4aa] transition-colors focus:outline-none"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {!isLoginMode && (
            /* Gender Select */
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-[#c9c6c5]" htmlFor="gender">
                Gender
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[#c9c6c5] z-10 text-xl">
                  wc
                </span>
                <select
                  className="input-glass w-full rounded py-3 pl-10 pr-10 font-body-md text-[#e5e2e1] appearance-none cursor-pointer"
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | '')}
                  required={!isLoginMode}
                >
                  <option className="bg-[#2a2a2a] text-[#c9c6c5]" value="" disabled>
                    Select...
                  </option>
                  {/* MALE / FEMALE only — these are the two values the backend's
                      Gender enum accepts, and events are segregated on them. */}
                  <option className="bg-[#2a2a2a] text-[#e5e2e1]" value="FEMALE">
                    Female
                  </option>
                  <option className="bg-[#2a2a2a] text-[#e5e2e1]" value="MALE">
                    Male
                  </option>
                </select>
                <span className="material-symbols-outlined absolute right-3 text-[#c9c6c5] pointer-events-none text-xl">
                  expand_more
                </span>
              </div>
            </div>
          )}

          {/* Error banner. The message is whatever the server said; the client
              never invents a reason a login failed. */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#e50914]/40 bg-[#e50914]/10 px-4 py-3 font-body-md text-sm text-[#ffb4aa] flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-lg leading-none">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit CTA */}
          <button
            className="btn-primary w-full py-4 mt-4 rounded-lg font-headline-md text-lg flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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

          <p className="text-center font-label-caps text-xs text-[#c9c6c5] mt-2">
            {isLoginMode ? "Don't have a ticket pass?" : 'Already have a ticket?'}
            <button
              type="button"
              className="text-[#ffb4aa] hover:text-[#e50914] transition-colors ml-1.5 underline cursor-pointer"
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
