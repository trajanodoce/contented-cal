import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { parseLocalDate } from '../lib/utils';
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
} from 'lucide-react';
import { formatDate, getPriorityDot, getUserInitials } from '../lib/utils';
import { ContentLibrary } from '../components/projects/ContentLibrary';

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

  const completedCount = useMemo(
    () => items.filter((i) => i.status === lastColumnId).length,
    [items, lastColumnId]
  );

  const overdueCount = useMemo(
    () =>
      items.filter((i) => {
        if (!i.due_date) return false;
        const d = parseLocalDate(i.due_date);
        return d < new Date() && !isToday(d);
      }).length,
    [items]
  );

  const uniqueAssignees = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((i) => i.assignee_ids?.forEach((a) => ids.add(a)));
    return members.filter((m) => ids.has(m.id));
  }, [items, members]);

  // Status badge colors
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      archived: 'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
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
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
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
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
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
              className="text-xl font-semibold text-slate-900 border-b-2 border-blue-500 outline-none bg-transparent flex-1"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-xl font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
            >
              {project.title}
            </h1>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 mt-1 ${statusBadge(project.status)}`}
          >
            {project.status}
          </span>
        </div>

        {/* Description */}
        {editingDesc ? (
          <div className="mb-3">
            <textarea
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Project description..."
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={saveDesc}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDescDraft(project.description ?? '');
                  setEditingDesc(false);
                }}
                className="px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
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
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <input
              type="date"
              value={project.start_date ?? ''}
              onChange={(e) =>
                updateProject({ start_date: e.target.value || null })
              }
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">End</span>
            <input
              type="date"
              value={project.end_date ?? ''}
              onChange={(e) =>
                updateProject({ end_date: e.target.value || null })
              }
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status</span>
            <select
              value={project.status}
              onChange={(e) => updateProject({ status: e.target.value as 'active' | 'completed' | 'archived' })}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  ? 'border-blue-500 text-blue-600'
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
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Recent Activity
          {activityLogs.length > 0 && (
            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{activityLogs.length}</span>
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
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Progress</h3>
        {totalItems > 0 ? (
          <>
            <div className="h-3 rounded-full overflow-hidden flex bg-slate-100">
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
          icon={<Users className="w-4 h-4 text-blue-500" />}
          label="Team members"
          value={uniqueAssignees.length}
        />
      </div>

      {/* Content Library */}
      <ContentLibrary projectId={projectId} workspaceId={workspaceId} />

      {/* Recent activity — collapsible, hidden by default */}
      <RecentActivitySection activityLogs={activityLogs} members={members} />

      {/* Team members */}
      {uniqueAssignees.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Team Members
          </h3>
          <div className="flex flex-wrap gap-3">
            {uniqueAssignees.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg"
              >
                <AvatarCircle profile={m} size="sm" />
                <span className="text-sm text-slate-700">
                  {m.full_name || m.email}
                </span>
              </div>
            ))}
          </div>
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
    <div className="bg-white rounded-lg border border-slate-200 p-4">
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
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Title
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Assignee
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Due Date
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => {
                const ct = contentTypes.find(
                  (c) => c.id === item.content_type_id
                );
                const col = boardColumns.find((c) => c.id === item.status);
                const assignee = members.find((m) =>
                  item.assignee_ids?.includes(m.id)
                );
                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick(item.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
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
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${col.color ?? '#94a3b8'}20`,
                            color: col.color ?? undefined,
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

function BoardTab({
  items,
  boardColumns,
  contentTypes,
  members,
  onItemClick,
}: {
  items: ContentItem[];
  boardColumns: BoardColumn[];
  contentTypes: ContentType[];
  members: Profile[];
  onItemClick: (id: string) => void;
}) {
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

  return (
    <div className="p-6 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {boardColumns.map((col) => {
          const colItems = itemsByColumn.get(col.id) ?? [];
          return (
            <div
              key={col.id}
              className="w-72 flex-shrink-0 bg-slate-100 rounded-lg"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color ?? undefined }}
                />
                <span className="text-sm font-medium text-slate-700">
                  {col.name}
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  {colItems.length}
                </span>
              </div>

              {/* Cards */}
              <div className="px-2 pb-2 space-y-2">
                {colItems.map((item) => {
                  const ct = contentTypes.find(
                    (c) => c.id === item.content_type_id
                  );
                  const assignee = members.find((m) =>
                    item.assignee_ids?.includes(m.id)
                  );
                  return (
                    <div
                      key={item.id}
                      onClick={() => onItemClick(item.id)}
                      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
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
                })}
                {colItems.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No items
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Calendar Tab
// ────────────────────────────────────────────────────────────────────────────────

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
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

  const goToday = () => setCurrentMonth(new Date());

  return (
    <div className="p-6">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="text-xs font-medium text-slate-500 text-center py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate.get(dateKey) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <span
                  className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    today
                      ? 'bg-blue-600 text-white'
                      : inMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayItems.slice(0, 3).map((item) => {
                    const ct = contentTypes.find(
                      (c) => c.id === item.content_type_id
                    );
                    return (
                      <div
                        key={item.id}
                        onClick={() => onItemClick(item.id)}
                        className="text-xs px-1.5 py-0.5 rounded cursor-pointer truncate hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: ct
                            ? `${ct.color}15`
                            : '#f1f5f9',
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
                    <span className="text-xs text-slate-400 pl-1">
                      +{dayItems.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
