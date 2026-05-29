import { useState, useEffect, useCallback } from 'react';
import { Inbox, ChevronRight, ArrowRight, Loader2, RefreshCw, Check, X, MessageSquare, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useTriageItems } from '../../hooks/useTriageItems';
import type { IntakeSubmission, IntakeForm, ContentItem } from '../../lib/database.types';
import { formatDateFull } from '../../lib/utils';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenItem?: (itemId: string) => void;
}

interface SubmissionWithForm extends IntakeSubmission {
  form?: IntakeForm;
}

type Tab = 'forms' | 'slack';

const REJECT_REASONS = [
  'Already have this content',
  'Repeat request',
  'Request unclear',
] as const;

// ── Main component ──────────────────────────────────────────────────────────

export function IntakeQueue({ addToast, onOpenItem }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('slack');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-2 border-b" style={{ borderColor: '#00233930' }}>
        <button
          onClick={() => setActiveTab('slack')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
            ${activeTab === 'slack' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-[#005D9710]'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Slack
        </button>
        <button
          onClick={() => setActiveTab('forms')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
            ${activeTab === 'forms' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-[#005D9710]'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          Forms
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'forms' ? (
        <FormsTab addToast={addToast} />
      ) : (
        <SlackTab addToast={addToast} onOpenItem={onOpenItem} />
      )}
    </div>
  );
}

// ── Slack Tab ───────────────────────────────────────────────────────────────

function SlackTab({ addToast, onOpenItem }: { addToast: Props['addToast']; onOpenItem?: (id: string) => void }) {
  const { userRole, user, refreshContentItems } = useApp();
  const { items, loading, refresh } = useTriageItems();
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showBulkReject, setShowBulkReject] = useState(false);

  const canAct = userRole === 'admin' || userRole === 'editor';

  // Shift-click selection
  function handleRowClick(item: ContentItem, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedId && canAct) {
      const ids = items.map(i => i.id);
      const start = ids.indexOf(lastClickedId);
      const end = ids.indexOf(item.id);
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      setSelectedIds(prev => {
        const next = new Set(prev);
        range.forEach(id => next.add(id));
        return next;
      });
    } else if ((e.metaKey || e.ctrlKey) && canAct) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else {
      setSelectedIds(new Set());
      setSelected(item);
    }
    setLastClickedId(item.id);
  }

  async function handleApprove(itemId: string) {
    if (!user) return;
    setProcessing(itemId);
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ needs_triage: false })
        .eq('id', itemId);
      if (error) throw error;
      await supabase.from('activity_log').insert({
        content_item_id: itemId,
        user_id: user.id,
        action: 'approved from triage queue',
      });
      await refreshContentItems();
      if (selected?.id === itemId) setSelected(null);
      addToast('Approved — item is now in Backlog');
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleApproveAndEdit(itemId: string) {
    await handleApprove(itemId);
    onOpenItem?.(itemId);
  }

  async function handleReject(itemId: string, reason: string) {
    if (!user) return;
    setProcessing(itemId);
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ archived: true, needs_triage: false })
        .eq('id', itemId);
      if (error) throw error;
      await supabase.from('activity_log').insert({
        content_item_id: itemId,
        user_id: user.id,
        action: `rejected from triage: ${reason}`,
        metadata: { reason },
      });
      if (selected?.id === itemId) setSelected(null);
      setRejectingId(null);
      addToast('Rejected');
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleBulkApprove() {
    if (!user || selectedIds.size === 0) return;
    setProcessing('bulk');
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('content_items')
        .update({ needs_triage: false })
        .in('id', ids);
      if (error) throw error;
      await Promise.all(ids.map(id =>
        supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user.id,
          action: 'approved from triage queue (bulk)',
        })
      ));
      await refreshContentItems();
      setSelectedIds(new Set());
      setSelected(null);
      addToast(`Approved ${ids.length} item(s)`);
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleBulkReject(reason: string) {
    if (!user || selectedIds.size === 0) return;
    setProcessing('bulk');
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('content_items')
        .update({ archived: true, needs_triage: false })
        .in('id', ids);
      if (error) throw error;
      await Promise.all(ids.map(id =>
        supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user.id,
          action: `rejected from triage: ${reason}`,
          metadata: { reason },
        })
      ));
      setSelectedIds(new Set());
      setSelected(null);
      setShowBulkReject(false);
      addToast(`Rejected ${ids.length} item(s)`);
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* List panel */}
      <div className="w-80 shrink-0 border-r bg-surface-card flex flex-col" style={{ borderColor: '#00233930' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#00233920' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Slack Requests
              {items.length > 0 && (
                <span className="ml-2 text-xs bg-mint-200 text-brand-700 px-1.5 py-0.5 rounded-full">{items.length}</span>
              )}
            </h2>
            <button onClick={refresh} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#005D9712] flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No pending requests</p>
              <p className="text-xs text-slate-400 mt-1">Slack /content-request submissions will appear here for triage.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#00233910' }}>
              {items.map(item => {
                const isSelected = selected?.id === item.id;
                const isChecked = selectedIds.has(item.id);
                const cf = (item.custom_fields as Record<string, string>) ?? {};
                return (
                  <button
                    key={item.id}
                    onClick={(e) => handleRowClick(item, e)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#005D9718] transition-colors
                      ${isSelected ? 'bg-mint border-l-2 border-brand-400' : ''}
                      ${isChecked ? 'bg-brand-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                        {cf._slack_user_name && (
                          <p className="text-xs text-slate-400 mt-0.5">from {cf._slack_user_name}</p>
                        )}
                        <p className="text-xs text-slate-400">{formatDateFull(item.created_at)}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto bg-surface-nested">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-surface-card flex items-center justify-center mb-4 shadow-sm" style={{ border: '1px solid #00233920' }}>
              <MessageSquare className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Select a request</h3>
            <p className="text-sm text-slate-400 max-w-xs">Click a Slack request on the left to review and take action.</p>
          </div>
        ) : (
          <SlackItemDetail
            item={selected}
            canAct={canAct}
            processing={processing === selected.id}
            rejectingId={rejectingId}
            onApprove={() => handleApprove(selected.id)}
            onApproveEdit={() => handleApproveAndEdit(selected.id)}
            onStartReject={() => setRejectingId(selected.id)}
            onCancelReject={() => setRejectingId(null)}
            onReject={(reason) => handleReject(selected.id, reason)}
          />
        )}
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && canAct && (
        <BulkTriageToolbar
          count={selectedIds.size}
          processing={processing === 'bulk'}
          showReject={showBulkReject}
          onApprove={handleBulkApprove}
          onStartReject={() => setShowBulkReject(true)}
          onReject={handleBulkReject}
          onCancelReject={() => setShowBulkReject(false)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}

// ── Slack item detail ───────────────────────────────────────────────────────

function SlackItemDetail({
  item, canAct, processing, rejectingId,
  onApprove, onApproveEdit, onStartReject, onCancelReject, onReject,
}: {
  item: ContentItem;
  canAct: boolean;
  processing: boolean;
  rejectingId: string | null;
  onApprove: () => void;
  onApproveEdit: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReject: (reason: string) => void;
}) {
  const cf = (item.custom_fields as Record<string, string>) ?? {};
  const isRejecting = rejectingId === item.id;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ borderColor: '#00233920' }}>
          <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {cf._slack_user_name && (
              <span className="text-xs text-slate-400">
                from <span className="font-medium text-slate-600">{cf._slack_user_name}</span>
              </span>
            )}
            <span className="text-xs text-slate-400">via Slack</span>
            <span className="text-xs text-slate-400">{formatDateFull(item.created_at)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {item.description && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag => (
                  <span key={tag} className="text-xs bg-[#005D9712] text-slate-600 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="px-6 py-4 bg-surface-nested border-t flex items-center gap-3" style={{ borderColor: '#00233920' }}>
            {isRejecting ? (
              <RejectReasonPicker
                onSelect={onReject}
                onCancel={onCancelReject}
                disabled={processing}
              />
            ) : (
              <>
                <button
                  onClick={onApprove}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-60 transition-colors"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={onApproveEdit}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-60 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Approve & edit
                </button>
                <button
                  onClick={onStartReject}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-surface-card transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reject reason picker ────────────────────────────────────────────────────

function RejectReasonPicker({ onSelect, onCancel, disabled }: {
  onSelect: (reason: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-slate-500">Reason:</span>
      {REJECT_REASONS.map(reason => (
        <button
          key={reason}
          onClick={() => onSelect(reason)}
          disabled={disabled}
          className="px-3 py-1.5 text-sm font-medium text-accent-crimson bg-[#BA2C2C08] border border-[#BA2C2C30] rounded-lg hover:bg-[#BA2C2C15] disabled:opacity-60 transition-colors"
        >
          {reason}
        </button>
      ))}
      <button
        onClick={onCancel}
        disabled={disabled}
        className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Bulk triage toolbar ─────────────────────────────────────────────────────

function BulkTriageToolbar({ count, processing, showReject, onApprove, onStartReject, onReject, onCancelReject, onClear }: {
  count: number;
  processing: boolean;
  showReject: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  onReject: (reason: string) => void;
  onCancelReject: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface-card shadow-xl rounded-xl px-4 py-3" style={{ border: '1px solid #00233930' }}>
      <span className="text-sm font-medium text-slate-700">{count} selected</span>
      <div className="h-6 w-px bg-slate-200" />

      {showReject ? (
        <RejectReasonPicker
          onSelect={onReject}
          onCancel={onCancelReject}
          disabled={processing}
        />
      ) : (
        <>
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Approve
          </button>
          <button
            onClick={onStartReject}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-crimson hover:bg-[#BA2C2C08] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </>
      )}

      <div className="h-6 w-px bg-slate-200" />
      <button
        onClick={onClear}
        disabled={processing}
        className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors disabled:opacity-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Forms Tab (existing behavior, extracted) ────────────────────────────────

function FormsTab({ addToast }: { addToast: Props['addToast'] }) {
  const { workspace, user, intakeForms, boardColumns, refreshContentItems } = useApp();
  const [submissions, setSubmissions] = useState<SubmissionWithForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmissionWithForm | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'converted' | 'rejected' | 'all'>('pending');

  const loadSubmissions = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);

    const formIds = intakeForms.map(f => f.id);
    if (formIds.length === 0) { setLoading(false); return; }

    const { data } = await supabase
      .from('intake_submissions')
      .select('*')
      .in('form_id', formIds)
      .order('created_at', { ascending: false });

    if (data) {
      const enriched = data.map(sub => ({
        ...sub,
        form: intakeForms.find(f => f.id === sub.form_id),
      }));
      setSubmissions(enriched);
    }
    setLoading(false);
  }, [workspace, intakeForms]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  async function convertToItem(sub: SubmissionWithForm) {
    if (!workspace || !user) return;
    setConverting(sub.id);

    const data = (sub.data as Record<string, string>) ?? {};
    const backlogCol = boardColumns[0];

    const existingTags = data.tags
      ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    try {
      const { error } = await supabase.from('content_items').insert({
        workspace_id: workspace.id,
        title: data.title || `Intake: ${sub.submitted_by_email ?? 'Submission'}`,
        description: data.description || '',
        channel: data.channel || null,
        due_date: data.due_date || null,
        publish_date: data.publish_date || null,
        tags: [...existingTags, 'Intake'],
        status: backlogCol?.id ?? null,
        priority: 'medium',
        created_by: user.id,
      });

      if (error) throw error;

      await supabase
        .from('intake_submissions')
        .update({ status: 'converted', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', sub.id);

      await refreshContentItems();
      await loadSubmissions();
      if (selected?.id === sub.id) setSelected(null);
      addToast('Submission converted to content item');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setConverting(null);
    }
  }

  async function rejectSubmission(sub: SubmissionWithForm) {
    if (!user) return;
    try {
      await supabase
        .from('intake_submissions')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', sub.id);
      await loadSubmissions();
      if (selected?.id === sub.id) setSelected(null);
      addToast('Submission rejected');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  }

  const filtered = submissions.filter(s => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="flex flex-1 min-h-0">
      {/* List panel */}
      <div className="w-80 shrink-0 border-r bg-surface-card flex flex-col" style={{ borderColor: '#00233930' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#00233920' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Submissions
              {pendingCount > 0 && (
                <span className="ml-2 text-xs bg-mint-200 text-brand-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </h2>
            <button onClick={loadSubmissions} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1">
            {(['pending', 'converted', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2 py-1 text-xs rounded-md capitalize transition-colors
                  ${statusFilter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-[#005D9710]'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#005D9712] flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No submissions</p>
              <p className="text-xs text-slate-400 mt-1">
                {statusFilter === 'pending' ? 'New intake submissions will appear here.' : `No ${statusFilter} submissions.`}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#00233910' }}>
              {filtered.map(sub => {
                const data = (sub.data as Record<string, string>) ?? {};
                const title = data.title || `Submission from ${sub.submitted_by_email ?? 'Unknown'}`;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#005D9718] transition-colors
                      ${selected?.id === sub.id ? 'bg-mint border-l-2 border-brand-400' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{sub.form?.name ?? 'Unknown form'}</p>
                        <p className="text-xs text-slate-400">{formatDateFull(sub.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={sub.status} />
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto bg-surface-nested">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-surface-card flex items-center justify-center mb-4 shadow-sm" style={{ border: '1px solid #00233920' }}>
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Select a submission</h3>
            <p className="text-sm text-slate-400 max-w-xs">Click a submission on the left to review its contents and take action.</p>
          </div>
        ) : (
          <SubmissionDetail
            sub={selected}
            converting={converting === selected.id}
            onConvert={() => convertToItem(selected)}
            onReject={() => rejectSubmission(selected)}
          />
        )}
      </div>
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    converted: 'bg-[#92D1B218] text-[#2F8889]',
    rejected: 'bg-[#BA2C2C12] text-accent-crimson',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-[#005D9712] text-slate-500'}`}>
      {status}
    </span>
  );
}

function SubmissionDetail({
  sub, converting, onConvert, onReject,
}: {
  sub: SubmissionWithForm;
  converting: boolean;
  onConvert: () => void;
  onReject: () => void;
}) {
  const data = (sub.data as Record<string, string>) ?? {};
  const isPending = sub.status === 'pending';

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ borderColor: '#00233920' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {data.title || `Submission from ${sub.submitted_by_email ?? 'Unknown'}`}
              </h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-slate-400">Via <span className="font-medium text-slate-600">{sub.form?.name ?? 'Unknown form'}</span></span>
                {sub.submitted_by_email && (
                  <span className="text-xs text-slate-400">{sub.submitted_by_email}</span>
                )}
                <span className="text-xs text-slate-400">{formatDateFull(sub.created_at)}</span>
              </div>
            </div>
            <StatusBadge status={sub.status} />
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          {Object.entries(data).map(([key, val]) => {
            if (!val) return null;
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={key}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{val}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="px-6 py-4 bg-surface-nested border-t flex items-center gap-3" style={{ borderColor: '#00233920' }}>
            <button
              onClick={onConvert}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-60 transition-colors"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Convert to content item
            </button>
            <button
              onClick={onReject}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-surface-card transition-colors"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}
        {sub.status === 'converted' && (
          <div className="px-6 py-4 bg-[#92D1B218] border-t border-[#92D1B230] flex items-center gap-2 text-sm text-[#2F8889]">
            <Check className="w-4 h-4" />
            Converted to a content item
          </div>
        )}
        {sub.status === 'rejected' && (
          <div className="px-6 py-4 bg-[#BA2C2C08] border-t border-[#BA2C2C15] flex items-center gap-2 text-sm text-accent-crimson">
            <X className="w-4 h-4" />
            Submission rejected
          </div>
        )}
      </div>
    </div>
  );
}
