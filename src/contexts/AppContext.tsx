import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';
import type {
  Workspace, WorkspaceMember, ContentType, BoardColumn,
  ContentItem, Project, CustomFieldDefinition, IntakeForm
} from '../lib/database.types';

interface AppContextValue {
  user: User | null;
  loading: boolean;
  workspace: Workspace | null;
  workspaces: Workspace[];
  userRole: 'admin' | 'editor' | 'viewer' | null;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  contentItems: ContentItem[];
  projects: Project[];
  customFieldDefs: CustomFieldDefinition[];
  intakeForms: IntakeForm[];
  members: (WorkspaceMember & { email?: string; full_name?: string; avatar_url?: string })[];
  linkedItemIds: Map<string, string[]>;
  setWorkspace: (w: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshContentItems: () => Promise<void>;
  refreshWorkspaceData: () => Promise<void>;
  refreshIntakeForms: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshLinkedItems: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { currentWorkspace: wsFromContext } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'viewer' | null>(null);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [members, setMembers] = useState<(WorkspaceMember & { email?: string; full_name?: string; avatar_url?: string })[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [linkedItemIds, setLinkedItemIds] = useState<Map<string, string[]>>(new Map());

  const refreshWorkspaces = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('workspaces').select('*').order('name');
    if (data) setWorkspaces(data);
  }, [user]);

  useEffect(() => {
    if (user) refreshWorkspaces();
  }, [user, refreshWorkspaces]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync workspace from WorkspaceContext so AppContext stays in sync
  useEffect(() => {
    if (wsFromContext && wsFromContext.id !== workspace?.id) {
      setWorkspaceState(wsFromContext);
    }
  }, [wsFromContext, workspace?.id]);

  const setWorkspace = useCallback((w: Workspace) => {
    setWorkspaceState(w);
    localStorage.setItem('lastWorkspaceId', w.id);
  }, []);

  const refreshLinkedItems = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('external_links')
      .select('content_item_id, platform')
      .in('content_item_id',
        (await supabase
          .from('content_items')
          .select('id')
          .eq('workspace_id', workspace.id)
          .then(r => (r.data ?? []).map(i => i.id)))
      );
    if (data) {
      const map = new Map<string, string[]>();
      for (const row of data) {
        const existing = map.get(row.content_item_id) ?? [];
        if (!existing.includes(row.platform)) existing.push(row.platform);
        map.set(row.content_item_id, existing);
      }
      setLinkedItemIds(map);
    }
  }, [workspace]);

  const refreshProjects = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('projects').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
    if (data) setProjects(data);
  }, [workspace]);

  const refreshIntakeForms = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('intake_forms').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
    if (data) setIntakeForms(data);
  }, [workspace]);

  const refreshWorkspaceData = useCallback(async () => {
    if (!workspace || !user) return;

    const [typesRes, colsRes, projRes, membersRes, roleRes, customFieldsRes] = await Promise.all([
      supabase.from('content_types').select('*').eq('workspace_id', workspace.id).order('name'),
      supabase.from('board_columns').select('*').eq('workspace_id', workspace.id).order('position'),
      supabase.from('projects').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('workspace_members').select('*, profiles:user_id(id, full_name, email, avatar_url)').eq('workspace_id', workspace.id),
      supabase.from('workspace_members').select('role').eq('workspace_id', workspace.id).eq('user_id', user.id).maybeSingle(),
      supabase.from('custom_field_definitions').select('*').eq('workspace_id', workspace.id).order('position'),
    ]);

    if (typesRes.data) setContentTypes(typesRes.data);
    if (colsRes.data) setBoardColumns(colsRes.data);
    if (projRes.data) setProjects(projRes.data);
    if (roleRes.data) setUserRole(roleRes.data.role as 'admin' | 'editor' | 'viewer');
    if (customFieldsRes.data) setCustomFieldDefs(customFieldsRes.data);

    if (membersRes.data) {
      // Enrich with profile data from the profiles join
      const enriched = membersRes.data.map((m: any) => ({
        ...m,
        email: m.profiles?.email ?? (m.user_id === user.id ? user.email : undefined),
        full_name: m.profiles?.full_name ?? (m.user_id === user.id ? user.user_metadata?.full_name : undefined),
        avatar_url: m.profiles?.avatar_url ?? (m.user_id === user.id ? user.user_metadata?.avatar_url : undefined),
        profiles: undefined, // Remove nested profiles object
      }));
      setMembers(enriched);
    }

    await refreshIntakeForms();
  }, [workspace, user, refreshIntakeForms]);

  const refreshContentItems = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('content_items').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
    if (data) setContentItems(data);
  }, [workspace]);

  useEffect(() => {
    if (workspace) {
      refreshWorkspaceData();
      refreshContentItems();
      refreshLinkedItems();
    }
  }, [workspace, refreshWorkspaceData, refreshContentItems, refreshLinkedItems]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setWorkspaceState(null);
    setUserRole(null);
    setContentTypes([]);
    setBoardColumns([]);
    setContentItems([]);
    setProjects([]);
    setMembers([]);
    setCustomFieldDefs([]);
    setIntakeForms([]);
    setLinkedItemIds(new Map());
    localStorage.removeItem('lastWorkspaceId');
  }, []);

  return (
    <AppContext.Provider value={{
      user, loading, workspace, workspaces, userRole,
      contentTypes, boardColumns, contentItems, projects,
      customFieldDefs, intakeForms, members, linkedItemIds,
      setWorkspace, refreshWorkspaces, refreshContentItems, refreshWorkspaceData, refreshIntakeForms, refreshProjects, refreshLinkedItems, signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
