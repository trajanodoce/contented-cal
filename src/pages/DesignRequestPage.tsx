import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import type { Profile, BoardColumn, Json } from '../lib/database.types';
import DatePicker from '../components/ui/DatePicker';
import {
  X,
  ChevronDown,
  Calendar,
  Check,
  User,
  Loader2,
  Plus,
  Trash2,
  Link as LinkIcon,
  Palette,
  ListChecks,
} from 'lucide-react';

// Priority options
const priorityOptions = [
  { value: 'low', label: 'Low', color: '#9ca3af' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
] as const;

// ── Reusable select ─────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; color?: string }

function CustomSelect({ options, value, onChange, placeholder }: {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-surface-card border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-between min-h-[42px]">
        <div className="flex items-center gap-2">
          {selected?.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selected.color }} />}
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>{selected?.label || placeholder || 'Select...'}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-card rounded-xl shadow-lg max-h-60 overflow-auto" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9708 0%, transparent 40%), #F7F9FC' }}>
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-2 ${opt.value === value ? 'bg-purple-50 text-purple-900' : 'text-slate-700'}`}>
              {opt.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />}
              {opt.label}
              {opt.value === value && <Check className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assignee multi-select ───────────────────────────────────────────────────

function AssigneeMultiSelect({ members, value, onChange }: {
  members: Profile[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = members.filter(m => value.includes(m.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-surface-card border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-between min-h-[42px]">
        <div className="flex items-center gap-2 flex-wrap">
          {selected.length === 0 ? <span className="text-slate-400">Select assignees...</span>
            : selected.length === 1 ? (
              <div className="flex items-center gap-2">
                {selected[0].avatar_url
                  ? <img src={selected[0].avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  : <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><User className="w-3 h-3 text-slate-500" /></div>}
                <span className="text-slate-700">{selected[0].full_name || selected[0].email}</span>
              </div>
            ) : <span className="text-slate-700">{selected.length} assignees</span>}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-card rounded-xl shadow-lg max-h-60 overflow-auto" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9708 0%, transparent 40%), #F7F9FC' }}>
          {members.map(m => {
            const sel = value.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggle(m.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-3 ${sel ? 'bg-purple-50' : ''}`}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${sel ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                  {sel && <Check className="w-3 h-3 text-white" />}
                </div>
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  : <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><User className="w-3 h-3 text-slate-500" /></div>}
                <span className={sel ? 'text-purple-900' : 'text-slate-700'}>{m.full_name || m.email}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function DesignRequestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { boardColumns, members } = useWorkspaceData(currentWorkspace?.id || null);
  const { projects } = useApp();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assetLinks, setAssetLinks] = useState<string[]>(['']);
  const [subtasks, setSubtasks] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default status
  useEffect(() => {
    if (boardColumns.length > 0 && !statusId) {
      const first = [...boardColumns].sort((a, b) => a.position - b.position)[0];
      setStatusId(first.id);
    }
  }, [boardColumns, statusId]);

  const statusOptions = useMemo(() =>
    [...boardColumns].sort((a, b) => a.position - b.position).map(c => ({ value: c.id, label: c.name, color: c.color ?? undefined })),
    [boardColumns]
  );

  // Asset links
  function addLink() { setAssetLinks(prev => [...prev, '']); }
  function removeLink(i: number) { setAssetLinks(prev => prev.filter((_, idx) => idx !== i)); }
  function updateLink(i: number, v: string) { setAssetLinks(prev => prev.map((l, idx) => idx === i ? v : l)); }

  // Subtasks
  function addSubtask() { setSubtasks(prev => [...prev, '']); }
  function removeSubtask(i: number) { setSubtasks(prev => prev.filter((_, idx) => idx !== i)); }
  function updateSubtask(i: number, v: string) { setSubtasks(prev => prev.map((s, idx) => idx === i ? v : s)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!currentWorkspace || !user) { toast.error('Not logged in'); return; }

    setIsSubmitting(true);
    try {
      // Create the content item
      const cleanLinks = assetLinks.filter(l => l.trim());
      const { data: newItem, error } = await supabase.from('content_items').insert({
        workspace_id: currentWorkspace.id,
        title: title.trim(),
        description: description.trim() || null,
        status: statusId || null,
        assignee_ids: assigneeIds,
        due_date: dueDate || null,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        project_id: projectId || null,
        created_by: user.id,
        tags: ['design-request'],
        custom_fields: {
          _source: 'design-request',
          _asset_links: cleanLinks.length > 0 ? cleanLinks : undefined,
        } as Json,
      }).select('id').single();

      if (error) throw error;

      // Create subtasks
      const cleanSubtasks = subtasks.filter(s => s.trim());
      if (cleanSubtasks.length > 0 && newItem) {
        const subtaskRows = cleanSubtasks.map((s, i) => ({
          content_item_id: newItem.id,
          title: s.trim(),
          completed: false,
          position: i,
        }));
        await supabase.from('subtasks').insert(subtaskRows);
      }

      toast.success('Design request created!');
      navigate('/list');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-page py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Design Request</h1>
            <p className="text-sm text-slate-500">Submit a new design request for the team.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What do you need designed?"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the design request in detail..."
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
                <CustomSelect options={statusOptions} value={statusId} onChange={setStatusId} placeholder="Select status..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Priority</label>
                <CustomSelect
                  options={priorityOptions.map(p => ({ value: p.value, label: p.label, color: p.color }))}
                  value={priority}
                  onChange={setPriority}
                />
              </div>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Assignees</label>
              <AssigneeMultiSelect members={members} value={assigneeIds} onChange={setAssigneeIds} />
            </div>

            {/* Project & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Project</label>
                  <CustomSelect
                    options={projects.filter(p => p.status === 'active').map(p => ({ value: p.id, label: p.title }))}
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Select project..."
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Due Date</label>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </div>
            </div>

            {/* Asset Links */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  Asset Links
                </label>
                <button type="button" onClick={addLink} className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add link
                </button>
              </div>
              <div className="space-y-2">
                {assetLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={e => updateLink(i, e.target.value)}
                      placeholder="https://figma.com/..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {assetLinks.length > 1 && (
                      <button type="button" onClick={() => removeLink(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                  Subtasks
                </label>
                <button type="button" onClick={addSubtask} className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add subtask
                </button>
              </div>
              <div className="space-y-2">
                {subtasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={task}
                      onChange={e => updateSubtask(i, e.target.value)}
                      placeholder={`Subtask ${i + 1}...`}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {subtasks.length > 1 && (
                      <button type="button" onClick={() => removeSubtask(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#0B2763' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
