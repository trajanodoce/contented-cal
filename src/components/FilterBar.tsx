import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, X, ChevronDown, Check, User } from 'lucide-react';
import type { ContentType, BoardColumn, Profile } from '../lib/database.types';

export interface FilterState {
  search: string;
  contentTypes: string[];
  statuses: string[];
  assignees: string[];
  priorities: string[];
  channels: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  contentTypes: [],
  statuses: [],
  assignees: [],
  priorities: [],
  channels: [],
};

interface FilterBarProps {
  workspaceId: string | null;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  channels: string[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: '#9ca3af' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
] as const;

export function FilterBar({
  workspaceId,
  contentTypes,
  boardColumns,
  members,
  channels,
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, filters, onFiltersChange]);

  // Persist filters to localStorage
  useEffect(() => {
    if (workspaceId) {
      const storageKey = `filters_${workspaceId}`;
      localStorage.setItem(storageKey, JSON.stringify(filters));
    }
  }, [filters, workspaceId]);

  const hasActiveFilters =
    filters.search ||
    filters.contentTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.assignees.length > 0 ||
    filters.priorities.length > 0 ||
    filters.channels.length > 0;

  const clearFilters = () => {
    setSearchValue('');
    onFiltersChange({ ...DEFAULT_FILTERS });
  };

  // Count active filters per category
  const activeFilterCounts = useMemo(() => ({
    types: filters.contentTypes.length,
    statuses: filters.statuses.length,
    assignees: filters.assignees.length,
    priorities: filters.priorities.length,
    channels: filters.channels.length,
  }), [filters]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-shrink-0 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Content Type filter */}
        <FilterDropdown
          label="Type"
          count={activeFilterCounts.types}
          options={contentTypes.map((ct) => ({ id: ct.id, label: ct.name, color: ct.color }))}
          selectedIds={filters.contentTypes}
          onToggle={(id) => {
            const newSet = filters.contentTypes.includes(id)
              ? filters.contentTypes.filter((t) => t !== id)
              : [...filters.contentTypes, id];
            onFiltersChange({ ...filters, contentTypes: newSet });
          }}
        />

        {/* Status filter */}
        <FilterDropdown
          label="Status"
          count={activeFilterCounts.statuses}
          options={boardColumns.map((bc) => ({ id: bc.id, label: bc.name, color: bc.color }))}
          selectedIds={filters.statuses}
          onToggle={(id) => {
            const newSet = filters.statuses.includes(id)
              ? filters.statuses.filter((s) => s !== id)
              : [...filters.statuses, id];
            onFiltersChange({ ...filters, statuses: newSet });
          }}
        />

        {/* Assignee filter */}
        <FilterDropdown
          label="Assignee"
          count={activeFilterCounts.assignees}
          options={members.map((m) => ({ id: m.id, label: m.full_name || m.email, avatarUrl: m.avatar_url }))}
          selectedIds={filters.assignees}
          onToggle={(id) => {
            const newSet = filters.assignees.includes(id)
              ? filters.assignees.filter((a) => a !== id)
              : [...filters.assignees, id];
            onFiltersChange({ ...filters, assignees: newSet });
          }}
        />

        {/* Priority filter */}
        <FilterDropdown
          label="Priority"
          count={activeFilterCounts.priorities}
          options={priorityOptions.map((p) => ({ id: p.value, label: p.label, color: p.color }))}
          selectedIds={filters.priorities}
          onToggle={(id) => {
            const newSet = filters.priorities.includes(id)
              ? filters.priorities.filter((p) => p !== id)
              : [...filters.priorities, id];
            onFiltersChange({ ...filters, priorities: newSet });
          }}
        />

        {/* Channel filter */}
        {channels.length > 0 && (
          <FilterDropdown
            label="Channel"
            count={activeFilterCounts.channels}
            options={channels.map((c) => ({ id: c, label: c }))}
            selectedIds={filters.channels}
            onToggle={(id) => {
              const newSet = filters.channels.includes(id)
                ? filters.channels.filter((c) => c !== id)
                : [...filters.channels, id];
              onFiltersChange({ ...filters, channels: newSet });
            }}
          />
        )}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mt-3 text-xs text-slate-500">
        Showing {filteredCount} of {totalCount} items
        {hasActiveFilters && <span className="ml-1 text-blue-600">(filtered)</span>}
      </div>
    </div>
  );
}

// Filter dropdown component
interface FilterDropdownProps {
  label: string;
  count: number;
  options: Array<{
    id: string;
    label: string | null;
    color?: string;
    avatarUrl?: string | null;
  }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

function FilterDropdown({
  label,
  count,
  options,
  selectedIds,
  onToggle,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine display text
  const displayText = useMemo(() => {
    if (count === 0) return `All ${label}s`;
    if (count === 1) {
      const option = options.find((o) => o.id === selectedIds[0]);
      return option?.label || label;
    }
    return `${label} (${count})`;
  }, [count, selectedIds, options, label]);

  // Determine indicator color (if single selection with color)
  const indicatorColor = useMemo(() => {
    if (count === 1) {
      const option = options.find((o) => o.id === selectedIds[0]);
      return option?.color;
    }
    return undefined;
  }, [count, selectedIds, options]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          count > 1
            ? 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
            : count === 1
              ? indicatorColor
                ? 'border hover:bg-slate-50'
                : 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
        }`}
        style={
          count === 1 && indicatorColor
            ? { backgroundColor: `${indicatorColor}15`, borderColor: indicatorColor }
            : {}
        }
      >
        {count === 1 && indicatorColor && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        )}
        <span style={count === 1 && indicatorColor ? { color: indicatorColor } : {}}>
          {displayText}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] max-h-[300px] overflow-y-auto z-50">
          <div className="p-2">
            <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">{label}</p>
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => onToggle(option.id)}
                  className={`w-full px-2 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 rounded ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  {option.avatarUrl !== undefined ? (
                    // Avatar for assignees
                    <>
                      {option.avatarUrl ? (
                        <img
                          src={option.avatarUrl}
                          alt={option.label || ''}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-500" />
                        </div>
                      )}
                    </>
                  ) : option.color ? (
                    // Color dot for types/status/priority
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-1"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : null}
                  <span className={isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                    {option.label || 'Unknown'}
                  </span>
                  {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage filter state with localStorage persistence
export function useFilters(workspaceId: string | null) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (workspaceId) {
      const storageKey = `filters_${workspaceId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFilters({ ...DEFAULT_FILTERS, ...parsed });
        } catch (e) {
          console.error('Failed to parse saved filters:', e);
        }
      }
    }
    setIsLoaded(true);
  }, [workspaceId]);

  return { filters, setFilters, isLoaded };
}

// Apply filters to items
export function applyFilters(
  items: Array<{
    id: string;
    title: string;
    content_type_id: string | null;
    status: string | null;
    assignee_ids: string[] | null;
    priority: string;
    channel: string | null;
  }>,
  filters: FilterState
): typeof items {
  return items.filter((item) => {
    // Search filter
    if (filters.search && !item.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // Content type filter (OR logic within category)
    if (filters.contentTypes.length > 0 && !filters.contentTypes.includes(item.content_type_id || '')) {
      return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(item.status || '')) {
      return false;
    }

    // Assignee filter (item has ANY of selected assignees)
    if (filters.assignees.length > 0) {
      const itemAssignees = item.assignee_ids || [];
      const hasAnyAssignee = filters.assignees.some((a) => itemAssignees.includes(a));
      if (!hasAnyAssignee) return false;
    }

    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) {
      return false;
    }

    // Channel filter
    if (filters.channels.length > 1 && !filters.channels.includes(item.channel || '')) {
      return false;
    }

    return true;
  });
}
