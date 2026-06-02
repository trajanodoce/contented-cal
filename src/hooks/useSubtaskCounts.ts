import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SubtaskCount {
  total: number;
  completed: number;
}

/**
 * Fetches subtask counts for all items in a workspace.
 * Returns a Map<contentItemId, SubtaskCount>.
 */
export function useSubtaskCounts(workspaceId: string | null) {
  const [counts, setCounts] = useState<Map<string, SubtaskCount>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!workspaceId) {
      setCounts(new Map());
      return;
    }
    setLoading(true);

    // Single query: join through content_items FK to filter by workspace
    const { data: subtasks, error } = await supabase
      .from('subtasks')
      .select('content_item_id, completed, content_items!inner(workspace_id)')
      .eq('content_items.workspace_id', workspaceId);

    if (error) {
      console.error('[useSubtaskCounts] failed to load:', error.message);
    }

    const map = new Map<string, SubtaskCount>();
    if (subtasks) {
      for (const st of subtasks) {
        const existing = map.get(st.content_item_id) ?? { total: 0, completed: 0 };
        existing.total++;
        if (st.completed) existing.completed++;
        map.set(st.content_item_id, existing);
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
