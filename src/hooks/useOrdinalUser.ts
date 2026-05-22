import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OrdinalUserConnection } from '../lib/database.types';

interface SyncStatus {
  total_posts: number;
  linkedin_count: number;
  x_count: number;
  instagram_count: number;
  tiktok_count: number;
  last_sync_at: string | null;
}

export function useOrdinalUser(workspaceId: string | null) {
  const [connections, setConnections] = useState<OrdinalUserConnection[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!workspaceId) {
      setConnections([]);
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase
        .from('ordinal_user_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('connected_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setConnections(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch connections');
    }
  }, [workspaceId]);

  const fetchSyncStatus = useCallback(async () => {
    if (!workspaceId) {
      setSyncStatus(null);
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase
        .rpc('get_ordinal_sync_status', { p_workspace_id: workspaceId });

      if (supabaseError) throw supabaseError;
      if (data && data.length > 0) {
        setSyncStatus(data[0] as SyncStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConnections();
    fetchSyncStatus();
  }, [fetchConnections, fetchSyncStatus]);

  const connect = async (profileId: string, profileName: string, platform: string) => {
    if (!workspaceId) return;

    setLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('ordinal_user_connections')
        .insert({
          workspace_id: workspaceId,
          profile_id: profileId,
          profile_name: profileName,
          platform,
        });

      if (supabaseError) throw supabaseError;
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (connectionId: string) => {
    setLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('ordinal_user_connections')
        .delete()
        .eq('id', connectionId);

      if (supabaseError) throw supabaseError;
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  return {
    connections,
    syncStatus,
    loading,
    error,
    refetchConnections: fetchConnections,
    refetchSyncStatus: fetchSyncStatus,
    connect,
    disconnect,
  };
}
