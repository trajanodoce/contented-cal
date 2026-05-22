import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useFilters } from '../contexts/FiltersContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, BoardColumn, Profile } from '../lib/database.types';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { DetailSlideOver } from '../components/content/DetailSlideOver';
import {
  Calendar as CalendarIcon,
  AlertCircle,
  User,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
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

interface BoardCardProps {
  item: ContentItem;
  contentTypes: ContentType[];
  members: Profile[];
  isOverlay?: boolean;
  onClick: () => void;
}

function BoardCard({ item, contentTypes, members, isOverlay, onClick }: BoardCardProps) {
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

  const isOverdue = item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date));

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
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-slate-50 rounded-lg p-4 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden ${
        isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''
      }`}
    >
      {/* Priority indicator */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
        style={{ backgroundColor: priorityColors[item.priority] || 'transparent' }}
      />

      <div className="pl-3">
        {/* Title */}
        <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 mb-2" title={item.title}>
          {item.title}
        </h4>

        {/* Content type */}
        {contentType && (
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: contentType.color }}
            />
            <span className="text-xs text-slate-500">{contentType.name}</span>
          </div>
        )}

        {/* Footer: Assignees and Due Date */}
        <div className="flex items-center justify-between">
          {/* Assignees */}
          <div className="flex -space-x-1.5">
            {itemMembers.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden"
                title={member.full_name || member.email}
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

          {/* Due date */}
          {item.due_date && (
            <div
              className={`flex items-center gap-1 text-xs ${
                isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
              }`}
            >
              {isOverdue && <AlertCircle className="w-3 h-3" />}
              <CalendarIcon className="w-3 h-3" />
              {format(new Date(item.due_date), 'MMM d')}
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
  members: Profile[];
  onCardClick: (item: ContentItem) => void;
}

function BoardColumnContainer({ column, items, contentTypes, members, onCardClick }: BoardColumnContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[300px] flex flex-col bg-slate-50 rounded-xl border-2 transition-all ${
        isOver ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'
      }`}
    >
      {/* Column Header */}
      <div
        className="px-4 py-3 border-b border-slate-200 rounded-t-xl bg-white"
        style={{ borderTop: `3px solid ${column.color}` }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{column.name}</h3>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
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
              members={members}
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
  const { currentWorkspace } = useWorkspace();
  const { filters, setFilters, isLoaded } = useFilters();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();

  const handleCardClick = useCallback((item: ContentItem) => {
    setSelectedItemId(item.id);
  }, [setSelectedItemId]);

  const handleClosePanel = useCallback(() => {
    setSelectedItemId(null);
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
        supabase.from('content_items').select('*').eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false }),
        supabase.from('content_types').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      ]);

      setColumns(columnsData || []);
      setItems(itemsData || []);
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

  const filteredItems = useMemo(() => {
    if (!isLoaded) return items;
    return applyFilters(items, filters);
  }, [items, filters, isLoaded]);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<string, ContentItem[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = filteredItems.filter((item) => item.status === col.id);
    });
    return grouped;
  }, [filteredItems, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    if (item) {
      setActiveDragItem(item);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

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
                members={members}
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
