import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Calendar, MessageSquare,
  Activity, Loader2, Edit2, Check, Hash, Zap, ExternalLink, Link2, User, Trash2, Copy
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { ContentItem, Comment, ActivityLog, ContentType, BoardColumn, Json, Profile } from '../../lib/database.types';
import { formatDateFull } from '../../lib/utils';
import { CustomFieldsSection } from './CustomFieldsSection';
import { SubtasksSection } from './SubtasksSection';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR, DRAFT_COLOR, getOrdinalProfile, getLinearIssueInfo, PLATFORM_META } from '../../lib/ordinal';
import { useOrdinalPost } from '../../hooks/useOrdinalPost';
import { ExternalLinksSection } from './ExternalLinks';
import { GranolaNoteSection } from './GranolaNoteSection';
import { GranolaNotePickerModal } from './GranolaNotePickerModal';
import { AiAssistant } from './AiAssistant';

interface Props {
  item: ContentItem;
  onClose: () => void;
  onUpdated: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Comment enriched with author profile via FK join
interface CommentWithProfile extends Comment {
  profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
}

const CHANNELS = ['Blog', 'Social', 'Newsletter/Email', 'Sales Enablement', 'Promo', 'Website', 'Other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

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

function TitleInput({ title, onSave }: { title: string; onSave: (val: string) => void }) {
  const [draft, setDraft] = useState(title);
  const savedRef = useRef(title);

  // Sync draft when the parent refreshes with a new title (after save)
  useEffect(() => {
    if (title !== savedRef.current) {
      setDraft(title);
      savedRef.current = title;
    }
  }, [title]);

  const save = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== savedRef.current) {
      savedRef.current = trimmed;
      onSave(trimmed);
    }
  }, [draft, onSave]);

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(savedRef.current); e.currentTarget.blur(); }
      }}
      className="w-full text-xl font-bold text-slate-900 outline-none bg-transparent border-b-2 border-transparent focus:border-brand-400 transition-colors"
    />
  );
}

export function DetailSlideOver({ item, onClose, onUpdated, addToast }: Props) {
  const { contentTypes, boardColumns, user, customFieldDefs, projects, members } = useApp();
  const { userRole } = useWorkspace();
  const isOrdinalPost = isOrdinalItem(item);
  const isLinearIssue = isLinearItem(item);
  const isReadOnly = userRole === 'viewer' || isOrdinalPost;
  const isExternalSource = isOrdinalPost || isLinearIssue;
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ContentItem>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [granolaPickerOpen, setGranolaPickerOpen] = useState(false);
  const [granolaRefreshKey, setGranolaRefreshKey] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedCheck, setShowSavedCheck] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const contentType = contentTypes.find(ct => ct.id === item.content_type_id);

  const ordinalProfile = isOrdinalPost ? getOrdinalProfile(item) : null;
  const { ordinalLink } = useOrdinalPost(item.id);
  const linearInfo = isLinearIssue ? getLinearIssueInfo(item) : null;

  // Get field visibility based on content type
  const fieldVisibility = useMemo(() => getFieldVisibility(contentType || null), [contentType]);

  // Get allowed statuses based on content type workflow
  const allowedStatuses = useMemo(() => getAllowedStatuses(contentType || null, boardColumns), [contentType, boardColumns]);

  const activeCustomFields = useMemo(
    () => customFieldDefs.filter(f => f.content_type_id === item.content_type_id || (!f.content_type_id && !item.content_type_id)),
    [customFieldDefs, item.content_type_id]
  );

  const customFieldValues = useMemo(
    () => (item.custom_fields as Record<string, unknown>) ?? {},
    [item.custom_fields]
  );

  async function updateCustomField(fieldId: string, value: unknown) {
    const updated = { ...customFieldValues, [fieldId]: value };
    await updateField('custom_fields', updated);
  }

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:user_id(id, full_name, email, avatar_url)')
      .eq('content_item_id', item.id)
      .order('created_at');
    if (data) setComments(data as unknown as CommentWithProfile[]);
  }, [item.id]);

  const loadActivity = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('content_item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setActivity(data);
  }, [item.id]);

  useEffect(() => {
    loadComments();
    loadActivity();
  }, [loadComments, loadActivity]);

  async function updateField(field: string, value: unknown) {
    setSavingField(field);
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ [field]: value } as Record<string, unknown>)
        .eq('id', item.id);
      if (error) throw error;

      await supabase.from('activity_log').insert({
        content_item_id: item.id,
        user_id: user?.id,
        action: `Updated ${field}`,
        metadata: { field, value } as Json,
      });

      onUpdated();
      setHasChanges(true);
      addToast('Updated');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSavingField(null);
      setEditingField(null);
    }
  }

  async function saveDescription() {
    await updateField('description', description);
    setEditingDescription(false);
  }

  async function addComment() {
    if (!commentText.trim() || !user) return;
    const { error } = await supabase.from('comments').insert({
      content_item_id: item.id,
      user_id: user.id,
      body: commentText.trim(),
    });
    if (error) { addToast(error.message, 'error'); return; }
    setCommentText('');
    loadComments();
    addToast('Comment added');
  }

  async function deleteItem() {
    setDeleting(true);
    try {
      // Delete subtasks first
      await supabase.from('subtasks').delete().eq('content_item_id', item.id);
      // Delete comments
      await supabase.from('comments').delete().eq('content_item_id', item.id);
      // Delete activity log
      await supabase.from('activity_log').delete().eq('content_item_id', item.id);
      // Delete linear issue links if any
      await supabase.from('linear_issue_links').delete().eq('content_item_id', item.id);
      // Delete the content item
      const { error } = await supabase.from('content_items').delete().eq('id', item.id);
      if (error) throw error;
      addToast('Item deleted');
      onClose();
      onUpdated();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const [duplicating, setDuplicating] = useState(false);
  async function duplicateItem() {
    setDuplicating(true);
    try {
      const { data, error } = await supabase.from('content_items').insert({
        workspace_id: item.workspace_id,
        title: `${item.title} (copy)`,
        description: item.description,
        content_type_id: item.content_type_id,
        status: item.status,
        priority: item.priority,
        channel: item.channel,
        project_id: item.project_id,
        assignee_ids: item.assignee_ids,
        tags: item.tags,
        custom_fields: item.custom_fields,
        due_date: item.due_date,
        publish_date: item.publish_date,
        created_by: user?.id ?? null,
      }).select().single();

      if (error) throw error;

      addToast('Item duplicated');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setDuplicating(false);
    }
  }

  // Close with green check animation if changes were made
  const [closing, setClosing] = useState(false);
  function handleClose() {
    if (closing) return; // prevent double-close
    if (hasChanges) {
      setClosing(true);
      setShowSavedCheck(true);
      setTimeout(() => {
        setShowSavedCheck(false);
        onClose();
      }, 800);
    } else {
      onClose();
    }
  }

  // Member profiles for subtasks section
  const memberProfiles = useMemo(
    () => members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null })),
    [members]
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={handleClose}>
      <div
        className="w-full max-w-2xl bg-white h-full flex flex-col border-l-2"
        style={{
          borderColor: isLinearIssue ? '#FFE4D6' : isOrdinalPost ? '#C4B5FD' : '#bfdbfe',
          boxShadow: isLinearIssue
            ? '-8px 0 30px -5px rgba(255, 228, 214, 0.4), -2px 0 10px -2px rgba(255, 228, 214, 0.25)'
            : isOrdinalPost
            ? '-8px 0 30px -5px rgba(126, 97, 255, 0.2), -2px 0 10px -2px rgba(126, 97, 255, 0.12)'
            : '-8px 0 30px -5px rgba(59, 130, 246, 0.15), -2px 0 10px -2px rgba(59, 130, 246, 0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* External source banner — Ordinal or Linear */}
        {isExternalSource && (
          <div className="px-6 py-3 border-b" style={{ backgroundColor: isOrdinalPost ? '#F3F0FF' : '#FFF3E0', borderColor: isOrdinalPost ? '#7E61FF' : '#E65100' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isOrdinalPost ? '#7E61FF' : '#E65100', color: 'white' }}
                >
                  {isOrdinalPost ? (
                    <Zap className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs font-bold">L</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: isOrdinalPost ? '#5B45B0' : '#BF360C' }}>
                    Sourced from {isOrdinalPost ? 'Ordinal' : 'Linear'} — {isOrdinalPost ? 'read-only' : 'edits here are local only'}
                  </p>
                  <p className="text-xs" style={{ color: isOrdinalPost ? '#7E61FF' : '#E65100' }}>
                    {isOrdinalPost ? 'This item is managed in Ordinal and cannot be edited here' : `Changes made in ContentedCal will not sync back to Linear`}
                    {isLinearIssue && linearInfo ? ` · ${linearInfo.identifier} · ${linearInfo.team}${linearInfo.project ? ` · ${linearInfo.project}` : ''}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isOrdinalPost && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                    style={{ backgroundColor: `${DRAFT_COLOR}15`, color: DRAFT_COLOR }}
                  >
                    Draft
                  </span>
                )}
                {isLinearIssue && linearInfo?.status && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${LINEAR_COLOR}15`, color: LINEAR_COLOR }}
                  >
                    {linearInfo.status}
                  </span>
                )}
                {isOrdinalPost && ordinalLink?.post_url && (
                  <a
                    href={ordinalLink.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
                    style={{ color: '#BF360C', borderColor: '#E6510040', backgroundColor: 'white' }}
                  >
                    <span>Open in Ordinal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {isLinearIssue && linearInfo?.url && (
                  <a
                    href={linearInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
                    style={{ color: '#BF360C', borderColor: '#E6510040', backgroundColor: 'white' }}
                  >
                    <span>Open in Linear</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        {(() => {
          const titleColor = contentType?.color ?? '#64748b';
          return (
            <div className="border-b border-slate-200">
              {/* Action buttons row */}
              <div className="flex items-center justify-between px-6 pt-3 pb-0">
                <div className="flex items-center gap-2">
                  {contentType && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: titleColor }} />
                      {contentType.name}
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400">Created {formatDateFull(item.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?item=${item.id}`;
                      navigator.clipboard.writeText(url).then(() => addToast('Link copied to clipboard'));
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Copy link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className={`p-1.5 rounded-full transition-all ${
                      showSavedCheck
                        ? 'bg-green-100 text-green-600'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {showSavedCheck ? (
                      <Check className="w-5 h-5 animate-[scaleIn_0.3s_ease-out]" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Title wrapper with content type color */}
              <div
                className="mx-5 my-3 px-4 py-3 rounded-lg border-l-[3px]"
                style={{
                  backgroundColor: `${titleColor}0A`,
                  borderLeftColor: titleColor,
                }}
              >
                {isReadOnly ? (
                  <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
                ) : (
                  <>
                    <TitleInput title={item.title} onSave={(val) => updateField('title', val)} />
                    {isOrdinalPost && ordinalProfile && (
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold"
                          style={{
                            backgroundColor: PLATFORM_META[ordinalProfile.platform]?.bgColor ?? '#F5F5F5',
                            color: PLATFORM_META[ordinalProfile.platform]?.color ?? '#666',
                          }}
                        >
                          {PLATFORM_META[ordinalProfile.platform]?.icon?.charAt(0) ?? '●'}
                        </span>
                        <span className="text-xs text-slate-500">{ordinalProfile.handle}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-400">{ordinalProfile.name}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {(['details', 'comments', 'activity'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors capitalize
                ${activeTab === tab ? 'border-brand-400 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
              {tab === 'comments' && comments.length > 0 && (
                <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{comments.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50">
          {activeTab === 'details' && (
            <div className="p-5 space-y-4">
              {/* Key fields card */}
              <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
                  <select
                    value={item.status ?? ''}
                    onChange={e => updateField('status', e.target.value || null)}
                    disabled={isReadOnly}
                    className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">None</option>
                    {allowedStatuses.map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                {fieldVisibility.priority && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</label>
                    <select
                      value={item.priority ?? undefined}
                      onChange={e => updateField('priority', e.target.value)}
                      disabled={isReadOnly}
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {PRIORITIES.map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Due date */}
                {fieldVisibility.dueDate && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due date
                    </label>
                    <input
                      type="date"
                      value={item.due_date ?? ''}
                      onChange={e => updateField('due_date', e.target.value || null)}
                      disabled={isReadOnly}
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                )}

                {/* Publish date */}
                {fieldVisibility.publishDate && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Publish date
                    </label>
                    <input
                      type="date"
                      value={item.publish_date ?? ''}
                      onChange={e => updateField('publish_date', e.target.value || null)}
                      disabled={isReadOnly}
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                )}

                {/* Channel */}
                {fieldVisibility.channel && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Channel</label>
                    <select
                      value={item.channel ?? ''}
                      onChange={e => updateField('channel', e.target.value)}
                      disabled={isReadOnly}
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">None</option>
                      {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Content type */}
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Content type</label>
                  <select
                    value={item.content_type_id ?? ''}
                    onChange={e => updateField('content_type_id', e.target.value || null)}
                    disabled={isReadOnly}
                    className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">None</option>
                    {contentTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                  </select>
                </div>

                {/* Project */}
                {projects.length > 0 && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project</label>
                    <select
                      value={item.project_id ?? ''}
                      onChange={e => updateField('project_id', e.target.value || null)}
                      disabled={isReadOnly}
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">No project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}

                {/* Assignee */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <User className="w-3 h-3" /> Assignee
                  </label>
                  <select
                    value={item.assignee_ids?.[0] ?? ''}
                    onChange={e => updateField('assignee_ids', e.target.value ? [e.target.value] : [])}
                    disabled={isReadOnly}
                    className={`mt-1.5 w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email || 'Unknown member'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              {fieldVisibility.tags && item.tags && item.tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                    <Hash className="w-3 h-3" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              </div>

              {/* Linked Assets */}
              <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden p-4">
                <ExternalLinksSection contentItemId={item.id} addToast={addToast} readOnly={isReadOnly} />
              </div>

              {/* Granola Meeting Notes */}
              <GranolaNoteSection
                key={granolaRefreshKey}
                contentItemId={item.id}
                onLinkNote={() => setGranolaPickerOpen(true)}
              />
              <GranolaNotePickerModal
                isOpen={granolaPickerOpen}
                onClose={() => setGranolaPickerOpen(false)}
                contentItemId={item.id}
                onLinked={() => setGranolaRefreshKey((k) => k + 1)}
              />

              {/* Description */}
              {fieldVisibility.description && (
                <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</label>
                    {!editingDescription && !isReadOnly && (
                      <button
                        onClick={() => setEditingDescription(true)}
                        className="text-xs text-brand-500 hover:text-brand-500 flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                  {editingDescription ? (
                    <div>
                      <textarea
                        autoFocus
                        value={description ?? ''}
                        onChange={e => setDescription(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none font-mono"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={saveDescription}
                          className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 flex items-center gap-1"
                        >
                          {savingField === 'description' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingDescription(false); setDescription(item.description); }}
                          className="px-3 py-1.5 text-slate-600 text-xs border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`text-sm text-slate-700 whitespace-pre-wrap min-h-[60px] p-3 bg-slate-50 rounded-lg transition-colors ${isReadOnly ? '' : 'cursor-pointer hover:bg-slate-100'}`}
                      onClick={() => !isReadOnly && setEditingDescription(true)}
                    >
                      {item.description || <span className="text-slate-400 italic">{isReadOnly ? 'No description' : 'Click to add description...'}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Custom fields */}
              {activeCustomFields.length > 0 && (
                <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden p-4">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 block">Custom fields</label>
                  <CustomFieldsSection
                    fields={activeCustomFields}
                    values={customFieldValues}
                    onChange={updateCustomField}
                    compact
                    members={members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null }))}
                  />
                </div>
              )}

              {/* Subtasks */}
              <SubtasksSection
                contentItemId={item.id}
                userId={user?.id ?? null}
                members={memberProfiles}
                addToast={addToast}
              />

              {/* AI Assistant */}
              <AiAssistant
                item={item}
                addToast={addToast}
                onInsertToDescription={(text, mode) => {
                  if (mode === 'replace') {
                    setDescription(text);
                  } else {
                    setDescription(prev => prev ? `${prev}\n\n---\n\n${text}` : text);
                  }
                  setEditingDescription(true);
                }}
              />
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="p-6 space-y-4">
              {comments.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No comments yet</p>
                </div>
              )}
              {comments.map(comment => {
                const authorName = comment.profiles?.full_name || comment.profiles?.email || 'Unknown';
                const authorInitial = (authorName[0] || '?').toUpperCase();
                return (
                  <div key={comment.id} className="flex gap-3">
                    {comment.profiles?.avatar_url ? (
                      <img
                        src={comment.profiles.avatar_url}
                        alt={authorName}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium shrink-0">
                        {authorInitial}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-slate-700">{authorName}</span>
                        <span className="text-xs text-slate-400">{formatDateFull(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-100">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
                <button
                  onClick={addComment}
                  disabled={!commentText.trim()}
                  className="mt-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  Post comment
                </button>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="p-6 space-y-3">
              {activity.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No activity yet</p>
                </div>
              )}
              {activity.map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{log.action}</p>
                    <p className="text-xs text-slate-400">{formatDateFull(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t-2 bg-white" style={{ borderColor: isLinearIssue ? '#FFE4D6' : isOrdinalPost ? '#C4B5FD' : '#dbeafe' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: '#25476C' }}>
                {hasChanges ? 'All changes saved' : 'No unsaved changes'}
              </span>
              {!isReadOnly && (
                <>
                  <button
                    onClick={duplicateItem}
                    disabled={duplicating}
                    className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{ color: '#25476C' }}
                    title="Duplicate item"
                  >
                    {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{ color: '#8B2500' }}
                    title="Delete item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <button
              onClick={handleClose}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              {showSavedCheck ? (
                <>
                  <Check className="w-4 h-4 animate-[scaleIn_0.3s_ease-out]" />
                  Saved
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Done
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 text-center">Are you sure?</h3>
              <p className="mt-2 text-sm text-slate-500 text-center">
                Once it's gone, it's gone for good.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteItem}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
