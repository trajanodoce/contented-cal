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
  contentItemsLoading: boolean;
  patchContentItem: (id: string, fields: Partial<ContentItem>) => void;
  projects: Project[];
  customFieldDefs: CustomFieldDefinition[];
  intakeForms: IntakeForm[];
  members: (WorkspaceMember & { id: string; email?: string; full_name?: string; avatar_url?: string })[];
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
  const [contentItemsLoading, setContentItemsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [members, setMembers] = useState<(WorkspaceMember & { id: string; email?: string; full_name?: string; avatar_url?: string })[]>([]);
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
    // Single query: join external_links through content_items via FK
    const { data } = await supabase
      .from('external_links')
      .select('content_item_id, platform, content_items!inner(workspace_id)')
      .eq('content_items.workspace_id', workspace.id);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
      const enriched = membersRes.data.map((m: any) => ({
        ...m,
        id: m.user_id, // Alias so members work as Profile-compatible (assignee_ids match on .id)
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
    setContentItemsLoading(true);
    const { data } = await supabase
      .from('content_items')
      .select('id, title, status, due_date, publish_date, priority, content_type_id, assignee_ids, channel, project_id, custom_fields, tags, completed, needs_triage')
      .eq('workspace_id', workspace.id).eq('archived', false).eq('needs_triage', false).order('created_at', { ascending: false });
    if (data) setContentItems(data as ContentItem[]);
    setContentItemsLoading(false);
  }, [workspace]);

  const patchContentItem = useCallback((id: string, fields: Partial<ContentItem>) => {
    setContentItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
  }, []);

  useEffect(() => {
    if (workspace) {
      refreshWorkspaceData();
      refreshContentItems();
      refreshLinkedItems();
    }
  }, [workspace, refreshWorkspaceData, refreshContentItems, refreshLinkedItems]);

  const workspaceId = workspace?.id;
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`app_content_items:${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_items',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as ContentItem;
          if (row.archived || row.needs_triage) return;
          setContentItems((prev) => [row, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as ContentItem;
          setContentItems((prev) => {
            if (row.archived || row.needs_triage) return prev.filter((i) => i.id !== row.id);
            const exists = prev.some((i) => i.id === row.id);
            return exists
              ? prev.map((i) => (i.id === row.id ? row : i))
              : [row, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setContentItems((prev) => prev.filter((i) => i.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

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
      contentTypes, boardColumns, contentItems, contentItemsLoading, projects,
      customFieldDefs, intakeForms, members, linkedItemIds,
      setWorkspace, refreshWorkspaces, refreshContentItems, patchContentItem, refreshWorkspaceData, refreshIntakeForms, refreshProjects, refreshLinkedItems, signOut,
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
