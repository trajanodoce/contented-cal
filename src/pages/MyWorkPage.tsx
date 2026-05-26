import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, Subtask } from '../lib/database.types';
import { isPast, isToday } from 'date-fns';
import { parseLocalDate, formatDate } from '../lib/utils';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR } from '../lib/ordinal';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { PersonalTasksSection } from '../components/personal/PersonalTasksSection';
import {
  Calendar,
  AlertCircle,
  Square,
  CheckSquare,
  ListChecks,
  ExternalLink,
  Loader2,
  Mic,
} from 'lucide-react';

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-300',
};

const priorityLabels: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface SubtaskWithParent extends Subtask {
  parent_title: string;
  parent_id: string;
}

export function MyWorkPage() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { contentTypes, boardColumns } = useApp();
  const { setSelectedItemId } = useSelectedItem();

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    try {
      // Fetch content items assigned to current user
      const { data: items } = await supabase
        .from('content_items')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .contains('assignee_ids', [user.id])
        .order('due_date', { ascending: true, nullsFirst: false });

      setContentItems(items || []);

      // Fetch subtasks assigned to current user (incomplete)
      // We need to join with content_items to get parent title
      const { data: mySubtasks } = await supabase
        .from('subtasks')
        .select('*, content_items!inner(id, title, workspace_id)')
        .eq('assignee_id', user.id)
        .eq('completed', false)
        .eq('content_items.workspace_id', currentWorkspace.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      const mapped = (mySubtasks || []).map((st: any) => ({
        ...st,
        parent_title: st.content_items?.title || 'Unknown',
        parent_id: st.content_items?.id || st.content_item_id,
        content_items: undefined,
      }));
      setSubtasks(mapped);
    } catch (err) {
      console.error('Error fetching my work:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const DONE_BG = '#DCEDF4';

  // The last board column is treated as the "published/done" status
  const doneColumnId = useMemo(() => {
    if (boardColumns.length === 0) return null;
    return boardColumns[boardColumns.length - 1].id;
  }, [boardColumns]);

  // An item is "done" if explicitly completed OR its status is the last column
  const isItemDone = useCallback(
    (item: ContentItem) => item.completed || (doneColumnId != null && item.status === doneColumnId),
    [doneColumnId],
  );

  // Sort: active items first, then completed/published items
  const sortedItems = useMemo(() => {
    const active = contentItems.filter((i) => !isItemDone(i));
    const done = contentItems.filter((i) => isItemDone(i));
    return [...active, ...done];
  }, [contentItems, isItemDone]);

  const toggleItemComplete = async (item: ContentItem) => {
    const nowCompleted = !item.completed;
    const { error } = await supabase
      .from('content_items')
      .update({
        completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update item');
      return;
    }

    setContentItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null }
          : i
      )
    );
    toast.success(nowCompleted ? 'Marked as done' : 'Marked as active');
  };

  const getStatusName = (statusId: string | null) => {
    if (!statusId) return null;
    return boardColumns.find((col) => col.id === statusId);
  };

  const getContentType = (typeId: string | null) => {
    if (!typeId) return null;
    return contentTypes.find((ct) => ct.id === typeId);
  };

  const toggleSubtask = async (subtask: SubtaskWithParent) => {
    const { error } = await supabase
      .from('subtasks')
      .update({ completed: true })
      .eq('id', subtask.id);

    if (error) {
      toast.error('Failed to complete subtask');
      return;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      content_item_id: subtask.content_item_id,
      user_id: user?.id || null,
      action: `completed subtask "${subtask.title}"`,
      metadata: { subtask_id: subtask.id },
    });

    toast.success('Subtask completed');
    setSubtasks((prev) => prev.filter((st) => st.id !== subtask.id));
  };

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
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Personal Tasks — always visible */}
      <PersonalTasksSection workspaceId={currentWorkspace.id} />

      {/* My Content Items */}
      {sortedItems.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">My Content Items</h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {sortedItems.length}
                </span>
              </div>

              <div className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-10 px-3 py-2.5"></th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedItems.map((item) => {
                      const ct = getContentType(item.content_type_id);
                      const status = getStatusName(item.status);
                      const done = isItemDone(item);
                      const isOverdue =
                        !done &&
                        item.due_date &&
                        isPast(parseLocalDate(item.due_date)) &&
                        !isToday(parseLocalDate(item.due_date));

                      const isOrdinal = isOrdinalItem(item);
                      const isLinear = isLinearItem(item);

                      // Determine row background: done → blue, ordinal/linear → tint, default → none
                      const rowBg = done
                        ? DONE_BG
                        : isOrdinal
                          ? `${ORDINAL_COLOR}0A`
                          : isLinear
                            ? `${LINEAR_COLOR}0A`
                            : undefined;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`cursor-pointer transition-colors ${done ? 'hover:brightness-95' : 'hover:bg-slate-50'}`}
                          style={rowBg ? { backgroundColor: rowBg } : {}}
                        >
                          {/* Complete toggle */}
                          <td className="px-3 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemComplete(item);
                              }}
                              className={`flex-shrink-0 transition-colors ${
                                done
                                  ? 'text-blue-500 hover:text-blue-600'
                                  : 'text-slate-300 hover:text-blue-500'
                              }`}
                              title={done ? 'Mark as active' : 'Mark as done'}
                            >
                              {done ? (
                                <CheckSquare className="w-4.5 h-4.5" />
                              ) : (
                                <Square className="w-4.5 h-4.5" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                {item.title}
                              </span>
                              {granolaItemIds.has(item.id) && (
                                <Mic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#345A11' }} title="Has meeting notes" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {ct && (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: ct.color ?? undefined }}
                                />
                                <span className={`text-sm ${done ? 'text-slate-400' : 'text-slate-600'}`}>{ct.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {status && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${status.color ?? '#94a3b8'}20`,
                                  color: status.color ?? undefined,
                                }}
                              >
                                {status.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.due_date ? (
                              <span
                                className={`flex items-center gap-1 text-sm ${
                                  isOverdue ? 'text-red-600 font-medium' : done ? 'text-slate-400' : 'text-slate-600'
                                }`}
                              >
                                {isOverdue && <AlertCircle className="w-3.5 h-3.5" />}
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatDate(item.due_date)}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${priorityColors[item.priority ?? 'medium']}`} />
                              <span className={`text-sm ${done ? 'text-slate-400' : 'text-slate-600'}`}>{priorityLabels[item.priority ?? 'medium']}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* My Subtasks */}
          {subtasks.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <ListChecks className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">My Subtasks</h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {subtasks.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {subtasks.map((subtask) => {
                  const isOverdue =
                    subtask.due_date &&
                    isPast(parseLocalDate(subtask.due_date)) &&
                    !isToday(parseLocalDate(subtask.due_date));

                  return (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSubtask(subtask)}
                        className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      >
                        <Square className="w-4.5 h-4.5" />
                      </button>

                      {/* Subtask title */}
                      <span className="text-sm text-slate-900 flex-1">{subtask.title}</span>

                      {/* Parent item link */}
                      <button
                        onClick={() => setSelectedItemId(subtask.parent_id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0"
                        title="Open parent item"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="max-w-[180px] truncate">{subtask.parent_title}</span>
                      </button>

                      {/* Due date */}
                      {subtask.due_date && (
                        <span
                          className={`flex items-center gap-1 text-xs flex-shrink-0 ${
                            isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {isOverdue && <AlertCircle className="w-3 h-3" />}
                          {formatDate(subtask.due_date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
    </div>
  );
}

export default MyWorkPage;
