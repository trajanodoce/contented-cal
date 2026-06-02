import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ExternalLinkPlatform } from '../lib/database.types';

export interface LinkInfo {
  count: number;
  platforms: ExternalLinkPlatform[];
}

/**
 * Fetches external link counts and platforms for all items in a workspace.
 * Returns a Map<contentItemId, LinkInfo>.
 */
export function useExternalLinkCounts(workspaceId: string | null) {
  const [links, setLinks] = useState<Map<string, LinkInfo>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!workspaceId) {
      setLinks(new Map());
      return;
    }
    setLoading(true);

    // Single query: join through content_items FK to filter by workspace
    const { data: externalLinks, error } = await supabase
      .from('external_links')
      .select('content_item_id, platform, content_items!inner(workspace_id)')
      .eq('content_items.workspace_id', workspaceId);

    if (error) {
      console.error('[useExternalLinkCounts] failed to load:', error.message);
    }

    const map = new Map<string, LinkInfo>();
    if (externalLinks) {
      for (const el of externalLinks) {
        const existing = map.get(el.content_item_id) ?? { count: 0, platforms: [] };
        existing.count++;
        const platform = el.platform as ExternalLinkPlatform;
        if (!existing.platforms.includes(platform)) {
          existing.platforms.push(platform);
        }
        map.set(el.content_item_id, existing);
      }
    }
    setLinks(map);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, loading, refresh: fetchLinks };
}

/**
 * Returns a Set of content_item_ids that have external links,
 * optionally filtered by platform.
 */
export function useItemsWithLinks(workspaceId: string | null) {
  const { links, loading, refresh } = useExternalLinkCounts(workspaceId);

  const getItemIdsWithLinks = useCallback(
    (platform?: ExternalLinkPlatform): Set<string> => {
      const ids = new Set<string>();
      links.forEach((info, itemId) => {
        if (!platform || info.platforms.includes(platform)) {
          ids.add(itemId);
        }
      });
      return ids;
    },
    [links]
  );

  return { links, loading, refresh, getItemIdsWithLinks };
}
