import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types matching the edge function ─────────────────────────────────────────

export interface GranolaNoteSummary {
  id: string;
  title: string | null;
  owner: { name: string | null; email: string };
  created_at: string;
  updated_at: string;
}

export interface GranolaFetchResult {
  notes: GranolaNoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

export interface GranolaSyncResult {
  synced: number;
  total: number;
  errors?: string[];
}

export interface GranolaLinkResult {
  linked: {
    id: string;
    granola_note_id: string;
    content_item_id: string;
    note_title: string | null;
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGranolaSync(workspaceId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async (body: Record<string, unknown>) => {
      if (!workspaceId) throw new Error('No workspace');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/granola-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ workspace_id: workspaceId, ...body }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      return json;
    },
    [workspaceId]
  );

  /** Browse the user's Granola notes (paginated) */
  const fetchNotes = useCallback(
    async (opts?: { updated_after?: string; cursor?: string; page_size?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const result = (await invoke({ action: 'fetch', ...opts })) as GranolaFetchResult;
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch notes';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  /** Link a Granola note to a content item */
  const linkNote = useCallback(
    async (granolaNoteId: string, contentItemId: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = (await invoke({
          action: 'link',
          granola_note_id: granolaNoteId,
          content_item_id: contentItemId,
        })) as GranolaLinkResult;
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to link note';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  /** Refresh metadata for all already-linked notes */
  const syncNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await invoke({ action: 'sync' })) as GranolaSyncResult;
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sync notes';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  return { fetchNotes, linkNote, syncNotes, loading, error };
}
