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

export function HomePage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { setSelectedItemId } = useSelectedItem();
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
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
      setProjects(projectsResult.data || []);
      setHighPriorityItems(priorityResult.data || []);
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
        <h1 className="text-2xl font-display text-slate-900">
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
          bg="bg-[#BA2C2C12]"
          alert={!!stats?.overdue_items}
          onClick={() => navigate('/list')}
        />
        <StatCard
          label="Urgent + High"
          value={urgentCount + highCount}
          icon={<Flame className="w-5 h-5" />}
          color="text-orange-600"
          bg="bg-orange-50"
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
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flame className="w-4.5 h-4.5 text-orange-500" />
                <h2 className="font-heading text-slate-900">High Priority Items</h2>
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
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#005D9708] transition-colors text-left group"
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
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4.5 h-4.5 text-brand-500" />
                <h2 className="font-heading text-slate-900">Due This Week</h2>
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
                  const dueDate = parseLocalDate(item.due_date);
                  const isDueToday = isToday(dueDate);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#005D9708] transition-colors text-left group"
                    >
                      <div className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                        isDueToday ? 'bg-brand-100 text-brand-700' : 'bg-[#005D9712] text-slate-600'
                      }`}>
                        {formatDate(item.due_date)}
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
            <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4.5 h-4.5 text-brand-500" />
                  <h2 className="font-heading text-slate-900">Active Projects</h2>
                </div>
                <button
                  onClick={() => navigate('/projects')}
                  className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
                >
                  All projects <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#005D9712]">
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="bg-surface-card p-4 hover:bg-[#005D9708] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: project.color ?? '#6366f1' }}
                      />
                      <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                        {project.name}
                      </h3>
                    </div>
                    {project.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{project.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Status Breakdown + Activity */}
        <div className="space-y-6">
          {/* Status Breakdown */}
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="font-heading text-slate-900">By Status</h2>
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
                      <div className="h-2 bg-[#005D9712] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: s.color || '#94a3b8',
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
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="font-heading text-slate-900">By Priority</h2>
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
          <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-slate-500" />
                <h2 className="font-heading text-slate-900">Recent Activity</h2>
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
                      <span className="text-slate-500">{activity.action}</span>
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
      style={{ border: '1px solid #00233930' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {alert && value > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-accent-crimson animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5 group-hover:text-brand-600 transition-colors">{label}</p>
    </button>
  );
}

export default HomePage;
