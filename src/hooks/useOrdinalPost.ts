import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OrdinalPostLink } from '../lib/database.types';

export function useOrdinalPost(contentItemId: string | null) {
  const [ordinalLink, setOrdinalLink] = useState<OrdinalPostLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrdinalLink = useCallback(async () => {
    if (!contentItemId) {
      setOrdinalLink(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from('ordinal_post_links')
        .select('*')
        .eq('content_item_id', contentItemId)
        .maybeSingle();

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      setOrdinalLink(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Ordinal link');
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  useEffect(() => {
    fetchOrdinalLink();
  }, [fetchOrdinalLink]);

  return {
    ordinalLink,
    loading,
    error,
    refetch: fetchOrdinalLink,
  };
}
