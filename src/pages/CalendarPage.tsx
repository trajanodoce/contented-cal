import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useViewPersistence } from '../contexts/ViewPersistenceContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, Profile } from '../lib/database.types';
import { useFilters } from '../contexts/FiltersContext';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { CreateItemModal } from '../components/content/CreateItemModal';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Columns,
  List,
  Clock,
  User,
  Plus,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
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

type CalendarView = 'month' | 'week' | 'day';
type DateMode = 'due' | 'publish';

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: 'transparent',
};

interface CalendarItemPillProps {
  item: ContentItem;
  contentTypes: ContentType[];
  members: Profile[];
  dateMode: DateMode;
  onClick: (e: React.MouseEvent) => void;
}

function CalendarItemPill({ item, contentTypes, members, dateMode, onClick }: CalendarItemPillProps) {
  const contentType = contentTypes.find((ct) => ct.id === item.content_type_id);
  const itemMembers = members.filter((m) => item.assignee_ids?.includes(m.id));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 1 : 1,
  };

  const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
  const isOverdue = dateField && isPast(new Date(dateField)) && !isToday(new Date(dateField));
  const isPublished = item.status === 'published';

  const borderColor = isOverdue && !isPublished ? '#ef4444' : contentType?.color || '#e2e8f0';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-slate-100 transition-colors bg-white border shadow-sm mb-1"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 1 : 1,
        borderLeftColor: borderColor,
        borderLeftWidth: '2px',
      }}
    >
      <span className="truncate flex-1 font-medium text-slate-700">{item.title}</span>
      {itemMembers[0] && (
        <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {itemMembers[0].avatar_url ? (
            <img src={itemMembers[0].avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-2 h-2 text-slate-600" />
          )}
        </div>
      )}
    </div>
  );
}

interface MonthViewProps {
  currentDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  members: Profile[];
  dateMode: DateMode;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
}

function MonthView({ currentDate, items, contentTypes, members, dateMode, onItemClick, onDateClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
      if (!dateField) return false;
      return isSameDay(new Date(dateField), date);
    });
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {weekDays.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, index) => {
          const dayItems = getItemsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] p-2 border-b border-r border-slate-100 ${
                !isCurrentMonth ? 'bg-slate-50/50' : 'bg-white'
              } ${index % 7 === 6 ? 'border-r-0' : ''}`}
              onClick={() => onDateClick(day)}
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    isTodayDate
                      ? 'bg-blue-600 text-white'
                      : isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-xs text-slate-400">{dayItems.length}</span>
                )}
              </div>

              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <CalendarItemPill
                    key={item.id}
                    item={item}
                    contentTypes={contentTypes}
                    members={members}
                    dateMode={dateMode}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(item);
                    }}
                  />
                ))}
                {dayItems.length > 3 && (
                  <button
                    className="text-xs text-slate-500 hover:text-blue-600 px-1 py-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    +{dayItems.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week View Component
interface WeekViewProps {
  currentDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  members: Profile[];
  dateMode: DateMode;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
}

function WeekView({ currentDate, items, contentTypes, members, dateMode, onItemClick, onDateClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
      if (!dateField) return false;
      return isSameDay(new Date(dateField), date);
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {days.map((day) => {
          const isTodayDate = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`px-2 py-3 text-center border-r border-slate-100 last:border-r-0 ${
                isTodayDate ? 'bg-blue-50' : ''
              }`}
            >
              <div className={`text-xs font-medium uppercase mb-1 ${isTodayDate ? 'text-blue-600' : 'text-slate-500'}`}>
                {format(day, 'EEE')}
              </div>
              <div
                className={`text-lg font-semibold w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                  isTodayDate ? 'bg-blue-600 text-white' : 'text-slate-900'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr min-h-[400px]">
        {days.map((day) => {
          const dayItems = getItemsForDate(day);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`p-2 border-r border-slate-100 last:border-r-0 border-b border-slate-100 min-h-[100px] ${
                isTodayDate ? 'bg-blue-50/30' : ''
              }`}
              onClick={() => onDateClick(day)}
            >
              <div className="space-y-2">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(item);
                    }}
                    className="bg-white rounded border border-slate-200 p-2 hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: contentTypes.find(ct => ct.id === item.content_type_id)?.color || 'transparent' }}
                      />
                      <span className="text-sm font-medium text-slate-900 line-clamp-2">{item.title}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex -space-x-1">
                        {members.filter(m => item.assignee_ids?.includes(m.id)).slice(0, 2).map(m => (
                          <div key={m.id} className="w-5 h-5 rounded-full bg-slate-200 border border-white overflow-hidden">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3 h-3 text-slate-500" />
                            )}
                          </div>
                        ))}
                      </div>
                      {item.priority !== 'low' && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: priorityColors[item.priority] }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day View Component
interface DayViewProps {
  currentDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  members: Profile[];
  dateMode: DateMode;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
}

function DayView({ currentDate, items, contentTypes, members, dateMode, onItemClick, onDateClick }: DayViewProps) {
  const dayItems = items.filter((item) => {
    const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
    if (!dateField) return false;
    return isSameDay(new Date(dateField), currentDate);
  });

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">
            {format(currentDate, 'EEEE, MMMM d')}
          </h3>
          <p className="text-slate-500 mt-1">
            {dayItems.length} item{dayItems.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        <button
          onClick={() => onDateClick(currentDate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {dayItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No items scheduled for this day</p>
          <button
            onClick={() => onDateClick(currentDate)}
            className="text-blue-600 hover:text-blue-700 font-medium mt-2"
          >
            Schedule an item
          </button>
        </div>
      ) : (
        <div className="grid gap-3 max-w-2xl">
          {dayItems.map((item) => (
            <DayViewCardFull
              key={item.id}
              item={item}
              contentTypes={contentTypes}
              members={members}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Full Day View Card
interface DayViewCardFullProps {
  item: ContentItem;
  contentTypes: ContentType[];
  members: Profile[];
  onClick: () => void;
}

function DayViewCardFull({ item, contentTypes, members, onClick }: DayViewCardFullProps) {
  const contentType = contentTypes.find((ct) => ct.id === item.content_type_id);
  const itemMembers = members.filter((m) => item.assignee_ids?.includes(m.id));

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="bg-slate-50 rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityColors[item.priority] || 'transparent' }}
        />

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-900 mb-1 truncate">{item.title}</h4>

          {contentType && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: contentType.color }} />
              <span className="text-xs text-slate-500">{contentType.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {itemMembers.slice(0, 3).map((member) => (
                <div
                  key={member.id}
                  className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center overflow-hidden"
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-2.5 h-2.5 text-slate-500" />
                  )}
                </div>
              ))}
            </div>
            {itemMembers.length > 3 && (
              <span className="text-xs text-slate-500">+{itemMembers.length - 3}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const { currentWorkspace } = useWorkspace();
  const { calendarViewType, setCalendarViewType } = useViewPersistence();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialDate, setCreateModalInitialDate] = useState<Date | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  // Use persisted calendar view type
  const [view, setView] = useState<CalendarView>(calendarViewType);
  const [dateMode, setDateMode] = useState<DateMode>('due');

  // Sync local view state with persistence
  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
    setCalendarViewType(newView);
  }, [setCalendarViewType]);

  const { filters, setFilters, isLoaded } = useFilters();
  const [channels, setChannels] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const [{ data: itemsData }, { data: typesData }] = await Promise.all([
        supabase.from('content_items').select('*').eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false }),
        supabase.from('content_types').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      ]);

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
      console.error('Error fetching calendar data:', err);
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

  const goToToday = () => setCurrentDate(new Date());
  const goToPrevious = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const goToNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const getHeaderTitle = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  const handleDateClick = (date: Date) => {
    setCreateModalInitialDate(date);
    setIsCreateModalOpen(true);
  };

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
    const newDateStr = over.id as string;
    const newDate = new Date(newDateStr);

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const dateField = dateMode === 'due' ? 'due_date' : 'publish_date';
    const oldDate = item[dateField];

    if (oldDate && isSameDay(new Date(oldDate), newDate)) return;

    const { error } = await supabase
      .from('content_items')
      .update({ [dateField]: format(newDate, 'yyyy-MM-dd') })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to reschedule: ' + error.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      content_item_id: itemId,
      user_id: user?.id || null,
      action: `rescheduled to ${format(newDate, 'MMM d, yyyy')}`,
      metadata: { previousDate: oldDate, newDate: format(newDate, 'yyyy-MM-dd'), dateMode },
    });

    toast.success(`Rescheduled "${item.title}" to ${format(newDate, 'MMM d')}`);
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, [dateField]: format(newDate, 'yyyy-MM-dd') } : i
      )
    );
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '1' },
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-slate-50">
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <FilterBar
            workspaceId={currentWorkspace?.id || null}
            contentTypes={contentTypes}
            boardColumns={[]}
            members={members}
            channels={channels}
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={items.length}
            filteredCount={filteredItems.length}
          />
        </div>

        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-900 min-w-[200px]">{getHeaderTitle()}</h2>
            <div className="flex items-center gap-1">
              <button onClick={goToPrevious} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
                Today
              </button>
              <button onClick={goToNext} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setDateMode('due')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateMode === 'due' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Due Date
              </button>
              <button
                onClick={() => setDateMode('publish')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateMode === 'publish' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Publish Date
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => handleViewChange('month')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  view === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Month
              </button>
              <button
                onClick={() => handleViewChange('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  view === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-4 h-4" />
                Week
              </button>
              <button
                onClick={() => handleViewChange('day')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  view === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-4 h-4" />
                Day
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              items={filteredItems}
              contentTypes={contentTypes}
              members={members}
              dateMode={dateMode}
              onItemClick={(item: ContentItem) => setSelectedItemId(item.id)}
              onDateClick={handleDateClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              items={filteredItems}
              contentTypes={contentTypes}
              members={members}
              dateMode={dateMode}
              onItemClick={(item: ContentItem) => setSelectedItemId(item.id)}
              onDateClick={handleDateClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              items={filteredItems}
              contentTypes={contentTypes}
              members={members}
              dateMode={dateMode}
              onItemClick={(item: ContentItem) => setSelectedItemId(item.id)}
              onDateClick={handleDateClick}
            />
          )}
        </div>

        <CreateItemModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateModalInitialDate(null);
          }}
          initialDueDate={dateMode === 'due' ? createModalInitialDate : null}
          initialPublishDate={dateMode === 'publish' ? createModalInitialDate : null}
        />
      </div>
    </DndContext>
  );
}

export default CalendarPage;
