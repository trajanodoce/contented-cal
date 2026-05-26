import { useState, useMemo, useCallback, useRef, useEffect }  from 'react';
import { isPast, isToday, isTomorrow } from 'date-fns';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
// UserRole type inferred from workspace context
import { useContentItems } from '../hooks/useContentItems';
import { parseLocalDate, formatDate } from '../lib/utils';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { BulkActionsToolbar } from '../components/content/BulkActionsToolbar';
import { CreateItemModal } from '../components/content/CreateItemModal';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, BoardColumn, Profile } from '../lib/database.types';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR } from '../lib/ordinal';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { useSubtaskCounts } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts } from '../hooks/useExternalLinkCounts';
import {
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  FileText,
  AlertCircle,
  ChevronDown,
  Check,
  User,
  ListChecks,
  Link2,
  Mic,
} from 'lucide-react';

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

// Helper to get content type info
function getContentType(
  contentTypeId: string | null,
  contentTypes: ContentType[]
): ContentType | null {
  if (!contentTypeId) return null;
  return contentTypes.find((ct) => ct.id === contentTypeId) || null;
}

// Helper to get board column info
function getBoardColumn(
  statusId: string | null,
  boardColumns: BoardColumn[]
): BoardColumn | null {
  if (!statusId) return null;
  return boardColumns.find((bc) => bc.id === statusId) || null;
}

// Helper to get assignee profiles
function getAssignees(assigneeIds: string[], members: Profile[]): Profile[] {
  return assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Profile => m !== undefined);
}

// Helper to format due date with status
function formatDueDateWithStatus(date: string | null): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!date) return { text: '-', isOverdue: false, isSoon: false };

  const dueDate = parseLocalDate(date);
  const overdue = isPast(dueDate) && !isToday(dueDate);
  const soon = isToday(dueDate) || isTomorrow(dueDate);

  return {
    text: formatDate(date),
    isOverdue: overdue,
    isSoon: soon,
  };
}

// Priority configuration
const priorityConfig = {
  urgent: { color: 'bg-red-500', label: 'Urgent', dotColor: 'bg-red-500' },
  high: { color: 'bg-orange-500', label: 'High', dotColor: 'bg-orange-500' },
  medium: { color: 'bg-yellow-500', label: 'Medium', dotColor: 'bg-yellow-500' },
  low: { color: 'bg-gray-400', label: 'Low', dotColor: 'bg-gray-400' },
};

export function ListPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const { filters, setFilters, isLoaded } = useFilters();
  const { items: rawItems, loading, error, refetch } = useContentItems({
    workspaceId: currentWorkspace?.id || null,
  });
  const {
    contentTypes,
    boardColumns,
    members,
    loading: workspaceDataLoading,
  } = useWorkspaceData(currentWorkspace?.id || null);

  const [sort, setSort] = useState<SortState>({ field: 'due_date', direction: 'asc' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);
  const [channels, setChannels] = useState<string[]>([]);

  // Extract unique channels from items
  useEffect(() => {
    if (rawItems.length > 1) {
      const uniqueChannels = [...new Set(rawItems.map((item) => item.channel).filter(Boolean))];
      setChannels(uniqueChannels as string[]);
    }
  }, [rawItems]);

  // Apply filters to items
  const items = useMemo(() => {
    if (!isLoaded) return rawItems;
    return applyFilters(rawItems, filters, linkCounts);
  }, [rawItems, filters, isLoaded, linkCounts]);

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

  const handleRowClick = useCallback((item: ContentItem) => {
    setSelectedItemId(item.id);
  }, [setSelectedItemId]);

  const handleItemUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  const isAllSelected = items.length > 0 && selectedItems.size === items.length;
  const isIndeterminate = selectedItems.size > 0 && selectedItems.size < items.length;

  if (loading || workspaceDataLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
            <h3 className="text-lg font-medium text-gray-900">Error loading content</h3>
            <p className="text-gray-500 mt-1">{error.message}</p>
            <button
              onClick={refetch}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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


      {/* Bulk Actions Floating Toolbar */}
      {selectedItems.size > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedItems.size}
          selectedIds={Array.from(selectedItems)}
          members={members}
          boardColumns={boardColumns}
          onClear={() => setSelectedItems(new Set())}
          onUpdate={handleItemUpdated}
        />
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : isIndeterminate ? (
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
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
                <SortHeader label="Assignee" field="assignee" sort={sort} onSort={handleSort} />
                <SortHeader label="Due Date" field="due_date" sort={sort} onSort={handleSort} />
                <SortHeader label="Priority" field="priority" sort={sort} onSort={handleSort} />
                <SortHeader label="Channel" field="channel" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const contentType = getContentType(item.content_type_id, contentTypes);
                const status = getBoardColumn(item.status, boardColumns);
                const assignees = getAssignees(item.assignee_ids || [], members);
                const dueDate = formatDueDateWithStatus(item.due_date);
                const priority = priorityConfig[(item.priority ?? 'medium') as keyof typeof priorityConfig] || priorityConfig.medium;

                const isOrdinal = isOrdinalItem(item);
                const isLinear = isLinearItem(item);
                const externalBg = isOrdinal ? `${ORDINAL_COLOR}0A` : isLinear ? `${LINEAR_COLOR}0A` : undefined;

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : ''
                    }`}
                    style={externalBg && !isSelected ? { backgroundColor: externalBg } : {}}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSelectItem(item.id)}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{item.title}</span>
                        {granolaItemIds.has(item.id) && (
                          <Mic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#345A11' }} title="Has meeting notes" />
                        )}
                        {subtaskCounts.get(item.id) && subtaskCounts.get(item.id)!.total > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>{subtaskCounts.get(item.id)!.completed}/{subtaskCounts.get(item.id)!.total}</span>
                          </span>
                        )}
                        {linkCounts.get(item.id) && linkCounts.get(item.id)!.count > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-xs text-slate-400"
                            title={`${linkCounts.get(item.id)!.count} linked asset${linkCounts.get(item.id)!.count !== 1 ? 's' : ''}`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            {linkCounts.get(item.id)!.count > 1 && <span>{linkCounts.get(item.id)!.count}</span>}
                          </span>
                        )}
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
                        status && (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${status.color ?? '#94a3b8'}20`, color: status.color ?? undefined }}
                          >
                            {status.name}
                          </span>
                        )
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
                            assignees.slice(0, 3).map((a) => (
                              <div key={a.id} className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs text-slate-600 overflow-hidden">
                                {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-full h-full object-cover" /> : (a.full_name?.[0] || a.email?.[0] || '?').toUpperCase()}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <InlineDueDateEdit
                          dueDate={item.due_date}
                          contentItemId={item.id}
                          onUpdate={handleItemUpdated}
                        />
                      ) : (
                        <span className={`text-sm ${dueDate.isOverdue ? 'text-red-600 font-medium' : dueDate.isSoon ? 'text-amber-600' : 'text-slate-600'}`}>
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
                          <span className={`w-2.5 h-2.5 rounded-full ${priority.dotColor}`} />
                          <span className="text-sm text-slate-700">{priority.label}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{item.channel || '-'}</span>
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
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: currentColumn?.color ? `${currentColumn.color}20` : '#f1f5f9',
          color: currentColumn?.color ?? '#64748b',
        }}
      >
        {currentColumn?.name || 'None'}
        <ChevronDown className="w-3 h-3 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[150px]">
          {[...boardColumns]
            .sort((a, b) => a.position - b.position)
            .map((column) => (
              <button
                key={column.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(column.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                  column.id === statusId ? 'bg-blue-50' : ''
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: column.color ?? undefined }}
                />
                <span className={column.id === statusId ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                  {column.name}
                </span>
                {column.id === statusId && <Check className="w-4 h-4 ml-auto text-blue-600" />}
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
  const currentPriority = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;

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
    const priorityLabel = priorityConfig[newPriority as keyof typeof priorityConfig]?.label || newPriority;
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
        <span className={`w-2.5 h-2.5 rounded-full ${currentPriority.dotColor}`} />
        <span className="text-sm text-slate-700">{currentPriority.label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[120px]">
          {Object.entries(priorityConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                handlePriorityChange(key);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                key === priority ? 'bg-blue-50' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              <span className={key === priority ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                {config.label}
              </span>
              {key === priority && <Check className="w-4 h-4 ml-auto text-blue-600" />}
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
          <>
            {selectedMembers[0].avatar_url ? (
              <img
                src={selectedMembers[0].avatar_url}
                alt={selectedMembers[0].full_name ?? selectedMembers[0].email ?? undefined}
                className="w-8 h-8 rounded-full object-cover border-2 border-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600">
                {(selectedMembers[0].full_name?.[0] || selectedMembers[0].email?.[0] || '?').toUpperCase()}
              </div>
            )}
          </>
        ) : (
          <>
            {selectedMembers.slice(0, 3).map((assignee, i) => (
              <div
                key={assignee.id}
                className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600"
                style={{ zIndex: 3 - i }}
              >
                {assignee.avatar_url ? (
                  <img
                    src={assignee.avatar_url}
                    alt={assignee.full_name ?? assignee.email ?? undefined}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (assignee.full_name?.[0] || assignee.email?.[0] || '?').toUpperCase()
                )}
              </div>
            ))}
            {selectedMembers.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-500">
                +{selectedMembers.length - 3}
              </div>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[180px] p-2">
          {members.map((member) => {
            const isSelected = assigneeIds.includes(member.id);
            return (
              <button
                key={member.id}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAssignee(member.id);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.full_name ?? member.email ?? undefined}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-3 h-3 text-slate-500" />
                  </div>
                )}
                <span className={isSelected ? 'text-blue-900' : 'text-slate-700'}>
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
}: {
  dueDate: string | null;
  contentItemId: string;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(dueDate || '');
  const containerRef = useRef<HTMLDivElement>(null);

  const formatted = formatDueDateWithStatus(dueDate);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isEditing) {
          handleSave();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, tempDate]);

  async function handleSave() {
    setIsEditing(false);
    if (tempDate === (dueDate || '')) return;

    const { error } = await supabase
      .from('content_items')
      .update({ due_date: tempDate || null })
      .eq('id', contentItemId);

    if (error) {
      toast.error('Failed to update due date: ' + error.message);
      return;
    }

    // Log activity
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: contentItemId,
      user_id: user?.id || null,
      action: `changed due date to ${tempDate || 'none'}`,
      metadata: { oldDueDate: dueDate, newDueDate: tempDate },
    });

    toast.success('Due date updated');
    onUpdate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempDate(dueDate || '');
    }
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className="inline-block">
        <input
          type="date"
          value={tempDate}
          onChange={(e) => setTempDate(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`text-sm hover:opacity-70 transition-opacity ${
        formatted.isOverdue
          ? 'text-red-600 font-medium'
          : formatted.isSoon
            ? 'text-amber-600'
            : 'text-slate-600'
      }`}
    >
      {formatted.text}
    </button>
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
    <th className="px-4 py-3 text-left">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
      >
        {label}
        {isActive ? (
          sort.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
        )}
      </button>
    </th>
  );
}