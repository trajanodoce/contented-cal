import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { FilterState }  from '../components/FilterBar';

export { DEFAULT_FILTERS, type FilterState } from '../components/FilterBar';

interface FiltersContextValue {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  isLoaded: boolean;
  hasActiveFilters: boolean;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'cc-filters-';

export function FiltersProvider({
  children,
  workspaceId
}: {
  children: React.ReactNode;
  workspaceId: string | null;
}) {
  const [filters, setFiltersState] = useState<FilterState>({
    search: '',
    contentTypes: [],
    statuses: [],
    assignees: [],
    priorities: [],
    channels: [],
    projects: [],
    linkedPlatforms: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load filters from localStorage when workspace changes
  useEffect(() => {
    if (!workspaceId) {
      setIsLoaded(true);
      return;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${workspaceId}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFiltersState({
          search: parsed.search || '',
          contentTypes: parsed.contentTypes || [],
          statuses: parsed.statuses || [],
          assignees: parsed.assignees || [],
          priorities: parsed.priorities || [],
          channels: parsed.channels || [],
          projects: parsed.projects || [],
          linkedPlatforms: parsed.linkedPlatforms || [],
        });
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }

    setIsLoaded(true);
  }, [workspaceId]);

  // Save filters to localStorage when they change
  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersState(newFilters);
    if (workspaceId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(newFilters));
    }
  }, [workspaceId]);

  const resetFilters = useCallback(() => {
    const defaultFilters: FilterState = {
      search: '',
      contentTypes: [],
      statuses: [],
      assignees: [],
      priorities: [],
      channels: [],
      projects: [],
      linkedPlatforms: [],
    };
    setFilters(defaultFilters);
  }, [setFilters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.contentTypes.length > 0 ||
      filters.statuses.length > 0 ||
      filters.assignees.length > 0 ||
      filters.priorities.length > 0 ||
      filters.channels.length > 0 ||
      filters.projects.length > 0 ||
      filters.linkedPlatforms.length > 0
    );
  }, [filters]);

  return (
    <FiltersContext.Provider value={{
      filters,
      setFilters,
      resetFilters,
      isLoaded,
      hasActiveFilters,
    }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
