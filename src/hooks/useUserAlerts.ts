import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { UserAlert } from '../lib/database.types';

/**
 * Phase 6.4 — Alert pipeline (client side).
 *
 * Server-side pipeline lives in the migration as `comments_mentions_alerts`
 * and `subtasks_assignment_alerts` triggers. Those fire AFTER INSERT/UPDATE
 * on the source row, dedup within a 60s window, skip self-actions + muted
 * projects, and INSERT a `user_alerts` row scoped to the recipient.
 *
 * This hook surfaces those rows to the UI: live count (sidebar dot),
 * mark-as-read on click-through, and a clear (delete) escape hatch.
 *
 * Scope: in-app only. Slack DM routing (originally part of 6.4) was deferred
 * to v2 per the Phase 6 bloat review — see the Notion backlog "Phase 6 /
 * Mentions — Slack DM alert when @mentioned in a comment (v2 enhancement)".
 */

export interface UserAlertWithContext extends UserAlert {
  actor: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  content_item: {
    id: string;
    title: string;
  } | null;
}

interface UseUserAlertsReturn {
  alerts: UserAlertWithContext[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

/**
 * Per-user alert feed for the current workspace.
 *
 * Returns the 50 most recent alerts (read + unread) so the in-app surface
 * can show a recent history, plus an `unreadCount` derived from `read_at IS
 * NULL`. Volume is small (per-user, lightly used), so the realtime handler
 * simply refetches on any change — keeps state simple without N+1 lookups.
 */
export function useUserAlerts(): UseUserAlertsReturn {
  const { user } = useApp();
  const { currentWorkspace } = useWorkspace();
  const userId = user?.id ?? null;
  const workspaceId = currentWorkspace?.id ?? null;

  const [alerts, setAlerts] = useState<UserAlertWithContext[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !workspaceId) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_alerts')
      .select(`
        *,
        actor:actor_id ( id, full_name, email, avatar_url ),
        content_item:content_item_id ( id, title )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[useUserAlerts] fetch error:', error);
      setAlerts([]);
    } else if (data) {
      setAlerts(data as unknown as UserAlertWithContext[]);
    }
    setLoading(false);
  }, [userId, workspaceId]);

  // Initial fetch (and refetch on workspace switch / sign-in change)
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refetch on any change to this user's alerts in this workspace.
  // Both user_id + workspace_id filters cut wire chatter (Postgres-changes
  // filters compose with AND), so cross-workspace alerts don't trigger refetches
  // that would only return current-workspace rows anyway.
  useEffect(() => {
    if (!userId || !workspaceId) return;
    const channel = supabase
      .channel(`user_alerts:${userId}:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Postgres-changes only supports one filter clause at a time, so we
          // guard workspace scope here to avoid refetching on cross-workspace
          // alerts when the user belongs to more than one.
          const rowWs =
            (payload.new as { workspace_id?: string } | null)?.workspace_id
            ?? (payload.old as { workspace_id?: string } | null)?.workspace_id;
          if (rowWs && rowWs !== workspaceId) return;
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, workspaceId, refresh]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => a.read_at === null).length,
    [alerts],
  );

  const markRead = useCallback(async (id: string) => {
    // Optimistic: flip locally first, then persist.
    const now = new Date().toISOString();
    setAlerts((prev) =>
      prev.map((a) => (a.id === id && a.read_at === null ? { ...a, read_at: now } : a)),
    );
    const { error } = await supabase
      .from('user_alerts')
      .update({ read_at: now })
      .eq('id', id);
    if (error) {
      console.error('[useUserAlerts] markRead error:', error);
      // Roll back: refetch on error
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setAlerts((prev) => prev.map((a) => (a.read_at === null ? { ...a, read_at: now } : a)));
    const { error } = await supabase
      .from('user_alerts')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) {
      console.error('[useUserAlerts] markAllRead error:', error);
      refresh();
    }
  }, [userId, refresh]);

  const dismiss = useCallback(async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from('user_alerts').delete().eq('id', id);
    if (error) {
      console.error('[useUserAlerts] dismiss error:', error);
      refresh();
    }
  }, [refresh]);

  return { alerts, unreadCount, loading, refresh, markRead, markAllRead, dismiss };
}
