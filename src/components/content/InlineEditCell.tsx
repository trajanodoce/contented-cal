import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast }     from 'sonner';
import { ChevronDown, User, Check } from 'lucide-react';
import type { Profile, BoardColumn, ContentType } from '../../lib/database.types';

// Priority configuration
const priorityOptions = [
  { value: 'low', label: 'Low', color: '#9ca3af' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
] as const;

interface InlineStatusEditProps {
  statusId: string | null;
  boardColumns: BoardColumn[];
  contentItemId: string;
  onUpdate: () => void;
}

export function InlineStatusEdit({ statusId, boardColumns, contentItemId, onUpdate }: InlineStatusEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentColumn = boardColumns.find((bc) => bc.id === statusId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleStatusChange(newStatusId: string) {
    setIsOpen(false);
    if (newStatusId === statusId) return;

    const { error } = await supabase
      .from('content_items')
      .update({ status: newStatusId })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update status: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const newStatus = boardColumns.find((bc) => bc.id === newStatusId);
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed status to ${newStatus?.name || 'None'}`,
      metadata: { oldStatus: statusId, newStatus: newStatusId },
    });

    toast.success('Status updated');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: currentColumn ? `${currentColumn.color}20` : '#f1f5f9',
          color: currentColumn?.color || '#64748b',
        }}
      >
        {currentColumn?.name || 'None'}
        <ChevronDown className="w-3 h-3 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[150px]">
          {boardColumns
            .sort((a, b) => a.position - b.position)
            .map((column) => (
              <button
                key={column.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(column.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                  column.id === statusId ? 'bg-blue-50' : ''
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className={column.id === statusId ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                  {column.name}
                </span>
                {column.id === statusId && <Check className="w-4 h-4 ml-auto text-blue-600" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface InlinePriorityEditProps {
  priority: string;
  contentItemId: string;
  onUpdate: () => void;
}

export function InlinePriorityEdit({ priority, contentItemId, onUpdate }: InlinePriorityEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPriority = priorityOptions.find((p) => p.value === priority) || priorityOptions[1];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handlePriorityChange(newPriority: string) {
    setIsOpen(false);
    if (newPriority === priority) return;

    const { error } = await supabase
      .from('content_items')
      .update({ priority: newPriority })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update priority: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const newPriorityLabel = priorityOptions.find((p) => p.value === newPriority)?.label;
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed priority to ${newPriorityLabel}`,
      metadata: { oldPriority: priority, newPriority },
    });

    toast.success('Priority updated');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: currentPriority.color }}
        />
        <span className="text-sm text-slate-700">{currentPriority.label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[120px]">
          {priorityOptions.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                handlePriorityChange(option.value);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                option.value === priority ? 'bg-blue-50' : ''
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: option.color }}
              />
              <span className={option.value === priority ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                {option.label}
              </span>
              {option.value === priority && <Check className="w-4 h-4 ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface InlineAssigneeEditProps {
  assigneeIds: string[];
  members: Profile[];
  contentItemId: string;
  onUpdate: () => void;
}

export function InlineAssigneeEdit({ assigneeIds, members, contentItemId, onUpdate }: InlineAssigneeEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedMembers = members.filter((m) => assigneeIds.includes(m.id));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggleAssignee(memberId: string) {
    const isSelected = assigneeIds.includes(memberId);
    const newAssigneeIds = isSelected
      ? assigneeIds.filter((id) => id !== memberId)
      : [...assigneeIds, memberId];

    const { error } = await supabase
      .from('content_items')
      .update({ assignee_ids: newAssigneeIds })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update assignees: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const member = members.find((m) => m.id === memberId);
    const action = isSelected
      ? `removed ${member?.full_name || member?.email || 'assignee'}`
      : `assigned to ${member?.full_name || member?.email || 'member'}`;

    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action,
      metadata: { assigneeId: memberId, assigneeIds: newAssigneeIds },
    });

    toast.success(isSelected ? 'Assignee removed' : 'Assignee added');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex -space-x-2 hover:opacity-80 transition-opacity"
      >
        {selectedMembers.length === 1 ? (
          <>
            {selectedMembers[0].avatar_url ? (
              <img
                src={selectedMembers[0].avatar_url}
                alt={selectedMembers[0].full_name || selectedMembers[0].email}
                className="w-8 h-8 rounded-full object-cover border-2 border-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600">
                {(selectedMembers[0].full_name?.[1] || selectedMembers[0].email[1] || '?').toUpperCase()}
              </div>
            )}
          </>
        ) : selectedMembers.length > 1 ? (
          <>
            {selectedMembers.slice(0, 3).map((assignee, i) => (
              <div
                key={assignee.id}
                className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600"
                style={{ zIndex: 3 - i }}
              >
                {assignee.avatar_url ? (
                  <img
                    src={assignee.avatar_url}
                    alt={assignee.full_name || assignee.email}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (assignee.full_name?.[1] || assignee.email[1] || '?').toUpperCase()
                )}
              </div>
            ))}
            {selectedMembers.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-500">
                +{selectedMembers.length - 3}
              </div>
            )}
          </>
        ) : (
          <span className="text-slate-400 text-sm">-</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[180px] p-2">
          {members.map((member) => {
            const isSelected = assigneeIds.includes(member.id);
            return (
              <button
                key={member.id}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAssignee(member.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.full_name || member.email}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-3 h-3 text-slate-500" />
                  </div>
                )}
                <span className={isSelected ? 'text-blue-900' : 'text-slate-700'}>
                  {member.full_name || member.email}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface InlineDueDateEditProps {
  dueDate: string | null;
  contentItemId: string;
  onUpdate: () => void;
}

export function InlineDueDateEdit({ dueDate, contentItemId, onUpdate }: InlineDueDateEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(dueDate || '');
  const containerRef = useRef<HTMLDivElement>(null);

  const formatted = formatDueDate(dueDate);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isEditing) {
          handleSave();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, tempDate]);

  async function handleSave() {
    setIsEditing(false);
    if (tempDate === (dueDate || '')) return;

    const { error } = await supabase
      .from('content_items')
      .update({ due_date: tempDate || null })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update due date: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed due date to ${tempDate || 'none'}`,
      metadata: { oldDueDate: dueDate, newDueDate: tempDate },
    });

    toast.success('Due date updated');
    onUpdate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempDate(dueDate || '');
    }
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className="inline-block">
        <input
          type="date"
          value={tempDate}
          onChange={(e) => setTempDate(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`text-sm hover:opacity-70 transition-opacity ${
        formatted.isOverdue
          ? 'text-red-600 font-medium'
          : formatted.isSoon
            ? 'text-amber-600'
            : 'text-slate-600'
      }`}
    >
      {formatted.text}
    </button>
  );
}