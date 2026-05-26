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

    // Get all content item IDs for this workspace
    const { data: items } = await supabase
      .from('content_items')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (!items || items.length === 0) {
      setCounts(new Map());
      setLoading(false);
      return;
    }

    const itemIds = items.map(i => i.id);

    // Fetch all subtasks for these items
    const { data: subtasks } = await supabase
      .from('subtasks')
      .select('content_item_id, completed')
      .in('content_item_id', itemIds);

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
