import { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useApp } from './AppContext';
import { useWorkspace } from './WorkspaceContext';

/**
 * Phase 6.6 — Workspace-scoped task presence (lean v1).
 *
 * One Supabase Presence channel per workspace. Each client tracks its
 * `viewing_task_id` (the currently-open detail slide-over). Consumers ask
 * "who else is viewing task X?" — used for the slide-over presence chip
 * and the subtle "someone else is viewing" dot on list rows + board cards.
 *
 * Lean v1 cuts (per the Phase 6 bloat review):
 *   - Calendar surface
 *   - Collision banner inside the slide-over
 *   - "Ping in Slack" CTA
 *   - Greying-out treatment for in-use tasks
 *
 * One channel per workspace beats one channel per task because:
 *   - O(1) subscription instead of O(N rows)
 *   - List/board can render presence indicators without N realtime subs
 *   - All members see the same state, simpler to reason about
 */

export interface PresenceViewer {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  viewing_task_id: string | null;
}

interface PresenceCtx {
  /** Set what the current user is viewing (null = nothing). */
  setViewing: (taskId: string | null) => void;
  /** Map of task_id → unique viewers (excluding self). */
  viewersByTask: Map<string, PresenceViewer[]>;
}

const Context = createContext<PresenceCtx | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, members } = useApp();
  const { currentWorkspace } = useWorkspace();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const viewingRef = useRef<string | null>(null);
  const [state, setState] = useState<Record<string, PresenceViewer[]>>({});

  const userId = user?.id ?? null;
  const workspaceId = currentWorkspace?.id ?? null;

  // Resolve display info for self from the loaded members list (fallback to user.email)
  const selfMeta = useMemo<PresenceViewer | null>(() => {
    if (!userId) return null;
    const m = members.find((x) => x.id === userId);
    return {
      user_id: userId,
      full_name: m?.full_name ?? null,
      email: m?.email ?? user?.email ?? null,
      avatar_url: m?.avatar_url ?? null,
      viewing_task_id: null,
    };
  }, [userId, members, user?.email]);

  // Subscribe to the workspace presence channel on mount / workspace change.
  useEffect(() => {
    if (!userId || !workspaceId || !selfMeta) return;

    const channel = supabase.channel(`presence:ws:${workspaceId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setState(channel.presenceState() as unknown as Record<string, PresenceViewer[]>);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...selfMeta, viewing_task_id: viewingRef.current });
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      // Best-effort untrack — supabase handles cleanup on removeChannel anyway.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [userId, workspaceId, selfMeta]);

  // Imperative API: broadcast new viewing_task_id.
  const setViewing = useCallback(
    (taskId: string | null) => {
      viewingRef.current = taskId;
      const channel = channelRef.current;
      if (!channel || !selfMeta) return;
      channel.track({ ...selfMeta, viewing_task_id: taskId }).catch((err) => {
        console.warn('[presence] track failed:', err);
      });
    },
    [selfMeta],
  );

  // Build the task → viewers map. Dedup by user_id so multi-tab users count once.
  const viewersByTask = useMemo(() => {
    const map = new Map<string, Map<string, PresenceViewer>>();
    for (const metas of Object.values(state)) {
      for (const meta of metas) {
        if (!meta?.viewing_task_id) continue;
        if (meta.user_id === userId) continue; // exclude self
        if (!map.has(meta.viewing_task_id)) {
          map.set(meta.viewing_task_id, new Map());
        }
        map.get(meta.viewing_task_id)!.set(meta.user_id, meta);
      }
    }
    // Collapse inner maps to arrays for consumer convenience.
    const out = new Map<string, PresenceViewer[]>();
    for (const [taskId, inner] of map) {
      out.set(taskId, Array.from(inner.values()));
    }
    return out;
  }, [state, userId]);

  const value = useMemo(() => ({ setViewing, viewersByTask }), [setViewing, viewersByTask]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Imperative + selectors. Prefer `usePresenceForTask(taskId)` when you only
 * need a single task's viewers — it memoizes per-task to avoid re-rendering
 * on unrelated presence changes.
 */
export function usePresence(): PresenceCtx {
  const ctx = useContext(Context);
  if (!ctx) {
    // Soft-fail with a no-op ctx so consumers outside PresenceProvider don't crash.
    return {
      setViewing: () => {},
      viewersByTask: new Map(),
    };
  }
  return ctx;
}

/**
 * Returns the (deduped, self-excluded) viewers for a specific task.
 * Empty array when nobody else is viewing — safe to render conditionally.
 */
export function usePresenceForTask(taskId: string | null | undefined): PresenceViewer[] {
  const { viewersByTask } = usePresence();
  return useMemo(() => {
    if (!taskId) return [];
    return viewersByTask.get(taskId) ?? [];
  }, [viewersByTask, taskId]);
}
