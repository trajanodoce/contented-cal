import { useState, useEffect, useCallback, useMemo } from 'react';
import { Archive as ArchiveIcon, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { TaskCategoryIcon } from '../components/content/TaskCategoryIcon';
import { pillTextColor } from '../lib/utils';
import type { ContentItem } from '../lib/database.types';

/**
 * Archive page — surfaces all soft-archived content_items in one place.
 *
 * Archive is a deliberate "set aside" state, distinct from the natural
 * Completed/Published terminal statuses (those stay visible elsewhere
 * with a de-emphasized visual treatment — see the showCompleted toggle).
 *
 * v1 actions:
 *   - Restore: flip archived=false, item reappears in main views
 * v2 (deferred — see Notion backlog):
 *   - Permanently delete (admin action, ConfirmModal destructive)
 *   - Bulk select + bulk restore
 */
export function ArchivePage() {
  const { currentWorkspace } = useWorkspace();
  const { contentTypes, boardColumns } = useApp();
  const { setSelectedItemId } = useSelectedItem();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchArchived = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('archived', true)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) {
      console.error('[ArchivePage] fetch error:', error);
      toast.error('Failed to load archived items');
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const handleRestore = useCallback(async (item: ContentItem) => {
    setRestoringId(item.id);
    // Optimistic remove
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    const { error } = await supabase
      .from('content_items')
      .update({ archived: false })
      .eq('id', item.id);

    setRestoringId(null);
    if (error) {
      console.error('[ArchivePage] restore error:', error);
      toast.error(`Failed to restore "${item.title}"`);
      setItems(previous); // rollback
      return;
    }
    toast.success(`Restored "${item.title}"`);
  }, [items]);

  const contentTypeMap = useMemo(
    () => new Map(contentTypes.map((ct) => [ct.id, ct])),
    [contentTypes],
  );
  const statusMap = useMemo(
    () => new Map(boardColumns.map((c) => [c.id, c])),
    [boardColumns],
  );

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">Please select a workspace</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#64748B12' }}>
          <ArchiveIcon className="w-5 h-5" style={{ color: '#64748B' }} />
        </div>
        <div>
          <h1 className="text-3xl font-display text-slate-900 leading-none">Archive</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {items.length === 0
              ? 'Nothing archived yet'
              : `${items.length} archived item${items.length === 1 ? '' : 's'} · most recent first`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="bg-surface-card rounded-xl p-12 text-center" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.094)' }}>
          <ArchiveIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Archive is empty</p>
          <p className="text-xs text-slate-400 mt-1">
            Items archived from the row menu, bulk toolbar, or intake rejection will appear here.
          </p>
        </div>
      ) : (
        <div
          className="bg-surface-card rounded-xl overflow-hidden"
          style={{ border: '1px solid rgb(var(--color-brand-900) / 0.094)' }}
        >
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const ct = contentTypeMap.get(item.content_type_id || '');
              const status = statusMap.get(item.status || '');
              const isRestoring = restoringId === item.id;
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-brand-600/[0.031] transition-colors"
                >
                  {/* Category icon */}
                  <TaskCategoryIcon category={item.category} />

                  {/* Title (click → open detail panel) */}
                  <button
                    onClick={() => setSelectedItemId(item.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium text-slate-700 truncate group-hover:text-brand-600 transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ct && (
                        <span className="text-xs text-slate-500">{ct.name}</span>
                      )}
                      {ct && status && <span className="text-slate-300">·</span>}
                      {status && (() => {
                        const base = status.color ?? '#94a3b8';
                        const dark = pillTextColor(base);
                        return (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${base}30`,
                              color: dark,
                              opacity: 0.7,
                            }}
                          >
                            {status.name}
                          </span>
                        );
                      })()}
                    </div>
                  </button>

                  {/* Archived-at */}
                  <span className="text-xs text-slate-400 shrink-0">
                    Archived {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                  </span>

                  {/* Restore action */}
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={isRestoring}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: '#357254',
                      color: 'white',
                    }}
                  >
                    {isRestoring ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
