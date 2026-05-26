import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Calendar, MessageSquare,
  Activity, Loader2, Edit2, Check, Hash, Zap, ExternalLink, Link2
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

const CHANNELS = ['Blog', 'LinkedIn', 'Twitter/X', 'Instagram', 'Facebook', 'YouTube', 'Email', 'Website', 'Other'];
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

export function DetailSlideOver({ item, onClose, onUpdated, addToast }: Props) {
  const { contentTypes, boardColumns, user, customFieldDefs, projects, members } = useApp();
  const { userRole } = useWorkspace();
  const isOrdinalPost = isOrdinalItem(item);
  const isLinearIssue = isLinearItem(item);
  const isReadOnly = userRole === 'viewer' || isOrdinalPost || isLinearIssue;
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

  // Member profiles for subtasks section
  const memberProfiles = useMemo(
    () => members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null })),
    [members]
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl border-l border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Ordinal Banner */}
        {isOrdinalPost && (
          <div className="px-6 py-3 border-b" style={{ backgroundColor: `${ORDINAL_COLOR}08`, borderColor: `${ORDINAL_COLOR}20` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: ORDINAL_COLOR }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">This post is managed in Ordinal</p>
                  <p className="text-xs text-slate-500">To edit, open it in Ordinal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${DRAFT_COLOR}15`, color: DRAFT_COLOR }}
                >
                  Draft
                </span>
                {ordinalLink?.post_url && (
                  <a
                    href={ordinalLink.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
                    style={{
                      color: ORDINAL_COLOR,
                      borderColor: `${ORDINAL_COLOR}40`,
                      backgroundColor: `${ORDINAL_COLOR}08`,
                    }}
                  >
                    <span>Open in Ordinal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Linear Banner */}
        {isLinearIssue && linearInfo && (
          <div className="px-6 py-3 border-b" style={{ backgroundColor: `${LINEAR_COLOR}08`, borderColor: `${LINEAR_COLOR}20` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs"
                  style={{ backgroundColor: `${LINEAR_COLOR}15`, color: LINEAR_COLOR }}
                >
                  L
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">This issue is managed in Linear</p>
                  <p className="text-xs text-slate-500">
                    {linearInfo.identifier} · {linearInfo.team}
                    {linearInfo.project ? ` · ${linearInfo.project}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {linearInfo.status && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${LINEAR_COLOR}15`, color: LINEAR_COLOR }}
                  >
                    {linearInfo.status}
                  </span>
                )}
                {linearInfo.url && (
                  <a
                    href={linearInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
                    style={{
                      color: LINEAR_COLOR,
                      borderColor: `${LINEAR_COLOR}40`,
                      backgroundColor: `${LINEAR_COLOR}08`,
                    }}
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
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {isOrdinalPost ? (
              // Read-only title for Ordinal items
              <div className="flex items-start gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: ORDINAL_COLOR }} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                  {/* Ordinal Profile */}
                  {ordinalProfile && (
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
                </div>
              </div>
            ) : isReadOnly ? (
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            ) : (
              <>
                {editingField === 'title' ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editValues.title ?? item.title}
                      onChange={e => setEditValues({ ...editValues, title: e.target.value })}
                      className="flex-1 text-lg font-semibold text-slate-900 border-b-2 border-brand-400 outline-none bg-transparent"
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateField('title', editValues.title ?? item.title);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => updateField('title', editValues.title ?? item.title)}>
                      {savingField === 'title' ? <Loader2 className="w-4 h-4 animate-spin text-brand-500" /> : <Check className="w-4 h-4 text-green-500" />}
                    </button>
                  </div>
                ) : (
                  <button
                    className="text-left group"
                    onClick={() => { setEditingField('title'); setEditValues({ title: item.title }); }}
                  >
                    <h2 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">{item.title}</h2>
                  </button>
                )}
              </>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {contentType && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: contentType.color ?? undefined }} />
                  {contentType.name}
                </span>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-400">Created {formatDateFull(item.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-1">
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
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
                  <select
                    value={item.status ?? ''}
                    onChange={e => updateField('status', e.target.value || null)}
                    disabled={isReadOnly}
                    className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                    className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      className={`mt-1.5 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">No project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}
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
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
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
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
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
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
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
      </div>
    </div>
  );
}
