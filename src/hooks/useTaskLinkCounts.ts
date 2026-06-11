import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Workspace-wide map of taskId → number of tasks it's linked to.
 *
 * Mirrors useSubtaskCounts / useExternalLinkCounts. Used by card-indicator
 * rendering in Board / List / Calendar views. A task gets a chain-link
 * indicator when count > 0; click-through opens it in the slide-over.
 */
export function useTaskLinkCounts(workspaceId: string | null) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!workspaceId) {
      setCounts(new Map());
      return;
    }
    setLoading(true);

    // Filter by workspace via item_a's joined content_items row. Pairs are
    // always same-workspace (link_tasks enforces it), so filtering one side
    // is sufficient — no need to join item_b as well.
    const { data, error } = await supabase
      .from('content_item_links')
      .select(
        'item_a_id, item_b_id, content_items!content_item_links_item_a_id_fkey!inner(workspace_id)'
      )
      .eq('content_items.workspace_id', workspaceId);

    if (error) {
      console.error('[useTaskLinkCounts] failed to load:', error.message);
      setLoading(false);
      return;
    }

    const map = new Map<string, number>();
    if (data) {
      for (const row of data) {
        map.set(row.item_a_id, (map.get(row.item_a_id) ?? 0) + 1);
        map.set(row.item_b_id, (map.get(row.item_b_id) ?? 0) + 1);
      }
    }
    setCounts(map);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime: refresh counts when any content_item_links row changes for
  // this workspace. content_item_links doesn't have a workspace_id column
  // (workspace is enforced via the joined content_items rows + RLS), so
  // there's no server-side filter we can apply — we subscribe to all
  // INSERT/DELETE events on the table and let fetchCounts() re-scope by
  // workspace on the next query. Cheap: the table is small and the query
  // already joins through content_items.workspace_id.
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`task_link_counts:${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_item_links',
      }, () => {
        fetchCounts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchCounts]);

  return { counts, loading, refresh: fetchCounts };
}
