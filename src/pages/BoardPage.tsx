import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { useApp } from '../contexts/AppContext';
import { FilteredEmptyState } from '../components/FilteredEmptyState';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, BoardColumn, Profile } from '../lib/database.types';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { useSubtaskCounts, SubtaskCount } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts, LinkInfo } from '../hooks/useExternalLinkCounts';
import { useTaskLinkCounts } from '../hooks/useTaskLinkCounts';
import {
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Mic,
  Inbox,
} from 'lucide-react';
import { AvatarStack } from '../components/ui/Avatar';
import { AssetIndicator, LinkedTaskIndicator } from '../components/content/CardIndicators';
import { isPast, isToday } from 'date-fns';
import { parseLocalDate, formatDate, getWorkspaceChannels } from '../lib/utils';
import { isDoneStatus } from '../lib/itemHelpers';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR, GRANOLA_COLOR, GRANOLA_TEXT, SLACK_COLOR, INTERNAL_COLOR } from '../lib/ordinal';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { useShowCompleted } from '../hooks/useShowCompleted';
import { TaskPresenceChip } from '../components/content/TaskPresenceChip';
import { TaskCategoryIcon } from '../components/content/TaskCategoryIcon';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DragGhost, BoardSourcePlaceholder } from '../components/dnd/DndPrimitives';
import { PRIORITY_STYLES } from '../lib/utils';

// Priority colors sourced from canonical PRIORITY_STYLES (lib/utils.ts) so
// board cards, list rows, calendar event chips, and detail pills all match.

interface BoardCardProps {
  item: ContentItem;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  subtaskCount?: SubtaskCount;
  linkInfo?: LinkInfo;
  taskLinkCount?: number;
  hasGranolaNotes?: boolean;
  isOverlay?: boolean;
  onClick: () => void;
}

function BoardCard({ item, contentTypes, boardColumns, members, subtaskCount, linkInfo, taskLinkCount, hasGranolaNotes, isOverlay, onClick }: BoardCardProps) {
  const contentType = contentTypes.find((ct) => ct.id === item.content_type_id);
  const itemMembers = members.filter((m) => item.assignee_ids?.includes(m.id));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  const statusCol = boardColumns.find(c => c.id === item.status);
  const isDone = isDoneStatus(statusCol?.name);
  const isOverdue = item.due_date && isPast(parseLocalDate(item.due_date)) && !isToday(parseLocalDate(item.due_date)) && !isDone;
  const isOrdinal = isOrdinalItem(item);
  const isLinear = isLinearItem(item);
  const customFields = item.custom_fields as Record<string, unknown> | null;
  const isSlackSource = customFields?._source === 'slack';
  // 3px source-color left border (canonical Draft 5.2) — replaces v1 bg tint.
  const sourceLeftBarColor = isOrdinal ? ORDINAL_COLOR
    : isLinear ? LINEAR_COLOR
    : hasGranolaNotes ? GRANOLA_COLOR
    : isSlackSource ? SLACK_COLOR
    : INTERNAL_COLOR;

  if (isDragging && !isOverlay) {
    return (
      <div ref={setNodeRef} style={style}>
        <BoardSourcePlaceholder height={96} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-surface-card rounded-lg shadow-xs border cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        isOverlay ? 'cursor-grabbing' : ''
      } ${isDone ? 'opacity-60' : ''}`}
      style={{
        ...style,
        padding: '10px 12px',
        borderColor: 'rgb(var(--color-brand-900) / 0.188)',
        borderLeft: `3px solid ${sourceLeftBarColor}`,
      }}
    >
      {/* Title */}
      <div className="flex items-start gap-1.5 mb-2">
        <span className="flex-shrink-0 mt-0.5">
          <TaskCategoryIcon category={item.category} size={12} />
        </span>
        {isDone && (
          <span title="Completed" className="inline-flex flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3" style={{ color: 'rgb(var(--color-state-completed))' }} />
          </span>
        )}
        <h4
          className={`text-xs font-medium ${isDone ? 'text-slate-500' : 'text-slate-900'} line-clamp-2 flex-1`}
          title={item.title}
        >
          {item.title}
        </h4>
        {hasGranolaNotes && (
          <span title="Has meeting notes" className="flex-shrink-0 mt-0.5 inline-flex">
            <Mic className="w-3 h-3" style={{ color: GRANOLA_TEXT }} />
          </span>
        )}
        <span className="flex-shrink-0 mt-0.5">
          <TaskPresenceChip taskId={item.id} variant="inline-dot" />
        </span>
      </div>

      {/* Metadata row: content type + priority dot */}
      {(contentType || (item.priority && item.priority !== 'medium')) && (
        <div className="flex items-center gap-2 mb-2">
          {contentType && (
            <div className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: contentType.color ?? undefined }}
              />
              <span className="text-[10px] text-slate-500">{contentType.name}</span>
            </div>
          )}
          {item.priority && item.priority !== 'medium' && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: PRIORITY_STYLES[item.priority ?? 'low']?.hex }}
            >
              {item.priority}
            </span>
          )}
        </div>
      )}

      {/* Subtask progress */}
      {subtaskCount && subtaskCount.total > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'rgb(var(--color-brand-600))' }}>
            <ListChecks className="w-3.5 h-3.5" />
            <span>{subtaskCount.completed}/{subtaskCount.total}</span>
          </div>
          <div className="flex-1 h-1 bg-brand-600/[0.071] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(subtaskCount.completed / subtaskCount.total) * 100}%`,
                backgroundColor: subtaskCount.completed === subtaskCount.total ? 'rgb(var(--color-accent-mint))' : 'rgb(var(--color-brand-600))',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer: Assignees, Links, and Due Date */}
      <div className="flex items-center justify-between">
        {/* Assignees + unified paperclip indicator (platform breakdown moved to slide-over) */}
        <div className="flex items-center gap-[11px]">
          <AvatarStack
            users={itemMembers.map(m => ({ src: m.avatar_url, name: m.full_name }))}
            size="xs-inline"
            max={3}
          />

          {/* Assets (navy paperclip) + linked tasks (berry chain) — see
              CardIndicators. Subtask progress renders as a bar above; the
              Granola mic sits in the title row. */}
          <AssetIndicator info={linkInfo} size="sm" />
          <LinkedTaskIndicator count={taskLinkCount} size="sm" />
        </div>

        {/* Due date */}
        {item.due_date && (
          <div
            className={`flex items-center gap-1 text-[10px] ${
              isOverdue ? 'font-medium' : 'text-slate-400'
            }`}
            style={isOverdue ? { color: 'rgb(var(--color-accent-crimson))' } : undefined}
          >
            {isOverdue && <AlertCircle className="w-3 h-3" />}
            <CalendarIcon className="w-3 h-3" />
            {formatDate(item.due_date)}
          </div>
        )}
      </div>
    </div>
  );
}

// Board Column Component
interface BoardColumnContainerProps {
  column: BoardColumn;
  items: ContentItem[];
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  subtaskCounts: Map<string, SubtaskCount>;
  linkCounts: Map<string, LinkInfo>;
  taskLinkCounts: Map<string, number>;
  granolaItemIds: Set<string>;
  onCardClick: (item: ContentItem) => void;
}

function BoardColumnContainer({ column, items, contentTypes, boardColumns, members, subtaskCounts, linkCounts, taskLinkCounts, granolaItemIds, onCardClick }: BoardColumnContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  const colColor = column.color ?? 'rgb(var(--color-slate-400))';

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl transition-all`}
      style={{
        backgroundColor: isOver ? 'rgb(var(--color-brand-600) / 0.063)' : `${colColor}06`,
        border: isOver ? '2px dashed rgb(var(--color-brand-600))' : '1px solid rgb(var(--color-brand-900) / 0.188)',
      }}
    >
      {/* Column Header — 4px color band + 12-alpha tinted header zone */}
      <div
        className="px-4 py-3 border-b rounded-t-xl"
        style={{
          borderTop: `4px solid ${colColor}`,
          borderBottomColor: `${colColor}30`,
          backgroundColor: `${colColor}12`,
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm text-slate-900">{column.name}</h3>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: `${colColor}20`, color: colColor }}
          >
            {items.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div className="cc-board-scrollbar flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[100px]">
        {items.length === 0 ? (
          // Empty-column treatment (Phase 3.5). Dashed outline picks up the
          // column color at low opacity in the idle state; intensifies to a
          // solid column-tinted fill when an item is being dragged over so
          // users get clear feedback that the column is a valid drop target.
          <div
            className="flex flex-col items-center justify-center py-10 px-4 rounded-lg border-2 border-dashed transition-colors"
            style={{
              borderColor: isOver ? colColor : `${colColor}30`,
              backgroundColor: isOver ? `${colColor}12` : 'transparent',
            }}
          >
            <Inbox
              className="w-6 h-6 mb-2 transition-colors"
              style={{ color: isOver ? colColor : 'rgb(var(--color-slate-300))' }}
            />
            <p
              className="text-xs font-medium transition-colors"
              style={{ color: isOver ? colColor : 'rgb(var(--color-slate-400))' }}
            >
              {isOver ? 'Release to drop' : 'No items yet'}
            </p>
            {!isOver && (
              <p className="text-[10px] text-slate-300 mt-0.5">
                Drag a task here
              </p>
            )}
          </div>
        ) : (
          items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              contentTypes={contentTypes}
              boardColumns={boardColumns}
              members={members}
              subtaskCount={subtaskCounts.get(item.id)}
              linkInfo={linkCounts.get(item.id)}
              taskLinkCount={taskLinkCounts.get(item.id)}
              hasGranolaNotes={granolaItemIds.has(item.id)}
              onClick={() => onCardClick(item)}
            />
          ))
        )}
        {/* zone-level drop target styling is applied to the column container itself */}
      </div>
    </div>
  );
}

// Main Board Page Component
export function BoardPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const canDrag = userRole === 'admin' || userRole === 'editor';
  const { filters, setFilters, isLoaded, resetFilters, hasActiveFilters } = useFilters();
  const { contentItems, contentItemsLoading, patchContentItem, memberProfiles: members } = useApp();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const { counts: taskLinkCounts } = useTaskLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);

  const handleCardClick = useCallback((item: ContentItem) => {
    setSelectedItemId(item.id);
  }, [setSelectedItemId]);

  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null);
  const channels = useMemo(() => {
    const configured = getWorkspaceChannels(currentWorkspace?.settings);
    const fromItems = contentItems.map((i) => i.channel).filter(Boolean) as string[];
    return [...new Set([...configured, ...fromItems])];
  }, [currentWorkspace?.settings, contentItems]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const [{ data: columnsData }, { data: typesData }] = await Promise.all([
        supabase.from('board_columns').select('*').eq('workspace_id', currentWorkspace.id).order('position'),
        supabase.from('content_types').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      ]);

      setColumns(columnsData || []);
      setContentTypes(typesData || []);
    } catch (err) {
      console.error('Error fetching board data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [showCompleted, setShowCompleted] = useShowCompleted('board');

  const filteredItems = useMemo(() => {
    let result = isLoaded ? applyFilters(contentItems, filters, linkCounts) : contentItems;
    // Ordinal posts are view-only reference (what posted / what's scheduled) and
    // live only on the Calendar — never on the task board, where everything is a
    // movable task. Always exclude them here.
    result = result.filter(i => !isOrdinalItem(i));
    if (!showCompleted) {
      const colById = new Map(columns.map(c => [c.id, c]));
      result = result.filter(i => !isDoneStatus(colById.get(i.status ?? '')?.name));
    }
    return result;
  }, [contentItems, filters, isLoaded, linkCounts, showCompleted, columns]);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<string, ContentItem[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = filteredItems.filter((item) => item.status === col.id);
    });
    return grouped;
  }, [filteredItems, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canDrag) return;
    const { active } = event;
    const item = contentItems.find((i) => i.id === active.id);
    if (item) {
      setActiveDragItem(item);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!canDrag || !over) return;

    const itemId = active.id as string;
    const targetColumnId = over.id as string;

    const item = contentItems.find((i) => i.id === itemId);
    const targetColumn = columns.find((c) => c.id === targetColumnId);

    if (!item || !targetColumn) return;
    if (item.status === targetColumnId) return;

    // completed / completed_at are derived from status by the DB trigger
    // (trg_sync_completed_from_status) — the client payload carries status only.
    const updatePayload: Record<string, unknown> = { status: targetColumnId };

    const { error } = await supabase
      .from('content_items')
      .update(updatePayload)
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to move item: ' + error.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: itemId,
      user_id: user?.id || null,
      action: `moved to ${targetColumn.name}`,
      metadata: { previousStatus: item.status, newStatus: targetColumnId },
    });

    toast.success(`Moved "${item.title}" to ${targetColumn.name}`);
    patchContentItem(itemId, { status: targetColumnId, ...updatePayload });
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '1',
        },
      },
    }),
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
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-page">
      <div className="px-6 py-4 bg-surface-card flex-shrink-0" style={{ borderBottom: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
        <FilterBar
          workspaceId={currentWorkspace?.id || null}
          contentTypes={contentTypes}
          boardColumns={columns}
          members={members}
          channels={channels}
          linkCounts={linkCounts}
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={contentItems.length}
          filteredCount={filteredItems.length}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
            style={{
              borderColor: showCompleted ? 'rgb(var(--color-state-success))' : 'rgb(var(--color-slate-200))',
              backgroundColor: showCompleted ? '#EAF4EF' : 'white',
              color: showCompleted ? 'rgb(var(--color-state-success))' : 'rgb(var(--color-slate-500))',
            }}
            title={showCompleted ? 'Hide completed/published tasks' : 'Show completed/published tasks'}
          >
            <div
              className="relative w-8 h-[18px] rounded-full transition-colors"
              style={{ backgroundColor: showCompleted ? 'rgb(var(--color-state-success))' : 'rgb(var(--color-slate-300))' }}
            >
              <div
                className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform"
                style={{ left: showCompleted ? '18px' : '2px' }}
              />
            </div>
            Done
          </button>
        </div>
      </div>

      {hasActiveFilters && filteredItems.length === 0 ? (
        <div className="flex-1 p-6">
          <FilteredEmptyState hiddenCount={contentItems.length} onClear={resetFilters} />
        </div>
      ) : (
      <div className="cc-board-scrollbar flex-1 min-h-0" style={{ overflowX: 'scroll', overflowY: 'hidden' }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 h-full min-w-max">
            {columns.map((column) => (
              <BoardColumnContainer
                key={column.id}
                column={column}
                items={itemsByColumn[column.id] || []}
                contentTypes={contentTypes}
                boardColumns={columns}
                members={members}
                subtaskCounts={subtaskCounts}
                linkCounts={linkCounts}
                taskLinkCounts={taskLinkCounts}
                granolaItemIds={granolaItemIds}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeDragItem ? (
              <DragGhost rotate={-1.5}>
                <BoardCard
                  item={activeDragItem}
                  contentTypes={contentTypes}
                  boardColumns={columns}
                  members={members}
                  isOverlay={true}
                  onClick={() => {}}
                />
              </DragGhost>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      )}

    </div>
  );
}

export default BoardPage;
