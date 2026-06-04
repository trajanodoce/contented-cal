import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Comment } from '../lib/database.types';

interface UseItemCommentsOptions {
  contentItemId: string | null;
}

interface UseItemCommentsReturn {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
  addComment: (body: string) => Promise<void>;
}

export function useItemComments({ contentItemId }: UseItemCommentsOptions): UseItemCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchComments = useCallback(async () => {
    if (!contentItemId) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('comments')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: true });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setComments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  // Initial fetch
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!contentItemId) return;

    const channel = supabase
      .channel(`comments_${contentItemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `content_item_id=eq.${contentItemId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => [...prev, payload.new as Comment]);
          } else if (payload.eventType === 'UPDATE') {
            // Covers both edits ("(edited)" label) and soft-deletes
            // (deleted_at transitions null → not null → CommentRow renders
            // as a tombstone). Replace the row in place so the change is
            // reflected without a hard refresh.
            const row = payload.new as Comment;
            setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentItemId]);

  const addComment = useCallback(async (body: string) => {
    if (!contentItemId || !body.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('comments').insert({
      content_item_id: contentItemId,
      user_id: user?.id || '',
      body: body.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }, [contentItemId]);

  return { comments, loading, error, addComment };
}
