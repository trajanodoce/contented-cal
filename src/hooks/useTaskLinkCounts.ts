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

    // Filter by workspace through both join sides — a row only counts if
    // BOTH item_a and item_b are in the requested workspace (they always
    // are by RPC contract, but RLS allows belt-and-suspenders here).
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

  return { counts, loading, refresh: fetchCounts };
}
