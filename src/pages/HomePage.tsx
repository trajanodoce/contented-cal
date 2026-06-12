import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { supabase } from '../lib/supabase';
import type { ContentItem, Project } from '../lib/database.types';
import { parseLocalDate, formatDate, PRIORITY_STYLES } from '../lib/utils';
import { isPast, isToday, formatDistanceToNow } from 'date-fns';
import {
  LayoutDashboard,
  AlertTriangle,
  CalendarClock,
  FolderOpen,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  ChevronRight,
  Activity,
  Loader2,
} from 'lucide-react';

interface WorkspaceStats {
  total_items: number;
  overdue_items: number;
  items_by_status: { status_id: string; status_name: string; color: string; count: number }[] | null;
  items_by_type: { type_id: string; type_name: string; color: string; count: number }[] | null;
  items_by_priority: { priority: string; count: number }[] | null;
  upcoming_due: { id: string; title: string; due_date: string; priority: string }[] | null;
  recent_activity: { id: string; action: string; user_name: string | null; created_at: string }[] | null;
}

const PRIORITY_ICONS: Record<string, typeof Flame> = {
  urgent: Flame,
  high: AlertTriangle,
  medium: AlertCircle,
  low: CheckCircle2,
};

// Maps raw activity_log.action strings (e.g. "Updated due_date") to human-
// readable labels for display in the Recent Activity panel. Falls back to
// the original string if nothing matches.
const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  due_date: 'Changed due date',
  status: 'Changed status',
  priority: 'Changed priority',
  assignee_ids: 'Changed owners',
  content_type_id: 'Changed content type',
  description: 'Edited description',
  title: 'Renamed task',
  channel: 'Changed channel',
  tags: 'Changed tags',
  project_id: 'Changed project',
  category: 'Changed task type',
  custom_fields: 'Updated custom fields',
  publish_date: 'Changed publish date',
  completed: 'Toggled completion',
  archived: 'Archived',
};

// Project card helpers — timeline-health + due-date relative formatting
// (canonical Draft 5.3 pattern). Mirrors the logic in ProjectDetailPage but
// simplified for the home dashboard card.

interface ProjectMiniStats {
  total: number;
  completed: number;
  nearestUpcomingDue: string | null;
}

function projectHealthColor(project: Project, ps?: ProjectMiniStats): string {
  if (project.status === 'completed') return '#357254'; // green
  if (project.status === 'archived') return '#64748B'; // slate

  // Active: derive timeline health from end_date + completion ratio
  if (!project.end_date) return 'rgb(var(--color-brand-600))'; // navy default — no due date
  const endDate = parseLocalDate(project.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToEnd = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  const completion = ps && ps.total > 0 ? ps.completed / ps.total : 0;
  if (daysToEnd < 0) return 'rgb(var(--color-accent-crimson))'; // overdue
  if (daysToEnd <= 7 && completion < 0.8) return '#C4504A'; // due soon, under-done
  return '#357254'; // on track
}

// "Due This Week" badge — graduated color treatment by how close the
// item's due_date is. The closer to today, the warmer the badge:
//   today      → coral (urgent now)
//   tomorrow   → peach (very soon)
//   2–3 days   → peach softer
//   4–7+ days  → brand navy (scheduled / not urgent yet)
//
// Background uses a tint of the same color (color-15 → color-12 → bg-12)
// so the chip stays small + readable. Bold text reinforces hierarchy.
function upcomingDueBadge(dueIso: string): { label: string; bg: string; text: string } {
  const dueDate = parseLocalDate(dueIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

  if (days === 0) {
    return { label: '🔥 Today', bg: '#C4504A18', text: '#C4504A' };
  }
  if (days === 1) {
    return { label: '🌅 Tomorrow', bg: '#D98A6B18', text: '#D98A6B' };
  }
  if (days <= 3) {
    return { label: `🌤 ${formatDate(dueIso)}`, bg: '#D98A6B10', text: '#D98A6B' };
  }
  // 4-7 days out: scheduled, not urgent yet — keep neutral brand-navy
  return { label: `🌊 ${formatDate(dueIso)}`, bg: 'rgb(var(--color-brand-600) / 0.071)', text: 'rgb(var(--color-brand-600))' };
}

function projectDueMeta(due: string | null): { label: string; color: string } | null {
  if (!due) return null;
  const dueDate = parseLocalDate(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return { label: `Overdue ${overdueDays}d`, color: 'rgb(var(--color-accent-crimson))' };
  }
  if (days === 0) return { label: 'Due today', color: '#C4504A' };
  if (days <= 3) return { label: `Due in ${days}d`, color: '#D98A6B' };
  if (days <= 7) return { label: `Due in ${days}d`, color: '#64748B' };
  return { label: `Due ${formatDate(due)}`, color: '#64748B' };
}

function humanizeActivityAction(action: string): string {
  // Pattern: "Updated <field>" → look up canonical label
  const updateMatch = action.match(/^Updated\s+(.+)$/i);
  if (updateMatch) {
    const field = updateMatch[1].trim();
    if (ACTIVITY_FIELD_LABELS[field]) return ACTIVITY_FIELD_LABELS[field];
    // Fallback: snake_case → human title-case ("Updated due_date" → "Changed due date")
    const pretty = field.replace(/_/g, ' ').replace(/\bid\b$/i, '').trim();
    if (pretty) return `Changed ${pretty}`;
  }
  // Common standalone actions
  const lower = action.toLowerCase();
  if (lower === 'created') return 'Created task';
  if (lower === 'archived') return 'Archived task';
  if (lower === 'restored') return 'Restored task';
  // Fall through unchanged — keeps comment/subtask/assignment action strings intact
  return action;
}

export function HomePage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { setSelectedItemId } = useSelectedItem();
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStats, setProjectStats] = useState<Map<string, ProjectMiniStats>>(new Map());
  const [highPriorityItems, setHighPriorityItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const [statsResult, projectsResult, priorityResult] = await Promise.all([
        supabase.rpc('get_workspace_stats', { ws_id: currentWorkspace.id }),
        supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('content_items')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .in('priority', ['urgent', 'high'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(8),
      ]);

      if (statsResult.data) setStats(statsResult.data as unknown as WorkspaceStats);
      const activeProjects = projectsResult.data || [];
      setProjects(activeProjects);
      setHighPriorityItems(priorityResult.data || []);

      // Per-project mini-stats: total / completed / nearest upcoming due_date.
      // One batched query covers all active projects in the card.
      if (activeProjects.length > 0) {
        const projectIds = activeProjects.map(p => p.id);
        const itemsResult = await supabase
          .from('content_items')
          .select('project_id, due_date, completed')
          .eq('workspace_id', currentWorkspace.id)
          .in('project_id', projectIds)
          .eq('archived', false);

        const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for lex compare
        const map = new Map<string, ProjectMiniStats>();
        for (const row of itemsResult.data ?? []) {
          if (!row.project_id) continue;
          const m = map.get(row.project_id) ?? { total: 0, completed: 0, nearestUpcomingDue: null };
          m.total++;
          if (row.completed) m.completed++;
          if (!row.completed && row.due_date && row.due_date >= todayIso) {
            if (!m.nearestUpcomingDue || row.due_date < m.nearestUpcomingDue) {
              m.nearestUpcomingDue = row.due_date;
            }
          }
          map.set(row.project_id, m);
        }
        setProjectStats(map);
      } else {
        setProjectStats(new Map());
      }
    } catch (err) {
      console.error('Error fetching homepage data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">Please select a workspace</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const statusItems = stats?.items_by_status?.filter(s => s.count > 0) || [];
  const urgentCount = stats?.items_by_priority?.find(p => p.priority === 'urgent')?.count || 0;
  const highCount = stats?.items_by_priority?.find(p => p.priority === 'high')?.count || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display text-slate-900">
          {greeting}, {userName}
        </h1>
        <p className="text-slate-500 mt-1">
          Here's what's happening in <span className="font-medium text-slate-700">{currentWorkspace.name}</span>
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={stats?.total_items ?? 0}
          icon={<LayoutDashboard className="w-5 h-5" />}
          color="text-brand-600"
          bg="bg-brand-50"
          onClick={() => navigate('/list')}
        />
        <StatCard
          label="Overdue"
          value={stats?.overdue_items ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-accent-crimson"
          bg="bg-accent-crimson/[0.071]"
          alert={!!stats?.overdue_items}
          onClick={() => navigate('/list')}
        />
        <StatCard
          label="Urgent + High"
          value={urgentCount + highCount}
          icon={<Flame className="w-5 h-5" />}
          color="text-[#C4504A]"
          bg="bg-[#C4504A12]"
          alert={urgentCount > 0}
          onClick={() => navigate('/list')}
        />
        <StatCard
          label="Active Projects"
          value={projects.length}
          icon={<FolderOpen className="w-5 h-5" />}
          color="text-brand-600"
          bg="bg-brand-50"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: High Priority + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* High Priority Items */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flame className="w-4.5 h-4.5 text-orange-500" />
                <h2 className="text-2xl font-heading text-slate-900">High Priority Items</h2>
                {highPriorityItems.length > 0 && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                    {highPriorityItems.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/list')}
                className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {highPriorityItems.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-[#92D1B2]" />
                <p className="font-medium text-slate-600">All clear!</p>
                <p className="text-sm">No urgent or high-priority items right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {highPriorityItems.map(item => {
                  const isOverdue = item.due_date && isPast(parseLocalDate(item.due_date)) && !isToday(parseLocalDate(item.due_date));
                  const pStyle = PRIORITY_STYLES[item.priority ?? 'low'];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-600/[0.094] transition-colors text-left group"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${pStyle.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-xs font-medium ${pStyle.text}`}>
                            {pStyle.label}
                          </span>
                          {item.due_date && (
                            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-accent-crimson font-medium' : 'text-slate-400'}`}>
                              <CalendarClock className="w-3 h-3" />
                              {formatDate(item.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Due */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4.5 h-4.5 text-brand-500" />
                <h2 className="text-2xl font-heading text-slate-900">Due This Week</h2>
              </div>
              <button
                onClick={() => navigate('/calendar')}
                className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
              >
                Calendar <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!stats?.upcoming_due || stats.upcoming_due.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400">
                <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nothing due in the next 7 days.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.upcoming_due.map(item => {
                  const dueBadge = upcomingDueBadge(item.due_date);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-600/[0.094] transition-colors text-left group"
                    >
                      <div
                        className="px-2 py-1 rounded text-xs font-semibold shrink-0"
                        style={{
                          backgroundColor: dueBadge.bg,
                          color: dueBadge.text,
                        }}
                      >
                        {dueBadge.label}
                      </div>
                      <p className="text-sm text-slate-900 truncate flex-1 group-hover:text-brand-600 transition-colors">
                        {item.title}
                      </p>
                      {item.priority && item.priority !== 'low' && (
                        <span className={`text-xs font-medium ${PRIORITY_STYLES[item.priority]?.text ?? 'text-slate-500'}`}>
                          {PRIORITY_STYLES[item.priority]?.label}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Projects Overview */}
          {projects.length > 0 && (
            <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4.5 h-4.5 text-brand-500" />
                  <h2 className="text-2xl font-heading text-slate-900">Active Projects</h2>
                </div>
                <button
                  onClick={() => navigate('/projects')}
                  className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
                >
                  All projects <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-brand-600/[0.071]">
                {projects.map(project => {
                  const ps = projectStats.get(project.id);
                  const dueMeta = projectDueMeta(ps?.nearestUpcomingDue ?? project.end_date ?? null);
                  const healthColor = projectHealthColor(project, ps);
                  return (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="bg-surface-card p-4 hover:bg-brand-600/[0.094] transition-colors text-left group"
                    >
                      <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors mb-1.5">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{
                            backgroundColor: `${healthColor}12`,
                            color: healthColor,
                            border: `1px solid ${healthColor}30`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: healthColor }}
                          />
                          {project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'Archived'}
                        </span>
                        {dueMeta && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium"
                            style={{ color: dueMeta.color }}
                          >
                            <CalendarClock className="w-3 h-3" />
                            {dueMeta.label}
                          </span>
                        )}
                        {ps && ps.total > 0 && (
                          <span className="text-[11px] text-slate-400">
                            {ps.completed}/{ps.total} done
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Status Breakdown + Activity */}
        <div className="space-y-6">
          {/* Status Breakdown */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="text-2xl font-heading text-slate-900">By Status</h2>
              </div>
            </div>

            {statusItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                No items yet
              </div>
            ) : (
              <div className="p-5 space-y-3">
                {/* Bar chart */}
                {statusItems.map(s => {
                  const pct = stats?.total_items ? Math.round((s.count / stats.total_items) * 100) : 0;
                  return (
                    <div key={s.status_id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{s.status_name}</span>
                        <span className="text-slate-500">{s.count}</span>
                      </div>
                      <div className="h-2 bg-brand-600/[0.071] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: s.color || '#64748B',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Priority Breakdown */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="text-2xl font-heading text-slate-900">By Priority</h2>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {['urgent', 'high', 'medium', 'low'].map(priority => {
                const ps = PRIORITY_STYLES[priority];
                const count = stats?.items_by_priority?.find(p => p.priority === priority)?.count ?? 0;
                const Icon = PRIORITY_ICONS[priority];
                return (
                  <div key={priority} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${ps.pill}`}>
                    <Icon className={`w-4 h-4 ${ps.text}`} />
                    <div>
                      <p className="text-lg font-semibold text-slate-900 leading-none">{count}</p>
                      <p className={`text-xs ${ps.text} mt-0.5`}>{ps.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="text-2xl font-heading text-slate-900">Recent Activity</h2>
              </div>
            </div>

            {!stats?.recent_activity || stats.recent_activity.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {stats.recent_activity.map(activity => (
                  <div key={activity.id} className="px-5 py-3">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{activity.user_name ?? 'Someone'}</span>{' '}
                      <span className="text-slate-500">{humanizeActivityAction(activity.action)}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  alert,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-surface-card rounded-xl p-5 hover:shadow-md transition-all text-left group"
      style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {alert && value > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-accent-crimson animate-pulse" />
        )}
      </div>
      <p className="text-3xl font-display text-slate-900 leading-none">{value}</p>
      <p className="text-sm text-slate-500 mt-1.5 group-hover:text-brand-600 transition-colors">{label}</p>
    </button>
  );
}

export default HomePage;
