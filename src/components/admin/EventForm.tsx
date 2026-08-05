import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIError,
  api,
  type EventInput,
  type EventStatus,
  type RallyEvent,
} from '../../api/client';
import type { Gender } from '../../types';

interface EventFormProps {
  /** Absent for create, present for edit. */
  event?: RallyEvent | null;
  onSaved: (saved: RallyEvent, mode: 'created' | 'updated') => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

interface FormState {
  movieName: string;
  description: string;
  cinema: string;
  location: string;
  googleMapsUrl: string;
  bookingUrl: string;
  whatsappInviteLink: string;
  startsAt: string;
  endsAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  capacity: string;
  gender: Gender;
  status: EventStatus;
}

/**
 * `datetime-local` needs 'YYYY-MM-DDTHH:mm' in *local* time, while the API
 * speaks ISO UTC. Converting through the epoch keeps the wall-clock time the
 * admin sees identical to the one they typed.
 *
 * Accepts `null` because the member-facing type marks restricted fields
 * nullable. An admin never receives a redacted event — `getEventForAdmin`
 * deliberately skips the policy — so `null` here means "not set", which is the
 * same empty field as `undefined`.
 */
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function initialState(event?: RallyEvent | null): FormState {
  return {
    movieName: event?.movieName ?? '',
    description: event?.description ?? '',
    cinema: event?.cinema ?? '',
    location: event?.location ?? '',
    googleMapsUrl: event?.googleMapsUrl ?? '',
    bookingUrl: event?.bookingUrl ?? '',
    whatsappInviteLink: event?.whatsappInviteLink ?? '',
    startsAt: isoToLocalInput(event?.startsAt),
    endsAt: isoToLocalInput(event?.endsAt),
    registrationOpenAt: isoToLocalInput(event?.registrationOpenAt),
    registrationCloseAt: isoToLocalInput(event?.registrationCloseAt),
    capacity: event ? String(event.capacity) : '100',
    gender: event?.gender ?? 'MALE',
    status: event?.status ?? 'OPEN',
  };
}

const labelClass =
  'font-label-caps text-xs text-zinc-400 uppercase tracking-wider font-bold';
const inputClass = 'input-glass rounded-2xl px-4 py-3.5 w-full font-body-md text-sm';
const dateInputClass = `${inputClass} [color-scheme:dark]`;

export const EventForm: React.FC<EventFormProps> = ({ event, onSaved, onCancel, onError }) => {
  const isEdit = Boolean(event);

  const [form, setForm] = useState<FormState>(() => initialState(event));
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Held in a ref so the unmount cleanup does not depend on render state and
  // therefore cannot miss the most recent URL.
  const previewUrl = useRef<string | null>(null);

  const setPreview = useCallback((url: string | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setPosterPreview(url);
  }, []);

  // Revoke on unmount: an object URL survives the component otherwise, pinning
  // the decoded image in memory for the life of the document.
  useEffect(
    () => () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = null;
      }
    },
    [],
  );

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePosterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setPoster(file);
      setPreview(file ? URL.createObjectURL(file) : null);
    },
    [setPreview],
  );

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldError(null);

    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setFieldError('Capacity must be a whole number of at least 1.');
      return;
    }
    if (!form.startsAt) {
      setFieldError('A start date and time is required.');
      return;
    }
    if (form.endsAt && form.endsAt <= form.startsAt) {
      setFieldError('The end time must be after the start time.');
      return;
    }
    if (form.registrationCloseAt && form.registrationCloseAt > form.startsAt) {
      setFieldError('Registration must close no later than the screening starts.');
      return;
    }

    const payload: EventInput = {
      movieName: form.movieName.trim(),
      cinema: form.cinema.trim(),
      location: form.location.trim(),
      googleMapsUrl: form.googleMapsUrl.trim() || undefined,
      bookingUrl: form.bookingUrl.trim() || undefined,
      whatsappInviteLink: form.whatsappInviteLink.trim() || undefined,
      description: form.description.trim() || undefined,
      startsAt: localInputToIso(form.startsAt),
      endsAt: localInputToIso(form.endsAt),
      registrationOpenAt: localInputToIso(form.registrationOpenAt),
      registrationCloseAt: localInputToIso(form.registrationCloseAt),
      capacity,
      gender: form.gender,
      status: form.status,
    };

    setSubmitting(true);
    try {
      const saved =
        isEdit && event
          ? await api.admin.events.update(event.id, payload, poster)
          : await api.admin.events.create(payload, poster);
      onSaved(saved, isEdit ? 'updated' : 'created');
    } catch (err) {
      onError(err instanceof APIError ? err.message : 'Saving the screening failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // `?? undefined` because `posterUrl` is nullable on the shared event type and
  // an <img src> may not be null. An admin never sees a redacted event, so this
  // is only ever the "no poster uploaded" case.
  const existingPoster = event?.posterUrl ?? undefined;

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <h2 className="font-headline-md text-xl text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-indigo-400">
            {isEdit ? 'edit_calendar' : 'add_circle'}
          </span>
          {isEdit ? `Edit ${event?.movieName ?? 'screening'}` : 'New Screening'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-700 px-4 py-2 font-label-caps text-xs font-bold text-zinc-400 transition-all hover:text-white hover:border-zinc-600 cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {fieldError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-body-md text-sm text-red-300"
        >
          {fieldError}
        </div>
      )}

      {/* Film and venue */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-movieName">
            Movie Name
          </label>
          <input
            id="ef-movieName"
            className={inputClass}
            type="text"
            required
            placeholder="e.g., Dune: Part Two"
            value={form.movieName}
            onChange={(e) => {
              update('movieName', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-cinema">
            Cinema
          </label>
          <input
            id="ef-cinema"
            className={inputClass}
            type="text"
            required
            placeholder="e.g., Vox Cinemas"
            value={form.cinema}
            onChange={(e) => {
              update('cinema', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-location">
            Location
          </label>
          <input
            id="ef-location"
            className={inputClass}
            type="text"
            required
            placeholder="e.g., Mall of Egypt, Cairo"
            value={form.location}
            onChange={(e) => {
              update('location', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-maps">
            Google Maps URL
          </label>
          <input
            id="ef-maps"
            className={inputClass}
            type="url"
            placeholder="https://maps.google.com/…"
            value={form.googleMapsUrl}
            onChange={(e) => {
              update('googleMapsUrl', e.target.value);
            }}
          />
        </div>
      </div>

      {/* Poster */}
      <div className="grid grid-cols-1 gap-5 border-t border-zinc-800/80 pt-6 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Poster</span>
          <label className="upload-slot relative flex h-56 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 transition-all hover:border-indigo-500/50">
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePosterChange}
            />
            {(posterPreview ?? existingPoster) ? (
              <img
                src={posterPreview ?? existingPoster}
                alt="Poster preview"
                width={200}
                height={224}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                <span className="material-symbols-outlined text-4xl text-zinc-500">image</span>
                <span className="font-body-md text-xs text-zinc-400">Upload poster</span>
                <span className="font-label-caps text-[10px] font-bold text-zinc-500">
                  JPG or PNG · Max 5MB
                </span>
              </div>
            )}
          </label>
          {poster && (
            <p className="flex items-center gap-1 font-label-caps text-xs font-bold text-emerald-400">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {poster.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-description">
            Description
          </label>
          <textarea
            id="ef-description"
            rows={8}
            className={`${inputClass} resize-none`}
            placeholder="What should members know about this screening?"
            value={form.description}
            onChange={(e) => {
              update('description', e.target.value);
            }}
          />
        </div>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 gap-4 border-t border-zinc-800/80 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-startsAt">
            Starts At
          </label>
          <input
            id="ef-startsAt"
            className={dateInputClass}
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(e) => {
              update('startsAt', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-endsAt">
            Ends At
          </label>
          <input
            id="ef-endsAt"
            className={dateInputClass}
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => {
              update('endsAt', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-regOpen">
            Registration Opens
          </label>
          <input
            id="ef-regOpen"
            className={dateInputClass}
            type="datetime-local"
            value={form.registrationOpenAt}
            onChange={(e) => {
              update('registrationOpenAt', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-regClose">
            Registration Closes
          </label>
          <input
            id="ef-regClose"
            className={dateInputClass}
            type="datetime-local"
            value={form.registrationCloseAt}
            onChange={(e) => {
              update('registrationCloseAt', e.target.value);
            }}
          />
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 gap-5 border-t border-zinc-800/80 pt-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className={`${labelClass} flex items-center gap-2`} htmlFor="ef-booking">
            <span className="material-symbols-outlined text-sm text-indigo-400">link</span>
            Booking URL
          </label>
          <input
            id="ef-booking"
            className={inputClass}
            type="url"
            placeholder="https://cinema.example/tickets/…"
            value={form.bookingUrl}
            onChange={(e) => {
              update('bookingUrl', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={`${labelClass} flex items-center gap-2`} htmlFor="ef-whatsapp">
            <span className="material-symbols-outlined text-sm text-emerald-400">forum</span>
            WhatsApp Invite Link
          </label>
          <input
            id="ef-whatsapp"
            className={inputClass}
            type="url"
            placeholder="https://chat.whatsapp.com/…"
            value={form.whatsappInviteLink}
            onChange={(e) => {
              update('whatsappInviteLink', e.target.value);
            }}
          />
        </div>
      </div>

      {/* Capacity, audience, status */}
      <div className="grid grid-cols-1 gap-5 border-t border-zinc-800/80 pt-6 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-capacity">
            Capacity
          </label>
          <input
            id="ef-capacity"
            className={inputClass}
            type="number"
            min={1}
            required
            value={form.capacity}
            onChange={(e) => {
              update('capacity', e.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-gender">
            Audience
          </label>
          <select
            id="ef-gender"
            className={`${inputClass} cursor-pointer appearance-none`}
            value={form.gender}
            onChange={(e) => {
              update('gender', e.target.value as Gender);
            }}
          >
            <option className="bg-zinc-900" value="MALE">
              Male
            </option>
            <option className="bg-zinc-900" value="FEMALE">
              Female
            </option>
          </select>
          <p className="font-body-md text-[11px] text-zinc-500">
            Members of the other gender never receive this screening from the API.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="ef-status">
            Status
          </label>
          <select
            id="ef-status"
            className={`${inputClass} cursor-pointer appearance-none`}
            value={form.status}
            onChange={(e) => {
              update('status', e.target.value as EventStatus);
            }}
          >
            <option className="bg-zinc-900" value="OPEN">
              Open
            </option>
            <option className="bg-zinc-900" value="CLOSED">
              Closed
            </option>
            <option className="bg-zinc-900" value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-zinc-800/80 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-800 px-8 py-3 font-label-caps text-xs font-bold text-zinc-400 transition-all hover:text-white hover:border-zinc-700 cursor-pointer"
        >
          Discard
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex items-center gap-2 rounded-full px-8 py-3.5 font-headline-md text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              <span>Saving…</span>
            </>
          ) : (
            <>
              <span>{isEdit ? 'Save Changes' : 'Create Screening'}</span>
              <span className="material-symbols-outlined text-base">check</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
