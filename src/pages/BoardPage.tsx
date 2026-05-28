import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, BoardColumn, Profile } from '../lib/database.types';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { useSubtaskCounts, SubtaskCount } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts, LinkInfo } from '../hooks/useExternalLinkCounts';
import {
  Calendar as CalendarIcon,
  AlertCircle,
  User,
  ListChecks,
  Mic,
} from 'lucide-react';
import { isPast, isToday } from 'date-fns';
import { parseLocalDate, formatDate } from '../lib/utils';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR } from '../lib/ordinal';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
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

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: 'transparent',
};

const LINK_PLATFORM_META: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  ordinal:      { label: 'Ordinal',      bg: '#FFF7ED', color: '#C2410C', icon: '⬡' },
  figma:        { label: 'Figma',        bg: '#F5F3FF', color: '#7C3AED', icon: 'F' },
  canva:        { label: 'Canva',        bg: '#EFF6FF', color: '#2563EB', icon: 'C' },
  miro:         { label: 'Miro',         bg: '#FFFBEB', color: '#D97706', icon: 'M' },
  google_docs:  { label: 'Google Docs',  bg: '#F0FDF4', color: '#15803D', icon: 'G' },
  google_drive: { label: 'Google Drive', bg: '#F0FDF4', color: '#15803D', icon: 'G' },
  notion:       { label: 'Notion',       bg: '#F9FAFB', color: '#374151', icon: 'N' },
  linear:       { label: 'Linear',       bg: '#EFF6FF', color: '#1D4ED8', icon: 'L' },
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
  const statusName = statusCol?.name?.toLowerCase();
  const isDone = statusName === 'published' || statusName === 'completed';
  const isOverdue = item.due_date && isPast(parseLocalDate(item.due_date)) && !isToday(parseLocalDate(item.due_date)) && !isDone;
  const isOrdinal = isOrdinalItem(item);
  const isLinear = isLinearItem(item);
  const isExternal = isOrdinal || isLinear;
  const externalBg = isOrdinal ? `${ORDINAL_COLOR}0A` : isLinear ? '#FFF7F2' : undefined;

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-4 h-32"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-lg p-4 shadow-md border cursor-grab active:cursor-grabbing hover:shadow-lg transition-all relative overflow-hidden ${
        isExternal ? '' : 'bg-slate-50'
      } ${isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''
      }`}
      style={{
        ...style,
        ...(externalBg ? { backgroundColor: externalBg } : {}),
        borderColor: '#002339',
      }}
    >
      {/* Priority indicator */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
        style={{ backgroundColor: priorityColors[item.priority ?? 'low'] || 'transparent' }}
      />

      <div className="pl-3">
        {/* Title */}
        <div className="flex items-start gap-1.5 mb-2">
          <h4 className="text-sm font-semibold text-slate-900 line-clamp-2" title={item.title}>
            {item.title}
          </h4>
          {hasGranolaNotes && (
            <Mic className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#345A11' }} title="Has meeting notes" />
          )}
        </div>

        {/* Content type */}
        {contentType && (
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: contentType.color ?? undefined }}
            />
            <span className="text-xs text-slate-500">{contentType.name}</span>
          </div>
        )}

        {/* Subtask indicator */}
        {subtaskCount && subtaskCount.total > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ListChecks className="w-3.5 h-3.5" />
              <span>{subtaskCount.completed}/{subtaskCount.total}</span>
            </div>
            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(subtaskCount.completed / subtaskCount.total) * 100}%`,
                  backgroundColor: subtaskCount.completed === subtaskCount.total ? '#22c55e' : '#3b82f6',
                }}
              />
            </div>
          </div>
        )}

        {/* Footer: Assignees, Links, and Due Date */}
        <div className="flex items-center justify-between">
          {/* Assignees */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {itemMembers.slice(0, 3).map((member) => (
                <div
                  key={member.id}
                  className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden"
                  title={member.full_name ?? member.email ?? undefined}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3 h-3 text-slate-500" />
                  )}
                </div>
              ))}
              {itemMembers.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-xs text-slate-600 font-medium">
                  +{itemMembers.length - 3}
                </div>
              )}
            </div>

            {/* Link platform icons */}
            {linkInfo && linkInfo.count > 0 && (
              <div className="flex items-center gap-0.5" title={`${linkInfo.count} linked asset${linkInfo.count !== 1 ? 's' : ''}`}>
                {linkInfo.platforms.slice(0, 3).map((p) => {
                  const meta = LINK_PLATFORM_META[p] ?? LINK_PLATFORM_META.other;
                  return (
                    <span
                      key={p}
                      className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center leading-none"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.icon}
                    </span>
                  );
                })}
                {linkInfo.platforms.length > 3 && (
                  <span className="text-[9px] text-slate-400 font-medium">+{linkInfo.platforms.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Due date */}
          {item.due_date && (
            <div
              className={`flex items-center gap-1 text-xs ${
                isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
              }`}
            >
              {isOverdue && <AlertCircle className="w-3 h-3" />}
              <CalendarIcon className="w-3 h-3" />
              {formatDate(item.due_date)}
            </div>
          )}
        </div>
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
      className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl border-2 transition-all ${
        isOver ? 'border-blue-400' : 'border-slate-200'
      }`}
      style={{ backgroundColor: isOver ? `${colColor}0C` : `${colColor}05` }}
    >
      {/* Column Header */}
      <div
        className="px-4 py-3 border-b rounded-t-xl"
        style={{
          borderTop: `3px solid ${colColor}`,
          borderBottomColor: `${colColor}30`,
          backgroundColor: `${colColor}15`,
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{column.name}</h3>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: `${colColor}20`, color: colColor }}
          >
            {items.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[100px]">
        {items.length === 0 && !isOver ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <p>Drop items here</p>
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
              hasGranolaNotes={granolaItemIds.has(item.id)}
              onClick={() => onCardClick(item)}
            />
          ))
        )}
        {isOver && (
          <div className="h-24 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 flex items-center justify-center">
            <p className="text-sm text-blue-500 font-medium">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Board Page Component
export function BoardPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const canDrag = userRole === 'admin' || userRole === 'editor';
  const { filters, setFilters, isLoaded } = useFilters();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);

  const handleCardClick = useCallback((item: ContentItem) => {
    setSelectedItemId(item.id);
  }, [setSelectedItemId]);

  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null);
  const [channels, setChannels] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const [{ data: columnsData }, { data: itemsData }, { data: typesData }] = await Promise.all([
        supabase.from('board_columns').select('*').eq('workspace_id', currentWorkspace.id).order('position'),
        supabase.from('content_items').select('id, title, status, due_date, priority, content_type_id, assignee_ids, channel, project_id, custom_fields, tags').eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false }),
        supabase.from('content_types').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      ]);

      setColumns(columnsData || []);
      setItems((itemsData ?? []) as ContentItem[]);
      setContentTypes(typesData || []);

      const uniqueChannels = [...new Set((itemsData || []).map((item) => item.channel).filter(Boolean))];
      setChannels(uniqueChannels as string[]);

      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('user_id, role, profiles:user_id(id, full_name, email, avatar_url)')
        .eq('workspace_id', currentWorkspace.id);

      const profiles = (membersData || []).map((m: any) => m.profiles).filter(Boolean);
      setMembers(profiles);
    } catch (err) {
      console.error('Error fetching board data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!currentWorkspace) return;
    const channel = supabase
      .channel('board_items_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_items',
        filter: `workspace_id=eq.${currentWorkspace.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems((prev) => [payload.new as ContentItem, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setItems((prev) => prev.map((item) => item.id === payload.new.id ? (payload.new as ContentItem) : item));
        } else if (payload.eventType === 'DELETE') {
          setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentWorkspace]);

  const filteredItems = useMemo(() => {
    if (!isLoaded) return items;
    return applyFilters(items, filters, linkCounts);
  }, [items, filters, isLoaded, linkCounts]);

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
    const item = items.find((i) => i.id === active.id);
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

    const item = items.find((i) => i.id === itemId);
    const targetColumn = columns.find((c) => c.id === targetColumnId);

    if (!item || !targetColumn) return;
    if (item.status === targetColumnId) return;

    const { error } = await supabase
      .from('content_items')
      .update({ status: targetColumnId })
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
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: targetColumnId } : i)));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100/50">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <FilterBar
          workspaceId={currentWorkspace?.id || null}
          contentTypes={contentTypes}
          boardColumns={columns}
          members={members}
          channels={channels}
          linkCounts={linkCounts}
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={items.length}
          filteredCount={filteredItems.length}
        />
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
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
              <div className="rotate-2 scale-105">
                <BoardCard
                  item={activeDragItem}
                  contentTypes={contentTypes}
                  boardColumns={columns}
                  members={members}
                  isOverlay={true}
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

    </div>
  );
}

export default BoardPage;
