import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp, Loader2, Copy, Check,
  ArrowDownToLine, Send, Clock, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem, AiInteraction, AiAction } from '../../lib/database.types';

interface Props {
  item: ContentItem;
  onInsertToDescription: (text: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ACTIONS: { id: AiAction; label: string; icon: string; description: string }[] = [
  { id: 'summarize', label: 'Summarize', icon: '📝', description: 'Generate a 2–3 sentence summary' },
  { id: 'headlines', label: 'Headlines', icon: '✍️', description: 'Get 5 headline options' },
  { id: 'meta_description', label: 'Meta description', icon: '🔍', description: 'Write an SEO meta description' },
  { id: 'social_posts', label: 'Social posts', icon: '📣', description: 'Draft posts for X, LinkedIn & Instagram' },
  { id: 'improvements', label: 'Improvements', icon: '💡', description: 'Get actionable editing suggestions' },
];

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
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

interface ResponseCardProps {
  interaction: AiInteraction;
  onInsert: (text: string) => void;
  contentTypes: { id: string; name: string }[];
}

function ResponseCard({ interaction, onInsert, contentTypes }: ResponseCardProps) {
  const actionMeta = ACTIONS.find(a => a.id === interaction.action);
  const date = new Date(interaction.created_at);
  const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{actionMeta?.icon ?? '✦'}</span>
          <span className="text-xs font-medium text-gray-700">{actionMeta?.label ?? interaction.action}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />{timeLabel}
          </span>
          <CopyButton text={interaction.response} />
          <button
            onClick={() => onInsert(interaction.response)}
            title="Insert into description"
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-500 transition-colors"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Insert
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{interaction.response}</p>
      </div>
    </div>
  );
}

export function AiAssistant({ item, onInsertToDescription, addToast }: Props) {
  const { workspace, user, contentTypes } = useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<AiAction | 'custom' | null>(null);
  const [history, setHistory] = useState<AiInteraction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contentType = contentTypes.find(c => c.id === item.content_type_id);

  // Check if Claude is connected
  const checkIntegration = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('integrations')
      .select('status')
      .eq('workspace_id', workspace.id)
      .eq('platform', 'claude')
      .maybeSingle();
    setHasIntegration(data?.status === 'connected');
  }, [workspace]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('ai_interactions')
      .select('*')
      .eq('content_item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(20);
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
          },
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

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-400 to-brand-300 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">AI Assistant</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Claude</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {hasIntegration === false ? (
            <NotConnectedState />
          ) : (
            <div className="p-4 space-y-4">
              {/* Quick actions */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Quick actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map(action => (
                    <button
                      key={action.id}
                      onClick={() => runAction(action.id)}
                      disabled={loading !== null}
                      className="flex items-start gap-2 p-2.5 text-left border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-mint/50 transition-all group disabled:opacity-50"
                    >
                      <span className="text-base leading-none mt-0.5">{action.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-gray-800 group-hover:text-brand-500 transition-colors">{action.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{action.description}</p>
                      </div>
                      {loading === action.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500 ml-auto mt-0.5 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom prompt */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Custom prompt</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && customPrompt.trim() && runAction('custom', customPrompt)}
                    placeholder="Ask anything about this content..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                    disabled={loading !== null}
                  />
                  <button
                    onClick={() => customPrompt.trim() && runAction('custom', customPrompt)}
                    disabled={loading !== null || !customPrompt.trim()}
                    className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    {loading === 'custom' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* History */}
              {loadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : history.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Recent responses</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {history.map(int => (
                      <ResponseCard
                        key={int.id}
                        interaction={int}
                        onInsert={onInsertToDescription}
                        contentTypes={contentTypes}
                      />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <Zap className="w-6 h-6 text-gray-300 mb-1.5" />
                  <p className="text-xs text-gray-400">Run an action above to get AI-generated content</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotConnectedState() {
  return (
    <div className="p-5 text-center">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-brand-100 flex items-center justify-center mx-auto mb-3">
        <Sparkles className="w-5 h-5 text-brand-500" />
      </div>
      <p className="text-sm font-medium text-gray-800 mb-1">AI Assistant not connected</p>
      <p className="text-xs text-gray-500 mb-3">Add your Anthropic API key in Settings → Integrations to unlock AI-powered content tools.</p>
      <a
        href="#settings"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 transition-colors font-medium"
      >
        <Zap className="w-3.5 h-3.5" /> Go to Integrations
      </a>
    </div>
  );
}
