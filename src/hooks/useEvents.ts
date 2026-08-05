import { useCallback, useEffect, useState } from 'react';
import { APIError, api, type EventListQuery } from '../api/client';
import type { RallyEvent } from '../types';

interface UseEventsResult {
  events: RallyEvent[];
  total: number;
  loading: boolean;
  error: string | null;
  /**
   * True when the server refused this query because the member is not verified.
   *
   * Kept separate from `error` so the UI can offer the one action that resolves
   * it — verify — instead of showing a generic failure the member cannot act on.
   */
  searchRefused: boolean;
  reload: () => void;
}

/** Matches the backend's search-side-channel refusal. */
const FORBIDDEN = 403;

/**
 * Loads the member-facing event list.
 *
 * The query has no gender parameter and never will: the server scopes the
 * response to the caller. Whatever arrives is rendered verbatim — including
 * `null` on any field the server chose to withhold.
 *
 * `search` is forwarded to the server. It is debounced because each keystroke
 * would otherwise be a request, and because the endpoint answers 403 for an
 * uncleared member — one refusal per settled query is informative, one per
 * keystroke is noise.
 */
export function useEvents(query: EventListQuery = {}): UseEventsResult {
  const { page, pageSize, search, status } = query;

  const [events, setEvents] = useState<RallyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchRefused, setSearchRefused] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const reload = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await api.events.list({
          page,
          pageSize,
          search: debouncedSearch,
          status,
        });
        if (cancelled) return;
        setEvents(data.events);
        setTotal(data.total);
        setSearchRefused(false);
      } catch (err) {
        if (cancelled) return;

        // A refused search is not a broken list. The previously loaded events
        // stay on screen: clearing them would make it look as though verifying
        // is required to browse at all, which is not the rule.
        if (err instanceof APIError && err.statusCode === FORBIDDEN && debouncedSearch) {
          setSearchRefused(true);
          return;
        }

        setEvents([]);
        setTotal(0);
        setSearchRefused(false);
        setError(err instanceof APIError ? err.message : 'Failed to load screenings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, debouncedSearch, status, nonce]);

  return { events, total, loading, error, searchRefused, reload };
}
