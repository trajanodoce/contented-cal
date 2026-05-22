import { useState, useEffect, useCallback } from 'react';
import { supabase }  from '../lib/supabase';
import type { ContentItem } from '../lib/database.types';

interface UseContentItemsOptions {
  workspaceId: string | null;
}

interface UseContentItemsReturn {
  items: ContentItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useContentItems({ workspaceId }: UseContentItemsOptions): UseContentItemsReturn {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(async () => {
    if (!workspaceId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('content_items')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch content items'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel('content_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_items',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [payload.new as ContentItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? (payload.new as ContentItem) : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return { items, loading, error, refetch: fetchItems };
}
