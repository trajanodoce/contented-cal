import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { useFilters } from '../contexts/FiltersContext';
import { FilterBar, applyFilters } from '../components/FilterBar';
import type {
  Project,
  ContentItem,
  ContentType,
  BoardColumn,
  Profile,
  ActivityLog,
} from '../lib/database.types';
import { parseLocalDate, pillTextColor } from '../lib/utils';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR } from '../lib/ordinal';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
  formatDistanceToNow,
} from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  Check,
  Calendar,
  List,
  LayoutGrid,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Clock,
  AlertTriangle,
  Plus,
  X,
  UserPlus,
  Link2,
  Share2,
} from 'lucide-react';
import { formatDate, getPriorityDot, getUserInitials } from '../lib/utils';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ContentLibrary } from '../components/projects/ContentLibrary';
import DatePicker from '../components/ui/DatePicker';

type TabId = 'overview' | 'list' | 'board' | 'calendar';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { members, boardColumns, contentTypes } = useWorkspaceData(
    currentWorkspace?.id ?? null
  );
  const { setSelectedItemId } = useSelectedItem();
  const { filters, setFilters } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Persist active tab in URL (?tab=list)
  const VALID_TABS: TabId[] = ['overview', 'list', 'board', 'calendar'];
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = useCallback((tab: TabId) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  // Fetch project
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setProject(data);
    setTitleDraft(data.title);
    setDescDraft(data.description ?? '');
  }, [projectId]);

  // Fetch content items for this project
  const fetchItems = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('project_id', projectId);
    if (error) {
      toast.error('Failed to load project items');
      return;
    }
    setItems(data ?? []);
  }, [projectId]);

  // Fetch activity logs for project items
  const fetchActivity = useCallback(async () => {
    if (!projectId || items.length === 0) {
      setActivityLogs([]);
      return;
    }
    const itemIds = items.map((i) => i.id);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .in('content_item_id', itemIds)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error && data) {
      setActivityLogs(data);
    }
  }, [projectId, items]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProject(), fetchItems()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProject, fetchItems]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Realtime subscription for project items
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project_items_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_items',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchItems]);

  // Metadata update helper
  const updateProject = useCallback(
    async (updates: Partial<Project>) => {
      if (!projectId) return;
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setProject((prev) => (prev ? { ...prev, ...updates } : prev));
      toast.success('Project updated');
    },
    [projectId]
  );

  // Title save
  const saveTitle = useCallback(async () => {
    if (!titleDraft.trim()) return;
    await updateProject({ title: titleDraft.trim() });
    setEditingTitle(false);
  }, [titleDraft, updateProject]);

  // Description save
  const saveDesc = useCallback(async () => {
    await updateProject({ description: descDraft });
    setEditingDesc(false);
  }, [descDraft, updateProject]);

  // Derived data
  const lastColumnId = useMemo(() => {
    if (boardColumns.length === 0) return null;
    const sorted = [...boardColumns].sort((a, b) => a.position - b.position);
    return sorted[sorted.length - 1].id;
  }, [boardColumns]);

  const doneColumnIds = useMemo(() => {
    const ids = new Set<string>();
    boardColumns.forEach(c => {
      const name = c.name.toLowerCase();
      if (name === 'published' || name === 'completed') ids.add(c.id);
    });
    return ids;
  }, [boardColumns]);

  const completedCount = useMemo(
    () => items.filter((i) => i.status != null && doneColumnIds.has(i.status)).length,
    [items, doneColumnIds]
  );

  const overdueCount = useMemo(
    () =>
      items.filter((i) => {
        if (!i.due_date) return false;
        const statusCol = boardColumns.find(c => c.id === i.status);
        const statusName = statusCol?.name?.toLowerCase();
        if (statusName === 'published' || statusName === 'completed') return false;
        const d = parseLocalDate(i.due_date);
        return d < new Date() && !isToday(d);
      }).length,
    [items, boardColumns]
  );

  const uniqueAssignees = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((i) => i.assignee_ids?.forEach((a) => ids.add(a)));
    return members.filter((m) => ids.has(m.id));
  }, [items, members]);

  // Status badge colors
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-[#92D1B218] text-[#2F8889]',
      completed: 'bg-brand-100 text-brand-700',
      archived: 'bg-[#005D9712] text-slate-500',
    };
    return map[status] ?? 'bg-[#005D9712] text-slate-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-6"
          style={{ backgroundColor: '#0B2763' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </button>
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Project not found
            </h2>
            <p className="text-slate-500 text-sm">
              This project may have been deleted or you don't have access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
    { id: 'board', label: 'Board', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-page">
      {/* Header */}
      <div className="bg-surface-card px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #00233930' }}>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-3"
          style={{ backgroundColor: '#0B2763' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </button>

        {/* Title */}
        <div className="flex items-start gap-3 mb-2">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(project.title);
                  setEditingTitle(false);
                }
              }}
              onBlur={saveTitle}
              className="text-xl font-semibold text-slate-900 border-b-2 border-brand-500 outline-none bg-transparent flex-1"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-xl font-display text-slate-900 cursor-pointer hover:text-brand-600 transition-colors"
            >
              {project.title}
            </h1>
          )}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusBadge(project.status)}`}
            >
              {project.status}
            </span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/projects/${projectId}`;
                navigator.clipboard.writeText(url).then(() => toast.success('Project link copied'));
              }}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
              title="Copy project link"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {editingDesc ? (
          <div className="mb-3">
            <textarea
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Project description..."
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={saveDesc}
                className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-500"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDescDraft(project.description ?? '');
                  setEditingDesc(false);
                }}
                className="px-3 py-1 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-[#005D9708]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            className="text-sm text-slate-500 mb-3 cursor-pointer hover:text-slate-700 transition-colors"
          >
            {project.description || 'Click to add a description...'}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Owner */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Owner</span>
            <select
              value={project.owner_id ?? ''}
              onChange={(e) =>
                updateProject({ owner_id: e.target.value || null })
              }
              className="text-sm text-slate-700 border border-slate-300 rounded-lg px-2 py-1 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Start Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Start</span>
            <div className="w-44">
              <DatePicker
                value={project.start_date ?? ''}
                onChange={(v) => updateProject({ start_date: v || null })}
                placeholder="Set start"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">End</span>
            <div className="w-44">
              <DatePicker
                value={project.end_date ?? ''}
                onChange={(v) => updateProject({ end_date: v || null })}
                placeholder="Set end"
              />
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status</span>
            <select
              value={project.status}
              onChange={(e) => updateProject({ status: e.target.value as 'active' | 'completed' | 'archived' })}
              className="text-sm text-slate-700 border border-slate-300 rounded-lg px-2 py-1 bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors mr-1 ${
                activeTab === t.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            projectId={projectId!}
            workspaceId={currentWorkspace?.id ?? ''}
            items={items}
            boardColumns={boardColumns}
            contentTypes={contentTypes}
            members={members}
            activityLogs={activityLogs}
            completedCount={completedCount}
            overdueCount={overdueCount}
            uniqueAssignees={uniqueAssignees}
          />
        )}
        {activeTab === 'list' && (
          <ListTab
            items={items}
            boardColumns={boardColumns}
            contentTypes={contentTypes}
            members={members}
            filters={filters}
            setFilters={setFilters}
            workspaceId={currentWorkspace?.id ?? null}
            onItemClick={setSelectedItemId}
          />
        )}
        {activeTab === 'board' && (
          <BoardTab
            items={items}
            boardColumns={boardColumns}
            contentTypes={contentTypes}
            members={members}
            onItemClick={setSelectedItemId}
            onItemMoved={fetchItems}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarTab
            items={items}
            contentTypes={contentTypes}
            onItemClick={setSelectedItemId}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Recent Activity (collapsible)
// ────────────────────────────────────────────────────────────────────────────────

function RecentActivitySection({ activityLogs, members }: { activityLogs: ActivityLog[]; members: Profile[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface-card rounded-xl overflow-hidden" style={{ border: '1px solid #00233930' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#005D9708] transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Recent Activity
          {activityLogs.length > 0 && (
            <span className="text-xs font-normal text-slate-400 bg-[#005D9712] px-1.5 py-0.5 rounded-full">{activityLogs.length}</span>
          )}
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          {activityLogs.length > 0 ? (
            <div className="space-y-3">
              {activityLogs.map((log) => {
                const member = members.find((m) => m.id === log.user_id);
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <AvatarCircle profile={member ?? null} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">
                          {member?.full_name || member?.email || 'Unknown'}
                        </span>{' '}
                        {log.action}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6">
              <Clock className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No recent activity.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ────────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  projectId,
  workspaceId,
  items,
  boardColumns,
  members,
  activityLogs,
  completedCount,
  overdueCount,
  uniqueAssignees,
}: {
  projectId: string;
  workspaceId: string;
  items: ContentItem[];
  boardColumns: BoardColumn[];
  contentTypes: ContentType[];
  members: Profile[];
  activityLogs: ActivityLog[];
  completedCount: number;
  overdueCount: number;
  uniqueAssignees: Profile[];
}) {
  const columnCounts = useMemo(() => {
    const counts = new Map<string, number>();
    boardColumns.forEach((col) => counts.set(col.id, 0));
    items.forEach((item) => {
      if (item.status) {
        counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
      }
    });
    return counts;
  }, [items, boardColumns]);

  const totalItems = items.length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Progress bar by board column */}
      <div className="bg-surface-card rounded-xl p-5" style={{ border: '1px solid #00233930' }}>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Progress</h3>
        {totalItems > 0 ? (
          <>
            <div className="h-3 rounded-full overflow-hidden flex bg-[#005D9712]">
              {boardColumns.map((col) => {
                const count = columnCounts.get(col.id) ?? 0;
                if (count === 0) return null;
                const widthPct = (count / totalItems) * 100;
                return (
                  <div
                    key={col.id}
                    className="h-full transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: col.color ?? undefined,
                    }}
                    title={`${col.name}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {boardColumns.map((col) => {
                const count = columnCounts.get(col.id) ?? 0;
                if (count === 0) return null;
                return (
                  <div key={col.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: col.color ?? undefined }}
                    />
                    <span className="text-slate-600">{col.name}</span>
                    <span className="font-medium text-slate-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">
            No items in this project yet.
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<List className="w-4 h-4 text-slate-400" />}
          label="Total items"
          value={totalItems}
        />
        <StatCard
          icon={<Check className="w-4 h-4 text-green-500" />}
          label="Completed"
          value={completedCount}
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          label="Overdue"
          value={overdueCount}
        />
        <StatCard
          icon={<Users className="w-4 h-4 text-brand-500" />}
          label="Team members"
          value={uniqueAssignees.length}
        />
      </div>

      {/* Content Library */}
      <ContentLibrary projectId={projectId} workspaceId={workspaceId} />

      {/* Recent activity — collapsible, hidden by default */}
      <RecentActivitySection activityLogs={activityLogs} members={members} />

      {/* Team members */}
      <TeamMembersSection
        projectId={projectId}
        allMembers={members}
        taskAssigneeIds={items.flatMap(i => i.assignee_ids ?? [])}
      />
    </div>
  );
}

function TeamMembersSection({
  projectId,
  allMembers,
  taskAssigneeIds,
}: {
  projectId: string;
  allMembers: Profile[];
  taskAssigneeIds: string[];
}) {
  const [manualMemberIds, setManualMemberIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fetch manually-added project members
  useEffect(() => {
    supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .then(({ data }) => {
        if (data) setManualMemberIds(data.map(d => d.user_id));
      });
  }, [projectId]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  // Merge task-derived + manually added, deduplicated
  const allMemberIds = useMemo(() => {
    const ids = new Set<string>([...taskAssigneeIds, ...manualMemberIds]);
    return Array.from(ids);
  }, [taskAssigneeIds, manualMemberIds]);

  const teamMembers = useMemo(
    () => allMembers.filter(m => allMemberIds.includes(m.id)),
    [allMembers, allMemberIds]
  );

  // Members available to add (not already on the project)
  const availableToAdd = useMemo(
    () => allMembers.filter(m => !allMemberIds.includes(m.id)),
    [allMembers, allMemberIds]
  );

  async function addMember(userId: string) {
    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
    });
    if (error) {
      toast.error('Failed to add member');
    } else {
      setManualMemberIds(prev => [...prev, userId]);
      toast.success('Member added');
    }
    setShowPicker(false);
  }

  async function removeMember(userId: string) {
    // Only allow removing manually-added members, not task-derived ones
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) {
      toast.error('Failed to remove member');
    } else {
      setManualMemberIds(prev => prev.filter(id => id !== userId));
      toast.success('Member removed');
    }
  }

  const isManualMember = (userId: string) => manualMemberIds.includes(userId);
  const isTaskAssignee = (userId: string) => taskAssigneeIds.includes(userId);

  return (
    <div className="bg-surface-card rounded-xl p-5" style={{ border: '1px solid #00233930' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          Team Members
        </h3>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            title="Add team member"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </button>
          {showPicker && (
            <div className="absolute right-0 mt-1 w-56 bg-surface-card rounded-xl shadow-lg py-1 z-50 max-h-64 overflow-y-auto" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9718 0%, transparent 50%), #ffffff' }}>
              {availableToAdd.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">All workspace members are on this project</p>
              ) : (
                availableToAdd.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addMember(m.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-[#005D9708] transition-colors"
                  >
                    <AvatarCircle profile={m} size="sm" />
                    <span className="truncate">{m.full_name || m.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {teamMembers.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {teamMembers.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-3 py-2 bg-surface-nested rounded-lg group"
            >
              <AvatarCircle profile={m} size="sm" />
              <span className="text-sm text-slate-700">
                {m.full_name || m.email}
              </span>
              {/* Only show remove for manually-added members who aren't also task assignees */}
              {isManualMember(m.id) && !isTaskAssignee(m.id) && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="p-0.5 text-slate-300 hover:text-accent-crimson opacity-0 group-hover:opacity-100 transition-all rounded"
                  title="Remove from project"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <Users className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No team members yet. Add someone or assign a task.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-surface-card rounded-xl p-4" style={{ border: '1px solid #00233930' }}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// List Tab
// ────────────────────────────────────────────────────────────────────────────────

function ListTab({
  items,
  boardColumns,
  contentTypes,
  members,
  filters,
  setFilters,
  workspaceId,
  onItemClick,
}: {
  items: ContentItem[];
  boardColumns: BoardColumn[];
  contentTypes: ContentType[];
  members: Profile[];
  filters: import('../components/FilterBar').FilterState;
  setFilters: (f: import('../components/FilterBar').FilterState) => void;
  workspaceId: string | null;
  onItemClick: (id: string) => void;
}) {
  const channels = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.channel) set.add(i.channel);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  return (
    <div className="p-6">
      <FilterBar
        workspaceId={workspaceId}
        contentTypes={contentTypes}
        boardColumns={boardColumns}
        members={members}
        channels={channels}
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={items.length}
        filteredCount={filteredItems.length}
      />

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No content items match the current filters.
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl overflow-hidden" style={{ border: '1px solid #00233930' }}>
          <table className="w-full">
            <thead className="bg-[#005D9712] border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Title
                </th>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Assignee
                </th>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Due Date
                </th>
                <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider px-4 py-3">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const ct = contentTypes.find(
                  (c) => c.id === item.content_type_id
                );
                const col = boardColumns.find((c) => c.id === item.status);
                const assignee = members.find((m) =>
                  item.assignee_ids?.includes(m.id)
                );
                const isOrdinal = isOrdinalItem(item);
                const isLinear = isLinearItem(item);
                const rowBg = isOrdinal ? `${ORDINAL_COLOR}18` : isLinear ? `${LINEAR_COLOR}18` : undefined;
                const colName = col?.name?.toLowerCase();
                const isDone = colName === 'published' || colName === 'completed';
                const isBlocked = colName === 'blocked';
                const isOverdue = item.due_date && !isDone && new Date(item.due_date + 'T00:00:00') < new Date(new Date().toDateString());
                const isUrgentRow = isBlocked || isOverdue;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick(item.id)}
                    className="hover:bg-[#005D9708] cursor-pointer transition-colors"
                    style={{
                      ...(rowBg ? { backgroundColor: rowBg } : {}),
                      ...(isUrgentRow ? { outline: '2px solid #ef4444', outlineOffset: '-2px' } : {}),
                    }}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[300px] truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3">
                      {ct ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: ct.color ?? undefined }}
                          />
                          <span className="text-xs text-slate-600">
                            {ct.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {col ? (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${col.color ?? '#94a3b8'}55`,
                            color: pillTextColor(col.color ?? '#94a3b8'),
                            border: `0.5px solid ${pillTextColor(col.color ?? '#94a3b8')}`,
                          }}
                        >
                          {col.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <AvatarCircle profile={assignee} size="sm" />
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {item.due_date ? formatDate(item.due_date) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority ?? 'medium')}`}
                        />
                        <span className="text-xs text-slate-600 capitalize">
                          {item.priority ?? 'medium'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Board Tab
// ────────────────────────────────────────────────────────────────────────────────

// Draggable card for the project board
function ProjectBoardCard({
  item,
  contentTypes,
  members,
  onClick,
  isOverlay,
}: {
  item: ContentItem;
  contentTypes: ContentType[];
  members: Profile[];
  onClick: () => void;
  isOverlay?: boolean;
}) {
  const ct = contentTypes.find((c) => c.id === item.content_type_id);
  const assignee = members.find((m) => item.assignee_ids?.includes(m.id));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-[#005D9712] border-2 border-dashed border-slate-300 rounded-lg p-3 h-20"
      />
    );
  }

  const isOrdinal = isOrdinalItem(item);
  const isLinear = isLinearItem(item);
  const cardBg = isOrdinal ? `${ORDINAL_COLOR}18` : isLinear ? `${LINEAR_COLOR}18` : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''
      } ${!cardBg ? 'bg-surface-card' : ''}`}
      style={{
        ...style,
        borderColor: '#00233930',
        ...(cardBg ? { backgroundColor: cardBg } : {}),
      }}
    >
      <p className="text-sm font-medium text-slate-800 mb-2">
        {item.title}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ct && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: ct.color ?? undefined }}
            />
          )}
          {assignee && (
            <AvatarCircle profile={assignee} size="xs" />
          )}
        </div>
        {item.due_date && (
          <span className="text-xs text-slate-400">
            {formatDate(item.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// Droppable column for the project board
function ProjectBoardColumn({
  column,
  items,
  contentTypes,
  members,
  onItemClick,
}: {
  column: BoardColumn;
  items: ContentItem[];
  contentTypes: ContentType[];
  members: Profile[];
  onItemClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  const colColor = column.color ?? '#94a3b8';

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 rounded-xl transition-all`}
      style={{
        backgroundColor: isOver ? `${colColor}0C` : `${colColor}05`,
        border: isOver ? `2px solid ${colColor}` : '1px solid #00233930',
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-3 border-b rounded-t-xl"
        style={{
          borderTop: `3px solid ${colColor}`,
          borderBottomColor: `${colColor}30`,
          backgroundColor: `${colColor}15`,
        }}
      >
        <span className="text-sm font-heading text-slate-900">
          {column.name}
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full ml-auto"
          style={{ backgroundColor: `${colColor}20`, color: colColor }}
        >
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="px-2 pb-2 pt-2 space-y-2 min-h-[80px]">
        {items.map((item) => (
          <ProjectBoardCard
            key={item.id}
            item={item}
            contentTypes={contentTypes}
            members={members}
            onClick={() => onItemClick(item.id)}
          />
        ))}
        {items.length === 0 && !isOver && (
          <p className="text-xs text-slate-400 text-center py-4">
            Drop items here
          </p>
        )}
        {isOver && (
          <div className="h-16 border-2 border-dashed border-brand-300 rounded-lg bg-brand-50/50 flex items-center justify-center">
            <p className="text-xs text-brand-500 font-medium">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardTab({
  items,
  boardColumns,
  contentTypes,
  members,
  onItemClick,
  onItemMoved,
}: {
  items: ContentItem[];
  boardColumns: BoardColumn[];
  contentTypes: ContentType[];
  members: Profile[];
  onItemClick: (id: string) => void;
  onItemMoved: () => void;
}) {
  const { userRole } = useWorkspace();
  const canDrag = userRole === 'admin' || userRole === 'editor';

  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    boardColumns.forEach((col) => map.set(col.id, []));
    items.forEach((item) => {
      if (item.status && map.has(item.status)) {
        map.get(item.status)!.push(item);
      }
    });
    return map;
  }, [items, boardColumns]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canDrag) return;
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveDragItem(item);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!canDrag || !over) return;

    const itemId = active.id as string;
    const targetColumnId = over.id as string;

    const item = items.find((i) => i.id === itemId);
    const targetColumn = boardColumns.find((c) => c.id === targetColumnId);

    if (!item || !targetColumn) return;
    if (item.status === targetColumnId) return;

    // Sync completed boolean when moving to/from done columns
    const targetName = targetColumn.name.toLowerCase();
    const isDoneColumn = targetName === 'published' || targetName === 'completed';
    const updatePayload: Record<string, unknown> = { status: targetColumnId };
    if (isDoneColumn) {
      updatePayload.completed = true;
      updatePayload.completed_at = new Date().toISOString();
    } else {
      const prevCol = boardColumns.find(c => c.id === item.status);
      const prevName = prevCol?.name?.toLowerCase();
      if (prevName === 'published' || prevName === 'completed') {
        updatePayload.completed = false;
        updatePayload.completed_at = null;
      }
    }

    const { error } = await supabase
      .from('content_items')
      .update(updatePayload)
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to move item: ' + error.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: itemId,
      user_id: user?.id || null,
      action: `moved to ${targetColumn.name}`,
      metadata: { previousStatus: item.status, newStatus: targetColumnId },
    });

    toast.success(`Moved "${item.title}" to ${targetColumn.name}`);
    onItemMoved();
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '1' } },
    }),
  };

  return (
    <div className="p-6 overflow-x-scroll">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-w-max">
          {boardColumns.map((col) => (
            <ProjectBoardColumn
              key={col.id}
              column={col}
              items={itemsByColumn.get(col.id) ?? []}
              contentTypes={contentTypes}
              members={members}
              onItemClick={onItemClick}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeDragItem ? (
            <ProjectBoardCard
              item={activeDragItem}
              contentTypes={contentTypes}
              members={members}
              isOverlay
              onClick={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Calendar Tab
// ────────────────────────────────────────────────────────────────────────────────

// Grid columns for Sun-start layout: indices 0 (Sun) and 6 (Sat) are weekends
// Use minmax(0, 1fr) to prevent content from inflating column width
const PROJECT_GRID_EXPANDED = 'repeat(7, minmax(0, 1fr))';
const PROJECT_GRID_COLLAPSED = 'repeat(5, minmax(0, 1fr))';

// Single-month grid used by the stacked CalendarTab view
function ProjectMonthGrid({
  monthDate,
  items,
  contentTypes,
  weekendsCollapsed,
  onToggleWeekends,
  onItemClick,
}: {
  monthDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  weekendsCollapsed: boolean;
  onToggleWeekends: () => void;
  onItemClick: (id: string) => void;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    items.forEach((item) => {
      if (item.due_date) {
        const key = format(parseLocalDate(item.due_date), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    });
    return map;
  }, [items]);

  const allWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDays = weekendsCollapsed
    ? allWeekDays.filter((_, i) => i !== 0 && i !== 6)
    : allWeekDays;
  const visibleDays = weekendsCollapsed
    ? days.filter((_, i) => i % 7 !== 0 && i % 7 !== 6)
    : days;
  const numCols = weekendsCollapsed ? 5 : 7;
  const gridCols = weekendsCollapsed ? PROJECT_GRID_COLLAPSED : PROJECT_GRID_EXPANDED;

  return (
    <>
      {/* Weekday header — quiet slate-400 row inside the card */}
      <div className="grid border-b border-slate-300" style={{ gridTemplateColumns: gridCols }}>
        {weekDays.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid" style={{ gridTemplateColumns: gridCols, gridAutoRows: 'minmax(140px, auto)' }}>
        {visibleDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, monthDate);
          const today = isToday(day);
          const isLastCol = (index + 1) % numCols === 0;

          // Months are stacked, so don't duplicate days that belong to the
          // neighboring month — render those slots as blank placeholders.
          if (!inMonth) {
            return (
              <div
                key={dateKey}
                className={`min-h-[140px] border-b border-r border-slate-300 ${isLastCol ? 'border-r-0' : ''}`}
              />
            );
          }

          const dayItems = itemsByDate.get(dateKey) ?? [];

          return (
            <div
              key={dateKey}
              className={`min-h-[140px] px-2 pt-2 pb-2.5 border-b border-r border-slate-300 ${
                today ? 'bg-[#005D970A]' : ''
              } ${isLastCol ? 'border-r-0' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-[11px] ${today ? 'font-bold text-[#005D97]' : 'font-semibold text-[#334155]'}`}
                >
                  {format(day, 'd')}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[10px] text-slate-400">{dayItems.length}</span>
                )}
              </div>
              <div className="space-y-[6px] min-w-0 overflow-hidden">
                {dayItems.slice(0, 3).map((item) => {
                  const ct = contentTypes.find(
                    (c) => c.id === item.content_type_id
                  );
                  return (
                    <div
                      key={item.id}
                      onClick={() => onItemClick(item.id)}
                      className="text-[14px] font-medium leading-tight px-2 py-1 rounded-[3px] cursor-pointer truncate hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: ct
                          ? `${ct.color}15`
                          : '#f1f5f9',
                        // Slim 1px tinted outline + 2px solid left border for emphasis.
                        border: `1px solid ${ct?.color ?? '#94a3b8'}30`,
                        borderLeft: `2px solid ${ct?.color ?? '#94a3b8'}`,
                        color: ct?.color ?? '#475569',
                      }}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  );
                })}
                {dayItems.length > 3 && (
                  <button
                    className="text-[10px] text-slate-500 hover:text-brand-600 px-1 py-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    +{dayItems.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CalendarTab({
  items,
  contentTypes,
  onItemClick,
}: {
  items: ContentItem[];
  contentTypes: ContentType[];
  onItemClick: (id: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [weekendsCollapsed, setWeekendsCollapsed] = useState(() => {
    const saved = localStorage.getItem('cc-weekends-collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleWeekends = useCallback(() => {
    setWeekendsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cc-weekends-collapsed', String(next));
      return next;
    });
  }, []);

  const goToday = () => setCurrentMonth(new Date());
  const monthCount = expanded ? 6 : 3;
  const months = Array.from({ length: monthCount }, (_, i) => addMonths(currentMonth, i));

  return (
    <div className="p-6">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          {format(currentMonth, 'MMMM yyyy')}
          {monthCount > 1 && (
            <span className="text-slate-400 font-normal">
              {' '}— {format(months[months.length - 1], 'MMMM yyyy')}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleWeekends}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              weekendsCollapsed
                ? 'border-slate-300 text-slate-600 hover:bg-[#005D9708]'
                : 'border-brand-200 bg-brand-50 text-brand-700'
            }`}
          >
            {weekendsCollapsed ? 'Show Weekends' : 'Hide Weekends'}
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-[#005D9708]"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-300 rounded-lg hover:bg-[#005D9708]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-300 rounded-lg hover:bg-[#005D9708]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stacked month grids */}
      <div className="space-y-0">
        {months.map((monthDate, idx) => (
          <div
            key={monthDate.toISOString()}
            className="bg-[#F7F9FC] rounded-xl overflow-hidden"
            style={{ border: '1.5px solid #002339', marginTop: idx > 0 ? '16px' : 0 }}
          >
            {/* Month header bar — navy → pink gradient per design system */}
            <div
              className="px-5 py-3.5 border-b border-[#002339]"
              style={{ background: 'linear-gradient(to right, #005D97 0%, #FBE7F1 100%)' }}
            >
              <h3
                className="text-base font-bold text-white tracking-wide"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
              >
                {format(monthDate, 'MMMM yyyy')}
              </h3>
            </div>
            <ProjectMonthGrid
              monthDate={monthDate}
              items={items}
              contentTypes={contentTypes}
              weekendsCollapsed={weekendsCollapsed}
              onToggleWeekends={toggleWeekends}
              onItemClick={onItemClick}
            />
          </div>
        ))}

        {/* View More / View Less button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-surface-card border border-slate-300 rounded-lg hover:bg-[#005D9708] hover:text-slate-900 transition-colors shadow-sm"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                View Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                View More
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Shared: Avatar component
// ────────────────────────────────────────────────────────────────────────────────

function AvatarCircle({
  profile,
  size = 'sm',
}: {
  profile: Profile | null;
  size?: 'xs' | 'sm';
}) {
  const sizeClasses = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]';

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name ?? profile.email ?? undefined}
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
        title={profile.full_name ?? profile.email ?? undefined}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-slate-200 flex items-center justify-center shrink-0`}
      title={profile?.full_name || profile?.email || 'Unknown'}
    >
      <span className="font-medium text-slate-600">
        {getUserInitials(profile?.email ?? undefined, profile?.full_name ?? undefined)}
      </span>
    </div>
  );
}
