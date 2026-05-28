import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import type { PersonalTask } from '../../lib/database.types';
import { parseLocalDate, formatDate } from '../../lib/utils';
import { isPast, isToday } from 'date-fns';
import {
  Plus,
  Check,
  Square,
  Trash2,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Users,
  Lightbulb,
  Palette,
  ClipboardCheck,
  Search,
  FolderOpen,
  Pencil,
  X,
} from 'lucide-react';
import DatePicker from '../ui/DatePicker';

// ── Category definitions ─────────────────────────────────────────────────────

export const TASK_CATEGORIES: Record<string, { label: string; icon: typeof Briefcase; color: string }> = {
  meetings:  { label: 'Meetings',   icon: Users,          color: '#6366f1' },
  admin:     { label: 'Admin',      icon: Briefcase,      color: '#64748b' },
  strategy:  { label: 'Strategy',   icon: Lightbulb,      color: '#f59e0b' },
  creative:  { label: 'Creative',   icon: Palette,        color: '#ec4899' },
  reviews:   { label: 'Reviews',    icon: ClipboardCheck, color: '#10b981' },
  research:  { label: 'Research',   icon: Search,         color: '#3b82f6' },
  general:   { label: 'General',    icon: FolderOpen,     color: '#94a3b8' },
};

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: '#94a3b8',
};

const priorityLabels: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// ── Inline add form ──────────────────────────────────────────────────────────

function AddTaskForm({ workspaceId, onAdded }: { workspaceId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('personal_tasks').insert({
      user_id: user.id,
      workspace_id: workspaceId,
      title: title.trim(),
      category,
      priority,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to add task');
      return;
    }
    toast.success('Task added');
    setTitle('');
    setCategory('general');
    setPriority('medium');
    setDueDate('');
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need to do?"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-xs text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-brand-200 outline-none"
        >
          {Object.entries(TASK_CATEGORIES).map(([key, cat]) => (
            <option key={key} value={key}>{cat.label}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-brand-200 outline-none"
        >
          {Object.entries(priorityLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <DatePicker
          value={dueDate || null}
          onChange={(val) => setDueDate(val)}
          placeholder="Due date"
        />
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

interface Props {
  workspaceId: string;
}

export function PersonalTasksSection({ workspaceId }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('personal_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setTasks((data as PersonalTask[]) || []);
    setLoading(false);
  }, [user, workspaceId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const updateTask = async (taskId: string, updates: Partial<Pick<PersonalTask, 'title' | 'category' | 'priority' | 'due_date'>>): Promise<boolean> => {
    const { error } = await supabase
      .from('personal_tasks')
      .update(updates)
      .eq('id', taskId);
    if (error) {
      toast.error('Failed to update task');
      return false;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    return true;
  };

  const toggleComplete = async (task: PersonalTask) => {
    const nowCompleted = !task.completed;
    const { error } = await supabase
      .from('personal_tasks')
      .update({
        completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', task.id);
    if (error) {
      toast.error('Failed to update task');
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null } : t
      )
    );
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
    if (error) {
      toast.error('Failed to delete task');
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Split tasks
  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  // Group active tasks by category
  const grouped = activeTasks.reduce<Record<string, PersonalTask[]>>((acc, task) => {
    const cat = task.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {});

  // Sort categories: those with tasks first, in order defined
  const categoryOrder = Object.keys(TASK_CATEGORIES);
  const sortedCategories = categoryOrder.filter((cat) => grouped[cat]?.length);

  if (loading) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-slate-100"
        style={{ background: 'linear-gradient(to right, #005D97 0%, #F5F0E8 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Personal Tasks</h2>
          {activeTasks.length > 0 && (
            <span className="text-xs font-medium text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
              {activeTasks.length}
            </span>
          )}
        </div>
        <AddTaskForm workspaceId={workspaceId} onAdded={fetchTasks} />
      </div>

      {/* Body */}
      <div className="p-5">
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg py-8 text-center">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Track your role tasks, meetings, and to-dos here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active tasks by category */}
            {sortedCategories.map((catKey) => {
              const catMeta = TASK_CATEGORIES[catKey] || TASK_CATEGORIES.general;
              const CatIcon = catMeta.icon;
              const catTasks = grouped[catKey];
              const isCollapsed = collapsedCategories.has(catKey);

              return (
                <div key={catKey} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <CatIcon className="w-4 h-4" style={{ color: catMeta.color }} />
                    <span className="text-sm font-medium text-slate-700">{catMeta.label}</span>
                    <span className="text-xs text-slate-400 ml-auto">{catTasks.length}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-slate-50 border-t border-slate-100">
                      {catTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          isEditing={editingTaskId === task.id}
                          onStartEdit={() => setEditingTaskId(task.id)}
                          onStopEdit={() => setEditingTaskId(null)}
                          onUpdate={async (updates) => updateTask(task.id, updates)}
                          onToggle={() => toggleComplete(task)}
                          onDelete={() => deleteTask(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Completed tasks toggle */}
            {completedTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors mb-2"
                >
                  {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
                </button>

                {showCompleted && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-50 opacity-60">
                    {completedTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        isEditing={editingTaskId === task.id}
                        onStartEdit={() => setEditingTaskId(task.id)}
                        onStopEdit={() => setEditingTaskId(null)}
                        onUpdate={async (updates) => updateTask(task.id, updates)}
                        onToggle={() => toggleComplete(task)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onToggle,
  onDelete,
}: {
  task: PersonalTask;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<Pick<PersonalTask, 'title' | 'category' | 'priority' | 'due_date'>>) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editCategory, setEditCategory] = useState(task.category || 'general');
  const [editPriority, setEditPriority] = useState(task.priority || 'medium');
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const [saving, setSaving] = useState(false);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset edit fields only when entering edit mode (not on every task object change)
  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
      setEditCategory(task.category || 'general');
      setEditPriority(task.priority || 'medium');
      setEditDueDate(task.due_date || '');
      setShowSavedCheck(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const hasChanges = () => {
    return (
      editTitle.trim() !== task.title ||
      editCategory !== (task.category || 'general') ||
      editPriority !== (task.priority || 'medium') ||
      editDueDate !== (task.due_date || '')
    );
  };

  const saveChanges = async (andClose = true): Promise<boolean> => {
    if (!editTitle.trim()) return false;
    if (!hasChanges()) {
      if (andClose) onStopEdit();
      return true;
    }
    setSaving(true);
    const ok = await onUpdate({
      title: editTitle.trim(),
      category: editCategory,
      priority: editPriority,
      due_date: editDueDate || null,
    });
    setSaving(false);
    if (!ok) return false;
    if (andClose) onStopEdit();
    return true;
  };

  const handleClose = async () => {
    if (hasChanges() && editTitle.trim()) {
      const ok = await saveChanges(false);
      if (ok) {
        setShowSavedCheck(true);
        setTimeout(() => {
          setShowSavedCheck(false);
          onStopEdit();
        }, 900);
      }
    } else {
      onStopEdit();
    }
  };

  const isOverdue =
    !task.completed &&
    task.due_date &&
    isPast(parseLocalDate(task.due_date)) &&
    !isToday(parseLocalDate(task.due_date));

  if (isEditing) {
    return (
      <div className="px-4 py-3 bg-brand-50/50 border-l-2 border-brand-400">
        {/* Row 1: Title + close/saved indicator */}
        <div className="flex items-center gap-2 mb-3">
          <input
            ref={titleRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveChanges();
              if (e.key === 'Escape') handleClose();
            }}
            className="flex-1 text-sm border border-slate-200 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none bg-white"
            placeholder="Task title"
          />
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-full transition-all flex-shrink-0 ${
              showSavedCheck
                ? 'bg-green-100 text-green-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Close (auto-saves)"
          >
            {showSavedCheck ? (
              <Check className="w-4 h-4 animate-[scaleIn_0.3s_ease-out]" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Row 2: Fields */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:ring-2 focus:ring-brand-200 outline-none bg-white"
          >
            {Object.entries(TASK_CATEGORIES).map(([key, cat]) => (
              <option key={key} value={key}>{cat.label}</option>
            ))}
          </select>
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:ring-2 focus:ring-brand-200 outline-none bg-white"
          >
            {Object.entries(priorityLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <DatePicker
            value={editDueDate || null}
            onChange={(val) => setEditDueDate(val)}
            placeholder="Due date"
          />
        </div>

        {/* Row 3: Save button at bottom */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-100">
          <button
            onClick={() => saveChanges()}
            disabled={!editTitle.trim() || saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Save Changes
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group cursor-pointer"
      onClick={() => !task.completed && onStartEdit()}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`flex-shrink-0 transition-colors ${
          task.completed
            ? 'text-green-500 hover:text-green-600'
            : 'text-slate-300 hover:text-brand-500'
        }`}
      >
        {task.completed ? <Check className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
      </button>

      {/* Title */}
      <span
        className={`text-sm flex-1 ${
          task.completed ? 'line-through text-slate-400' : 'text-slate-900'
        }`}
      >
        {task.title}
      </span>

      {/* Edit icon on hover */}
      {!task.completed && (
        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}

      {/* Priority dot */}
      {!task.completed && task.priority !== 'medium' && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityColors[task.priority] }}
          title={priorityLabels[task.priority]}
        />
      )}

      {/* Due date */}
      {task.due_date && !task.completed && (
        <span
          className={`flex items-center gap-1 text-xs flex-shrink-0 ${
            isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
          }`}
        >
          {isOverdue && <AlertCircle className="w-3 h-3" />}
          <Calendar className="w-3 h-3" />
          {formatDate(task.due_date)}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
        title="Delete task"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
