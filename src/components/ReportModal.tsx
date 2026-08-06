import React, { useState } from 'react';
import { api, APIError, type ReportReason } from '../api/client';

/**
 * The two ways this modal is opened, mirroring the backend's report shape:
 *
 *  * **EVENT** — opened from an event the member is already looking at. The id is
 *    known and passed straight through; the member never types it.
 *  * **USER** — opened from the member's own profile to report another member.
 *    There is deliberately NO id and NO way to pick a person from a list: the
 *    member *types* a phone number or name, and the server resolves it privately.
 *    Whether it matched an account never comes back — the success screen is the
 *    same either way — so this cannot be used to discover who is on Rally.
 */
type ReportModalProps =
  | {
      targetType: 'EVENT';
      targetId: string;
      /** The film title, shown for confirmation. */
      targetLabel: string;
      onClose: () => void;
    }
  | {
      targetType: 'USER';
      onClose: () => void;
    };

/**
 * The reasons a member may pick. The set differs by target: an event cannot be
 * a fake profile, and a user cannot have incorrect event details. Filtering the
 * list here keeps the member from filing a report the admin would only discard.
 */
const USER_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'INAPPROPRIATE_BEHAVIOUR', label: 'Inappropriate behavior' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
];

const EVENT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'INCORRECT_EVENT_DETAILS', label: 'Incorrect event details' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
];

export const ReportModal: React.FC<ReportModalProps> = (props) => {
  const { targetType, onClose } = props;
  const reasons = targetType === 'USER' ? USER_REASONS : EVENT_REASONS;

  const [reason, setReason] = useState<ReportReason>(reasons[0].value);
  const [details, setDetails] = useState('');
  // Only used in USER mode: the phone or name the member types. In EVENT mode the
  // subject is the known event id and this stays empty.
  const [subjectQuery, setSubjectQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const trimmedQuery = subjectQuery.trim();
  const canSubmit = !submitting && (targetType === 'EVENT' || trimmedQuery.length > 0);

  const handleSubmit = (): void => {
    setError(null);
    setSubmitting(true);

    void (async () => {
      try {
        if (targetType === 'USER') {
          await api.reports.submit({
            targetType: 'USER',
            subjectQuery: trimmedQuery,
            reason,
            details: details.trim() || undefined,
          });
        } else {
          await api.reports.submit({
            targetType: 'EVENT',
            targetId: props.targetId,
            reason,
            details: details.trim() || undefined,
          });
        }
        setDone(true);
      } catch (err) {
        setError(
          err instanceof APIError ? err.message : 'Could not submit your report. Try again.',
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-md rounded-[32px] border border-zinc-800 bg-[#09090b]/95 p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-6 top-6 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/20 text-emerald-400">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div>
              <h2 className="font-headline-md text-lg text-white">Report submitted</h2>
              <p className="mt-1 font-body-md text-sm text-zinc-400">
                Thank you. Our team will review this and take action if needed.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary font-headline-md mt-2 w-full rounded-full py-3 text-xs uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-start gap-4">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
                <span className="material-symbols-outlined text-xl">flag</span>
              </span>
              <div>
                <h2 id="report-modal-title" className="font-headline-md text-lg text-white">
                  Report {targetType === 'USER' ? 'a member' : 'this event'}
                </h2>
                <p className="mt-1 font-body-md text-sm text-zinc-400">
                  {targetType === 'USER'
                    ? 'Enter the member’s phone number or name.'
                    : props.targetLabel}
                </p>
              </div>
            </div>

            {targetType === 'USER' && (
              <div className="mb-4">
                <label className="font-label-caps mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Phone number or name
                </label>
                <input
                  type="text"
                  value={subjectQuery}
                  onChange={(e) => setSubjectQuery(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-body-md text-sm text-white placeholder-zinc-500"
                  placeholder="e.g. 01xxxxxxxxx or their full name"
                />
                <p className="mt-2 font-body-md text-[11px] text-zinc-500">
                  We’ll match this to their account privately. You won’t be told
                  whether it matched, and they’re never told who reported them.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="font-label-caps mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-body-md text-sm text-white cursor-pointer"
              >
                {reasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="font-label-caps mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Details (optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-body-md text-sm text-white placeholder-zinc-500"
                placeholder="What happened? Give us any context that helps."
              />
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                <span className="material-symbols-outlined text-lg text-red-400">error</span>
                <p className="font-body-md text-xs text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-full border border-zinc-700 py-3 font-label-caps text-xs font-bold uppercase tracking-wider text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-danger flex-1 py-3 font-label-caps text-xs font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer"
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
