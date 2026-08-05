import React, { useCallback, useEffect, useState } from 'react';
import { APIError, api } from '../../api/client';
import {
  VERIFICATION_PLATFORM_LABEL,
  type VerificationPlatform,
} from '../../types';
import type { ToastKind } from '../ui/Toast';

interface VerificationContactSettingsProps {
  notify: (kind: ToastKind, text: string) => void;
}

const PLATFORMS: VerificationPlatform[] = ['INSTAGRAM', 'TELEGRAM', 'TIKTOK'];

const inputClass = 'input-glass rounded-2xl px-4 py-3.5 w-full font-body-md text-sm';
const labelClass = 'font-label-caps text-xs font-bold uppercase tracking-wider text-zinc-400';

/**
 * The handle pending members are told to message.
 *
 * Editable so the person doing verification can change without a deploy — which
 * is also why the member-facing screen reads it from the API rather than holding
 * a constant.
 */
export const VerificationContactSettings: React.FC<VerificationContactSettingsProps> = ({
  notify,
}) => {
  const [platform, setPlatform] = useState<VerificationPlatform>('INSTAGRAM');
  const [handleOrUrl, setHandleOrUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const contact = await api.admin.verification.getContact();
        if (cancelled || !contact) return;
        setPlatform(contact.platform);
        setHandleOrUrl(contact.handleOrUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof APIError ? err.message : 'Failed to load the contact.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = handleOrUrl.trim();
      if (trimmed === '') {
        setError('A handle or URL is required.');
        return;
      }

      setSaving(true);
      setError(null);
      try {
        const saved = await api.admin.verification.updateContact({
          platform,
          handleOrUrl: trimmed,
        });
        setPlatform(saved.platform);
        setHandleOrUrl(saved.handleOrUrl);
        notify('success', 'Verification contact updated.');
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : 'Could not update the contact.';
        setError(message);
        notify('error', message);
      } finally {
        setSaving(false);
      }
    },
    [handleOrUrl, notify, platform],
  );

  return (
    <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
      <div className="mb-6 border-b border-zinc-800/80 pb-4">
        <h2 className="font-headline-md text-xl text-white">Verification Contact</h2>
        <p className="font-body-md mt-1 text-sm text-zinc-400">
          The account pending members are told to message. Changing it takes effect
          immediately, with no deploy.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="font-body-md mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body-md text-sm text-zinc-400">Loading contact…</p>
      ) : (
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr_auto] md:items-end"
        >
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="vc-platform">
              Platform
            </label>
            <select
              id="vc-platform"
              className={`${inputClass} cursor-pointer appearance-none`}
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value as VerificationPlatform);
              }}
            >
              {PLATFORMS.map((option) => (
                <option key={option} className="bg-zinc-900" value={option}>
                  {VERIFICATION_PLATFORM_LABEL[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="vc-handle">
              Handle or URL
            </label>
            <input
              id="vc-handle"
              className={inputClass}
              type="text"
              required
              placeholder="@rally_verify"
              value={handleOrUrl}
              onChange={(e) => {
                setHandleOrUrl(e.target.value);
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary font-headline-md flex cursor-pointer items-center justify-center gap-2 rounded-full px-8 py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
            <span className="material-symbols-outlined text-base">check</span>
          </button>
        </form>
      )}
    </section>
  );
};
