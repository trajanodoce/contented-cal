import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp, Loader2, Copy, Check,
  ArrowDownToLine, Send, Clock, Zap, PenLine, FileText, Heading,
  Share2, Brain, ShieldAlert, Lightbulb, Search, MoreHorizontal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem, AiInteraction, AiAction, CustomFieldDefinition } from '../../lib/database.types';

// Accent color for all AI assistant interactive elements
const AI_ACCENT = '#2F8889';

interface Props {
  item: ContentItem;
  onInsertToDescription: (text: string, mode: 'replace' | 'append') => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Action definitions ───────────────────────────────────────────────────────

interface ActionDef {
  id: AiAction;
  label: string;
  icon: React.ReactNode;
  description: string;
  tier: 'primary' | 'secondary' | 'tertiary';
}

const ALL_ACTIONS: ActionDef[] = [
  { id: 'social_posts', label: 'Draft Social Posts', icon: <Share2 className="w-4 h-4" />, description: 'LinkedIn, X, and short-form variants', tier: 'primary' },
  { id: 'quick_draft', label: 'Quick Draft', icon: <PenLine className="w-4 h-4" />, description: 'Fast first-pass draft from item context', tier: 'primary' },
  { id: 'full_workflow', label: 'Generate Outline', icon: <FileText className="w-4 h-4" />, description: 'Structured outline for review before drafting', tier: 'primary' },
  { id: 'headlines', label: 'Generate Headlines', icon: <Heading className="w-4 h-4" />, description: '5 persona-aware headline options', tier: 'secondary' },
  { id: 'improvements', label: 'Suggest Improvements', icon: <Lightbulb className="w-4 h-4" />, description: 'Specific edits with before/after', tier: 'secondary' },
  { id: 'stop_slop_audit', label: 'Stop Slop Audit', icon: <ShieldAlert className="w-4 h-4" />, description: 'Score on 5 dimensions, flag violations', tier: 'secondary' },
  { id: 'schwartz_diagnosis', label: 'Schwartz Diagnosis', icon: <Brain className="w-4 h-4" />, description: 'Messaging strategy from awareness level', tier: 'tertiary' },
  { id: 'meta_description', label: 'Meta Description', icon: <Search className="w-4 h-4" />, description: 'SEO meta under 160 chars', tier: 'tertiary' },
];

// ── Content-type-aware action filtering ──────────────────────────────────────

function getActionsForContentType(typeName: string | undefined): AiAction[] {
  const name = (typeName || '').toLowerCase();

  if (name.includes('social')) {
    return ['social_posts', 'quick_draft', 'stop_slop_audit', 'improvements'];
  }
  if (name.includes('email')) {
    return ['quick_draft', 'headlines', 'stop_slop_audit', 'improvements'];
  }
  if (name.includes('ad')) {
    return ['quick_draft', 'schwartz_diagnosis', 'stop_slop_audit'];
  }
  // Blog, landing page, customer story, webinar, or any long-form: all actions
  return ALL_ACTIONS.map(a => a.id);
}

// ── Extract writing context from custom fields ───────────────────────────────

const WRITING_FIELD_NAMES = [
  'Target Persona',
  'Buyer Stage',
  'Voice',
  'Awareness Level',
  'Market Sophistication',
] as const;

function extractWritingContext(
  customFields: Record<string, unknown> | null,
  fieldDefs: CustomFieldDefinition[]
): Record<string, string> {
  if (!customFields) return {};
  const result: Record<string, string> = {};

  for (const name of WRITING_FIELD_NAMES) {
    const def = fieldDefs.find(f => f.name === name);
    if (def && customFields[def.id]) {
      const key = name.toLowerCase().replace(/ /g, '_');
      result[key] = String(customFields[def.id]);
    }
  }
  return result;
}

// ── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Insert modal ─────────────────────────────────────────────────────────────

function InsertModal({
  onChoice,
  onCancel,
}: {
  onChoice: (mode: 'replace' | 'append') => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Insert into description</h3>
        <p className="text-xs text-slate-500 mb-4">The description already has content. How should this be added?</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoice('replace')}
            className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: AI_ACCENT }}
          >
            Replace description
          </button>
          <button
            onClick={() => onChoice('append')}
            className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Append to description
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Response card ────────────────────────────────────────────────────────────

function ResponseCard({
  interaction,
  onInsert,
  hasDescription,
}: {
  interaction: AiInteraction;
  onInsert: (text: string, hasExisting: boolean) => void;
  hasDescription: boolean;
}) {
  const actionMeta = ALL_ACTIONS.find(a => a.id === interaction.action);
  const date = new Date(interaction.created_at);
  const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#002339' }}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">{actionMeta?.icon ?? <Sparkles className="w-3.5 h-3.5" />}</span>
          <span className="text-xs font-medium text-slate-700">{actionMeta?.label ?? interaction.action}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />{timeLabel}
          </span>
          <CopyButton text={interaction.response ?? ''} />
          <button
            onClick={() => onInsert(interaction.response ?? '', hasDescription)}
            title="Insert into description"
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: AI_ACCENT }}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Insert
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{interaction.response}</p>
      </div>
    </div>
  );
}

// ── Voice indicator ──────────────────────────────────────────────────────────

function ActiveContext({ persona, voice }: { persona?: string; voice?: string }) {
  if (!persona && !voice) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {voice && voice !== 'Bolt.new TOV' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
          🎙 {voice}
        </span>
      )}
      {persona && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded-full">
          👤 {persona.split(' / ')[0]}
        </span>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AiAssistant({ item, onInsertToDescription, addToast }: Props) {
  const { workspace, contentTypes, customFieldDefs } = useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<AiAction | 'custom' | null>(null);
  const [history, setHistory] = useState<AiInteraction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [insertModal, setInsertModal] = useState<{ text: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contentType = contentTypes.find(c => c.id === item.content_type_id);
  const customFieldValues = (item.custom_fields as Record<string, unknown>) ?? {};
  const writingContext = extractWritingContext(customFieldValues, customFieldDefs);

  // Get actions filtered by content type
  const allowedActionIds = getActionsForContentType(contentType?.name);
  const visibleActions = ALL_ACTIONS.filter(a => allowedActionIds.includes(a.id));
  const primaryActions = visibleActions.filter(a => a.tier === 'primary');
  const secondaryActions = visibleActions.filter(a => a.tier === 'secondary');
  const tertiaryActions = visibleActions.filter(a => a.tier === 'tertiary');

  // Always enable AI panel — server may have ANTHROPIC_API_KEY env var as fallback
  const checkIntegration = useCallback(async () => {
    setHasIntegration(true);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('ai_interactions')
      .select('*')
      .eq('content_item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistory(data as AiInteraction[]);
    setLoadingHistory(false);
  }, [item.id]);

  useEffect(() => {
    if (open && hasIntegration === null) checkIntegration();
    if (open && hasIntegration) loadHistory();
  }, [open, hasIntegration, checkIntegration, loadHistory]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, open]);

  async function runAction(action: AiAction, custom?: string) {
    if (!workspace) return;
    setLoading(action === 'custom' ? 'custom' : action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          content_item_id: item.id,
          action,
          item: {
            title: item.title,
            description: item.description,
            content_type: contentType?.name,
            channel: item.channel,
            priority: item.priority,
            tags: item.tags,
          },
          custom_field_context: writingContext,
          custom_prompt: custom,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI request failed');

      await loadHistory();
      if (action === 'custom') setCustomPrompt('');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(null);
    }
  }

  function handleInsert(text: string, hasExistingDescription: boolean) {
    if (!hasExistingDescription || !item.description?.trim()) {
      onInsertToDescription(text, 'replace');
      addToast('Inserted into description');
    } else {
      setInsertModal({ text });
    }
  }

  function handleInsertChoice(mode: 'replace' | 'append') {
    if (insertModal) {
      onInsertToDescription(insertModal.text, mode);
      addToast(mode === 'replace' ? 'Description replaced' : 'Appended to description');
      setInsertModal(null);
    }
  }

  return (
    <>
      <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#002339' }}>
        {/* Header toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2F8889' }}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800">AI Assistant</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Bolt.new Writer</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {open && (
          <div className="border-t border-slate-100">
            {hasIntegration === false ? (
              <NotConnectedState />
            ) : (
              <div className="p-4 space-y-4">
                {/* Active voice/persona context */}
                <ActiveContext
                  persona={writingContext.target_persona}
                  voice={writingContext.voice}
                />

                {/* Primary actions — large buttons */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Quick actions</p>
                  <div className="space-y-2">
                    {primaryActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => runAction(action.id)}
                        disabled={loading !== null}
                        className="w-full flex items-center gap-3 p-3 text-left border border-slate-200 rounded-lg transition-all group disabled:opacity-50 hover:border-[#2F8889]/30 hover:bg-[#2F8889]/5"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#2F8889]/10 flex items-center justify-center text-slate-500 group-hover:text-[#2F8889] transition-colors shrink-0">
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-[#2F8889] transition-colors">{action.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                        </div>
                        {loading === action.id && (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: AI_ACCENT }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secondary actions — compact grid */}
                {secondaryActions.length > 0 && (
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      {secondaryActions.map(action => (
                        <button
                          key={action.id}
                          onClick={() => runAction(action.id)}
                          disabled={loading !== null}
                          className="flex items-center gap-2 p-2.5 text-left border border-slate-200 rounded-lg hover:border-[#2F8889]/30 hover:bg-[#2F8889]/5 transition-all group disabled:opacity-50"
                        >
                          <span className="text-slate-400 group-hover:text-[#2F8889] transition-colors shrink-0">
                            {action.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 group-hover:text-[#2F8889] transition-colors">{action.label}</p>
                          </div>
                          {loading === action.id && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto shrink-0" style={{ color: AI_ACCENT }} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tertiary actions — collapsible */}
                {tertiaryActions.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowMoreActions(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      {showMoreActions ? 'Less' : 'More actions'}
                    </button>
                    {showMoreActions && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {tertiaryActions.map(action => (
                          <button
                            key={action.id}
                            onClick={() => runAction(action.id)}
                            disabled={loading !== null}
                            className="flex items-center gap-2 p-2 text-left border border-slate-100 rounded-lg hover:border-[#2F8889]/30 hover:bg-[#2F8889]/5 transition-all group disabled:opacity-50"
                          >
                            <span className="text-slate-400 group-hover:text-[#2F8889] transition-colors shrink-0">
                              {action.icon}
                            </span>
                            <p className="text-xs text-slate-600 group-hover:text-[#2F8889] transition-colors">{action.label}</p>
                            {loading === action.id && (
                              <Loader2 className="w-3 h-3 animate-spin ml-auto shrink-0" style={{ color: AI_ACCENT }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom prompt */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Ask Claude anything</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && customPrompt.trim() && runAction('custom', customPrompt)}
                      placeholder="Ask anything about this content..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F8889]"
                      disabled={loading !== null}
                    />
                    <button
                      onClick={() => customPrompt.trim() && runAction('custom', customPrompt)}
                      disabled={loading !== null || !customPrompt.trim()}
                      className="p-2 text-white rounded-lg disabled:opacity-50 transition-colors" style={{ backgroundColor: AI_ACCENT }}
                    >
                      {loading === 'custom' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* History */}
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                ) : history.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Recent responses</p>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {history.map(int => (
                        <ResponseCard
                          key={int.id}
                          interaction={int}
                          onInsert={handleInsert}
                          hasDescription={!!item.description?.trim()}
                        />
                      ))}
                      <div ref={bottomRef} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 text-center">
                    <Zap className="w-6 h-6 text-slate-300 mb-1.5" />
                    <p className="text-xs text-slate-400">Run an action to get AI-generated content</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insert modal */}
      {insertModal && (
        <InsertModal
          onChoice={handleInsertChoice}
          onCancel={() => setInsertModal(null)}
        />
      )}
    </>
  );
}

// ── Not connected state ──────────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="p-5 text-center">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(to bottom right, #e0f2f1, #b2dfdb)' }}>
        <Sparkles className="w-5 h-5" style={{ color: AI_ACCENT }} />
      </div>
      <p className="text-sm font-medium text-slate-800 mb-1">AI Assistant not connected</p>
      <p className="text-xs text-slate-500 mb-3">Connect Claude AI in Settings → Integrations to use the AI assistant.</p>
      <a
        href="#settings"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs rounded-lg transition-colors font-medium" style={{ backgroundColor: AI_ACCENT }}
      >
        <Zap className="w-3.5 h-3.5" /> Go to Integrations
      </a>
    </div>
  );
}
