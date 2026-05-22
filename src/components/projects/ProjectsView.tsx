import React, { useState, useMemo } from 'react';
import {
  Plus, Calendar, Users, BarChart3, ArrowLeft,
  Loader2, FolderOpen, Check, X, Edit2, Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { Project, ContentItem } from '../../lib/database.types';
import { formatDate } from '../../lib/utils';

interface Props {
  onItemClick: (item: ContentItem) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ProjectsView({ onItemClick, addToast }: Props) {
  const { projects, contentItems, user, workspace, refreshProjects, boardColumns, contentTypes, members } = useApp();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onItemClick={onItemClick}
        addToast={addToast}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
            <p className="text-sm text-gray-500 mt-0.5">Group related content items into projects</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New project
          </button>
        </div>

        {showCreate && (
          <CreateProjectModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); refreshProjects(); }}
            addToast={addToast}
          />
        )}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
              <FolderOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">No projects yet</h3>
            <p className="text-sm text-gray-400 max-w-xs">Create your first project to group and track related content items together.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
            >
              Create a project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const items = contentItems.filter(i => i.project_id === project.id);
              const completed = items.filter(i => {
                const col = boardColumns.find(c => c.id === i.status);
                return col?.name?.toLowerCase() === 'published' || col?.name?.toLowerCase() === 'approved';
              }).length;
              const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors truncate">{project.title}</h3>
                      {project.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <StatusDot status={project.status} />
                  </div>

                  <div className="space-y-3">
                    {items.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{completed}/{items.length} items</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {(project.start_date || project.end_date) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {project.start_date ? formatDate(project.start_date) : '—'}
                            {' → '}
                            {project.end_date ? formatDate(project.end_date) : '—'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-brand-400',
    archived: 'bg-gray-400',
  };
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ml-2 ${map[status] ?? 'bg-gray-300'}`} />
  );
}

// ── Project Detail ────────────────────────────────────────────────────────────

function ProjectDetail({ project, onBack, onItemClick, addToast }: {
  project: Project;
  onBack: () => void;
  onItemClick: (item: ContentItem) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const { contentItems, boardColumns, contentTypes, refreshProjects, refreshContentItems } = useApp();
  const [tab, setTab] = useState<'overview' | 'list'>('overview');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDesc, setEditDesc] = useState(project.description);
  const [editStatus, setEditStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);

  const items = useMemo(
    () => contentItems.filter(i => i.project_id === project.id),
    [contentItems, project.id]
  );

  const publishedCol = boardColumns.find(c => c.name.toLowerCase() === 'published');
  const approvedCol = boardColumns.find(c => c.name.toLowerCase() === 'approved');
  const completedIds = new Set([publishedCol?.id, approvedCol?.id].filter(Boolean));
  const completed = items.filter(i => i.status && completedIds.has(i.status)).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const byStatus = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const col of boardColumns) map.set(col.id, []);
    map.set('none', []);
    for (const item of items) {
      const key = item.status ?? 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items, boardColumns]);

  async function saveProject() {
    setSaving(true);
    const { error } = await supabase.from('projects')
      .update({ title: editTitle, description: editDesc, status: editStatus })
      .eq('id', project.id);
    setSaving(false);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshProjects();
    setEditing(false);
    addToast('Project updated');
  }

  async function deleteProject() {
    if (!confirm('Delete this project? Content items will not be deleted.')) return;
    await supabase.from('content_items').update({ project_id: null }).eq('project_id', project.id);
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshProjects();
    await refreshContentItems();
    onBack();
    addToast('Project deleted');
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All projects
        </button>

        {editing ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="text-xl font-semibold text-gray-900 border-b-2 border-brand-400 outline-none bg-transparent w-full"
            />
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={2}
              className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              placeholder="Description..."
            />
            <div className="flex items-center gap-2">
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={saveProject}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">{project.title}</h1>
                <StatusBadge status={project.status} />
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 mt-1">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                {project.start_date && <span><Calendar className="w-3 h-3 inline mr-1" />{formatDate(project.start_date)} → {project.end_date ? formatDate(project.end_date) : 'ongoing'}</span>}
                <span>{items.length} content item{items.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={deleteProject} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mt-4 -mb-px">
          {(['overview', 'list'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors mr-1
                ${tab === t ? 'border-brand-400 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>{completed} completed</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-400 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 shrink-0">{items.length}</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {boardColumns.slice(0, 6).map(col => {
                  const count = (byStatus.get(col.id) ?? []).length;
                  if (count === 0) return null;
                  return (
                    <div key={col.id} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="text-gray-600 truncate">{col.name}</span>
                      <span className="ml-auto font-medium text-gray-900">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items by status */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Content items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No content items in this project yet. Add items by setting their project in the detail panel.</p>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, 10).map(item => {
                    const ct = contentTypes.find(c => c.id === item.content_type_id);
                    const col = boardColumns.find(c => c.id === item.status);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onItemClick(item)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        {ct && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />}
                        <span className="flex-1 text-sm text-gray-800 truncate">{item.title}</span>
                        {col && (
                          <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                            {col.name}
                          </span>
                        )}
                        {item.due_date && (
                          <span className="text-xs text-gray-400 shrink-0">{formatDate(item.due_date)}</span>
                        )}
                      </button>
                    );
                  })}
                  {items.length > 10 && (
                    <button onClick={() => setTab('list')} className="w-full text-center text-xs text-brand-500 hover:text-brand-700 py-2">
                      View all {items.length} items
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'list' && (
          <div className="p-6">
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No content items in this project.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {items.map(item => {
                    const ct = contentTypes.find(c => c.id === item.content_type_id);
                    const col = boardColumns.find(c => c.id === item.status);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onItemClick(item)}
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {ct ? (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300" />
                        )}
                        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{item.title}</span>
                        {col && (
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                            {col.name}
                          </span>
                        )}
                        <span className={`text-xs shrink-0 font-medium ${
                          item.priority === 'urgent' ? 'text-red-500' :
                          item.priority === 'high' ? 'text-orange-500' :
                          item.priority === 'medium' ? 'text-yellow-600' : 'text-gray-400'
                        }`}>{item.priority}</span>
                        {item.due_date && (
                          <span className="text-xs text-gray-400 shrink-0 w-20 text-right">{formatDate(item.due_date)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-mint-200 text-brand-700',
    archived: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ── Create Project Modal ──────────────────────────────────────────────────────

function CreateProjectModal({ onClose, onCreated, addToast }: {
  onClose: () => void;
  onCreated: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const { workspace, user } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !user) return;
    setLoading(true);
    const { error } = await supabase.from('projects').insert({
      workspace_id: workspace.id,
      title: title.trim(),
      description,
      owner_id: user.id,
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'active',
    });
    setLoading(false);
    if (error) { addToast(error.message, 'error'); return; }
    addToast(`Project "${title}" created`);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              autoFocus
              required
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="e.g. Q1 Content Campaign"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              placeholder="Optional project description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
