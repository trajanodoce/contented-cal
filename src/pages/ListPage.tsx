import { useState, useMemo, useCallback, useRef, useEffect }  from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
// UserRole type inferred from workspace context
import { useContentItems } from '../hooks/useContentItems';
import { useApp } from '../contexts/AppContext';
import { parseLocalDate, pillTextColor, PRIORITY_STYLES, getWorkspaceChannels } from '../lib/utils';
import { getContentType, getBoardColumn, getAssignees, formatDueDateWithStatus, isDoneStatus } from '../lib/itemHelpers';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { BulkActionToolbar } from '../components/list/BulkActionToolbar';
import { RowActionsMenu } from '../components/list/RowActionsMenu';
import { TaskPresenceChip } from '../components/content/TaskPresenceChip';
import { TaskCategoryIcon } from '../components/content/TaskCategoryIcon';
import { CreateItemModal } from '../components/content/CreateItemModal';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, BoardColumn, Profile } from '../lib/database.types';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, ORDINAL_TEXT, LINEAR_COLOR, GRANOLA_COLOR, GRANOLA_TEXT, SLACK_COLOR, INTERNAL_COLOR } from '../lib/ordinal';
import DatePicker from '../components/ui/DatePicker';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { useSubtaskCounts } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts } from '../hooks/useExternalLinkCounts';
import { useTaskLinkCounts } from '../hooks/useTaskLinkCounts';
import { useShowCompleted } from '../hooks/useShowCompleted';
import {
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  FileText,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Check,
  CheckCircle2,
  ListChecks,
  Paperclip,
  Link2,
  Mic,
} from 'lucide-react';
import { Avatar, AvatarStack } from '../components/ui/Avatar';

type SortField =
  | 'title'
  | 'content_type'
  | 'status'
  | 'assignee'
  | 'due_date'
  | 'priority'
  | 'channel'
  | null;

type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

// Priority configuration sourced from PRIORITY_STYLES in lib/utils

export function ListPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const { filters, setFilters, isLoaded } = useFilters();
  const { items: rawItems, loading, error, refetch } = useContentItems();
  const { patchContentItem } = useApp();
  const {
    contentTypes,
    boardColumns,
    members,
    loading: workspaceDataLoading,
  } = useWorkspaceData(currentWorkspace?.id || null);

  const [sort, setSort] = useState<SortState>({ field: 'due_date', direction: 'asc' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const { counts: taskLinkCounts } = useTaskLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);
  // Channels: workspace settings merged with any orphaned values from items
  const channels = useMemo(() => {
    const configured = getWorkspaceChannels(currentWorkspace?.settings);
    const fromItems = rawItems.map((i) => i.channel).filter(Boolean) as string[];
    return [...new Set([...configured, ...fromItems])];
  }, [currentWorkspace?.settings, rawItems]);

  const [showOrdinal, setShowOrdinal] = useState(() => {
    const saved = localStorage.getItem('cc-show-ordinal');
    return saved !== null ? saved === 'true' : true;
  });
  // Clean up stale localStorage key from old Granola toggle
  useEffect(() => {
    localStorage.removeItem('cc-show-granola');
  }, []);

  const [showCompleted, setShowCompleted] = useShowCompleted('list');

  // Apply filters to items
  const items = useMemo(() => {
    let result = isLoaded ? applyFilters(rawItems, filters, linkCounts) : rawItems;
    if (!showOrdinal) result = result.filter(i => !isOrdinalItem(i));
    if (!showCompleted) {
      result = result.filter(i => !isDoneStatus(getBoardColumn(i.status, boardColumns)?.name));
    }
    return result;
  }, [rawItems, filters, isLoaded, linkCounts, showOrdinal, showCompleted, boardColumns]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sort.field) return items;

    return [...items].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'content_type': {
          const aType = getContentType(a.content_type_id, contentTypes)?.name || '';
          const bType = getContentType(b.content_type_id, contentTypes)?.name || '';
          comparison = aType.localeCompare(bType);
          break;
        }
        case 'status': {
          const aStatus = getBoardColumn(a.status, boardColumns)?.name || '';
          const bStatus = getBoardColumn(b.status, boardColumns)?.name || '';
          comparison = aStatus.localeCompare(bStatus);
          break;
        }
        case 'assignee': {
          const aAssignees = getAssignees(a.assignee_ids || [], members);
          const bAssignees = getAssignees(b.assignee_ids || [], members);
          const aName = aAssignees[0]?.full_name || aAssignees[0]?.email || '';
          const bName = bAssignees[0]?.full_name || bAssignees[0]?.email || '';
          comparison = aName.localeCompare(bName);
          break;
        }
        case 'due_date': {
          const aDate = a.due_date ? parseLocalDate(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? parseLocalDate(b.due_date).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'priority':
          comparison = (a.priority || '').localeCompare(b.priority || '');
          break;
        case 'channel':
          comparison = (a.channel || '').localeCompare(b.channel || '');
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [items, sort, contentTypes, boardColumns, members]);

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)));
    }
  }, [items, selectedItems.size]);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleRowClick = useCallback((item: ContentItem, idx?: number) => {
    setSelectedItemId(item.id);
    if (typeof idx === 'number') setFocusedIndex(idx);
  }, [setSelectedItemId]);

  // Keyboard nav: ArrowUp/Down · Enter to open · Space to toggle select.
  // Scoped to the table container so it doesn't hijack arrow keys in inputs
  // or inline editors elsewhere on the page.
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }
    if (sortedItems.length === 0) return;
    const current = focusedIndex ?? -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(Math.min(current + 1, sortedItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(Math.max(current - 1, 0));
    } else if (e.key === 'Enter' && current >= 0 && current < sortedItems.length) {
      e.preventDefault();
      handleRowClick(sortedItems[current], current);
    } else if (e.key === ' ' && current >= 0 && current < sortedItems.length) {
      e.preventDefault();
      handleSelectItem(sortedItems[current].id);
    }
  }, [focusedIndex, sortedItems, handleRowClick, handleSelectItem]);

  // Keep focusedIndex valid as items change (filter, sort, delete, etc.)
  useEffect(() => {
    if (focusedIndex === null) return;
    if (focusedIndex >= sortedItems.length) {
      setFocusedIndex(sortedItems.length > 0 ? sortedItems.length - 1 : null);
    }
  }, [sortedItems.length, focusedIndex]);

  const handleItemUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  const isAllSelected = items.length > 0 && selectedItems.size === items.length;
  const isIndeterminate = selectedItems.size > 0 && selectedItems.size < items.length;

  if (loading || workspaceDataLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Error loading content</h3>
            <p className="text-slate-500 mt-1">{error.message}</p>
            <button
              onClick={refetch}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — only when workspace has zero raw items. If raw > 0 but
  // filtered = 0, fall through to render the FilterBar so users can clear
  // their filters (otherwise they'd see "Create your first item" CTA with
  // 106 items hiding behind an active filter — confusing).
  if (rawItems.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">No content items yet</h2>
            <p className="text-slate-500 mb-6">
              Get started by creating your first content item. You can organize it by type, assign it to team members, and track its progress.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first item
            </button>
          </div>
        </div>
        <CreateItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      {/* FilterBar */}
      <FilterBar
        workspaceId={currentWorkspace?.id || null}
        contentTypes={contentTypes}
        boardColumns={boardColumns}
        members={members}
        channels={channels}
        linkCounts={linkCounts}
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={rawItems.length}
        filteredCount={items.length}
      />

      <div className="flex items-center justify-end gap-2 mt-3 mb-1">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
          style={{
            borderColor: showCompleted ? '#357254' : '#e2e8f0',
            backgroundColor: showCompleted ? '#EAF4EF' : '#F7F9FC',
            color: showCompleted ? '#357254' : '#64748b',
          }}
          title={showCompleted ? 'Hide completed/published tasks' : 'Show completed/published tasks'}
        >
          <div
            className="relative w-8 h-[18px] rounded-full transition-colors"
            style={{ backgroundColor: showCompleted ? '#357254' : '#CBD5E1' }}
          >
            <div
              className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform"
              style={{ left: showCompleted ? '18px' : '2px' }}
            />
          </div>
          Done
        </button>
        <button
          onClick={() => {
            setShowOrdinal(prev => {
              const next = !prev;
              localStorage.setItem('cc-show-ordinal', String(next));
              return next;
            });
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
          style={{
            borderColor: showOrdinal ? '#C4B5FD' : '#e2e8f0',
            backgroundColor: showOrdinal ? '#F5F3FF' : '#F7F9FC',
            color: showOrdinal ? ORDINAL_TEXT : '#64748b',
          }}
          title={showOrdinal ? 'Hide Ordinal posts' : 'Show Ordinal posts'}
        >
          <div
            className="relative w-8 h-[18px] rounded-full transition-colors"
            style={{ backgroundColor: showOrdinal ? ORDINAL_TEXT : '#CBD5E1' }}
          >
            <div
              className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform"
              style={{ left: showOrdinal ? '18px' : '2px' }}
            />
          </div>
          Ordinal
        </button>
      </div>

      {/* Bulk Actions Floating Toolbar */}
      {selectedItems.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedItems.size}
          selectedIds={Array.from(selectedItems)}
          members={members}
          boardColumns={boardColumns}
          onClear={() => setSelectedItems(new Set())}
          onUpdate={handleItemUpdated}
        />
      )}

      {/* Table */}
      <div
        className="bg-surface-card rounded-lg overflow-hidden focus:outline-none"
        style={{ border: '1.5px solid #002339' }}
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead
              className="sticky top-0 z-10"
              style={{ background: '#F7F9FC', borderBottom: '1.5px solid #00233980' }}
            >
              <tr>
                <th className="px-4 py-3 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-[#005D9710] rounded transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-5 h-5 text-brand-600" />
                    ) : isIndeterminate ? (
                      <div className="w-5 h-5 bg-brand-600 rounded flex items-center justify-center">
                        <div className="w-3 h-0.5 bg-white" />
                      </div>
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </th>
                <SortHeader label="Title" field="title" sort={sort} onSort={handleSort} />
                <SortHeader label="Type" field="content_type" sort={sort} onSort={handleSort} />
                <SortHeader label="Status" field="status" sort={sort} onSort={handleSort} />
                <SortHeader label="Owner" field="assignee" sort={sort} onSort={handleSort} />
                <SortHeader label="Due Date" field="due_date" sort={sort} onSort={handleSort} />
                <SortHeader label="Priority" field="priority" sort={sort} onSort={handleSort} />
                <SortHeader label="Channel" field="channel" sort={sort} onSort={handleSort} />
                <th className="px-2 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <p className="text-sm text-slate-500 font-medium mb-2">No items match your filters</p>
                    <p className="text-xs text-slate-400 mb-4">{rawItems.length} item{rawItems.length === 1 ? '' : 's'} hidden by the current filters</p>
                    <button
                      onClick={() => {
                        setFilters({
                          search: '',
                          contentTypes: [],
                          statuses: [],
                          assignees: [],
                          priorities: [],
                          channels: [],
                          projects: [],
                          linkedPlatforms: [],
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg text-accent-crimson hover:bg-[#BA2C2C08] transition-colors"
                      style={{ border: '1px solid #BA2C2C30' }}
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
              {sortedItems.map((item, idx) => {
                const isSelected = selectedItems.has(item.id);
                const isFocused = focusedIndex === idx;
                const contentType = getContentType(item.content_type_id, contentTypes);
                const status = getBoardColumn(item.status, boardColumns);
                const isDone = isDoneStatus(status?.name);
                const assignees = getAssignees(item.assignee_ids || [], members);
                const dueDate = formatDueDateWithStatus(item.due_date);
                if (isDone) dueDate.isOverdue = false;
                const priority = PRIORITY_STYLES[item.priority ?? 'medium'] ?? PRIORITY_STYLES.medium;

                const isOrdinal = isOrdinalItem(item);
                const isLinear = isLinearItem(item);
                const hasGranola = granolaItemIds.has(item.id);
                const customFields = item.custom_fields as Record<string, unknown> | null;
                const isSlackSource = customFields?._source === 'slack';
                // Source-color left bar (canonical Draft 5.1) — replaces the v1 bg tint.
                // Urgent state overrides with delete-red.
                const sourceLeftBarColor = isOrdinal
                  ? ORDINAL_COLOR
                  : isLinear
                    ? LINEAR_COLOR
                    : hasGranola
                      ? GRANOLA_COLOR
                      : isSlackSource
                        ? SLACK_COLOR
                        : INTERNAL_COLOR;
                const isBlocked = status?.name?.toLowerCase() === 'blocked';
                const isUrgentRow = isBlocked || (dueDate.isOverdue && !isDone);
                const leftBarColor = isUrgentRow ? '#BA2C2C' : sourceLeftBarColor;

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item, idx)}
                    className={`group cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#005D9710]' : 'hover:bg-[#005D9718]'
                    } ${isDone ? 'opacity-60' : ''}`}
                    style={
                      isFocused
                        ? { outline: '2px solid #005D97', outlineOffset: '-2px' }
                        : undefined
                    }
                  >
                    <td
                      className="px-4 py-3"
                      style={{ borderLeft: `3px solid ${leftBarColor}` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleSelectItem(item.id)}
                        className="p-1 hover:bg-[#005D9710] rounded transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-brand-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[400px]">
                      <div className="flex items-center gap-2">
                        <TaskCategoryIcon category={item.category} />
                        {isDone && (
                          <span title="Completed" className="inline-flex flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#357254' }} />
                          </span>
                        )}
                        {isUrgentRow && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: '#BA2C2C' }}
                          />
                        )}
                        <span className={`${isUrgentRow ? 'font-bold' : 'font-medium'} ${isDone ? 'text-slate-500' : 'text-slate-900'} truncate max-w-[320px]`}>{item.title}</span>
                        {granolaItemIds.has(item.id) && (
                          <span title="Has meeting notes" className="flex-shrink-0 inline-flex">
                            <Mic className="w-3.5 h-3.5" style={{ color: GRANOLA_TEXT }} />
                          </span>
                        )}
                        {subtaskCounts.get(item.id) && subtaskCounts.get(item.id)!.total > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#005D97' }}>
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>{subtaskCounts.get(item.id)!.completed}/{subtaskCounts.get(item.id)!.total}</span>
                          </span>
                        )}
                        {linkCounts.get(item.id) && linkCounts.get(item.id)!.count > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold"
                            style={{ color: '#005D97' }}
                            title={`${linkCounts.get(item.id)!.count} attachment${linkCounts.get(item.id)!.count !== 1 ? 's' : ''}`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {linkCounts.get(item.id)!.count}
                          </span>
                        )}
                        {taskLinkCounts.get(item.id) && taskLinkCounts.get(item.id)! > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold"
                            style={{ color: '#B8447A' }}
                            title={`${taskLinkCounts.get(item.id)} linked task${taskLinkCounts.get(item.id) !== 1 ? 's' : ''}`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            {taskLinkCounts.get(item.id)}
                          </span>
                        )}
                        <TaskPresenceChip taskId={item.id} variant="inline-dot" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contentType && (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: contentType.color ?? undefined }}
                          />
                          <span className="text-sm text-slate-600">{contentType.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <InlineStatusEdit
                          statusId={item.status}
                          boardColumns={boardColumns}
                          contentItemId={item.id}
                          onUpdate={handleItemUpdated}
                        />
                      ) : (
                        status && (() => {
                          const base = status.color ?? '#94a3b8';
                          const dark = pillTextColor(base);
                          return (
                          <span
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                            style={{ backgroundColor: `${base}55`, color: dark, border: `0.5px solid ${dark}` }}
                          >
                            {status.name}
                          </span>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <InlineAssigneeEdit
                          assigneeIds={item.assignee_ids || []}
                          members={members}
                          contentItemId={item.id}
                          onUpdate={handleItemUpdated}
                        />
                      ) : (
                        <div className="flex -space-x-2">
                          {assignees.length === 0 ? (
                            <span className="text-slate-400 text-sm">-</span>
                          ) : (
                            <AvatarStack
                              users={assignees.map(a => ({ src: a.avatar_url, name: a.full_name }))}
                              size="md"
                              max={3}
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <InlineDueDateEdit
                          dueDate={item.due_date}
                          contentItemId={item.id}
                          isDone={isDone}
                          onUpdate={handleItemUpdated}
                          patchItem={patchContentItem}
                        />
                      ) : (
                        <span className={`text-sm ${dueDate.isOverdue ? 'text-accent-crimson font-medium' : dueDate.isSoon ? 'text-amber-600' : 'text-slate-600'}`}>
                          {dueDate.text}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <InlinePriorityEdit
                          priority={item.priority}
                          contentItemId={item.id}
                          onUpdate={handleItemUpdated}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${priority.dot}`} />
                          <span className="text-sm text-slate-700">{priority.label}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{item.channel || '-'}</span>
                    </td>
                    <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        item={item}
                        onOpen={() => handleRowClick(item, idx)}
                        onUpdate={handleItemUpdated}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Inline Status Edit Component
function InlineStatusEdit({
  statusId,
  boardColumns,
  contentItemId,
  onUpdate,
}: {
  statusId: string | null;
  boardColumns: BoardColumn[];
  contentItemId: string;
  onUpdate: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentColumn = boardColumns.find((bc) => bc.id === statusId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleStatusChange(newStatusId: string) {
    setIsOpen(false);
    if (newStatusId === statusId) return;

    const { error } = await supabase
      .from('content_items')
      .update({ status: newStatusId })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update status: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const newStatus = boardColumns.find((bc) => bc.id === newStatusId);
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed status to ${newStatus?.name || 'None'}`,
      metadata: { oldStatus: statusId, newStatus: newStatusId },
    });

    toast.success('Status updated');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: currentColumn?.color ? `${currentColumn.color}55` : '#f1f5f9',
          color: currentColumn?.color ? pillTextColor(currentColumn.color) : '#64748b',
          border: currentColumn?.color ? `0.5px solid ${pillTextColor(currentColumn.color)}` : undefined,
        }}
      >
        {currentColumn?.name || 'None'}
        <ChevronDown className="w-3 h-3 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-surface-card rounded-xl shadow-lg min-w-[150px]" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9718 0%, transparent 50%), #ffffff' }}>
          {[...boardColumns]
            .sort((a, b) => a.position - b.position)
            .map((column) => (
              <button
                key={column.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(column.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9718] flex items-center gap-2 ${
                  column.id === statusId ? 'bg-brand-50' : ''
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: column.color ?? undefined }}
                />
                <span className={column.id === statusId ? 'text-brand-900 font-medium' : 'text-slate-700'}>
                  {column.name}
                </span>
                {column.id === statusId && <Check className="w-4 h-4 ml-auto text-brand-600" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Inline Priority Edit Component
function InlinePriorityEdit({
  priority,
  contentItemId,
  onUpdate,
}: {
  priority: string | null;
  contentItemId: string;
  onUpdate: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPriority = PRIORITY_STYLES[priority ?? 'medium'] ?? PRIORITY_STYLES.medium;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handlePriorityChange(newPriority: string) {
    setIsOpen(false);
    if (newPriority === priority) return;

    const { error } = await supabase
      .from('content_items')
      .update({ priority: newPriority as 'low' | 'medium' | 'high' | 'urgent' })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update priority: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const priorityLabel = PRIORITY_STYLES[newPriority]?.label || newPriority;
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed priority to ${priorityLabel}`,
      metadata: { oldPriority: priority, newPriority },
    });

    toast.success('Priority updated');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${currentPriority.dot}`} />
        <span className="text-sm text-slate-700">{currentPriority.label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-surface-card rounded-xl shadow-lg min-w-[120px]" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9718 0%, transparent 50%), #ffffff' }}>
          {Object.entries(PRIORITY_STYLES).map(([key, ps]) => (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                handlePriorityChange(key);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9718] flex items-center gap-2 ${
                key === priority ? 'bg-brand-50' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${ps.dot}`} />
              <span className={key === priority ? 'text-brand-900 font-medium' : 'text-slate-700'}>
                {ps.label}
              </span>
              {key === priority && <Check className="w-4 h-4 ml-auto text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline Assignee Edit Component
function InlineAssigneeEdit({
  assigneeIds,
  members,
  contentItemId,
  onUpdate,
}: {
  assigneeIds: string[];
  members: Profile[];
  contentItemId: string;
  onUpdate: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedMembers = members.filter((m) => assigneeIds.includes(m.id));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggleAssignee(memberId: string) {
    const isSelected = assigneeIds.includes(memberId);
    const newAssigneeIds = isSelected
      ? assigneeIds.filter((id) => id !== memberId)
      : [...assigneeIds, memberId];

    const { error } = await supabase
      .from('content_items')
      .update({ assignee_ids: newAssigneeIds })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update assignees: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    const member = members.find((m) => m.id === memberId);
    const action = isSelected
      ? `removed ${member?.full_name || member?.email || 'assignee'}`
      : `assigned to ${member?.full_name || member?.email || 'member'}`;

    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action,
      metadata: { assigneeId: memberId, assigneeIds: newAssigneeIds },
    });

    toast.success(isSelected ? 'Assignee removed' : 'Assignee added');
    onUpdate();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex -space-x-2 hover:opacity-80 transition-opacity"
      >
        {selectedMembers.length === 0 ? (
          <span className="text-slate-400 text-sm">-</span>
        ) : selectedMembers.length === 1 ? (
          <Avatar src={selectedMembers[0].avatar_url} name={selectedMembers[0].full_name} size="lg" />
        ) : (
          <AvatarStack
            users={selectedMembers.map(a => ({ src: a.avatar_url, name: a.full_name }))}
            size="lg"
            max={3}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-surface-card rounded-xl shadow-lg min-w-[180px] p-2" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9718 0%, transparent 50%), #ffffff' }}>
          {members.map((member) => {
            const isSelected = assigneeIds.includes(member.id);
            return (
              <button
                key={member.id}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAssignee(member.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#005D9718] flex items-center gap-3 rounded ${
                  isSelected ? 'bg-brand-50' : ''
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <Avatar src={member.avatar_url} name={member.full_name} size="md" />
                <span className={isSelected ? 'text-brand-900' : 'text-slate-700'}>
                  {member.full_name || member.email || 'Unknown'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline Due Date Edit Component
function InlineDueDateEdit({
  dueDate,
  contentItemId,
  onUpdate,
  patchItem,
}: {
  dueDate: string | null;
  contentItemId: string;
  isDone?: boolean;
  onUpdate: () => void;
  patchItem: (id: string, fields: Record<string, unknown>) => void;
}) {
  async function handleChange(newDate: string) {
    if (newDate === (dueDate || '')) return;

    // Optimistic update — immediately reflect in UI
    patchItem(contentItemId, { due_date: newDate || null });

    const { error } = await supabase
      .from('content_items')
      .update({ due_date: newDate || null })
      .eq('id', contentItemId);

    if (error) {
      // Revert on failure
      patchItem(contentItemId, { due_date: dueDate });
      toast.error('Failed to update due date: ' + error.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed due date to ${newDate || 'none'}`,
      metadata: { oldDueDate: dueDate, newDueDate: newDate },
    });

    toast.success('Due date updated');
    onUpdate();
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DatePicker
        value={dueDate}
        onChange={handleChange}
        placeholder="Set due date"
      />
    </div>
  );
}

// Sort header component
function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: SortField;
  sort: SortState;
  onSort: (field: SortField) => void;
}) {
  const isActive = sort.field === field;

  return (
    <th className="group px-4 py-3 text-left">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
      >
        {label}
        {isActive ? (
          sort.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </button>
    </th>
  );
}