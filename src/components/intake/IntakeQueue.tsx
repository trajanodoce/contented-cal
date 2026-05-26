import { useState, useEffect, useCallback } from 'react';
import { Inbox, ChevronRight, ArrowRight, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { IntakeSubmission, IntakeForm } from '../../lib/database.types';
import { formatDateFull } from '../../lib/utils';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface SubmissionWithForm extends IntakeSubmission {
  form?: IntakeForm;
}

export function IntakeQueue({ addToast }: Props) {
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

      // Mark submission as converted
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
    <div className="flex h-full">
      {/* List panel */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Submissions
              {pendingCount > 0 && (
                <span className="ml-2 text-xs bg-mint-200 text-brand-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </h2>
            <button onClick={loadSubmissions} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1">
            {(['pending', 'converted', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2 py-1 text-xs rounded-md capitalize transition-colors
                  ${statusFilter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No submissions</p>
              <p className="text-xs text-gray-400 mt-1">
                {statusFilter === 'pending' ? 'New intake submissions will appear here.' : `No ${statusFilter} submissions.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(sub => {
                const data = (sub.data as Record<string, string>) ?? {};
                const title = data.title || `Submission from ${sub.submitted_by_email ?? 'Unknown'}`;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                      ${selected?.id === sub.id ? 'bg-mint border-l-2 border-brand-400' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sub.form?.name ?? 'Unknown form'}</p>
                        <p className="text-xs text-gray-400">{formatDateFull(sub.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={sub.status} />
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
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
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
              <Inbox className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Select a submission</h3>
            <p className="text-sm text-gray-400 max-w-xs">Click a submission on the left to review its contents and take action.</p>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    converted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {data.title || `Submission from ${sub.submitted_by_email ?? 'Unknown'}`}
              </h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">Via <span className="font-medium text-gray-600">{sub.form?.name ?? 'Unknown form'}</span></span>
                {sub.submitted_by_email && (
                  <span className="text-xs text-gray-400">{sub.submitted_by_email}</span>
                )}
                <span className="text-xs text-gray-400">{formatDateFull(sub.created_at)}</span>
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
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{val}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}
        {sub.status === 'converted' && (
          <div className="px-6 py-4 bg-green-50 border-t border-green-100 flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Converted to a content item
          </div>
        )}
        {sub.status === 'rejected' && (
          <div className="px-6 py-4 bg-red-50 border-t border-red-100 flex items-center gap-2 text-sm text-red-600">
            <X className="w-4 h-4" />
            Submission rejected
          </div>
        )}
      </div>
    </div>
  );
}
