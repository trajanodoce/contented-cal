import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useViewPersistence } from '../contexts/ViewPersistenceContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { ContentItem, ContentType, Profile, BoardColumn, Project, Subtask } from '../lib/database.types';
import { parseLocalDate } from '../lib/utils';
import { isOrdinalItem, isLinearItem, ORDINAL_COLOR, LINEAR_COLOR } from '../lib/ordinal';
import { useSubtaskCounts, SubtaskCount } from '../hooks/useSubtaskCounts';
import { useExternalLinkCounts, LinkInfo } from '../hooks/useExternalLinkCounts';
import { useGranolaItemIds } from '../hooks/useGranolaNotes';
import { useFilters } from '../contexts/FiltersContext';
import { FilterBar, applyFilters } from '../components/FilterBar';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { CreateItemModal, MeetingPrefill } from '../components/content/CreateItemModal';
import { GranolaNotePickerModal } from '../components/content/GranolaNotePickerModal';
import type { GranolaNoteSummary } from '../hooks/useGranolaSync';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  Columns,
  List,
  User,
  Plus,
  Link2,
  FolderOpen,
  CheckSquare,
  Flag,
  Mic,
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
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
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

// Droppable wrapper for calendar day cells — enables drag-and-drop rescheduling
function DroppableDayCell({ dateId, children, className, onClick }: {
  dateId: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateId });
  return (
    <div
      ref={setNodeRef}
      className={`overflow-hidden min-w-0 ${className || ''} ${isOver ? 'ring-2 ring-inset ring-brand-400 !bg-brand-50/60' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CalendarItemPillProps {
  item: ContentItem;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  dateMode: DateMode;
  subtaskCount?: SubtaskCount;
  linkInfo?: LinkInfo;
  hasGranolaNotes?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function CalendarItemPill({ item, contentTypes, boardColumns, members, dateMode, subtaskCount, linkInfo, hasGranolaNotes, onClick }: CalendarItemPillProps) {
  const contentType = contentTypes.find((ct) => ct.id === item.content_type_id);
  const itemMembers = members.filter((m) => item.assignee_ids?.includes(m.id));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
  const statusCol = boardColumns.find(c => c.id === item.status);
  const statusName = statusCol?.name?.toLowerCase();
  const isDone = statusName === 'published' || statusName === 'completed';
  const isOverdue = dateField && isPast(parseLocalDate(dateField)) && !isToday(parseLocalDate(dateField)) && !isDone;

  const borderColor = isOverdue ? '#ef4444' : contentType?.color || '#e2e8f0';
  const isOrdinal = isOrdinalItem(item);
  const isLinear = isLinearItem(item);

  const itemBg = isOrdinal ? `${ORDINAL_COLOR}0A` : isLinear ? `${LINEAR_COLOR}0A` : 'white';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-slate-100 transition-colors border shadow-sm mb-1 overflow-hidden min-w-0"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 1 : 1,
        borderLeftColor: isLinear ? LINEAR_COLOR : borderColor,
        borderLeftWidth: '2px',
        backgroundColor: itemBg,
      }}
    >
      {isLinear && (
        <span
          className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-bold"
          style={{ backgroundColor: `${LINEAR_COLOR}20`, color: LINEAR_COLOR }}
        >
          L
        </span>
      )}
      <span className="truncate flex-1 font-medium text-slate-700">{item.title}</span>
      {subtaskCount && subtaskCount.total > 0 && subtaskCount.completed < subtaskCount.total && (
        <span
          className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
          title={`${subtaskCount.completed}/${subtaskCount.total} subtasks done`}
        />
      )}
      {linkInfo && linkInfo.count > 0 && (
        <span title={`${linkInfo.count} linked asset${linkInfo.count !== 1 ? 's' : ''}`}>
          <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
        </span>
      )}
      {hasGranolaNotes && (
        <span title="Has meeting notes">
          <Mic className="w-3 h-3 flex-shrink-0" style={{ color: '#345A11' }} />
        </span>
      )}
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

// Subtask with parent content item info
interface SubtaskWithParent extends Subtask {
  parentTitle?: string;
}

// Project start/end marker pill for calendar cells
function ProjectMarker({ project, type }: { project: Project; type: 'start' | 'end' }) {
  const isStart = type === 'start';
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate"
      style={{
        backgroundColor: isStart ? '#dbeafe' : '#fef3c7',
        color: isStart ? '#1d4ed8' : '#92400e',
      }}
      title={`${project.title} — ${isStart ? 'starts' : 'ends'}`}
    >
      {isStart ? (
        <FolderOpen className="w-2.5 h-2.5 flex-shrink-0" />
      ) : (
        <Flag className="w-2.5 h-2.5 flex-shrink-0" />
      )}
      <span className="truncate">{project.title}</span>
    </div>
  );
}

// Subtask due date pill for calendar cells
function SubtaskPill({ subtask }: { subtask: SubtaskWithParent }) {
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate ${
        subtask.completed
          ? 'bg-green-50 text-green-600 line-through'
          : 'bg-slate-100 text-slate-500'
      }`}
      title={`Subtask: ${subtask.title}${subtask.parentTitle ? ` (${subtask.parentTitle})` : ''}`}
    >
      <CheckSquare className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="truncate">{subtask.title}</span>
    </div>
  );
}

// CSS grid template for collapsible weekends (Mon–Sun, weekStartsOn=1 → indices 5,6 are Sat,Sun)
// Use minmax(0, 1fr) instead of 1fr to prevent content from inflating column width
const GRID_COLS_EXPANDED = 'repeat(7, minmax(0, 1fr))';
const GRID_COLS_COLLAPSED = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 40px 40px';

// Single-month grid used by MonthView
interface SingleMonthGridProps {
  monthDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  dateMode: DateMode;
  subtaskCounts: Map<string, SubtaskCount>;
  linkCounts: Map<string, LinkInfo>;
  projects: Project[];
  subtasks: SubtaskWithParent[];
  granolaItemIds: Set<string>;
  weekendsCollapsed: boolean;
  onToggleWeekends: () => void;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
  onShowMore: (date: Date) => void;
}

function SingleMonthGrid({ monthDate, items, contentTypes, boardColumns, members, dateMode, subtaskCounts, linkCounts, projects, subtasks, granolaItemIds, weekendsCollapsed, onToggleWeekends, onItemClick, onDateClick, onShowMore }: SingleMonthGridProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
      if (!dateField) return false;
      return isSameDay(parseLocalDate(dateField), date);
    });
  };

  const getProjectMarkersForDate = (date: Date) => {
    const markers: { project: Project; type: 'start' | 'end' }[] = [];
    for (const p of projects) {
      if (p.start_date && isSameDay(parseLocalDate(p.start_date), date)) {
        markers.push({ project: p, type: 'start' });
      }
      if (p.end_date && isSameDay(parseLocalDate(p.end_date), date)) {
        markers.push({ project: p, type: 'end' });
      }
    }
    return markers;
  };

  const getSubtasksForDate = (date: Date) => {
    return subtasks.filter((st) => st.due_date && isSameDay(parseLocalDate(st.due_date), date));
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const gridCols = weekendsCollapsed ? GRID_COLS_COLLAPSED : GRID_COLS_EXPANDED;

  return (
    <>
      <div className="grid" style={{ backgroundColor: '#115e59', gridTemplateColumns: gridCols }}>
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={`px-2 py-2 text-center text-xs font-semibold text-white uppercase tracking-wide ${
              i >= 5 && weekendsCollapsed ? 'cursor-pointer hover:bg-teal-700 transition-colors' : ''
            }`}
            onClick={i >= 5 && weekendsCollapsed ? onToggleWeekends : undefined}
            title={i >= 5 && weekendsCollapsed ? 'Click to expand weekends' : undefined}
          >
            {weekendsCollapsed && i >= 5 ? day.charAt(0) : day}
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: gridCols, gridAutoRows: 'minmax(120px, auto)' }}>
        {days.map((day, index) => {
          const dayItems = getItemsForDate(day);
          const dayProjectMarkers = getProjectMarkersForDate(day);
          const daySubtasks = getSubtasksForDate(day);
          const isCurrentMonth = isSameMonth(day, monthDate);
          const isTodayDate = isToday(day);
          const totalSlots = dayItems.length + dayProjectMarkers.length + daySubtasks.length;
          const isWeekend = index % 7 >= 5;
          const collapsed = isWeekend && weekendsCollapsed;

          return (
            <DroppableDayCell
              key={day.toISOString()}
              dateId={format(day, 'yyyy-MM-dd')}
              className={`${collapsed ? 'min-h-[120px] p-1' : 'min-h-[120px] p-2'} border-b-[1.5px] border-r-[1.5px] border-slate-300 ${
                !isCurrentMonth ? 'bg-slate-50/50' : collapsed ? 'bg-slate-50/80' : 'bg-white'
              } ${index % 7 === 6 ? 'border-r-0' : ''}`}
              onClick={() => collapsed ? onToggleWeekends() : onDateClick(day)}
            >
              {collapsed ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isTodayDate ? 'bg-brand-600 text-white' : ''
                    }`}
                    style={!isTodayDate ? { color: isCurrentMonth ? '#0B4463' : '#94a3b8' } : undefined}
                  >
                    {format(day, 'd')}
                  </span>
                  {totalSlots > 0 && (
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center">
                      {totalSlots}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                        isTodayDate ? 'bg-brand-600 text-white' : ''
                      }`}
                      style={!isTodayDate ? { color: isCurrentMonth ? '#0B4463' : '#94a3b8' } : undefined}
                    >
                      {format(day, 'd')}
                    </span>
                    {totalSlots > 0 && (
                      <span className="text-xs text-slate-400">{totalSlots}</span>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 overflow-hidden">
                    {dayProjectMarkers.map((m) => (
                      <ProjectMarker key={`proj-${m.type}-${m.project.id}`} project={m.project} type={m.type} />
                    ))}
                    {dayItems.slice(0, 3).map((item) => (
                      <CalendarItemPill
                        key={item.id}
                        item={item}
                        contentTypes={contentTypes}
                        boardColumns={boardColumns}
                        members={members}
                        dateMode={dateMode}
                        subtaskCount={subtaskCounts.get(item.id)}
                        linkInfo={linkCounts.get(item.id)}
                        hasGranolaNotes={granolaItemIds.has(item.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                      />
                    ))}
                    {daySubtasks.slice(0, 2).map((st) => (
                      <SubtaskPill key={`sub-${st.id}`} subtask={st} />
                    ))}
                    {dayItems.length > 3 && (
                      <button
                        className="text-xs text-slate-500 hover:text-brand-600 px-1 py-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowMore(day);
                        }}
                      >
                        +{dayItems.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </DroppableDayCell>
          );
        })}
      </div>
    </>
  );
}

// Month View: 3 stacked full-width months (expandable to 6)
interface MonthViewProps {
  currentDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  dateMode: DateMode;
  subtaskCounts: Map<string, SubtaskCount>;
  linkCounts: Map<string, LinkInfo>;
  projects: Project[];
  subtasks: SubtaskWithParent[];
  granolaItemIds: Set<string>;
  weekendsCollapsed: boolean;
  onToggleWeekends: () => void;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
  onShowMore: (date: Date) => void;
}

function MonthView({ currentDate, items, contentTypes, boardColumns, members, dateMode, subtaskCounts, linkCounts, projects, subtasks, granolaItemIds, weekendsCollapsed, onToggleWeekends, onItemClick, onDateClick, onShowMore }: MonthViewProps) {
  const [expanded, setExpanded] = useState(false);
  const monthCount = expanded ? 6 : 3;
  const months = Array.from({ length: monthCount }, (_, i) => addMonths(currentDate, i));

  return (
    <div className="space-y-0">
      {months.map((monthDate, idx) => (
        <div key={monthDate.toISOString()} className="bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ marginTop: idx > 0 ? '-1px' : 0 }}>
          {/* Month header bar */}
          <div
            className="px-5 py-3 border-b border-slate-200"
            style={{ background: 'linear-gradient(135deg, #B1CDDC 0%, #c8dde8 100%)' }}
          >
            <h3 className="text-lg font-bold text-white tracking-wide" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              {format(monthDate, 'MMMM yyyy')}
            </h3>
          </div>
          <SingleMonthGrid
            monthDate={monthDate}
            items={items}
            contentTypes={contentTypes}
            boardColumns={boardColumns}
            members={members}
            dateMode={dateMode}
            subtaskCounts={subtaskCounts}
            linkCounts={linkCounts}
            projects={projects}
            subtasks={subtasks}
            granolaItemIds={granolaItemIds}
            weekendsCollapsed={weekendsCollapsed}
            onToggleWeekends={onToggleWeekends}
            onItemClick={onItemClick}
            onDateClick={onDateClick}
            onShowMore={onShowMore}
          />
        </div>
      ))}

      {/* View More / View Less button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              View Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              View More
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Week View Component
interface WeekViewProps {
  currentDate: Date;
  items: ContentItem[];
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  dateMode: DateMode;
  subtaskCounts: Map<string, SubtaskCount>;
  linkCounts: Map<string, LinkInfo>;
  projects: Project[];
  subtasks: SubtaskWithParent[];
  granolaItemIds: Set<string>;
  weekendsCollapsed: boolean;
  onToggleWeekends: () => void;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
}

function WeekView({ currentDate, items, contentTypes, boardColumns, members, dateMode, subtaskCounts, linkCounts, projects, subtasks, granolaItemIds, weekendsCollapsed, onToggleWeekends, onItemClick, onDateClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
      if (!dateField) return false;
      return isSameDay(parseLocalDate(dateField), date);
    });
  };

  const getProjectMarkersForDate = (date: Date) => {
    const markers: { project: Project; type: 'start' | 'end' }[] = [];
    for (const p of projects) {
      if (p.start_date && isSameDay(parseLocalDate(p.start_date), date)) {
        markers.push({ project: p, type: 'start' });
      }
      if (p.end_date && isSameDay(parseLocalDate(p.end_date), date)) {
        markers.push({ project: p, type: 'end' });
      }
    }
    return markers;
  };

  const getSubtasksForDate = (date: Date) => {
    return subtasks.filter((st) => st.due_date && isSameDay(parseLocalDate(st.due_date), date));
  };

  const gridCols = weekendsCollapsed ? GRID_COLS_COLLAPSED : GRID_COLS_EXPANDED;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="grid" style={{ backgroundColor: '#115e59', gridTemplateColumns: gridCols }}>
        {days.map((day, i) => {
          const isTodayDate = isToday(day);
          const isWeekend = i >= 5;
          const collapsed = isWeekend && weekendsCollapsed;
          return (
            <div
              key={day.toISOString()}
              className={`${collapsed ? 'px-1 py-2' : 'px-2 py-3'} text-center border-r border-teal-700 last:border-r-0 ${
                isTodayDate ? 'bg-teal-700' : ''
              } ${collapsed ? 'cursor-pointer hover:bg-teal-700 transition-colors' : ''}`}
              onClick={collapsed ? onToggleWeekends : undefined}
              title={collapsed ? 'Click to expand weekends' : undefined}
            >
              <div className={`text-xs font-semibold uppercase mb-1 tracking-wide ${isTodayDate ? 'text-teal-100' : 'text-teal-200'}`}>
                {collapsed ? format(day, 'EEEEE') : format(day, 'EEE')}
              </div>
              <div
                className={`${collapsed ? 'text-sm w-6 h-6' : 'text-lg w-8 h-8'} font-semibold flex items-center justify-center mx-auto rounded-full ${
                  isTodayDate ? 'bg-white text-teal-900' : 'text-white'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid auto-rows-fr min-h-[400px]" style={{ gridTemplateColumns: gridCols }}>
        {days.map((day, i) => {
          const dayItems = getItemsForDate(day);
          const dayProjectMarkers = getProjectMarkersForDate(day);
          const daySubtasks = getSubtasksForDate(day);
          const isTodayDate = isToday(day);
          const isWeekend = i >= 5;
          const collapsed = isWeekend && weekendsCollapsed;
          const totalCount = dayItems.length + dayProjectMarkers.length + daySubtasks.length;

          return (
            <DroppableDayCell
              key={day.toISOString()}
              dateId={format(day, 'yyyy-MM-dd')}
              className={`${collapsed ? 'p-1' : 'p-2'} border-r border-slate-100 last:border-r-0 border-b border-slate-100 min-h-[100px] ${
                isTodayDate ? 'bg-brand-50/30' : collapsed ? 'bg-slate-50/80' : ''
              }`}
              onClick={() => collapsed ? onToggleWeekends() : onDateClick(day)}
            >
              {collapsed ? (
                <div className="flex flex-col items-center gap-1 mt-2">
                  {totalCount > 0 && (
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center">
                      {totalCount}
                    </span>
                  )}
                </div>
              ) : (
              <div className="space-y-2">
                {dayProjectMarkers.map((m) => (
                  <ProjectMarker key={`proj-${m.type}-${m.project.id}`} project={m.project} type={m.type} />
                ))}
                {dayItems.map((item) => {
                  const statusCol = boardColumns.find(c => c.id === item.status);
                  const statusName = statusCol?.name?.toLowerCase();
                  const isDone = statusName === 'published' || statusName === 'completed';
                  const itemDate = dateMode === 'due' ? item.due_date : item.publish_date;
                  const isOverdue = itemDate && isPast(parseLocalDate(itemDate)) && !isToday(parseLocalDate(itemDate)) && !isDone;
                  const ctColor = contentTypes.find(ct => ct.id === item.content_type_id)?.color || '#e2e8f0';
                  const borderColor = isOverdue ? '#ef4444' : ctColor;

                  return (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(item);
                    }}
                    className="bg-white rounded p-2 hover:shadow-sm transition-shadow cursor-pointer"
                    style={{ border: '1px solid #e2e8f0', borderLeftColor: borderColor, borderLeftWidth: '2px' }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: contentTypes.find(ct => ct.id === item.content_type_id)?.color || 'transparent' }}
                      />
                      <span className="text-sm font-medium text-slate-900 line-clamp-2">{item.title}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
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
                        {(() => {
                          const sc = subtaskCounts.get(item.id);
                          return sc && sc.total > 0 && sc.completed < sc.total ? (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                              title={`${sc.completed}/${sc.total} subtasks done`}
                            />
                          ) : null;
                        })()}
                        {(() => {
                          const li = linkCounts.get(item.id);
                          return li && li.count > 0 ? (
                            <span title={`${li.count} linked asset${li.count !== 1 ? 's' : ''}`}>
                              <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            </span>
                          ) : null;
                        })()}
                        {granolaItemIds.has(item.id) && (
                          <span title="Has meeting notes">
                            <Mic className="w-3 h-3 flex-shrink-0" style={{ color: '#345A11' }} />
                          </span>
                        )}
                      </div>
                      {item.priority && item.priority !== 'low' && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: priorityColors[item.priority] }}
                        />
                      )}
                    </div>
                  </div>
                  );
                })}
                {daySubtasks.map((st) => (
                  <SubtaskPill key={`sub-${st.id}`} subtask={st} />
                ))}
              </div>
              )}
            </DroppableDayCell>
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
  boardColumns: BoardColumn[];
  members: Profile[];
  dateMode: DateMode;
  subtaskCounts: Map<string, SubtaskCount>;
  linkCounts: Map<string, LinkInfo>;
  projects: Project[];
  subtasks: SubtaskWithParent[];
  granolaItemIds: Set<string>;
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
}

function DayView({ currentDate, items, contentTypes, boardColumns, members, dateMode, projects, subtasks, granolaItemIds, onItemClick, onDateClick }: DayViewProps) {
  const dayItems = items.filter((item) => {
    const dateField = dateMode === 'due' ? item.due_date : item.publish_date;
    if (!dateField) return false;
    return isSameDay(parseLocalDate(dateField), currentDate);
  });

  const dayProjectMarkers = useMemo(() => {
    const markers: { project: Project; type: 'start' | 'end' }[] = [];
    for (const p of projects) {
      if (p.start_date && isSameDay(parseLocalDate(p.start_date), currentDate)) {
        markers.push({ project: p, type: 'start' });
      }
      if (p.end_date && isSameDay(parseLocalDate(p.end_date), currentDate)) {
        markers.push({ project: p, type: 'end' });
      }
    }
    return markers;
  }, [projects, currentDate]);

  const daySubtasks = useMemo(() => {
    return subtasks.filter((st) => st.due_date && isSameDay(parseLocalDate(st.due_date), currentDate));
  }, [subtasks, currentDate]);

  const hasAnyContent = dayItems.length > 0 || dayProjectMarkers.length > 0 || daySubtasks.length > 0;

  return (
    <DroppableDayCell dateId={format(currentDate, 'yyyy-MM-dd')} className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">
            {format(currentDate, 'EEEE, MMMM d')}
          </h3>
          <p className="text-slate-500 mt-1">
            {dayItems.length} item{dayItems.length !== 1 ? 's' : ''} scheduled
            {daySubtasks.length > 0 && ` · ${daySubtasks.length} subtask${daySubtasks.length !== 1 ? 's' : ''} due`}
          </p>
        </div>
        <button
          onClick={() => onDateClick(currentDate)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {!hasAnyContent ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No items scheduled for this day</p>
          <button
            onClick={() => onDateClick(currentDate)}
            className="text-brand-600 hover:text-brand-700 font-medium mt-2"
          >
            Schedule an item
          </button>
        </div>
      ) : (
        <div className="grid gap-3 max-w-2xl">
          {dayProjectMarkers.length > 0 && (
            <div className="space-y-2">
              {dayProjectMarkers.map((m) => (
                <div
                  key={`proj-${m.type}-${m.project.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: m.type === 'start' ? '#dbeafe' : '#fef3c7',
                    color: m.type === 'start' ? '#1d4ed8' : '#92400e',
                  }}
                >
                  {m.type === 'start' ? (
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Flag className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{m.project.title} — {m.type === 'start' ? 'Project starts' : 'Project ends'}</span>
                </div>
              ))}
            </div>
          )}
          {dayItems.map((item) => (
            <DayViewCardFull
              key={item.id}
              item={item}
              contentTypes={contentTypes}
              boardColumns={boardColumns}
              members={members}
              hasGranolaNotes={granolaItemIds.has(item.id)}
              onClick={() => onItemClick(item)}
            />
          ))}
          {daySubtasks.length > 0 && (
            <div className="mt-2">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Subtasks Due</h4>
              <div className="space-y-1.5">
                {daySubtasks.map((st) => (
                  <div
                    key={`sub-${st.id}`}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                      st.completed
                        ? 'bg-green-50 text-green-600 line-through'
                        : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{st.title}</span>
                    {st.parentTitle && (
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">from {st.parentTitle}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DroppableDayCell>
  );
}

// Full Day View Card
interface DayViewCardFullProps {
  item: ContentItem;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  hasGranolaNotes?: boolean;
  onClick: () => void;
}

function DayViewCardFull({ item, contentTypes, boardColumns, members, hasGranolaNotes, onClick }: DayViewCardFullProps) {
  const contentType = contentTypes.find((ct) => ct.id === item.content_type_id);
  const itemMembers = members.filter((m) => item.assignee_ids?.includes(m.id));
  const statusCol = boardColumns.find(c => c.id === item.status);
  const statusName = statusCol?.name?.toLowerCase();
  const isDone = statusName === 'published' || statusName === 'completed';
  const isOverdue = item.due_date && isPast(parseLocalDate(item.due_date)) && !isToday(parseLocalDate(item.due_date)) && !isDone;
  const isOrdinal = isOrdinalItem(item);
  const isLinear = isLinearItem(item);
  const isExternal = isOrdinal || isLinear;

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
  });

  const externalBg = isOrdinal ? `${ORDINAL_COLOR}0A` : isLinear ? `${LINEAR_COLOR}0A` : undefined;

  const style = {
    transform: CSS.Translate.toString(transform),
    ...(externalBg ? { backgroundColor: externalBg } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-lg border p-4 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isExternal ? '' : 'bg-slate-50'
      } ${isOverdue ? 'border-red-300' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
          style={{ backgroundColor: isOverdue ? '#ef4444' : (priorityColors[item.priority ?? 'low'] || 'transparent') }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="font-medium text-slate-900 truncate">{item.title}</h4>
            {hasGranolaNotes && (
              <Mic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#345A11' }} title="Has meeting notes" />
            )}
          </div>

          {contentType && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: contentType.color ?? undefined }} />
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
  const { currentWorkspace, userRole } = useWorkspace();
  const canDrag = userRole === 'admin' || userRole === 'editor';
  const { calendarViewType, setCalendarViewType } = useViewPersistence();
  const { contentItems, contentItemsLoading, patchContentItem } = useApp();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subtasksRaw, setSubtasksRaw] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedItemId } = useSelectedItem();
  const { counts: subtaskCounts } = useSubtaskCounts(currentWorkspace?.id || null);
  const { links: linkCounts } = useExternalLinkCounts(currentWorkspace?.id || null);
  const granolaItemIds = useGranolaItemIds(currentWorkspace?.id || null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialDate, setCreateModalInitialDate] = useState<Date | null>(null);
  const [meetingPrefill, setMeetingPrefill] = useState<MeetingPrefill | null>(null);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Use persisted calendar view type
  const [view, setView] = useState<CalendarView>(calendarViewType);
  const [dateMode, setDateMode] = useState<DateMode>('due');
  const [weekendsCollapsed, setWeekendsCollapsed] = useState(() => {
    const saved = localStorage.getItem('cc-weekends-collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const [showOrdinal, setShowOrdinal] = useState(() => {
    const saved = localStorage.getItem('cc-show-ordinal');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleWeekends = useCallback(() => {
    setWeekendsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cc-weekends-collapsed', String(next));
      return next;
    });
  }, []);

  // Sync local view state with persistence
  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
    setCalendarViewType(newView);
  }, [setCalendarViewType]);

  const { filters, setFilters, isLoaded } = useFilters();
  const channels = useMemo(
    () => [...new Set(contentItems.map((item) => item.channel).filter(Boolean))] as string[],
    [contentItems],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      const [{ data: typesData }, { data: colsData }, { data: projectsData }, { data: subtasksData }] = await Promise.all([
        supabase.from('content_types').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
        supabase.from('board_columns').select('*').eq('workspace_id', currentWorkspace.id).order('position'),
        supabase.from('projects').select('*').eq('workspace_id', currentWorkspace.id).in('status', ['active']),
        supabase.from('subtasks').select('*, content_items!inner(title, workspace_id)').eq('content_items.workspace_id', currentWorkspace.id).not('due_date', 'is', null),
      ]);

      setContentTypes(typesData || []);
      setBoardColumns(colsData || []);
      setProjects(projectsData || []);
      setSubtasksRaw(subtasksData || []);

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
    let result = isLoaded ? applyFilters(contentItems, filters, linkCounts) : contentItems;
    if (!showOrdinal) result = result.filter(i => !isOrdinalItem(i));
    return result;
  }, [contentItems, filters, isLoaded, linkCounts, showOrdinal]);

  // Build subtasks with parent titles for calendar display
  const subtasksWithParent: SubtaskWithParent[] = useMemo(() => {
    const itemMap = new Map(contentItems.map((i) => [i.id, i.title]));
    return subtasksRaw.map((st) => ({
      ...st,
      parentTitle: itemMap.get(st.content_item_id) || undefined,
    }));
  }, [subtasksRaw, contentItems]);

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
    if (view === 'month') {
      const m3 = addMonths(currentDate, 2);
      return `${format(currentDate, 'MMM')} – ${format(m3, 'MMM yyyy')}`;
    }
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

  const handleDragStart = (_event: DragStartEvent) => {
    // drag start - no additional state needed
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!canDrag || !over) return;

    const itemId = active.id as string;
    const newDateStr = over.id as string;
    const newDate = parseLocalDate(newDateStr);

    const item = contentItems.find((i) => i.id === itemId);
    if (!item) return;

    const dateField = dateMode === 'due' ? 'due_date' : 'publish_date';
    const oldDate = item[dateField];

    if (oldDate && isSameDay(parseLocalDate(oldDate), newDate)) return;

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
    patchContentItem(itemId, { [dateField]: format(newDate, 'yyyy-MM-dd') });
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-slate-50">
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <FilterBar
            workspaceId={currentWorkspace?.id || null}
            contentTypes={contentTypes}
            boardColumns={boardColumns}
            members={members}
            channels={channels}
            linkCounts={linkCounts}
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={contentItems.length}
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
            <button
              onClick={() => setIsNotePickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" style={{ color: '#345A11' }} />
              From Meeting
            </button>
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
                color: showOrdinal ? '#7E61FF' : '#64748b',
              }}
              title={showOrdinal ? 'Hide Ordinal posts' : 'Show Ordinal posts'}
            >
              <div
                className="relative w-8 h-[18px] rounded-full transition-colors"
                style={{ backgroundColor: showOrdinal ? '#7E61FF' : '#CBD5E1' }}
              >
                <div
                  className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform"
                  style={{ left: showOrdinal ? '18px' : '2px' }}
                />
              </div>
              Ordinal
            </button>

            {view !== 'day' && (
              <button
                onClick={toggleWeekends}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  weekendsCollapsed
                    ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'border-brand-200 bg-brand-50 text-brand-700'
                }`}
                title={weekendsCollapsed ? 'Show weekends' : 'Collapse weekends'}
              >
                {weekendsCollapsed ? 'Show Weekends' : 'Hide Weekends'}
              </button>
            )}

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
              boardColumns={boardColumns}
              members={members}
              dateMode={dateMode}
              subtaskCounts={subtaskCounts}
              linkCounts={linkCounts}
              projects={projects}
              subtasks={subtasksWithParent}
              granolaItemIds={granolaItemIds}
              weekendsCollapsed={weekendsCollapsed}
              onToggleWeekends={toggleWeekends}
              onItemClick={(item: ContentItem) => setSelectedItemId(item.id)}
              onDateClick={handleDateClick}
              onShowMore={(date) => {
                setCurrentDate(date);
                handleViewChange('day');
              }}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              items={filteredItems}
              contentTypes={contentTypes}
              boardColumns={boardColumns}
              members={members}
              dateMode={dateMode}
              subtaskCounts={subtaskCounts}
              linkCounts={linkCounts}
              projects={projects}
              subtasks={subtasksWithParent}
              granolaItemIds={granolaItemIds}
              weekendsCollapsed={weekendsCollapsed}
              onToggleWeekends={toggleWeekends}
              onItemClick={(item: ContentItem) => setSelectedItemId(item.id)}
              onDateClick={handleDateClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              items={filteredItems}
              contentTypes={contentTypes}
              boardColumns={boardColumns}
              members={members}
              dateMode={dateMode}
              subtaskCounts={subtaskCounts}
              linkCounts={linkCounts}
              projects={projects}
              subtasks={subtasksWithParent}
              granolaItemIds={granolaItemIds}
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
            setMeetingPrefill(null);
          }}
          initialDate={createModalInitialDate ? format(createModalInitialDate, 'yyyy-MM-dd') : null}
          meetingPrefill={meetingPrefill}
        />
        <GranolaNotePickerModal
          isOpen={isNotePickerOpen}
          onClose={() => setIsNotePickerOpen(false)}
          onCreateFromNote={(note: GranolaNoteSummary) => {
            setIsNotePickerOpen(false);
            setMeetingPrefill({
              title: note.title || 'Untitled Meeting',
              description: `Meeting notes from: ${note.title || 'Untitled Meeting'}\nDate: ${note.created_at ? format(new Date(note.created_at), 'MMM d, yyyy') : 'Unknown'}`,
              granolaNoteId: note.id,
            });
            setIsCreateModalOpen(true);
          }}
        />
      </div>
    </DndContext>
  );
}

export default CalendarPage;
