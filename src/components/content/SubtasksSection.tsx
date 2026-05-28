import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Check, Plus, X, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { Subtask, Profile } from '../../lib/database.types';
import { DatePickerPanel, datePickerPopoverClass, datePickerPopoverStyle } from '../ui/DatePicker';

interface SubtasksSectionProps {
  contentItemId: string;
  userId: string | null;
  members: Profile[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function SubtasksSection({ contentItemId, userId, members, addToast }: SubtasksSectionProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [assigneePopoverId, setAssigneePopoverId] = useState<string | null>(null);
  const [dueDateEditId, setDueDateEditId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const dragIdRef = useRef<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const assigneePopoverRef = useRef<HTMLDivElement>(null);
  const assigneeBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dueDateRef = useRef<HTMLDivElement>(null);
  const dueDateBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [dueDatePos, setDueDatePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Fetch subtasks
  const fetchSubtasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('content_item_id', contentItemId)
      .order('position');

    if (error) {
      addToast('Failed to load subtasks', 'error');
      return;
    }
    setSubtasks(data ?? []);
  }, [contentItemId, addToast]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (assigneePopoverId && assigneePopoverRef.current && !assigneePopoverRef.current.contains(target)) {
        // Also check if click was on the toggle button itself
        const btn = assigneeBtnRefs.current[assigneePopoverId];
        if (!btn || !btn.contains(target)) {
          setAssigneePopoverId(null);
        }
      }
      if (dueDateEditId && dueDateRef.current && !dueDateRef.current.contains(target)) {
        const btn = dueDateBtnRefs.current[dueDateEditId];
        if (!btn || !btn.contains(target)) {
          setDueDateEditId(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigneePopoverId, dueDateEditId]);

  // Position the due-date popover to the right of the trigger (subtask rows sit at
  // the bottom of a slide-over, so opening downward gets clipped). Fall back to the
  // left if there isn't room, and clamp vertically so the panel stays on screen.
  const computeDueDatePos = useCallback((btn: HTMLElement) => {
    const POPOVER_W = 280;
    const POPOVER_H = 340;
    const MARGIN = 6;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + MARGIN;
    if (left + POPOVER_W > vw - 8) {
      left = Math.max(8, rect.left - POPOVER_W - MARGIN);
    }

    let top = rect.top;
    if (top + POPOVER_H > vh - 8) {
      top = Math.max(8, vh - POPOVER_H - 8);
    }

    setDueDatePos({ top, left });
  }, []);

  // Keep the popover pinned to the trigger while the user scrolls or resizes.
  useEffect(() => {
    if (!dueDateEditId) return;
    const btn = dueDateBtnRefs.current[dueDateEditId];
    if (!btn) return;
    const handler = () => computeDueDatePos(btn);
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true); // capture: nested scroll containers also fire
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [dueDateEditId, computeDueDatePos]);

  // Sorted subtasks: incomplete first by position, then completed by position
  const sortedSubtasks = [...subtasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.position - b.position;
  });

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Toggle completed
  const toggleCompleted = async (subtask: Subtask) => {
    const newCompleted = !subtask.completed;

    setSubtasks(prev =>
      prev.map(s => (s.id === subtask.id ? { ...s, completed: newCompleted } : s))
    );

    const { error } = await supabase
      .from('subtasks')
      .update({ completed: newCompleted })
      .eq('id', subtask.id);

    if (error) {
      addToast('Failed to update subtask', 'error');
      setSubtasks(prev =>
        prev.map(s => (s.id === subtask.id ? { ...s, completed: !newCompleted } : s))
      );
      return;
    }

    if (newCompleted && userId) {
      await supabase.from('activity_log').insert({
        content_item_id: contentItemId,
        user_id: userId,
        action: `completed subtask: ${subtask.title}`,
      });
    }
  };

  // Save edited title
  const saveTitle = async (subtaskId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    setSubtasks(prev =>
      prev.map(s => (s.id === subtaskId ? { ...s, title: trimmed } : s))
    );
    setEditingId(null);

    const { error } = await supabase
      .from('subtasks')
      .update({ title: trimmed })
      .eq('id', subtaskId);

    if (error) {
      addToast('Failed to update subtask title', 'error');
      fetchSubtasks();
    }
  };

  // Update assignee
  const updateAssignee = async (subtaskId: string, assigneeId: string | null) => {
    setSubtasks(prev =>
      prev.map(s => (s.id === subtaskId ? { ...s, assignee_id: assigneeId } : s))
    );
    setAssigneePopoverId(null);

    const { error } = await supabase
      .from('subtasks')
      .update({ assignee_id: assigneeId })
      .eq('id', subtaskId);

    if (error) {
      addToast('Failed to update assignee', 'error');
      fetchSubtasks();
    }
  };

  // Update due date
  const updateDueDate = async (subtaskId: string, date: string | null) => {
    setSubtasks(prev =>
      prev.map(s => (s.id === subtaskId ? { ...s, due_date: date } : s))
    );
    setDueDateEditId(null);

    const { error } = await supabase
      .from('subtasks')
      .update({ due_date: date })
      .eq('id', subtaskId);

    if (error) {
      addToast('Failed to update due date', 'error');
      fetchSubtasks();
    }
  };

  // Delete subtask
  const deleteSubtask = async (subtaskId: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));

    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtaskId);

    if (error) {
      addToast('Failed to delete subtask', 'error');
      fetchSubtasks();
    }
  };

  // Add subtask
  const addSubtask = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setNewTitle('');

    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        content_item_id: contentItemId,
        title: trimmed,
        position: subtasks.length,
      })
      .select()
      .single();

    if (error) {
      addToast('Failed to add subtask', 'error');
      setNewTitle(trimmed);
      return;
    }

    if (data) {
      setSubtasks(prev => [...prev, data]);
    }

    newInputRef.current?.focus();
  };

  // Drag and drop
  const handleDragStart = (id: string) => {
    dragIdRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const dragId = dragIdRef.current;
    const overId = dragOverId;

    dragIdRef.current = null;
    setDragOverId(null);

    if (!dragId || !overId || dragId === overId) return;

    const reordered = [...subtasks];
    const dragIdx = reordered.findIndex(s => s.id === dragId);
    const overIdx = reordered.findIndex(s => s.id === overId);
    if (dragIdx === -1 || overIdx === -1) return;

    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(overIdx, 0, moved);

    const updated = reordered.map((s, i) => ({ ...s, position: i }));
    setSubtasks(updated);

    try {
      await Promise.all(
        updated.map(s =>
          supabase.from('subtasks').update({ position: s.position }).eq('id', s.id)
        )
      );
    } catch {
      addToast('Failed to reorder subtasks', 'error');
      fetchSubtasks();
    }
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
  };

  // Helper: get member by id
  const getMember = (id: string | null): Profile | undefined => {
    if (!id) return undefined;
    return members.find(m => m.id === id);
  };

  // Helper: member initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-surface-card border rounded-xl shadow-sm overflow-hidden p-4" style={{ borderColor: '#002339' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-slate-700">Subtasks</span>
        {totalCount > 0 && (
          <span className="text-xs font-medium text-slate-500 bg-[#005D9712] px-1.5 py-0.5 rounded">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 rounded-full bg-[#005D9712] mb-3">
          <div
            className="h-1.5 rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {sortedSubtasks.map(subtask => {
          const member = getMember(subtask.assignee_id);

          return (
            <div
              key={subtask.id}
              className={`group flex items-center gap-2 py-1.5 px-1 hover:bg-[#005D9708] rounded-lg transition-colors ${
                subtask.completed ? 'opacity-60' : ''
              } ${dragOverId === subtask.id ? 'bg-brand-50' : ''}`}
              draggable
              onDragStart={() => handleDragStart(subtask.id)}
              onDragOver={e => handleDragOver(e, subtask.id)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              {/* Drag handle */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors" />
              </div>

              {/* Checkbox */}
              <button
                onClick={() => toggleCompleted(subtask)}
                className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  subtask.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {subtask.completed && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Title */}
              <div className="flex-1 min-w-0">
                {editingId === subtask.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTitle(subtask.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => saveTitle(subtask.id)}
                    autoFocus
                    className="w-full text-sm px-1 py-0 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                ) : (
                  <span
                    onClick={() => {
                      setEditingId(subtask.id);
                      setEditTitle(subtask.title);
                    }}
                    className={`text-sm cursor-pointer truncate block ${
                      subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {subtask.title}
                  </span>
                )}
              </div>

              {/* Assignee */}
              <div className="relative flex-shrink-0">
                <button
                  ref={el => { assigneeBtnRefs.current[subtask.id] = el; }}
                  onClick={() => {
                    const next = assigneePopoverId === subtask.id ? null : subtask.id;
                    setAssigneePopoverId(next);
                    if (next) {
                      const btn = assigneeBtnRefs.current[subtask.id];
                      if (btn) {
                        const rect = btn.getBoundingClientRect();
                        setPopoverPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 160 });
                      }
                    }
                  }}
                  className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden"
                  title={member ? member.full_name ?? undefined : 'Assign'}
                >
                  {member ? (
                    member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name ?? undefined}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[8px] font-medium flex items-center justify-center">
                        {getInitials(member.full_name ?? '')}
                      </span>
                    )
                  ) : (
                    <User className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {assigneePopoverId === subtask.id && createPortal(
                  <div
                    ref={assigneePopoverRef}
                    className="fixed bg-surface-card border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-[240px] overflow-y-auto"
                    style={{
                      top: Math.min(popoverPos.top, window.innerHeight - 260),
                      left: popoverPos.left,
                      zIndex: 9999,
                    }}
                  >
                    <button
                      onClick={() => updateAssignee(subtask.id, null)}
                      className="w-full text-left px-3 py-1.5 text-sm text-slate-500 hover:bg-[#005D9708] transition-colors"
                    >
                      None
                    </button>
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => updateAssignee(subtask.id, m.id)}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-[#005D9708] flex items-center gap-2 transition-colors"
                      >
                        {m.avatar_url ? (
                          <img
                            src={m.avatar_url}
                            alt={m.full_name ?? undefined}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[8px] font-medium flex items-center justify-center">
                            {getInitials(m.full_name ?? '')}
                          </span>
                        )}
                        {m.full_name}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </div>

              {/* Due date */}
              <div className="relative flex-shrink-0">
                <button
                  ref={el => { dueDateBtnRefs.current[subtask.id] = el; }}
                  onClick={() => {
                    const next = dueDateEditId === subtask.id ? null : subtask.id;
                    setDueDateEditId(next);
                    if (next) {
                      const btn = dueDateBtnRefs.current[subtask.id];
                      if (btn) computeDueDatePos(btn);
                    }
                  }}
                  className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border bg-surface-card transition-colors ${
                    dueDateEditId === subtask.id
                      ? 'border-[#005D97] ring-2 ring-[#005D9725]'
                      : 'border-slate-300 hover:border-[#005D97]'
                  }`}
                  title={subtask.due_date ? formatDate(subtask.due_date) : 'Set due date'}
                >
                  <Calendar className="w-3 h-3 text-[#005D97] shrink-0" />
                  {subtask.due_date ? (
                    <span className="text-slate-700 font-medium">{formatDate(subtask.due_date)}</span>
                  ) : (
                    <span className="text-slate-400">Due</span>
                  )}
                </button>
                {dueDateEditId === subtask.id && createPortal(
                  <div
                    ref={dueDateRef}
                    className={datePickerPopoverClass}
                    style={{ ...datePickerPopoverStyle, top: dueDatePos.top, left: dueDatePos.left }}
                  >
                    <DatePickerPanel
                      value={subtask.due_date ?? ''}
                      onChange={v => updateDueDate(subtask.id, v || null)}
                      onClose={() => setDueDateEditId(null)}
                    />
                  </div>,
                  document.body
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteSubtask(subtask.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add subtask input */}
      <div className="flex items-center gap-2 mt-2">
        <input
          ref={newInputRef}
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') addSubtask();
          }}
          placeholder="Add a subtask..."
          className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          onClick={addSubtask}
          disabled={!newTitle.trim()}
          className="p-1.5 text-slate-400 hover:text-brand-500 disabled:opacity-30 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
