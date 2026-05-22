import React, { useState, useMemo, useRef } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, isSameMonth, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  parseISO, startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem } from '../../lib/database.types';
import { isOverdue } from '../../lib/utils';
import { FilterBar, FilterState, applyFilters } from '../ui/FilterBar';
import { isOrdinalItem, ORDINAL_COLOR } from '../../lib/ordinal';
import { Zap } from 'lucide-react';

type CalMode = 'month' | 'week' | 'day';
type DateField = 'due_date' | 'publish_date';

interface Props {
  onItemClick: (item: ContentItem) => void;
  onCreateClick: (defaultDate?: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

function Pill({ item, contentTypes, onClick, onDragStart }: {
  item: ContentItem;
  contentTypes: { id: string; name: string; color: string }[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const ct = contentTypes.find(c => c.id === item.content_type_id);
  const overdue = isOverdue(item.due_date);
  const isOrdinal = isOrdinalItem(item);

  return (
    <div
      draggable={!isOrdinal} // Disable drag for Ordinal items
      onDragStart={e => isOrdinal ? e.preventDefault() : onDragStart(e, item.id)}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer select-none
        transition-all hover:brightness-95 active:scale-95"
      style={{
        backgroundColor: isOrdinal ? `${ORDINAL_COLOR}15` : overdue ? '#FEF2F2' : (ct?.color ?? '#6B7280') + '20',
        color: isOrdinal ? ORDINAL_COLOR : overdue ? '#DC2626' : ct?.color ?? '#6B7280',
        borderLeft: isOrdinal ? `2px solid ${ORDINAL_COLOR}` : overdue ? '1px solid #FECACA' : '1px solid transparent',
      }}
    >
      {isOrdinal ? (
        <Zap className="w-3 h-3 shrink-0" />
      ) : (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: overdue ? '#EF4444' : ct?.color ?? '#6B7280' }}
        />
      )}
      <span className="truncate max-w-[100px]">{item.title}</span>
      {overdue && <AlertCircle className="w-2.5 h-2.5 shrink-0" />}
    </div>
  );
}

function DayCell({ date, items, contentTypes, isCurrentMonth, onItemClick, onCellClick, onDragStart, dropTargetDate, onDragOver, onDrop, onDragLeave }: {
  date: Date;
  items: ContentItem[];
  contentTypes: { id: string; name: string; color: string }[];
  isCurrentMonth: boolean;
  onItemClick: (item: ContentItem) => void;
  onCellClick: (date: Date) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  dropTargetDate: string | null;
  onDragOver: (e: React.DragEvent, dateStr: string) => void;
  onDrop: (e: React.DragEvent, dateStr: string) => void;
  onDragLeave: () => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const today = isToday(date);
  const isOver = dropTargetDate === dateStr;
  const MAX = 3;
  const visible = items.slice(0, MAX);
  const overflow = items.length - MAX;

  return (
    <div
      onDragOver={e => onDragOver(e, dateStr)}
      onDrop={e => onDrop(e, dateStr)}
      onDragLeave={onDragLeave}
      onClick={() => onCellClick(date)}
      className={`min-h-[100px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors
        ${isOver ? 'bg-mint' : 'hover:bg-gray-50/80'}
        ${!isCurrentMonth ? 'bg-gray-50/40' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
            ${today ? 'bg-brand-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}
        >
          {format(date, 'd')}
        </span>
      </div>
      <div className="space-y-0.5">
        {visible.map(item => (
          <Pill key={item.id} item={item} contentTypes={contentTypes} onClick={() => onItemClick(item)} onDragStart={onDragStart} />
        ))}
        {overflow > 0 && (
          <span className="text-xs text-gray-400 pl-1.5">+{overflow} more</span>
        )}
      </div>
    </div>
  );
}

function WeekRow({ date, items, contentTypes, onItemClick, onDragStart, dropTargetDate, onDragOver, onDrop, onDragLeave }: {
  date: Date;
  items: ContentItem[];
  contentTypes: { id: string; name: string; color: string }[];
  onItemClick: (item: ContentItem) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  dropTargetDate: string | null;
  onDragOver: (e: React.DragEvent, dateStr: string) => void;
  onDrop: (e: React.DragEvent, dateStr: string) => void;
  onDragLeave: () => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const isOver = dropTargetDate === dateStr;
  const today = isToday(date);

  return (
    <div
      onDragOver={e => onDragOver(e, dateStr)}
      onDrop={e => onDrop(e, dateStr)}
      onDragLeave={onDragLeave}
      className={`flex gap-3 p-3 min-h-[80px] border-b border-gray-100 transition-colors
        ${isOver ? 'bg-mint' : today ? 'bg-mint-50/50' : 'hover:bg-gray-50/60'}`}
    >
      <div className="flex flex-col items-center min-w-[48px]">
        <span className="text-xs text-gray-400">{format(date, 'EEE')}</span>
        <span
          className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
            ${today ? 'bg-brand-600 text-white' : 'text-gray-700'}`}
        >
          {format(date, 'd')}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        {items.map(item => (
          <Pill key={item.id} item={item} contentTypes={contentTypes} onClick={() => onItemClick(item)} onDragStart={onDragStart} />
        ))}
        {items.length === 0 && (
          <span className="text-xs text-gray-300 italic mt-1">Empty</span>
        )}
      </div>
    </div>
  );
}

function DayContainer({ date, items, contentTypes, onItemClick, onCreateClick, onDragStart, dropTargetDate, onDragOver, onDrop, onDragLeave }: {
  date: Date;
  items: ContentItem[];
  contentTypes: { id: string; name: string; color: string }[];
  onItemClick: (item: ContentItem) => void;
  onCreateClick: (dateStr: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  dropTargetDate: string | null;
  onDragOver: (e: React.DragEvent, dateStr: string) => void;
  onDrop: (e: React.DragEvent, dateStr: string) => void;
  onDragLeave: () => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const isOver = dropTargetDate === dateStr;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span
          className={`text-3xl font-bold w-14 h-14 flex items-center justify-center rounded-2xl
            ${isToday(date) ? 'bg-brand-600 text-white' : 'text-gray-800 bg-gray-100'}`}
        >
          {format(date, 'd')}
        </span>
        <div>
          <p className="text-lg font-semibold text-gray-800">{format(date, 'EEEE')}</p>
          <p className="text-sm text-gray-400">{format(date, 'MMMM yyyy')}</p>
        </div>
      </div>

      <div
        onDragOver={e => onDragOver(e, dateStr)}
        onDrop={e => onDrop(e, dateStr)}
        onDragLeave={onDragLeave}
        className={`rounded-xl border border-gray-200 min-h-[200px] p-4 transition-colors
          ${isOver ? 'bg-mint border-brand-100' : 'bg-gray-50'}`}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-sm">No items scheduled</p>
            <button
              onClick={() => onCreateClick(dateStr)}
              className="mt-2 text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add item
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <Pill key={item.id} item={item} contentTypes={contentTypes} onClick={() => onItemClick(item)} onDragStart={onDragStart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarView({ onItemClick, onCreateClick, addToast, filters, onFiltersChange }: Props) {
  const { contentItems, contentTypes, refreshContentItems, linkedItemIds } = useApp();
  const [mode, setMode] = useState<CalMode>(() => (localStorage.getItem('calMode') as CalMode) ?? 'month');
  const [dateField, setDateField] = useState<DateField>(() => (localStorage.getItem('calDateField') as DateField) ?? 'due_date');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);

  const uniqueChannels = useMemo(() =>
    Array.from(new Set(contentItems.map(i => i.channel).filter(Boolean) as string[])),
    [contentItems]
  );

  const filtered = useMemo(() =>
    applyFilters(contentItems, filters, linkedItemIds).filter(i => i[dateField] != null),
    [contentItems, filters, linkedItemIds, dateField]
  );

  function getItemsForDate(date: Date): ContentItem[] {
    return filtered.filter(item => {
      const val = item[dateField];
      return val && isSameDay(parseISO(val), date);
    });
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    dragItemId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    setDropTargetDate(dateStr);
  }

  function handleDragLeave() {
    setDropTargetDate(null);
  }

  async function handleDrop(e: React.DragEvent, newDate: string) {
    e.preventDefault();
    setDropTargetDate(null);
    const itemId = dragItemId.current;
    dragItemId.current = null;
    if (!itemId || !newDate.match(/^\d{4}-\d{2}-\d{2}$/)) return;

    const { error } = await supabase
      .from('content_items')
      .update({ [dateField]: newDate })
      .eq('id', itemId);

    if (error) { addToast(error.message, 'error'); return; }
    addToast('Rescheduled');
    refreshContentItems();
  }

  function navigate(dir: 'prev' | 'next') {
    if (mode === 'month') setCursor(dir === 'prev' ? subMonths(cursor, 1) : addMonths(cursor, 1));
    else if (mode === 'week') setCursor(dir === 'prev' ? subWeeks(cursor, 1) : addWeeks(cursor, 1));
    else setCursor(dir === 'prev' ? subDays(cursor, 1) : addDays(cursor, 1));
  }

  function goToday() { setCursor(startOfDay(new Date())); }

  function setModeAndPersist(m: CalMode) {
    setMode(m);
    localStorage.setItem('calMode', m);
  }

  function setDateFieldAndPersist(f: DateField) {
    setDateField(f);
    localStorage.setItem('calDateField', f);
  }

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const titleLabel = useMemo(() => {
    if (mode === 'month') return format(cursor, 'MMMM yyyy');
    if (mode === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(cursor, 'EEEE, MMMM d, yyyy');
  }, [mode, cursor]);

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header toolbar */}
      <div className="border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 flex-wrap bg-white">
        <FilterBar filters={filters} onChange={onFiltersChange} channels={uniqueChannels} showSearch={false} showLinksFilter showProject />

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['due_date', 'publish_date'] as DateField[]).map(f => (
              <button
                key={f}
                onClick={() => setDateFieldAndPersist(f)}
                className={`px-2.5 py-1.5 transition-colors ${dateField === f ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {f === 'due_date' ? 'Due date' : 'Publish date'}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['month', 'week', 'day'] as CalMode[]).map(m => (
              <button
                key={m}
                onClick={() => setModeAndPersist(m)}
                className={`px-3 py-1.5 capitalize transition-colors ${mode === m ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100 bg-white">
        <button onClick={goToday} className="px-3 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          Today
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('prev')} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('next')} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{titleLabel}</h2>
        <div className="ml-auto">
          <button
            onClick={() => onCreateClick()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto">
        {mode === 'month' && (
          <div className="min-h-full">
            <div className="grid grid-cols-7 border-b border-gray-100 sticky top-0 bg-white z-10">
              {DOW.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map(date => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  items={getItemsForDate(date)}
                  contentTypes={contentTypes}
                  isCurrentMonth={isSameMonth(date, cursor)}
                  onItemClick={onItemClick}
                  onCellClick={d => onCreateClick(format(d, 'yyyy-MM-dd'))}
                  onDragStart={handleDragStart}
                  dropTargetDate={dropTargetDate}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragLeave={handleDragLeave}
                />
              ))}
            </div>
          </div>
        )}

        {mode === 'week' && (
          <div className="min-h-full">
            {weekDays.map(date => (
              <WeekRow
                key={date.toISOString()}
                date={date}
                items={getItemsForDate(date)}
                contentTypes={contentTypes}
                onItemClick={onItemClick}
                onDragStart={handleDragStart}
                dropTargetDate={dropTargetDate}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
              />
            ))}
          </div>
        )}

        {mode === 'day' && (
          <DayContainer
            date={cursor}
            items={getItemsForDate(cursor)}
            contentTypes={contentTypes}
            onItemClick={onItemClick}
            onCreateClick={onCreateClick}
            onDragStart={handleDragStart}
            dropTargetDate={dropTargetDate}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
          />
        )}
      </div>
    </div>
  );
}
