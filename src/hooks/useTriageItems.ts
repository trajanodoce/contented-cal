import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import type { ContentItem } from '../lib/database.types';

/**
 * Fetches content_items where needs_triage = true.
 * AppContext deliberately filters these out, so the Slack triage tab
 * needs its own query + realtime subscription.
 */
export function useTriageItems() {
  const { workspace } = useApp();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('needs_triage', true)
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (data) setItems(data as ContentItem[]);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: mirror AppContext pattern
  useEffect(() => {
    if (!workspace) return;
    const channel = supabase
      .channel(`triage_items:${workspace.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_items',
        filter: `workspace_id=eq.${workspace.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as ContentItem;
          if (!row.needs_triage || row.archived) return;
          setItems((prev) => [row, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as ContentItem;
          if (!row.needs_triage || row.archived) {
            // Item was approved or archived — remove from triage list
            setItems((prev) => prev.filter((i) => i.id !== row.id));
          } else {
            setItems((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists
                ? prev.map((i) => (i.id === row.id ? row : i))
                : [row, ...prev];
            });
          }
        } else if (payload.eventType === 'DELETE') {
          setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace]);

  return { items, loading, refresh };
}
