import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWorkspace }  from './WorkspaceContext';

export type ViewType = 'home' | 'list' | 'board' | 'calendar' | 'projects' | 'settings' | 'intake-queue' | 'my-work';
type CalendarViewType = 'month' | 'week' | 'day';

interface ViewPersistenceContextValue {
  lastUsedView: ViewType;
  setLastUsedView: (view: ViewType) => void;
  calendarViewType: CalendarViewType;
  setCalendarViewType: (view: CalendarViewType) => void;
}

const ViewPersistenceContext = createContext<ViewPersistenceContextValue | null>(null);

const VIEW_STORAGE_KEY_PREFIX = 'cc-lastView-';
const CALENDAR_VIEW_STORAGE_KEY_PREFIX = 'cc-calendarView-';

export function ViewPersistenceProvider({ children }: { children: React.ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  const [lastUsedView, setLastUsedViewState] = useState<ViewType>('home');
  const [calendarViewType, setCalendarViewTypeState] = useState<CalendarViewType>('month');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load persisted values when workspace changes
  useEffect(() => {
    if (!currentWorkspace) {
      setIsInitialized(true);
      return;
    }

    // Load last used view
    const viewStorageKey = `${VIEW_STORAGE_KEY_PREFIX}${currentWorkspace.id}`;
    const savedView = localStorage.getItem(viewStorageKey);
    if (savedView && ['home', 'list', 'board', 'calendar', 'projects', 'settings'].includes(savedView)) {
      setLastUsedViewState(savedView as ViewType);
    }

    // Load calendar view type
    const calendarStorageKey = `${CALENDAR_VIEW_STORAGE_KEY_PREFIX}${currentWorkspace.id}`;
    const savedCalendarView = localStorage.getItem(calendarStorageKey);
    if (savedCalendarView && ['month', 'week', 'day'].includes(savedCalendarView)) {
      setCalendarViewTypeState(savedCalendarView as CalendarViewType);
    }

    setIsInitialized(true);
  }, [currentWorkspace]);

  const setLastUsedView = useCallback((view: ViewType) => {
    setLastUsedViewState(view);
    if (currentWorkspace) {
      localStorage.setItem(`${VIEW_STORAGE_KEY_PREFIX}${currentWorkspace.id}`, view);
    }
  }, [currentWorkspace]);

  const setCalendarViewType = useCallback((view: CalendarViewType) => {
    setCalendarViewTypeState(view);
    if (currentWorkspace) {
      localStorage.setItem(`${CALENDAR_VIEW_STORAGE_KEY_PREFIX}${currentWorkspace.id}`, view);
    }
  }, [currentWorkspace]);

  // Don't render children until we've loaded persisted values
  if (!isInitialized) {
    return null;
  }

  return (
    <ViewPersistenceContext.Provider value={{
      lastUsedView,
      setLastUsedView,
      calendarViewType,
      setCalendarViewType,
    }}>
      {children}
    </ViewPersistenceContext.Provider>
  );
}

export function useViewPersistence() {
  const ctx = useContext(ViewPersistenceContext);
  if (!ctx) throw new Error('useViewPersistence must be used within ViewPersistenceProvider');
  return ctx;
}
