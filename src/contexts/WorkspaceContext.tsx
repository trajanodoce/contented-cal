import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { Workspace } from '../lib/database.types';

import type { WorkspaceRole } from '../lib/database.types';
type UserRole = WorkspaceRole;

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  userRole: UserRole | null;
  loading: boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, slug: string) => Promise<{ workspace?: Workspace; error?: Error }>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's workspaces and determine which to show
  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Auto-accept any pending invites for this user's email. The actual
      // membership insert + accepted_at update happen server-side inside
      // the accept_invite() SECURITY DEFINER function — we only pass the
      // invite ID. The server re-reads the row and uses the role AS STORED,
      // so even if the invitee tampered with the row pre-acceptance (e.g.
      // tried to flip viewer → admin), the function ignores the local
      // mutation. RLS now also blocks invitees from writing to
      // workspace_invites at all. See migration 20260605000000.
      if (user.email) {
        const { data: pendingInvites } = await supabase
          .from('workspace_invites')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .is('accepted_at', null);

        if (pendingInvites && pendingInvites.length > 0) {
          for (const invite of pendingInvites) {
            const { error: acceptError } = await supabase.rpc('accept_invite', {
              p_invite_id: invite.id,
            });
            if (acceptError) {
              console.error('Failed to accept invite', invite.id, acceptError);
            }
          }
        }
      }

      // Get all workspaces the user is a member of
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        // User has no workspaces
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      // Get workspace details
      const workspaceIds = memberships.map(m => m.workspace_id);
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('name');

      if (workspaceError) throw workspaceError;

      const userWorkspaces = workspaceData || [];
      setWorkspaces(userWorkspaces);

      // Determine which workspace to select
      // Priority 1: Check localStorage for last workspace
      const savedWorkspaceId = localStorage.getItem('lastWorkspaceId');
      if (savedWorkspaceId) {
        const savedWorkspace = userWorkspaces.find(w => w.id === savedWorkspaceId);
        if (savedWorkspace) {
          const membership = memberships.find(m => m.workspace_id === savedWorkspace.id);
          setCurrentWorkspace(savedWorkspace);
          setUserRole(membership?.role as UserRole || null);
          setLoading(false);
          return;
        }
      }

      // Priority 2: Use first workspace
      if (userWorkspaces.length > 1) {
        // Multiple workspaces - don't auto-select, let user pick
        setCurrentWorkspace(null);
        setUserRole(null);
      } else {
        // Single workspace - auto-select it
        const workspace = userWorkspaces[0];
        const membership = memberships.find(m => m.workspace_id === workspace.id);
        setCurrentWorkspace(workspace);
        setUserRole(membership?.role as UserRole || null);
        localStorage.setItem('lastWorkspaceId', workspace.id);
      }

    } catch (err) {
      console.error('Error loading workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const switchWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('lastWorkspaceId', workspace.id);

    // Get user's role for this workspace
    if (user) {
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setUserRole(data.role as UserRole);
          }
        });
    }
  }, [user]);

  const createWorkspace = useCallback(async (name: string, slug: string) => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { data: workspace, error: insertError } = await supabase
        .from('workspaces')
        .insert({ name, slug })
        .select()
        .single();

      if (insertError) throw insertError;

      // Database trigger automatically:
      // 1. Creates content types
      // 2. Creates board columns
      // 3. Adds user as admin member

      // Add to local state
      setWorkspaces(prev => [...prev, workspace]);
      setCurrentWorkspace(workspace);
      setUserRole('admin');
      localStorage.setItem('lastWorkspaceId', workspace.id);

      return { workspace };
    } catch (err) {
      return { error: err as Error };
    }
  }, [user]);

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      workspaces,
      userRole,
      loading,
      switchWorkspace,
      refreshWorkspaces,
      createWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
