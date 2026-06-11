import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Returns a Set of content_item_ids that have linked Granola meeting notes.
 * Used to show the 🎙️ indicator on calendar pills, board cards, and list rows.
 */
export function useGranolaItemIds(workspaceId: string | null): Set<string> {
  const [granolaItemIds, setGranolaItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceId) return;
    // Bind the narrowed value into a parameter so TS knows it's a string
    // inside the async function (closure narrowing doesn't propagate).
    const wsId = workspaceId;

    async function fetchGranolaLinks() {
      // Join through content_items to filter by workspace
      const { data } = await supabase
        .from('granola_note_links')
        .select('content_item_id, content_items!inner(workspace_id)')
        .eq('content_items.workspace_id', wsId);

      if (data) {
        setGranolaItemIds(new Set(data.map(d => d.content_item_id)));
      }
    }

    fetchGranolaLinks();
  }, [workspaceId]);

  return granolaItemIds;
}
