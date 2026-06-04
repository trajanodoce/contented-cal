import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, BoardColumn, Profile } from '../lib/database.types';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { useSubtaskCounts, SubtaskCount } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts, LinkInfo } from '../hooks/useExternalLinkCounts';
import {
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Mic,
} from 'lucide-react';
import { AvatarStack } from '../components/ui/Avatar';
import { isPast, isToday } from 'date-fns';
import { parseLocalDate, formatDate, getWorkspaceChannels } from '../lib/utils';
import { isDoneStatus } from '../lib/itemHelpers';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, ORDINAL_TEXT, LINEAR_COLOR, GRANOLA_COLOR, GRANOLA_TEXT, SLACK_COLOR, INTERNAL_COLOR } from '../lib/ordinal';
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
import { DropTarget, DragGhost, BoardSourcePlaceholder } from '../components/dnd/DndPrimitives';

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: 'transparent',
};

const LINK_PLATFORM_META: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  ordinal:      { label: 'Ordinal',      bg: '#C4B5D940', color: '#5B4F8A', icon: '⬡' },
  figma:        { label: 'Figma',        bg: '#F5F3FF', color: '#7C3AED', icon: 'F' },
  canva:        { label: 'Canva',        bg: '#EFF6FF', color: '#2563EB', icon: 'C' },
  miro:         { label: 'Miro',         bg: '#FFFBEB', color: '#D97706', icon: 'M' },
  google_docs:  { label: 'Google Docs',  bg: '#F0FDF4', color: '#15803D', icon: 'G' },
  google_drive: { label: 'Google Drive', bg: '#F0FDF4', color: '#15803D', icon: 'G' },
  notion:       { label: 'Notion',       bg: '#F9FAFB', color: '#374151', icon: 'N' },
  linear:       { label: 'Linear',       bg: '#FFC3B840', color: '#A05042', icon: 'L' },
  other:        { label: 'Link',         bg: '#F9FAFB', color: '#4B5563', icon: '↗' },
};

interface BoardCardProps {
  item: ContentItem;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  subtaskCount?: SubtaskCount;
  linkInfo?: LinkInfo;
  hasGranolaNotes?: boolean;
  isOverlay?: boolean;
  onClick: () => void;
}

function BoardCard({ item, contentTypes, boardColumns, members, subtaskCount, linkInfo, hasGranolaNotes, isOverlay, onClick }: BoardCardProps) {
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
        borderColor: '#00233930',
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
            <CheckCircle2 className="w-3 h-3" style={{ color: '#357254' }} />
          </span>
        )}
        <h4
          className={`text-xs font-medium ${isDone ? 'text-slate-500' : 'text-slate-900'} line-clamp-2 flex-1`}
          title={item.title}
        >
          {item.title}
        </h4>
        {hasGranolaNotes && (
          <Mic className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: GRANOLA_TEXT }} title="Has meeting notes" />
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
              style={{ color: priorityColors[item.priority] }}
            >
              {item.priority}
            </span>
          )}
        </div>
      )}

      {/* Subtask progress */}
      {subtaskCount && subtaskCount.total > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <ListChecks className="w-3 h-3" />
            <span>{subtaskCount.completed}/{subtaskCount.total}</span>
          </div>
          <div className="flex-1 h-1 bg-[#005D9712] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(subtaskCount.completed / subtaskCount.total) * 100}%`,
                backgroundColor: subtaskCount.completed === subtaskCount.total ? '#92D1B2' : '#005D97',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer: Assignees, Links, and Due Date */}
      <div className="flex items-center justify-between">
        {/* Assignees + link platform icons */}
        <div className="flex items-center gap-1.5">
          <AvatarStack
            users={itemMembers.map(m => ({ src: m.avatar_url, name: m.full_name }))}
            size="xs-inline"
            max={3}
          />

          {linkInfo && linkInfo.count > 0 && (
            <div className="flex items-center gap-0.5" title={`${linkInfo.count} linked asset${linkInfo.count !== 1 ? 's' : ''}`}>
              {linkInfo.platforms.slice(0, 3).map((p) => {
                const meta = LINK_PLATFORM_META[p] ?? LINK_PLATFORM_META.other;
                return (
                  <span
                    key={p}
                    className="w-3.5 h-3.5 rounded text-[8px] font-bold flex items-center justify-center leading-none"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {meta.icon}
                  </span>
                );
              })}
              {linkInfo.platforms.length > 3 && (
                <span className="text-[8px] text-slate-400 font-medium">+{linkInfo.platforms.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Due date */}
        {item.due_date && (
          <div
            className={`flex items-center gap-1 text-[10px] ${
              isOverdue ? 'font-medium' : 'text-slate-400'
            }`}
            style={isOverdue ? { color: '#BA2C2C' } : undefined}
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
  granolaItemIds: Set<string>;
  onCardClick: (item: ContentItem) => void;
}

function BoardColumnContainer({ column, items, contentTypes, boardColumns, members, subtaskCounts, linkCounts, granolaItemIds, onCardClick }: BoardColumnContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  const colColor = column.color ?? '#94a3b8';

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl transition-all`}
      style={{
        backgroundColor: isOver ? '#005D9710' : `${colColor}06`,
        border: isOver ? '2px dashed #005D97' : '1px solid #00233930',
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
        {items.length === 0 && !isOver ? (
          <p className="text-center py-8 text-slate-400 text-xs italic">
            Drop items here
          </p>
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
  const { filters, setFilters, isLoaded } = useFilters();
  const { contentItems, contentItemsLoading, patchContentItem, members } = useApp();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);

  const handleCardClick = useCallback((item: ContentItem) => {
    setSelectedItemId(item.id);
  }, [setSelectedItemId]);

  const [showOrdinal, setShowOrdinal] = useState(() => {
    const saved = localStorage.getItem('cc-show-ordinal');
    return saved !== null ? saved === 'true' : true;
  });

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
    if (!showOrdinal) result = result.filter(i => !isOrdinalItem(i));
    if (!showCompleted) {
      const colById = new Map(columns.map(c => [c.id, c]));
      result = result.filter(i => !isDoneStatus(colById.get(i.status ?? '')?.name));
    }
    return result;
  }, [contentItems, filters, isLoaded, linkCounts, showOrdinal, showCompleted, columns]);

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

    // Sync completed boolean when moving to/from done columns
    const isDoneCol = isDoneStatus(targetColumn.name);
    const updatePayload: Record<string, unknown> = { status: targetColumnId };
    if (isDoneCol) {
      updatePayload.completed = true;
      updatePayload.completed_at = new Date().toISOString();
    } else {
      // Moving out of a done column — mark incomplete
      const prevCol = columns.find(c => c.id === item.status);
      if (isDoneStatus(prevCol?.name)) {
        updatePayload.completed = false;
        updatePayload.completed_at = null;
      }
    }

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
      <div className="px-6 py-4 bg-surface-card flex-shrink-0" style={{ borderBottom: '1px solid #00233930' }}>
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
              borderColor: showCompleted ? '#357254' : '#e2e8f0',
              backgroundColor: showCompleted ? '#EAF4EF' : 'white',
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
              backgroundColor: showOrdinal ? '#F5F3FF' : 'white',
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
      </div>

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

    </div>
  );
}

export default BoardPage;
