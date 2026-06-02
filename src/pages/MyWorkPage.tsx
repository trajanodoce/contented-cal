import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useFilters } from '../contexts/FiltersContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, Subtask } from '../lib/database.types';
import { isPast, isToday } from 'date-fns';
import { parseLocalDate, formatDate, pillTextColor, PRIORITY_STYLES, getWorkspaceChannels } from '../lib/utils';
import { isDoneStatus } from '../lib/itemHelpers';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR, GRANOLA_TEXT } from '../lib/ordinal';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { PersonalTasksSection } from '../components/personal/PersonalTasksSection';
import { MentionsPanel } from '../components/personal/MentionsPanel';
import {
  Calendar,
  AlertCircle,
  Square,
  ListChecks,
  ExternalLink,
  Loader2,
  Mic,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';

// Priority colors now sourced from PRIORITY_STYLES in lib/utils

const priorityLabels: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type SortField = 'title' | 'type' | 'status' | 'due_date' | 'priority';
type SortDirection = 'asc' | 'desc';

const priorityWeight: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface SubtaskWithParent extends Subtask {
  parent_title: string;
  parent_id: string;
}

export function MyWorkPage() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { contentTypes, boardColumns, members, projects, contentItems, contentItemsLoading } = useApp();
  const { filters, setFilters, isLoaded } = useFilters();
  const { setSelectedItemId } = useSelectedItem();

  const [subtasks, setSubtasks] = useState<SubtaskWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const myItems = useMemo(
    () => (user ? contentItems.filter((i) => i.assignee_ids?.includes(user.id)) : []),
    [contentItems, user],
  );
  const channels = useMemo(() => {
    const configured = getWorkspaceChannels(currentWorkspace?.settings);
    const fromItems = myItems.map((i) => i.channel).filter(Boolean) as string[];
    return [...new Set([...configured, ...fromItems])];
  }, [currentWorkspace?.settings, myItems]);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    try {
      // Fetch subtasks assigned to current user (incomplete)
      // We need to join with content_items to get parent title
      const { data: mySubtasks } = await supabase
        .from('subtasks')
        .select('*, content_items!inner(id, title, workspace_id)')
        .eq('assignee_id', user.id)
        .eq('completed', false)
        .eq('content_items.workspace_id', currentWorkspace.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
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

  // Apply filters to items
  const filteredItems = useMemo(() => {
    if (!isLoaded) return myItems;
    return applyFilters(myItems, filters);
  }, [myItems, filters, isLoaded]);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const DONE_BG = '#DCEDF4';

  // Columns treated as "done" — Published or Completed
  const doneColumnIds = useMemo(() => {
    return new Set(
      boardColumns
        .filter(c => isDoneStatus(c.name))
        .map(c => c.id)
    );
  }, [boardColumns]);

  // An item is "done" if explicitly completed OR its status is Published/Completed
  const isItemDone = useCallback(
    (item: ContentItem) => item.completed || (item.status != null && doneColumnIds.has(item.status)),
    [doneColumnIds],
  );

  // Build a board column position lookup for status sorting
  const columnPositionMap = useMemo(() => {
    const map = new Map<string, number>();
    boardColumns.forEach((col, idx) => map.set(col.id, idx));
    return map;
  }, [boardColumns]);

  const compareItems = useCallback(
    (a: ContentItem, b: ContentItem): number => {
      if (!sortField) return 0;
      const dir = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'title':
          return dir * (a.title ?? '').localeCompare(b.title ?? '');
        case 'type': {
          const aName = contentTypes.find(ct => ct.id === a.content_type_id)?.name ?? '';
          const bName = contentTypes.find(ct => ct.id === b.content_type_id)?.name ?? '';
          return dir * aName.localeCompare(bName);
        }
        case 'status': {
          const aPos = columnPositionMap.get(a.status ?? '') ?? 999;
          const bPos = columnPositionMap.get(b.status ?? '') ?? 999;
          return dir * (aPos - bPos);
        }
        case 'due_date': {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return dir * (aDate - bDate);
        }
        case 'priority': {
          const aW = priorityWeight[a.priority ?? 'medium'] ?? 2;
          const bW = priorityWeight[b.priority ?? 'medium'] ?? 2;
          return dir * (aW - bW);
        }
        default:
          return 0;
      }
    },
    [sortField, sortDirection, contentTypes, columnPositionMap],
  );

  // Sort: active items first, then completed/published items, with column sort within each group
  const sortedItems = useMemo(() => {
    const active = filteredItems.filter((i) => !isItemDone(i));
    const done = filteredItems.filter((i) => isItemDone(i));
    if (sortField) {
      active.sort(compareItems);
      done.sort(compareItems);
    }
    return [...active, ...done];
  }, [filteredItems, isItemDone, sortField, compareItems]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Clear sort
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-brand-600" />
      : <ArrowDown className="w-3 h-3 text-brand-600" />;
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

  if (loading || contentItemsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* FilterBar */}
      <FilterBar
        workspaceId={currentWorkspace?.id || null}
        contentTypes={contentTypes}
        boardColumns={boardColumns}
        members={members.map(m => ({ id: m.user_id, full_name: m.full_name ?? '', email: m.email ?? '', avatar_url: m.avatar_url ?? null }))}
        channels={channels}
        projects={projects.map(p => ({ id: p.id, label: p.title }))}
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={myItems.length}
        filteredCount={filteredItems.length}
      />

      {/* Mentions + alerts — hidden when zero */}
      <MentionsPanel onOpenItem={setSelectedItemId} />

      {/* Personal Tasks — always visible */}
      <PersonalTasksSection workspaceId={currentWorkspace.id} />

      {/* My Tasks */}
      {sortedItems.length > 0 && (
            <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
              <div className="cc-banner-section-header flex items-center gap-2 border-b border-slate-100">
                <h2 className="text-base font-heading" style={{ color: '#002339' }}>My Tasks</h2>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,35,57,.12)', color: '#002339' }}
                >
                  {sortedItems.length}
                </span>
              </div>

              <div className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#005D9712] border-b border-slate-200">
                    <tr>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
                        onClick={() => handleSort('title')}
                      >
                        <span className="inline-flex items-center gap-1">Title <SortIcon field="title" /></span>
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
                        onClick={() => handleSort('type')}
                      >
                        <span className="inline-flex items-center gap-1">Type <SortIcon field="type" /></span>
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span>
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
                        onClick={() => handleSort('due_date')}
                      >
                        <span className="inline-flex items-center gap-1">Due Date <SortIcon field="due_date" /></span>
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
                        onClick={() => handleSort('priority')}
                      >
                        <span className="inline-flex items-center gap-1">Priority <SortIcon field="priority" /></span>
                      </th>
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
                          className={`cursor-pointer transition-colors ${done ? 'hover:brightness-95' : 'hover:bg-[#005D9718]'}`}
                          style={rowBg ? { backgroundColor: rowBg } : {}}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                {item.title}
                              </span>
                              {granolaItemIds.has(item.id) && (
                                <Mic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GRANOLA_TEXT }} title="Has meeting notes" />
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
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: `${status.color ?? '#94a3b8'}55`,
                                  color: pillTextColor(status.color ?? '#94a3b8'),
                                  border: `0.5px solid ${pillTextColor(status.color ?? '#94a3b8')}`,
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
                                  isOverdue ? 'text-accent-crimson font-medium' : done ? 'text-slate-400' : 'text-slate-600'
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
                              <span className={`w-2 h-2 rounded-full ${PRIORITY_STYLES[item.priority ?? 'medium']?.dot}`} />
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
            <section className="bg-surface-card rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid #00233930' }}>
              <div className="cc-banner-section-header flex items-center gap-2 border-b border-slate-100">
                <ListChecks className="w-3.5 h-3.5" style={{ color: '#002339' }} />
                <h2 className="text-base font-heading" style={{ color: '#002339' }}>My Subtasks</h2>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,35,57,.12)', color: '#002339' }}
                >
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
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#005D9718] transition-colors"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSubtask(subtask)}
                        className="p-0.5 text-slate-400 hover:text-brand-600 transition-colors flex-shrink-0"
                      >
                        <Square className="w-4.5 h-4.5" />
                      </button>

                      {/* Subtask title */}
                      <span className="text-sm text-slate-900 flex-1">{subtask.title}</span>

                      {/* Parent item link */}
                      <button
                        onClick={() => setSelectedItemId(subtask.parent_id)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium flex-shrink-0"
                        title="Open parent item"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="max-w-[180px] truncate">{subtask.parent_title}</span>
                      </button>

                      {/* Due date */}
                      {subtask.due_date && (
                        <span
                          className={`flex items-center gap-1 text-xs flex-shrink-0 ${
                            isOverdue ? 'text-accent-crimson font-medium' : 'text-slate-500'
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
