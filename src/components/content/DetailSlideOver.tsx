import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Calendar, MessageSquare,
  Activity, Loader2, Edit2, Check, Hash, Zap, ExternalLink, Link2, Trash2, Copy, ChevronDown, FolderOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { ContentItem, ActivityLog, ContentType, BoardColumn, Json } from '../../lib/database.types';
import { formatDateFull, PRIORITY_STYLES, getWorkspaceChannels, getWorkspaceSubtaskTemplates } from '../../lib/utils';
import { CustomFieldsSection } from './CustomFieldsSection';
import { SubtasksSection } from './SubtasksSection';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, ORDINAL_TEXT, LINEAR_COLOR, LINEAR_TEXT, DRAFT_COLOR, getOrdinalProfile, getLinearIssueInfo, PLATFORM_META } from '../../lib/ordinal';
import { useOrdinalPost } from '../../hooks/useOrdinalPost';
import { ExternalLinksSection } from './ExternalLinks';
import { GranolaNoteSection } from './GranolaNoteSection';
import { SlackSourceBanner } from './SlackSourceBanner';
import { SlackThreadsSection } from './SlackThreadsSection';
import { CommentRow, type CommentWithProfile } from './CommentRow';
import { MentionAutocomplete } from './MentionAutocomplete';
import { extractMentionIds, renderBodyWithMentions } from '../../lib/mentionFormat';
import { TaskPresenceChip } from './TaskPresenceChip';
import { usePresence } from '../../contexts/PresenceContext';
import { GranolaNotePickerModal } from './GranolaNotePickerModal';
import { AiAssistant } from './AiAssistant';
import { StyledSelect } from '../ui/StyledSelect';
import { ConfirmModal } from '../ui/ConfirmModal';
import DatePicker from '../ui/DatePicker';
import { ActivityLog as ActivityLogList, ActivityLogRow, mapActionToType } from '../activity/ActivityLogRow';

interface Props {
  item: ContentItem;
  onClose: () => void;
  onUpdated: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Comment enriched with author profile via FK join
// CommentWithProfile imported from ./CommentRow

// Channels are now loaded from workspace settings via getWorkspaceChannels()
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
      className="w-full text-xl font-display text-slate-900 outline-none bg-transparent border-b-2 border-transparent focus:border-brand-400 transition-colors"
    />
  );
}

export function DetailSlideOver({ item, onClose, onUpdated, addToast }: Props) {
  const { contentTypes, boardColumns, user, customFieldDefs, projects, members } = useApp();
  const { userRole, currentWorkspace } = useWorkspace();
  const channels = useMemo(() => getWorkspaceChannels(currentWorkspace?.settings), [currentWorkspace?.settings]);
  const subtaskTemplates = useMemo(() => getWorkspaceSubtaskTemplates(currentWorkspace?.settings), [currentWorkspace?.settings]);
  const isOrdinalPost = isOrdinalItem(item);
  const isLinearIssue = isLinearItem(item);
  const cf = (item.custom_fields as Record<string, string>) ?? {};
  const isSlackItem = cf._source === 'slack';
  const isReadOnly = userRole === 'viewer' || isOrdinalPost;
  const isExternalSource = isOrdinalPost || isLinearIssue;
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [granolaPickerOpen, setGranolaPickerOpen] = useState(false);
  const [granolaRefreshKey, setGranolaRefreshKey] = useState(0);
  // Slack threads share a refresh key — when SlackThreadsSection unlinks the
  // origin thread, the source banner needs to disappear too.
  const [slackRefreshKey, setSlackRefreshKey] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedCheck, setShowSavedCheck] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status section collapse — per-user persistence via localStorage.
  // Default: collapsed (per design decision 2026-06-05). Status fields are
  // operational state (dates, channel, type) — most users want them out
  // of the way until they need to change something.
  const [statusCollapsed, setStatusCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('cc-status-collapsed');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const toggleStatusCollapsed = useCallback(() => {
    setStatusCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cc-status-collapsed', String(next));
      } catch {
        // localStorage unavailable — toggle still works in-session
      }
      return next;
    });
  }, []);
  const [deleting, setDeleting] = useState(false);

  const contentType = contentTypes.find(ct => ct.id === item.content_type_id);

  const ordinalProfile = isOrdinalPost ? getOrdinalProfile(item) : null;
  const { ordinalLink } = useOrdinalPost(item.id);
  const linearInfo = isLinearIssue ? getLinearIssueInfo(item) : null;

  // Get field visibility based on content type
  const fieldVisibility = useMemo(() => getFieldVisibility(contentType || null), [contentType]);

  // Get allowed statuses based on content type workflow
  const allowedStatuses = useMemo(() => getAllowedStatuses(contentType || null, boardColumns), [contentType, boardColumns]);

  // Two-layer filter on custom fields:
  //   1. Content-type scope: workspace-wide fields (content_type_id = null)
  //      show on every item; type-specific fields only on matching content_type.
  //   2. Task-category scope: applies_to='both' shows on every task;
  //      'content' only on content tasks; 'design' only on design tasks.
  const activeCustomFields = useMemo(
    () =>
      customFieldDefs.filter(f => {
        const contentTypeMatch = !f.content_type_id || f.content_type_id === item.content_type_id;
        if (!contentTypeMatch) return false;
        return f.applies_to === 'both' || f.applies_to === item.category;
      }),
    [customFieldDefs, item.content_type_id, item.category]
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
      .select('*, profiles:user_id(id, full_name, email, avatar_url), deletedByProfile:deleted_by(id, full_name, email)')
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

  // Phase 6.6 — broadcast presence for this task while the slide-over is open
  const { setViewing } = usePresence();
  useEffect(() => {
    setViewing(item.id);
    return () => setViewing(null);
  }, [item.id, setViewing]);

  async function updateField(field: string, value: unknown) {
    setSavingField(field);
    try {
      const payload: Record<string, unknown> = { [field]: value };

      // Sync completed boolean when status changes to/from done columns
      if (field === 'status' && value) {
        const targetCol = boardColumns.find(c => c.id === value);
        const targetName = targetCol?.name?.toLowerCase();
        const isDone = targetName === 'published' || targetName === 'completed';
        if (isDone) {
          payload.completed = true;
          payload.completed_at = new Date().toISOString();
        } else {
          const prevCol = boardColumns.find(c => c.id === item.status);
          const prevName = prevCol?.name?.toLowerCase();
          if (prevName === 'published' || prevName === 'completed') {
            payload.completed = false;
            payload.completed_at = null;
          }
        }
      }

      const { error } = await supabase
        .from('content_items')
        .update(payload)
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
    const trimmed = commentText.trim();
    const mentions = extractMentionIds(trimmed);
    const { error } = await supabase.from('comments').insert({
      content_item_id: item.id,
      user_id: user.id,
      body: trimmed,
      mentions,
    });
    if (error) { addToast(error.message, 'error'); return; }
    setCommentText('');
    loadComments();
    addToast('Comment added');
  }

  // Phase 6.2: edit comment body. Author only (RLS-enforced).
  // Phase 6.3: also accepts mentions[] derived from the new body.
  async function editComment(commentId: string, newBody: string, mentions: string[]): Promise<boolean> {
    const { error } = await supabase
      .from('comments')
      .update({ body: newBody, mentions })
      .eq('id', commentId);
    if (error) {
      addToast(error.message, 'error');
      return false;
    }
    // updated_at is bumped by trigger; trigger also fires for newly-added mentions.
    await loadComments();
    addToast('Comment updated');
    return true;
  }

  // Phase 6.2: soft-delete via SECURITY DEFINER RPC. Author OR workspace admin.
  async function softDeleteComment(commentId: string): Promise<boolean> {
    const { error } = await supabase.rpc('soft_delete_comment', { comment_id: commentId });
    if (error) {
      addToast(error.message, 'error');
      return false;
    }
    await loadComments();
    addToast('Comment deleted');
    return true;
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
      const { error } = await supabase.from('content_items').insert({
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

  // Member profiles for general use
  const memberProfiles = useMemo(
    () => members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null })),
    [members]
  );

  // Subtask-eligible members: only people assigned to content items or on the project
  const [subtaskEligibleIds, setSubtaskEligibleIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    async function fetchEligible() {
      const eligibleIds = new Set<string>();

      // 1. All users who are assignees on any content item in this workspace
      const { data: items } = await supabase
        .from('content_items')
        .select('assignee_ids')
        .eq('workspace_id', item.workspace_id);

      if (items) {
        for (const ci of items) {
          if (ci.assignee_ids && Array.isArray(ci.assignee_ids)) {
            for (const id of ci.assignee_ids) eligibleIds.add(id);
          }
        }
      }

      // 2. All members of the item's project (if it belongs to one)
      if (item.project_id) {
        const { data: projMembers } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', item.project_id);

        if (projMembers) {
          for (const pm of projMembers) eligibleIds.add(pm.user_id);
        }
      }

      // 3. Always include the current user
      if (user?.id) eligibleIds.add(user.id);

      setSubtaskEligibleIds(eligibleIds);
    }

    fetchEligible();
  }, [item.workspace_id, item.project_id, user?.id]);

  const subtaskMembers = useMemo(() => {
    if (!subtaskEligibleIds) return memberProfiles; // show all while loading
    return memberProfiles.filter(m => subtaskEligibleIds.has(m.id));
  }, [memberProfiles, subtaskEligibleIds]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={handleClose}>
      <div
        className="w-full max-w-2xl bg-surface-card h-full flex flex-col"
        style={{
          borderLeft: '1.5px solid #002339',
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
          <div
            className="px-6 py-3 border-b"
            style={{
              backgroundColor: isOrdinalPost ? `${ORDINAL_COLOR}30` : `${LINEAR_COLOR}30`,
              borderColor: isOrdinalPost ? ORDINAL_TEXT : LINEAR_TEXT,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isOrdinalPost ? ORDINAL_TEXT : LINEAR_TEXT, color: 'white' }}
                >
                  {isOrdinalPost ? (
                    <Zap className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs font-bold">L</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: isOrdinalPost ? ORDINAL_TEXT : LINEAR_TEXT }}>
                    Sourced from {isOrdinalPost ? 'Ordinal' : 'Linear'} — {isOrdinalPost ? 'read-only' : 'edits here are local only'}
                  </p>
                  <p className="text-xs" style={{ color: isOrdinalPost ? ORDINAL_TEXT : LINEAR_TEXT }}>
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
                    style={{ color: ORDINAL_TEXT, borderColor: `${ORDINAL_COLOR}60`, backgroundColor: '#F7F9FC' }}
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
                    style={{ color: LINEAR_TEXT, borderColor: `${LINEAR_COLOR}60`, backgroundColor: '#F7F9FC' }}
                  >
                    <span>Open in Linear</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Slack source banner — canonical Draft 4.6 (reads slack_thread_links) */}
        {isSlackItem && !isExternalSource && (
          <SlackSourceBanner contentItemId={item.id} refreshKey={slackRefreshKey} />
        )}

        {/* Header */}
        {(() => {
          const titleColor = contentType?.color ?? '#64748b';
          return (
            <div style={{ borderBottom: '1px solid #00233930' }}>
              {/* Action buttons row */}
              <div className="flex items-center justify-between px-6 pt-3 pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {contentType && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: titleColor }} />
                      {contentType.name}
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400">Created {formatDateFull(item.created_at)}</span>
                  {/* Phase 6.6 — quiet presence chip when others are viewing */}
                  <TaskPresenceChip taskId={item.id} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?item=${item.id}`;
                      navigator.clipboard.writeText(url).then(() => addToast('Link copied to clipboard'));
                    }}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                    title="Copy link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className={`p-1.5 rounded-full transition-all ${
                      showSavedCheck
                        ? 'bg-green-100 text-green-600'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-[#005D9718]'
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
                <span className="ml-1.5 text-xs bg-[#005D9712] text-slate-600 px-1.5 py-0.5 rounded-full">{comments.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-nested">
          {activeTab === 'details' && (
            <div className="p-5 space-y-4">
              {/* ──────────────────────────────────────────────────────────────
                  Phase 7 — Detail Slide-Over Layout orchestration.
                  Section order matches the canonical Batch 4 spec (Details-
                  tab subset; Comments + Activity stay in their own tabs):
                    1. Assignee
                    2. Key fields (Status / Priority / Dates / Channel / Type
                       / Project / Tags)
                    3. Description
                    4. Optional Details (custom field zone, Batch 5 v2)
                    5. Subtasks
                    6. Linked Assets (External Links)
                    7. Granola Meeting Notes (conditional)
                    8. Slack Threads (conditional)
                    9. AI Assistant (collapsed by default)
                  Section headings use the unified canonical treatment:
                    text-[11px] font-semibold uppercase slate-500
                    tracking-[0.06em]
                  Lighter than the prior text-sm headings; matches the spec.
                  ────────────────────────────────────────────────────────── */}

              {/* 1. Context row — Owner + Project, two info tiles side-by-side.
                  Project gets ~40% more width since project names run longer
                  than personal names. Locked 2026-06-05. */}
              <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                {/* Owner tile */}
                <div className="bg-surface-card rounded-xl shadow-sm p-3" style={{ border: '1px solid #00233930' }}>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em] flex items-center gap-1.5 mb-1.5">
                    <span className="w-4 h-4 rounded-full inline-block" style={{ background: 'linear-gradient(135deg, #005D97, #D4729E)' }} aria-hidden />
                    Owner
                  </label>
                  <StyledSelect
                    value={item.assignee_ids?.[0] ?? ''}
                    onChange={val => updateField('assignee_ids', val ? [val] : [])}
                    disabled={isReadOnly}
                    options={[
                      { value: '', label: 'Unowned' },
                      ...members.map(m => ({ value: m.user_id, label: m.full_name || m.email || 'Unknown member' })),
                    ]}
                    placeholder="Unowned"
                  />
                </div>

                {/* Project tile (renders even when empty so the grid stays balanced) */}
                <div className="bg-surface-card rounded-xl shadow-sm p-3" style={{ border: '1px solid #00233930' }}>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.06em] flex items-center gap-1.5 mb-1.5">
                    <FolderOpen className="w-3.5 h-3.5" style={{ color: '#C4504A' }} />
                    Project
                  </label>
                  <StyledSelect
                    value={item.project_id ?? ''}
                    onChange={val => updateField('project_id', val || null)}
                    disabled={isReadOnly || projects.length === 0}
                    options={[
                      { value: '', label: 'No project' },
                      ...projects.map(p => ({ value: p.id, label: p.title })),
                    ]}
                    placeholder={projects.length === 0 ? 'No projects yet' : 'No project'}
                  />
                </div>
              </div>

              {/* 2. Status (collapsible). Default collapsed per-user via
                  localStorage. Collapsed shows a one-line summary; expanded
                  shows the full field grid. */}
              <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
                {/* Section header — clickable to toggle */}
                <button
                  type="button"
                  onClick={toggleStatusCollapsed}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#005D9710] transition-colors"
                  title={statusCollapsed ? 'Expand status fields' : 'Collapse status fields'}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] flex-shrink-0">Status</span>
                    {/* Collapsed one-line summary */}
                    {statusCollapsed && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0 truncate">
                        {(() => {
                          const status = boardColumns.find(c => c.id === item.status);
                          const priority = item.priority ?? 'medium';
                          const dueLabel = item.due_date ? formatDateFull(item.due_date) : null;
                          return (
                            <>
                              {status && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                                  style={{
                                    color: status.color ?? '#64748B',
                                    backgroundColor: `${status.color ?? '#64748B'}15`,
                                    border: `1px solid ${status.color ?? '#64748B'}`,
                                  }}
                                >
                                  {status.name}
                                </span>
                              )}
                              <span className="text-slate-300">·</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium flex-shrink-0" style={{ color: PRIORITY_STYLES[priority]?.hex ?? '#64748B' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_STYLES[priority]?.hex ?? '#64748B' }} />
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                              </span>
                              {dueLabel && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-[11px] text-slate-500 flex-shrink-0">Due {dueLabel}</span>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${statusCollapsed ? '' : 'rotate-180'}`}
                  />
                </button>

                {/* Section body — only rendered when expanded */}
                {!statusCollapsed && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5 block">Status</label>
                        <StyledSelect
                          value={item.status ?? ''}
                          onChange={val => updateField('status', val || null)}
                          disabled={isReadOnly}
                          options={[
                            { value: '', label: 'None' },
                            ...allowedStatuses.map(col => ({ value: col.id, label: col.name, color: col.color ?? undefined })),
                          ]}
                          placeholder="None"
                        />
                      </div>
                      {fieldVisibility.priority && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5 block">Priority</label>
                          <StyledSelect
                            value={item.priority ?? 'medium'}
                            onChange={val => updateField('priority', val)}
                            disabled={isReadOnly}
                            options={PRIORITIES.map(p => ({
                              value: p,
                              label: p.charAt(0).toUpperCase() + p.slice(1),
                              color: PRIORITY_STYLES[p]?.hex ?? '#94a3b8',
                            }))}
                          />
                        </div>
                      )}
                      {fieldVisibility.dueDate && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] flex items-center gap-1 mb-1.5">
                            <Calendar className="w-3 h-3" /> Due date
                          </label>
                          <DatePicker
                            value={item.due_date}
                            onChange={val => updateField('due_date', val || null)}
                            disabled={isReadOnly}
                          />
                        </div>
                      )}
                      {fieldVisibility.publishDate && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] flex items-center gap-1 mb-1.5">
                            <Calendar className="w-3 h-3" /> Publish date
                          </label>
                          <DatePicker
                            value={item.publish_date}
                            onChange={val => updateField('publish_date', val || null)}
                            disabled={isReadOnly}
                          />
                        </div>
                      )}
                      {fieldVisibility.channel && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5 block">Channel</label>
                          <StyledSelect
                            value={item.channel ?? ''}
                            onChange={val => updateField('channel', val)}
                            disabled={isReadOnly}
                            options={[
                              { value: '', label: 'None' },
                              ...channels.map(c => ({ value: c, label: c })),
                            ]}
                            placeholder="None"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-1.5 block">Content type</label>
                        <StyledSelect
                          value={item.content_type_id ?? ''}
                          onChange={val => updateField('content_type_id', val || null)}
                          disabled={isReadOnly}
                          options={[
                            { value: '', label: 'None' },
                            ...contentTypes.map(ct => ({ value: ct.id, label: ct.name, color: ct.color ?? undefined })),
                          ]}
                          placeholder="None"
                        />
                      </div>
                    </div>

                    {/* Tags — inside Status section so they collapse with the rest */}
                    {fieldVisibility.tags && item.tags && item.tags.length > 0 && (
                      <div className="mt-4">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em] flex items-center gap-1 mb-2">
                          <Hash className="w-3 h-3" /> Tags
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.map(tag => (
                            <span key={tag} className="text-xs px-2.5 py-1 bg-[#005D9712] text-slate-600 rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Subtasks — what's left to do takes priority over context */}
              <SubtasksSection
                contentItemId={item.id}
                userId={user?.id ?? null}
                members={subtaskMembers}
                addToast={addToast}
                templates={subtaskTemplates}
                userRole={userRole}
              />

              {/* 4. Linked Assets */}
              <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden p-4" style={{ border: '1px solid #00233930' }}>
                <ExternalLinksSection contentItemId={item.id} addToast={addToast} readOnly={isReadOnly} />
              </div>

              {/* 5. Optional Details (canonical Batch 5 v2): category-tinted
                  zone housing all custom field affordances. Tint + label
                  color match the task's category (navy for content, berry
                  for design). Heading is 11px to match the unified canonical
                  treatment; color stays category-tinted for context. */}
              {activeCustomFields.length > 0 && (() => {
                const isDesign = item.category === 'design';
                const categoryColor = isDesign ? '#B8447A' : '#005D97';
                const tintBg = isDesign ? '#FDF3F8' : '#005D9708';
                return (
                  <div
                    className="rounded-xl overflow-hidden p-4"
                    style={{
                      backgroundColor: tintBg,
                      border: `1px solid ${categoryColor}20`,
                    }}
                  >
                    <label
                      className="text-[11px] font-semibold uppercase tracking-[0.06em] block mb-3"
                      style={{ color: categoryColor }}
                    >
                      Optional Details
                    </label>
                    <CustomFieldsSection
                      fields={activeCustomFields}
                      values={customFieldValues}
                      onChange={updateCustomField}
                      compact
                      members={members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null }))}
                      taskCategory={item.category}
                    />
                  </div>
                );
              })()}

              {/* 6. Description — usually base-level context only, so sits
                  below structured task data (subtasks, links, custom fields). */}
              {fieldVisibility.description && (
                <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden p-4" style={{ border: '1px solid #00233930' }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">Description</label>
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
                          className="px-3 py-1.5 text-slate-600 text-xs rounded-lg hover:bg-[#005D9718]" style={{ border: '1px solid #00233930' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`text-sm text-slate-700 whitespace-pre-wrap min-h-[60px] p-3 bg-surface-nested rounded-lg transition-colors ${isReadOnly ? '' : 'cursor-pointer hover:bg-[#005D9710]'}`}
                      onClick={() => !isReadOnly && setEditingDescription(true)}
                    >
                      {item.description || <span className="text-slate-400 italic">{isReadOnly ? 'No description' : 'Click to add description...'}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* 7. Granola Meeting Notes (conditional — section hides itself
                  when no note is linked and not in admin view) */}
              <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden p-4" style={{ border: '1px solid #00233930' }}>
              <GranolaNoteSection
                key={granolaRefreshKey}
                contentItemId={item.id}
                onLinkNote={() => setGranolaPickerOpen(true)}
              />
              </div>
              <GranolaNotePickerModal
                isOpen={granolaPickerOpen}
                onClose={() => setGranolaPickerOpen(false)}
                contentItemId={item.id}
                onLinked={() => setGranolaRefreshKey((k) => k + 1)}
              />

              {/* 8. Slack Threads (conditional — section hides itself when no
                  thread is linked) */}
              <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden p-4" style={{ border: '1px solid #00233930' }}>
                <SlackThreadsSection
                  key={slackRefreshKey}
                  contentItemId={item.id}
                  onUnlink={() => setSlackRefreshKey((k) => k + 1)}
                />
              </div>

              {/* 9. AI Assistant — canonical bottom-of-panel slot, collapsed
                  by default; component owns the cool-wash + chevron + teal
                  accent styling per Path 1 doc alignment. */}
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
              {comments.map(comment => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id ?? null}
                  isAdmin={userRole === 'admin'}
                  members={members}
                  onEdit={editComment}
                  onDelete={softDeleteComment}
                />
              ))}

              <div className="pt-2" style={{ borderTop: '1px solid #00233930' }}>
                <MentionAutocomplete
                  value={commentText}
                  onChange={setCommentText}
                  members={members}
                  placeholder="Add a comment… (type @ to mention)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  style={{ border: '1px solid #00233930' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                />

                {/* Preview line — only when the draft contains mention syntax.
                    The composer is a plain textarea (lean v1), so users see
                    raw `@[Name](uuid)` while typing. This preview shows how
                    chips will render once the comment is posted. */}
                {extractMentionIds(commentText).length > 0 && (
                  <div
                    className="mt-2 px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: '#F7F9FC', border: '1px solid #00233918' }}
                  >
                    <span className="uppercase tracking-wider font-semibold text-slate-400 mr-2 text-[10px]">
                      Preview
                    </span>
                    <span className="text-slate-700 whitespace-pre-wrap break-words">
                      {renderBodyWithMentions(commentText, (m) => (
                        <span
                          key={`${m.uuid}-${m.start}`}
                          className="inline-flex items-baseline rounded-full px-1.5 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: '#005D9712', color: '#005D97' }}
                          title={`Mentioned: ${m.name}`}
                        >
                          @{m.name}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={addComment}
                    disabled={!commentText.trim()}
                    className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    Post comment
                  </button>
                  <span className="text-[10px] text-slate-400">⌘↵ to post · @ to mention</span>
                </div>
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
              {activity.length > 0 && (
                <ActivityLogList>
                  {activity.map(log => {
                    const member = members.find(m => m.user_id === log.user_id);
                    const actorName = member?.full_name || member?.email || 'Unknown';
                    return (
                      <ActivityLogRow
                        key={log.id}
                        type={mapActionToType(log.action)}
                        actor={{ name: actorName, avatarUrl: member?.avatar_url }}
                        timestamp={log.created_at}
                        action={log.action}
                        metadata={log.metadata}
                      />
                    );
                  })}
                </ActivityLogList>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t-2 bg-surface-card" style={{ borderColor: isLinearIssue ? '#FFE4D6' : isOrdinalPost ? '#C4B5FD' : '#dbeafe' }}>
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
              className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-1.5"
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
        <ConfirmModal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={deleteItem}
          variant="destructive"
          icon={<Trash2 className="w-5 h-5" style={{ color: '#BA2C2C' }} />}
          title="Are you sure?"
          description="Once it's gone, it's gone for good."
          confirmLabel="Delete item"
          loading={deleting}
        />
      </div>
    </div>
  );
}
