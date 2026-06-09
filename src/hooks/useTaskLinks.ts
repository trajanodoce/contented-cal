import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ContentItem } from '../lib/database.types';

/**
 * Per-item hook for the Linked Tasks section in DetailSlideOver.
 *
 * Returns the list of full task records linked to `itemId` (resolving both
 * sides of the canonical (a, b) pair), plus link/unlink helpers backed by
 * SECURITY DEFINER RPCs that handle canonical ordering server-side.
 */
export function useTaskLinks(itemId: string | null) {
  const [linkedTasks, setLinkedTasks] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!itemId) {
      setLinkedTasks([]);
      return;
    }
    setLoading(true);
    setError(null);

    // Two queries because PostgREST .or() with nested joins is painful here —
    // one fetches the b-side of pairs where this item is `a`, the other the
    // a-side where this item is `b`. Both join `content_items` to hydrate.
    const [aSide, bSide] = await Promise.all([
      supabase
        .from('content_item_links')
        .select('item_b_id, content_items!content_item_links_item_b_id_fkey(*)')
        .eq('item_a_id', itemId),
      supabase
        .from('content_item_links')
        .select('item_a_id, content_items!content_item_links_item_a_id_fkey(*)')
        .eq('item_b_id', itemId),
    ]);

    if (aSide.error || bSide.error) {
      const msg = aSide.error?.message ?? bSide.error?.message ?? 'Unknown error';
      console.error('[useTaskLinks] failed to load:', msg);
      setError(msg);
      setLoading(false);
      return;
    }

    const tasks: ContentItem[] = [];
    aSide.data?.forEach((row) => {
      // content_items embed is typed as a single object via the FK relationship
      const ci = (row as unknown as { content_items: ContentItem | null }).content_items;
      if (ci) tasks.push(ci);
    });
    bSide.data?.forEach((row) => {
      const ci = (row as unknown as { content_items: ContentItem | null }).content_items;
      if (ci) tasks.push(ci);
    });

    setLinkedTasks(tasks);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  /**
   * Link this task to another task. Server normalizes (a, b) ordering and
   * verifies same-workspace + admin/editor role. Idempotent — re-linking
   * an existing pair is a silent no-op (RPC returns null).
   */
  const linkTo = useCallback(
    async (otherTaskId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!itemId) return { ok: false, error: 'No item selected' };
      const { error: rpcError } = await supabase.rpc('link_tasks', {
        p_task_a: itemId,
        p_task_b: otherTaskId,
      });
      if (rpcError) {
        console.error('[useTaskLinks] link failed:', rpcError.message);
        return { ok: false, error: rpcError.message };
      }
      await fetchLinks();
      return { ok: true };
    },
    [itemId, fetchLinks]
  );

  /**
   * Remove the link between this task and the other one. Server also
   * un-checks any auto-managed "Request design" subtask on the content
   * side of a content↔design pair (see migration comments).
   */
  const unlinkFrom = useCallback(
    async (otherTaskId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!itemId) return { ok: false, error: 'No item selected' };
      const { error: rpcError } = await supabase.rpc('unlink_tasks', {
        p_task_a: itemId,
        p_task_b: otherTaskId,
      });
      if (rpcError) {
        console.error('[useTaskLinks] unlink failed:', rpcError.message);
        return { ok: false, error: rpcError.message };
      }
      await fetchLinks();
      return { ok: true };
    },
    [itemId, fetchLinks]
  );

  return { linkedTasks, loading, error, refresh: fetchLinks, linkTo, unlinkFrom };
}
