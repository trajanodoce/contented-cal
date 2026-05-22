import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ContentType, BoardColumn, Profile } from '../lib/database.types';

interface WorkspaceData {
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
}

interface UseWorkspaceDataReturn extends WorkspaceData {
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const CACHE_KEY_PREFIX = 'workspace_data_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCache(workspaceId: string): WorkspaceData | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${workspaceId}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setCache(workspaceId: string, data: WorkspaceData) {
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${workspaceId}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Ignore cache errors
  }
}

export function useWorkspaceData(workspaceId: string | null): UseWorkspaceDataReturn {
  const [data, setData] = useState<WorkspaceData>({
    contentTypes: [],
    boardColumns: [],
    members: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    if (!workspaceId) {
      setData({ contentTypes: [], boardColumns: [], members: [] });
      setLoading(false);
      return;
    }

    // Check cache if not forcing refresh
    if (!force && !hasFetched.current) {
      const cached = getCache(workspaceId);
      if (cached) {
        setData(cached);
        setLoading(false);
        hasFetched.current = true;
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [contentTypesRes, boardColumnsRes, membersRes] = await Promise.all([
        supabase
          .from('content_types')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('name'),
        supabase
          .from('board_columns')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('position'),
        supabase
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', workspaceId),
      ]);

      if (contentTypesRes.error) throw contentTypesRes.error;
      if (boardColumnsRes.error) throw boardColumnsRes.error;
      if (membersRes.error) throw membersRes.error;

      // Fetch profiles for members
      const memberIds = (membersRes.data || []).map((m) => m.user_id);
      let members: Profile[] = [];

      if (memberIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', memberIds);

        if (profilesError) throw profilesError;
        members = profiles || [];
      }

      const newData: WorkspaceData = {
        contentTypes: contentTypesRes.data || [],
        boardColumns: boardColumnsRes.data || [],
        members,
      };

      setData(newData);
      setCache(workspaceId, newData);
      hasFetched.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workspace data'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    hasFetched.current = false;
    fetchData();
  }, [workspaceId, fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { ...data, loading, error, refresh };
}
