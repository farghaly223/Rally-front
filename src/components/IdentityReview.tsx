import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIError, api, type PendingUser } from '../api/client';

/**
 * Identity review queue.
 *
 * Security model, mirrored from the backend:
 *  - No image URL ever exists client-side. Images are fetched as blobs from our
 *    own origin and revoked the moment the review ends.
 *  - Viewing requires the admin's password (elevation), scoped to ONE user.
 *  - The elevation is consumed by the decision, so reviewing the next person
 *    prompts for the password again.
 */
export const IdentityReview: React.FC = () => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<PendingUser | null>(null);
  const [password, setPassword] = useState('');
  const [elevationToken, setElevationToken] = useState<string | null>(null);
  const [images, setImages] = useState<{ selfie?: string; nationalId?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Tracked in a ref so cleanup can revoke them without re-running effects.
  const blobUrls = useRef<string[]>([]);

  const revokeImages = useCallback(() => {
    blobUrls.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    blobUrls.current = [];
    setImages({});
  }, []);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPending(await api.admin.listPending());
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Failed to load the review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  // Revoke blob URLs if the component unmounts mid-review, so decoded identity
  // documents do not linger in memory.
  useEffect(() => revokeImages, [revokeImages]);

  const closeReview = useCallback(() => {
    revokeImages();
    setActive(null);
    setElevationToken(null);
    setPassword('');
    setError(null);
  }, [revokeImages]);

  async function handleUnlock(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!active) return;

    setBusy(true);
    setError(null);

    try {
      const { elevationToken: token } = await api.admin.elevate(active.id, password);
      // Clear immediately — never keep the password in state longer than the
      // request that used it.
      setPassword('');
      setElevationToken(token);

      const next: { selfie?: string; nationalId?: string } = {};

      if (active.hasSelfie) {
        const url = await api.admin.fetchIdentityImage(active.id, 'selfie', token);
        blobUrls.current.push(url);
        next.selfie = url;
      }
      if (active.hasNationalId) {
        const url = await api.admin.fetchIdentityImage(active.id, 'national-id', token);
        blobUrls.current.push(url);
        next.nationalId = url;
      }

      setImages(next);
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Unlock failed');
      setElevationToken(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(decision: 'approve' | 'reject'): Promise<void> {
    if (!active || !elevationToken) return;

    setBusy(true);
    setError(null);

    try {
      const result =
        decision === 'approve'
          ? await api.admin.approve(active.id, elevationToken)
          : await api.admin.reject(active.id, elevationToken);

      setNotice(
        result.assetsPending > 0
          ? `${active.fullName} ${decision}d, but ${String(result.assetsPending)} document(s) could not be deleted and are queued for retry.`
          : `${active.fullName} ${decision}d. ${String(result.assetsDeleted)} document(s) permanently destroyed.`,
      );

      closeReview();
      await loadPending();
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Decision failed');
      // A consumed or expired elevation cannot be reused — force a re-unlock.
      if (err instanceof APIError && err.statusCode === 403) {
        revokeImages();
        setElevationToken(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-400 font-body-md text-sm">Loading review queue…</p>;
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {error && !active && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {pending.length === 0 ? (
        <p className="text-zinc-400 font-body-md text-sm">No users awaiting verification.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div>
                <p className="font-headline-md text-sm text-white">{user.fullName}</p>
                <p className="font-body-md text-xs text-zinc-400">
                  {user.phone} · {user.gender}
                </p>
                {(!user.hasSelfie || !user.hasNationalId) && (
                  <p className="mt-1 text-xs text-amber-400">Documents incomplete</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActive(user);
                  setNotice(null);
                }}
                disabled={!user.hasSelfie || !user.hasNationalId}
                className="rounded-full bg-indigo-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
              >
                Review
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-[32px] border border-zinc-800 bg-zinc-900 p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="font-display-lg text-2xl text-white">{active.fullName}</h2>
                <p className="font-body-md text-sm text-zinc-400">{active.phone}</p>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="text-zinc-400 hover:text-white"
                aria-label="Close review"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!elevationToken ? (
              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="font-body-md text-sm text-zinc-300">
                    Re-enter your password to view this person&apos;s identity documents.
                    Access is limited to this user and ends when you decide.
                  </p>
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  placeholder="Your admin password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={busy || password.length === 0}
                  className="w-full rounded-full bg-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
                >
                  {busy ? 'Verifying…' : 'Unlock documents'}
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(['selfie', 'nationalId'] as const).map((key) => (
                    <figure key={key}>
                      <figcaption className="mb-2 text-xs font-bold uppercase text-indigo-400">
                        {key === 'selfie' ? 'Personal photo' : 'Official ID'}
                      </figcaption>
                      {images[key] ? (
                        <img
                          src={images[key]}
                          alt={key === 'selfie' ? 'Personal photo' : 'Official ID'}
                          className="h-64 w-full rounded-2xl border border-zinc-800 object-contain bg-zinc-950"
                        />
                      ) : (
                        <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
                          Not provided
                        </div>
                      )}
                    </figure>
                  ))}
                </div>

                <p className="text-center text-xs text-amber-400">
                  These documents are permanently destroyed the moment you decide.
                </p>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => void handleDecision('reject')}
                    disabled={busy}
                    className="flex-1 rounded-full border border-red-500/40 py-3 text-xs font-bold uppercase tracking-wider text-red-300 disabled:opacity-40"
                  >
                    {busy ? 'Working…' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDecision('approve')}
                    disabled={busy}
                    className="flex-1 rounded-full bg-emerald-600 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
                  >
                    {busy ? 'Working…' : 'Approve'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
