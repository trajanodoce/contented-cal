import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLog, Json } from '../lib/database.types';

interface UseActivityLogOptions {
  contentItemId: string | null;
}

interface UseActivityLogReturn {
  activities: ActivityLog[];
  loading: boolean;
  error: Error | null;
  logActivity: (action: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export function useActivityLog({ contentItemId }: UseActivityLogOptions): UseActivityLogReturn {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!contentItemId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('activity_log')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setActivities(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch activity log'));
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  // Initial fetch
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Realtime subscription
  useEffect(() => {
    if (!contentItemId) return;

    const channel = supabase
      .channel(`activity_${contentItemId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `content_item_id=eq.${contentItemId}`,
        },
        (payload) => {
          setActivities((prev) => [payload.new as ActivityLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentItemId]);

  const logActivity = useCallback(async (action: string, metadata?: Record<string, unknown>) => {
    if (!contentItemId) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action,
      metadata: (metadata || {}) as Json,
    });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  }, [contentItemId]);

  return { activities, loading, error, logActivity };
}
