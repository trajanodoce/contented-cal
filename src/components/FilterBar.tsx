import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ChevronDown, Check, User } from 'lucide-react';
import type { ContentType, BoardColumn, Profile } from '../lib/database.types';

export interface FilterState {
  search: string;
  contentTypes: string[];
  statuses: string[];
  assignees: string[];
  priorities: string[];
  channels: string[];
  projects: string[];
  linkedPlatforms: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  contentTypes: [],
  statuses: [],
  assignees: [],
  priorities: [],
  channels: [],
  projects: [],
  linkedPlatforms: [],
};

interface FilterBarProps {
  workspaceId: string | null;
  contentTypes: ContentType[];
  boardColumns: BoardColumn[];
  members: Profile[];
  channels: string[];
  projects?: Array<{ id: string; label: string }>;
  linkCounts?: Map<string, { count: number; platforms: string[] }>;
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

const linkPlatformOptions = [
  { id: '_any', label: 'Any linked asset' },
  { id: 'figma', label: 'Figma' },
  { id: 'canva', label: 'Canva' },
  { id: 'miro', label: 'Miro' },
  { id: 'ordinal', label: 'Ordinal' },
  { id: 'google_docs', label: 'Google Docs' },
  { id: 'google_drive', label: 'Google Drive' },
  { id: 'notion', label: 'Notion' },
  { id: 'linear', label: 'Linear' },
] as const;

export function FilterBar({
  workspaceId,
  contentTypes,
  boardColumns,
  members,
  channels,
  projects,
  linkCounts,
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
    filters.channels.length > 0 ||
    filters.projects?.length > 0 ||
    filters.linkedPlatforms?.length > 0;

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
    projects: filters.projects?.length || 0,
    links: filters.linkedPlatforms?.length || 0,
  }), [filters]);

  return (
    <div className="bg-surface-card border-2 rounded-lg p-4 mb-4" style={{ borderColor: '#002339' }}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-shrink-0 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            style={{ borderColor: '#002339' }}
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

        <div className="h-6 w-px" style={{ backgroundColor: '#002339' }} />

        {/* Content Type filter */}
        <FilterDropdown
          label="Type"
          count={activeFilterCounts.types}
          options={contentTypes.map((ct) => ({ id: ct.id, label: ct.name, color: ct.color ?? undefined }))}
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
          options={boardColumns.map((bc) => ({ id: bc.id, label: bc.name, color: bc.color ?? undefined }))}
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

        {/* Project filter */}
        {projects && projects.length > 0 && (
          <FilterDropdown
            label="Project"
            count={activeFilterCounts.projects}
            options={projects}
            selectedIds={filters.projects || []}
            onToggle={(id) => {
              const current = filters.projects || [];
              const newSet = current.includes(id)
                ? current.filter((p) => p !== id)
                : [...current, id];
              onFiltersChange({ ...filters, projects: newSet });
            }}
          />
        )}

        {/* Has Links filter */}
        {linkCounts && linkCounts.size > 0 && (
          <FilterDropdown
            label="Links"
            count={activeFilterCounts.links}
            options={linkPlatformOptions.map((p) => ({ id: p.id, label: p.label }))}
            selectedIds={filters.linkedPlatforms || []}
            onToggle={(id) => {
              const current = filters.linkedPlatforms || [];
              const newSet = current.includes(id)
                ? current.filter((p) => p !== id)
                : [...current, id];
              onFiltersChange({ ...filters, linkedPlatforms: newSet });
            }}
          />
        )}

        {/* Clear all filters — chalkboard eraser style */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="relative flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            style={{
              background: 'linear-gradient(to bottom, #4a4a4a 0%, #2d2d2d 60%, #1a1a1a 100%)',
              color: '#e8e0d0',
              border: '2px solid #5c4a3a',
              borderBottom: '5px solid #8b7355',
              letterSpacing: '0.08em',
            }}
            title="Clear all filters"
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>🧽</span>
            Erase All
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mt-3 text-xs text-slate-500">
        Showing {filteredCount} of {totalCount} items
        {hasActiveFilters && <span className="ml-1 text-brand-600">(filtered)</span>}
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
    if (count === 0) {
      const plural: Record<string, string> = {
        Type: 'Types',
        Status: 'Statuses',
        Assignee: 'Assignees',
        Priority: 'Priorities',
        Channel: 'Channels',
        Project: 'Projects',
        Links: 'Links',
      };
      return `All ${plural[label] || label + 's'}`;
    }
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
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          count > 1
            ? 'text-brand-700 bg-brand-50 hover:bg-brand-100'
            : count === 1
              ? indicatorColor
                ? 'hover:bg-slate-50'
                : 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-600 hover:bg-slate-100'
        }`}
        style={
          count === 1 && indicatorColor
            ? { backgroundColor: `${indicatorColor}15`, borderColor: indicatorColor }
            : { borderColor: '#002339' }
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
        <div className="absolute top-full mt-1 bg-surface-card border-2 rounded-lg shadow-xl min-w-[200px] max-h-[300px] overflow-y-auto z-50" style={{ borderColor: '#002339' }}>
          <div className="p-2 space-y-1">
            <p className="text-xs font-medium uppercase px-2 py-1" style={{ color: '#002339' }}>{label}</p>
            {options.map((option, idx) => {
              const isSelected = selectedIds.includes(option.id);
              // Very subtle alternating cool-tone washes
              const coolWashes = ['#f0f4f8', '#f5f0f8', '#f0f6f5', '#f2f4f8', '#f5f3f0', '#f0f2f6', '#f4f0f5'];
              const rowBg = isSelected ? '#e8f0fe' : coolWashes[idx % coolWashes.length];
              return (
                <button
                  key={option.id}
                  onClick={() => onToggle(option.id)}
                  className="w-full px-2 py-2 text-left text-sm flex items-center gap-2 rounded transition-colors"
                  style={{ backgroundColor: rowBg }}
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
                  <span className={isSelected ? 'text-brand-900 font-medium' : 'text-slate-700'}>
                    {option.label || 'Unknown'}
                  </span>
                  {isSelected && <Check className="w-4 h-4 ml-auto text-brand-600" />}
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
export function applyFilters<T extends {
    id: string;
    title: string;
    content_type_id: string | null;
    status: string | null;
    assignee_ids: string[] | null;
    priority: string | null;
    channel: string | null;
    project_id?: string | null;
  }>(
  items: T[],
  filters: FilterState,
  linkCounts?: Map<string, { count: number; platforms: string[] }>
): T[] {
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
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority ?? '')) {
      return false;
    }

    // Project filter
    if (filters.projects && filters.projects.length > 0 && !filters.projects.includes(item.project_id || '')) {
      return false;
    }

    // Channel filter
    if (filters.channels.length > 0 && !filters.channels.includes(item.channel || '')) {
      return false;
    }

    // Linked platforms filter
    if (filters.linkedPlatforms && filters.linkedPlatforms.length > 0 && linkCounts) {
      const itemLinks = linkCounts.get(item.id);
      if (!itemLinks || itemLinks.count === 0) return false;

      // If "_any" is selected, just check that item has links (already done above)
      const specificPlatforms = filters.linkedPlatforms.filter((p) => p !== '_any');
      if (specificPlatforms.length > 0) {
        const hasMatchingPlatform = specificPlatforms.some((p) => itemLinks.platforms.includes(p));
        if (!hasMatchingPlatform) return false;
      }
    }

    return true;
  });
}
