import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useApp } from '../../contexts/AppContext';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { CustomFieldsSection } from './CustomFieldsSection';
import DatePicker from '../ui/DatePicker';
import type { ContentType, Profile, BoardColumn, Json } from '../../lib/database.types';
import {
  X,
  ChevronDown,
  Calendar,
  Check,
  User,
  Loader2,
} from 'lucide-react';

export interface MeetingPrefill {
  title: string;
  description: string;
  dueDate?: string;
  granolaNoteId?: string;
}

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string | null;
  initialProjectId?: string | null;
  initialTags?: string[];
  meetingPrefill?: MeetingPrefill | null;
}

// Priority options
const priorityOptions = [
  { value: 'low', label: 'Low', color: '#9ca3af' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
] as const;

// Default field visibility - all fields visible by default
interface DefaultWorkflow {
  fields?: Record<string, boolean>;
  columns?: string[];
}

function getFieldVisibility(contentType: ContentType | null): Record<string, boolean> {
  const defaultVisibility = {
    channel: true,
    priority: true,
    publishDate: true,
    dueDate: true,
    tags: true,
    description: true,
  };

  if (!contentType?.default_workflow) return defaultVisibility;

  const workflow = contentType.default_workflow as DefaultWorkflow;
  return { ...defaultVisibility, ...workflow.fields };
}

function getAllowedStatuses(contentType: ContentType | null, allColumns: BoardColumn[]): BoardColumn[] {
  if (!contentType?.default_workflow) return allColumns;

  const workflow = contentType.default_workflow as DefaultWorkflow;
  if (!workflow.columns || workflow.columns.length === 0) return allColumns;

  return allColumns.filter(col => workflow.columns?.includes(col.id));
}

// Simple custom select component
interface SelectOption {
  value: string;
  label: string;
  color?: string | undefined;
}

function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-surface-card border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 flex items-center justify-between min-h-[42px]"
      >
        <div className="flex items-center gap-2">
          {selectedOption?.color && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className={selectedOption ? '' : 'text-slate-400'}>
            {selectedOption?.label || placeholder || 'Select...'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-card rounded-xl shadow-lg max-h-60 overflow-auto" style={{ border: '1px solid #00233930', background: '#ffffff' }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-2 ${
                option.value === value ? 'bg-brand-50 text-brand-900' : 'text-slate-700'
              }`}
            >
              {option.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label}
              {option.value === value && <Check className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Multi-select for assignees
function AssigneeMultiSelect({
  members,
  value,
  onChange,
}: {
  members: Profile[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMembers = members.filter((m) => value.includes(m.id));

  const toggleMember = (memberId: string) => {
    if (value.includes(memberId)) {
      onChange(value.filter((id) => id !== memberId));
    } else {
      onChange([...value, memberId]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-surface-card border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 flex items-center justify-between min-h-[42px]"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {selectedMembers.length === 0 ? (
            <span className="text-slate-400">Select assignees...</span>
          ) : selectedMembers.length === 1 ? (
            <>
              {selectedMembers[0].avatar_url ? (
                <img
                  src={selectedMembers[0].avatar_url}
                  alt={selectedMembers[0].full_name ?? selectedMembers[0].email ?? undefined}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-3 h-3 text-slate-500" />
                </div>
              )}
              <span className="text-slate-700">
                {selectedMembers[0].full_name || selectedMembers[0].email}
              </span>
            </>
          ) : (
            <span className="text-slate-700">{selectedMembers.length} members</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface-card rounded-xl shadow-lg max-h-60 overflow-auto" style={{ border: '1px solid #00233930', background: '#ffffff' }}>
          {members.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No members found</div>
          ) : (
            members.map((member) => {
              const isSelected = value.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-3 ${
                    isSelected ? 'bg-brand-50' : ''
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.full_name ?? member.email ?? undefined}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-3 h-3 text-slate-500" />
                    </div>
                  )}
                  <span className={isSelected ? 'text-brand-900' : 'text-slate-700'}>
                    {member.full_name || member.email}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Main modal component
export function CreateItemModal({ isOpen, onClose, initialDate, initialProjectId, initialTags, meetingPrefill }: CreateItemModalProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { contentTypes, boardColumns, members } = useWorkspaceData(
    currentWorkspace?.id || null
  );
  const { customFieldDefs, projects } = useApp();

  const [title, setTitle] = useState('');
  const [contentTypeId, setContentTypeId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(initialDate || '');
  const [priority, setPriority] = useState('medium');
  const [channel, setChannel] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom fields for the selected content type
  const activeCustomFields = useMemo(
    () => customFieldDefs
      .filter(f => f.content_type_id === contentTypeId || (!f.content_type_id && !contentTypeId))
      .sort((a, b) => a.position - b.position),
    [customFieldDefs, contentTypeId]
  );

  const memberProfiles = useMemo(
    () => members.map(m => ({ id: m.id, email: m.email || '', full_name: m.full_name || m.email || '', avatar_url: m.avatar_url ?? null })),
    [members]
  );

  // Pre-fill due date when opened from calendar date click
  useEffect(() => {
    if (isOpen && initialDate) {
      setDueDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // Pre-fill project when opened from project page
  useEffect(() => {
    if (isOpen && initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [isOpen, initialProjectId]);

  // Pre-fill from meeting note
  useEffect(() => {
    if (isOpen && meetingPrefill) {
      setTitle(meetingPrefill.title);
      setDescription(meetingPrefill.description);
      if (meetingPrefill.dueDate) setDueDate(meetingPrefill.dueDate);
    }
  }, [isOpen, meetingPrefill]);

  // Set default status to first board column (Backlog)
  useEffect(() => {
    if (boardColumns.length > 0 && !statusId) {
      const firstColumn = [...boardColumns].sort((a, b) => a.position - b.position)[0];
      setStatusId(firstColumn.id);
    }
  }, [boardColumns, statusId]);

  // Get selected content type
  const selectedContentType = contentTypes.find(ct => ct.id === contentTypeId);

  // Get field visibility based on selected content type
  const fieldVisibility = getFieldVisibility(selectedContentType ?? null);

  // Prepare select options
  const contentTypeOptions = contentTypes.map((ct) => ({
    value: ct.id,
    label: ct.name,
    color: ct.color ?? undefined,
  }));

  // Filter status options based on content type workflow
  const allowedStatuses = getAllowedStatuses(selectedContentType ?? null, boardColumns);
  const statusOptions = [...allowedStatuses]
    .sort((a, b) => a.position - b.position)
    .map((bc) => ({
      value: bc.id,
      label: bc.name,
      color: bc.color ?? undefined,
    }));

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!currentWorkspace) {
      toast.error('No workspace selected');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    // Validate required custom fields
    const missingRequired = activeCustomFields.filter(f =>
      f.required && (customFieldValues[f.id] === undefined || customFieldValues[f.id] === null || customFieldValues[f.id] === '')
    );
    if (missingRequired.length > 0) {
      toast.error(`Required field: ${missingRequired[0].name}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: newItem, error } = await supabase.from('content_items').insert({
        workspace_id: currentWorkspace.id,
        title: title.trim(),
        content_type_id: contentTypeId || null,
        status: statusId || null,
        assignee_ids: assigneeIds,
        due_date: dueDate || null,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        channel: channel.trim(),
        description: description.trim(),
        created_by: user.id,
        tags: initialTags ?? [],
        project_id: projectId || null,
        custom_fields: customFieldValues as Json,
      }).select('id').single();

      if (error) {
        throw error;
      }

      // If created from a meeting note, link it automatically
      if (meetingPrefill?.granolaNoteId && newItem) {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-granola-notes`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.data.session.access_token}`,
                Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                action: 'link',
                workspace_id: currentWorkspace.id,
                granola_note_id: meetingPrefill.granolaNoteId,
                content_item_id: newItem.id,
              }),
            }
          ).catch(() => {}); // Fire-and-forget — note link is best-effort
        }
      }

      toast.success('Content item created!');
      onClose();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create content item');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setTitle('');
    setContentTypeId('');
    setAssigneeIds([]);
    setDueDate('');
    setPriority('medium');
    setChannel('');
    setDescription('');
    setProjectId('');
    setCustomFieldValues({});
    // Keep status as default
  }

  function handleClose() {
    onClose();
    resetForm();
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00233960]">
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" style={{ border: '1px solid #00233930' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {initialTags?.includes('design-request') && (
              <span className="w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">D</span>
              </span>
            )}
            <h2 className="font-semibold text-slate-900">
              {initialTags?.includes('design-request') ? 'Create Design Request' : 'Create Content Item'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter content title..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              autoFocus
              required
            />
          </div>

          {/* Content Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Content Type</label>
              <CustomSelect
                options={contentTypeOptions}
                value={contentTypeId}
                onChange={(value) => {
                  setContentTypeId(value);
                  setCustomFieldValues({}); // Reset custom fields when type changes
                  // Reset status to first allowed when type changes
                  const newType = contentTypes.find(ct => ct.id === value);
                  const newAllowedStatuses = getAllowedStatuses(newType || null, boardColumns);
                  if (newAllowedStatuses.length > 0) {
                    setStatusId([...newAllowedStatuses].sort((a, b) => a.position - b.position)[1]?.id || newAllowedStatuses[0]?.id);
                  }
                }}
                placeholder="Select type..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
              <CustomSelect
                options={statusOptions}
                value={statusId}
                onChange={setStatusId}
                placeholder="Select status..."
              />
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Assignees</label>
            <AssigneeMultiSelect members={members} value={assigneeIds} onChange={setAssigneeIds} />
          </div>

          {/* Project */}
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

          {/* Due Date & Priority */}
          <div className="grid grid-cols-2 gap-4">
            {fieldVisibility.dueDate && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Due Date</label>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </div>
            )}

            {fieldVisibility.priority && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Priority</label>
                <CustomSelect
                  options={priorityOptions.map((p) => ({ value: p.value, label: p.label, color: p.color }))}
                  value={priority}
                  onChange={setPriority}
                />
              </div>
            )}
          </div>

          {/* Channel */}
          {fieldVisibility.channel && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-surface-card"
              >
                <option value="">Select a channel...</option>
                {['Blog', 'Social', 'Newsletter/Email', 'Sales Enablement', 'Promo', 'Website', 'Media/External', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          {fieldVisibility.description && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any additional details..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
              />
            </div>
          )}

          {/* Custom fields */}
          {activeCustomFields.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Custom fields</p>
              <CustomFieldsSection
                fields={activeCustomFields}
                values={customFieldValues}
                onChange={(id, value) => setCustomFieldValues(prev => ({ ...prev, [id]: value }))}
                members={memberProfiles}
              />
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-surface-nested">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-[#005D9715] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
