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

    // Get all content item IDs for this workspace
    const { data: items } = await supabase
      .from('content_items')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (!items || items.length === 0) {
      setLinks(new Map());
      setLoading(false);
      return;
    }

    const itemIds = items.map((i) => i.id);

    // Fetch all external links for these items
    const { data: externalLinks } = await supabase
      .from('external_links')
      .select('content_item_id, platform')
      .in('content_item_id', itemIds);

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
