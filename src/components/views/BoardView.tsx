import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronDown, GripVertical, AlertCircle, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem, BoardColumn } from '../../lib/database.types';
import { formatDate, isOverdue, getPriorityDot } from '../../lib/utils';
import { FilterBar, FilterState, DEFAULT_FILTERS, applyFilters } from '../ui/FilterBar';
import { isOrdinalItem, getOrdinalProfile, ORDINAL_COLOR, getPlatformFromChannel } from '../../lib/ordinal';

type GroupBy = 'status' | 'content_type' | 'priority' | 'channel';

interface Props {
  onItemClick: (item: ContentItem) => void;
  onCreateClick: (defaultStatus?: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  item: ContentItem;
  onClick: () => void;
  overlay?: boolean;
}

// Platform icons for social media
const PLATFORM_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  ordinal:      { icon: '⬡', bg: '#FFF7ED', color: '#C2410C' },
  figma:        { icon: 'F', bg: '#F5F3FF', color: '#7C3AED' },
  canva:        { icon: 'C', bg: '#EFF6FF', color: '#2563EB' },
  miro:         { icon: 'M', bg: '#FFFBEB', color: '#D97706' },
  google_docs:  { icon: 'G', bg: '#F0FDF4', color: '#15803D' },
  google_drive: { icon: 'G', bg: '#F0FDF4', color: '#15803D' },
  notion:       { icon: 'N', bg: '#F9FAFB', color: '#374151' },
  linear:       { icon: 'L', bg: '#EFF6FF', color: '#1D4ED8' },
  other:        { icon: '↗', bg: '#F9FAFB', color: '#4B5563' },
};

// Platform icon component for board cards
function BoardOrdinalProfile({ item }: { item: ContentItem }) {
  const profile = getOrdinalProfile(item);
  const platform = getPlatformFromChannel(item.channel);

  if (!profile && !platform) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 mb-1">
      {platform && (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold"
          style={{
            backgroundColor: PLATFORM_META[platform]?.bgColor ?? '#F5F5F5',
            color: PLATFORM_META[platform]?.color ?? '#666',
          }}
        >
          {PLATFORM_META[platform]?.icon?.charAt(0) ?? '●'}
        </span>
      )}
      {profile && (
        <span className="text-[10px] text-gray-500">
          <span className="text-gray-400">@</span>
          {profile.handle.replace('@', '')}
        </span>
      )}
    </div>
  );
}

function Card({ item, onClick, overlay }: CardProps) {
  const { contentTypes, boardColumns, linkedItemIds } = useApp();
  const itemPlatforms = linkedItemIds.get(item.id) ?? [];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const contentType = contentTypes.find(ct => ct.id === item.content_type_id);
  const overdue = isOverdue(item.due_date);

  const inner = (
    <div
      onClick={overlay ? undefined : onClick}
      className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-pointer
        hover:shadow-md hover:border-gray-300 transition-all group select-none
        ${overlay ? 'shadow-xl rotate-1 scale-105' : ''}
        ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div
          {...(overlay ? {} : { ...listeners })}
          className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            {isOrdinalItem(item) && (
              <span
                title="Synced from Ordinal"
                className="inline-flex items-center justify-center w-4 h-4 rounded flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
              >
                <Zap className="w-2.5 h-2.5" style={{ color: ORDINAL_COLOR }} />
              </span>
            )}
            <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug flex-1">{item.title}</p>
          </div>

          {/* Ordinal Profile Info */}
          {isOrdinalItem(item) && <BoardOrdinalProfile item={item} />}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {contentType && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: contentType.color }} />
                <span className="truncate max-w-[80px]">{contentType.name}</span>
              </span>
            )}

            <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {overdue && <AlertCircle className="w-3 h-3" />}
              {formatDate(item.due_date)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className={`flex items-center gap-1 text-xs capitalize text-gray-500`}>
              <span className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority)}`} />
              {item.priority}
            </span>

            <div className="flex items-center gap-1">
              {itemPlatforms.slice(0, 3).map(p => {
                const meta = PLATFORM_ICONS[p] ?? PLATFORM_ICONS.other;
                return (
                  <span
                    key={p}
                    title={p}
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center leading-none"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {meta.icon}
                  </span>
                );
              })}
              {itemPlatforms.length > 3 && (
                <span className="text-[9px] text-gray-400">+{itemPlatforms.length - 3}</span>
              )}
              {item.channel && itemPlatforms.length === 0 && (
                <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{item.channel}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (overlay) return inner;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {inner}
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  onAddClick: () => void;
}

function Column({ id, title, color, items, onItemClick, onAddClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{items.length}</span>
        </div>
        <button
          onClick={onAddClick}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2.5 min-h-[120px] p-2 rounded-xl transition-colors
          ${isOver ? 'bg-mint ring-2 ring-brand-200' : 'bg-gray-50/60'}`}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <Card key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-6">
            No items
          </div>
        )}
      </div>
    </div>
  );
}

// ── Swimlane Board ────────────────────────────────────────────────────────────

interface SwimlaneBoardProps {
  items: ContentItem[];
  groupLabel: string;
  boardColumns: BoardColumn[];
  onItemClick: (item: ContentItem) => void;
  onAddClick: (statusId: string) => void;
  onStatusChange: (itemId: string, newStatusId: string) => void;
}

function SwimlaneBoard({ items, groupLabel, boardColumns, onItemClick, onAddClick, onStatusChange }: SwimlaneBoardProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{groupLabel}</span>
        <span className="text-xs text-gray-400">({items.length})</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {boardColumns.map(col => (
          <Column
            key={col.id}
            id={`${groupLabel}::${col.id}`}
            title={col.name}
            color={col.color}
            items={items.filter(i => i.status === col.id)}
            onItemClick={onItemClick}
            onAddClick={() => onAddClick(col.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Board View ───────────────────────────────────────────────────────────

export function BoardView({ onItemClick, onCreateClick, addToast, filters, onFiltersChange }: Props) {
  const { contentItems, boardColumns, contentTypes, refreshContentItems, linkedItemIds } = useApp();
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<ContentItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync localItems from contentItems
  useMemo(() => {
    setLocalItems(contentItems);
    setInitialized(true);
  }, [contentItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const uniqueChannels = useMemo(() =>
    Array.from(new Set(contentItems.map(i => i.channel).filter(Boolean) as string[])),
    [contentItems]
  );

  const filtered = useMemo(() =>
    applyFilters(localItems, filters, linkedItemIds),
    [localItems, filters, linkedItemIds]
  );

  const activeItem = useMemo(() =>
    localItems.find(i => i.id === activeId) ?? null,
    [localItems, activeId]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    // If over a column droppable (format: "label::colId" or just colId)
    const overColId = overId.includes('::') ? overId.split('::')[1] : overId;
    const targetCol = boardColumns.find(c => c.id === overColId);

    if (targetCol) {
      setLocalItems(prev =>
        prev.map(item =>
          item.id === activeItemId ? { ...item, status: targetCol.id } : item
        )
      );
      return;
    }

    // Over another card — same column swap
    const overItem = localItems.find(i => i.id === overId);
    if (overItem && overItem.status !== localItems.find(i => i.id === activeItemId)?.status) {
      setLocalItems(prev =>
        prev.map(item =>
          item.id === activeItemId ? { ...item, status: overItem.status } : item
        )
      );
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeItemId = active.id as string;
    const activeItem = localItems.find(i => i.id === activeItemId);
    if (!activeItem) return;

    // Persist status change
    const { error } = await supabase
      .from('content_items')
      .update({ status: activeItem.status })
      .eq('id', activeItemId);

    if (error) {
      addToast(error.message, 'error');
      await refreshContentItems();
    } else {
      addToast('Status updated');
    }
  }

  // Group by status (default Kanban)
  if (groupBy === 'status') {
    return (
      <div className="flex flex-col h-full">
        <Toolbar
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          filters={filters}
          onFiltersChange={onFiltersChange}
          channels={uniqueChannels}
          onCreateClick={() => onCreateClick()}
        />
        <div className="flex-1 overflow-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-5 h-full pb-4">
              {boardColumns.map(col => (
                <Column
                  key={col.id}
                  id={col.id}
                  title={col.name}
                  color={col.color}
                  items={filtered.filter(i => i.status === col.id)}
                  onItemClick={onItemClick}
                  onAddClick={() => onCreateClick(col.id)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeItem && <Card item={activeItem} onClick={() => {}} overlay />}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    );
  }

  // Swimlane mode
  const groups = getGroups(filtered, groupBy, contentTypes, boardColumns);

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        filters={filters}
        onFiltersChange={onFiltersChange}
        channels={uniqueChannels}
        onCreateClick={() => onCreateClick()}
      />
      <div className="flex-1 overflow-auto p-6">
        {groups.map(({ label, items }) => (
          <SwimlaneBoard
            key={label}
            groupLabel={label}
            items={items}
            boardColumns={boardColumns}
            onItemClick={onItemClick}
            onAddClick={(statusId) => onCreateClick(statusId)}
            onStatusChange={async (itemId, newStatusId) => {
              const { error } = await supabase
                .from('content_items')
                .update({ status: newStatusId })
                .eq('id', itemId);
              if (error) addToast(error.message, 'error');
              else { addToast('Status updated'); refreshContentItems(); }
            }}
          />
        ))}
        {groups.length === 0 && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No items match your filters
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface ToolbarProps {
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  channels: string[];
  onCreateClick: () => void;
}

function Toolbar({ groupBy, onGroupByChange, filters, onFiltersChange, channels, onCreateClick }: ToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 flex-wrap">
      <FilterBar filters={filters} onChange={onFiltersChange} channels={channels} showLinksFilter showProject />

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Group by</span>
          <div className="relative">
            <select
              value={groupBy}
              onChange={e => onGroupByChange(e.target.value as GroupBy)}
              className="appearance-none pl-2.5 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
            >
              <option value="status">Status</option>
              <option value="content_type">Content Type</option>
              <option value="priority">Priority</option>
              <option value="channel">Channel</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
}

// ── Group helpers ─────────────────────────────────────────────────────────────

function getGroups(
  items: ContentItem[],
  groupBy: GroupBy,
  contentTypes: { id: string; name: string }[],
  boardColumns: BoardColumn[]
): { label: string; items: ContentItem[] }[] {
  const map = new Map<string, ContentItem[]>();

  for (const item of items) {
    let key = '';
    if (groupBy === 'content_type') {
      const ct = contentTypes.find(c => c.id === item.content_type_id);
      key = ct?.name ?? 'No type';
    } else if (groupBy === 'priority') {
      key = item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : 'None';
    } else if (groupBy === 'channel') {
      key = item.channel || 'No channel';
    }

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}
