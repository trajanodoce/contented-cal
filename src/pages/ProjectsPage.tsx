import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { parseLocalDate } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { Profile } from '../lib/database.types';
import {
  Folder,
  Plus,
  Calendar,
  BarChart3,
  X,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}

interface ContentItemStub {
  id: string;
  project_id: string | null;
  status: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-slate-100 text-slate-500',
};

function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500';
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    if (s.getFullYear() === e.getFullYear()) {
      return `${format(s, 'MMM d')} — ${format(e, 'MMM d, yyyy')}`;
    }
    return `${format(s, 'MMM d, yyyy')} — ${format(e, 'MMM d, yyyy')}`;
  }
  if (start) return `From ${format(parseLocalDate(start), 'MMM d, yyyy')}`;
  return `Until ${format(parseLocalDate(end!), 'MMM d, yyyy')}`;
}

function OwnerAvatar({ owner }: { owner: Profile | undefined }) {
  if (!owner) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-600">
      {owner.avatar_url ? (
        <img
          src={owner.avatar_url}
          alt={owner.full_name ?? undefined}
          className="w-5 h-5 rounded-full object-cover"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-500">
          {owner.full_name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      )}
      <span className="truncate max-w-[120px]">{owner.full_name}</span>
    </div>
  );
}

// ─── Create Project Modal ────────────────────────────────────────────

interface CreateModalProps {
  members: Profile[];
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateProjectModal({ members, workspaceId, onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('projects').insert({
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim(),
      owner_id: ownerId || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error('Failed to create project');
      return;
    }

    toast.success('Project created');
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Create Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Owner */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No owner</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Projects Page ───────────────────────────────────────────────────

export function ProjectsPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const { members, boardColumns } = useWorkspaceData(workspaceId);
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [contentItems, setContentItems] = useState<ContentItemStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    const [projectsRes, itemsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('content_items')
        .select('id, project_id, status')
        .eq('workspace_id', workspaceId),
    ]);

    if (projectsRes.error) {
      toast.error('Failed to load projects');
    } else {
      setProjects(projectsRes.data as Project[]);
    }

    if (!itemsRes.error) {
      setContentItems(itemsRes.data as ContentItemStub[]);
    }

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine the "done" column (highest position)
  const doneColumnId = useMemo(() => {
    if (boardColumns.length === 0) return null;
    return boardColumns.reduce((prev, cur) => (cur.position > prev.position ? cur : prev)).id;
  }, [boardColumns]);

  // Group content items by project_id
  const itemsByProject = useMemo(() => {
    const map = new Map<string, ContentItemStub[]>();
    for (const item of contentItems) {
      if (item.project_id) {
        const list = map.get(item.project_id);
        if (list) {
          list.push(item);
        } else {
          map.set(item.project_id, [item]);
        }
      }
    }
    return map;
  }, [contentItems]);

  const membersMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      {/* Grid or empty state */}
      {projects.length === 0 ? (
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No projects yet</h2>
            <p className="text-slate-500 mb-6">Create your first project to start organizing content.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const items = itemsByProject.get(project.id) ?? [];
            const totalItems = items.length;
            const doneItems = doneColumnId
              ? items.filter((i) => i.status === doneColumnId).length
              : 0;
            const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
            const owner = project.owner_id ? membersMap.get(project.owner_id) : undefined;
            const dateRange = formatDateRange(project.start_date, project.end_date);

            return (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-white border border-slate-200 rounded-lg p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                    {project.title}
                  </h3>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyle(project.status)}`}
                  >
                    {project.status}
                  </span>
                </div>

                {/* Owner */}
                {owner && (
                  <div className="mb-3">
                    <OwnerAvatar owner={owner} />
                  </div>
                )}

                {/* Date range */}
                {dateRange && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{dateRange}</span>
                  </div>
                )}

                {/* Progress */}
                <div className="mb-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {totalItems} {totalItems === 1 ? 'item' : 'items'}
                    </span>
                    {totalItems > 0 && <span>{progressPct}%</span>}
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && workspaceId && (
        <CreateProjectModal
          members={members}
          workspaceId={workspaceId}
          onClose={() => setShowCreate(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
