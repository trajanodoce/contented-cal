import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export interface FilterState {
  search: string;
  contentType: string;
  status: string;
  priority: string;
  channel: string;
  project: string;
  hasLinks: string; // platform name or '' for any or 'none'
  source: '' | 'calendar' | 'ordinal' | 'slack' | 'intake';
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  contentType: '',
  status: '',
  priority: '',
  channel: '',
  project: '',
  hasLinks: '',
  source: '',
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  showSearch?: boolean;
  showProject?: boolean;
  showLinksFilter?: boolean;
  channels: string[];
  children?: React.ReactNode;
}

const LINK_PLATFORMS = [
  { value: 'ordinal', label: 'Ordinal' },
  { value: 'figma', label: 'Figma' },
  { value: 'canva', label: 'Canva' },
  { value: 'miro', label: 'Miro' },
  { value: 'google_docs', label: 'Google Docs' },
  { value: 'google_drive', label: 'Google Drive' },
  { value: 'notion', label: 'Notion' },
  { value: 'linear', label: 'Linear' },
  { value: 'other', label: 'Other link' },
];

export function FilterBar({ filters, onChange, showSearch = true, showProject = false, showLinksFilter = false, channels, children }: Props) {
  const { contentTypes, boardColumns, projects } = useApp();

  const activeCount = [filters.contentType, filters.status, filters.priority, filters.channel, filters.project, filters.hasLinks, filters.source]
    .filter(Boolean).length;

  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function clear() {
    onChange({ ...filters, contentType: '', status: '', priority: '', channel: '', project: '', hasLinks: '', source: '' });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showSearch && (
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent w-48"
          />
        </div>
      )}

      {showProject && projects.length > 0 && (
        <select
          value={filters.project}
          onChange={e => set('project', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}

      <select
        value={filters.contentType}
        onChange={e => set('contentType', e.target.value)}
        className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
      >
        <option value="">All types</option>
        {contentTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
      </select>

      <select
        value={filters.status}
        onChange={e => set('status', e.target.value)}
        className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
      >
        <option value="">All statuses</option>
        {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
      </select>

      <select
        value={filters.priority}
        onChange={e => set('priority', e.target.value)}
        className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
      >
        <option value="">All priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {channels.length > 0 && (
        <select
          value={filters.channel}
          onChange={e => set('channel', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
        >
          <option value="">All channels</option>
          {channels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {showLinksFilter && (
        <select
          value={filters.hasLinks}
          onChange={e => set('hasLinks', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
        >
          <option value="">Any links</option>
          <option value="has_any">Has links</option>
          {LINK_PLATFORMS.map(p => (
            <option key={p.value} value={p.value}>Has {p.label}</option>
          ))}
        </select>
      )}

      {/* Source Filter */}
      <select
        value={filters.source}
        onChange={e => set('source', e.target.value as FilterState['source'])}
        className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
      >
        <option value="">All sources</option>
        <option value="calendar">Calendar (native)</option>
        <option value="ordinal">Ordinal (synced)</option>
        <option value="slack">Slack requests</option>
        <option value="intake">Intake forms</option>
      </select>

      {activeCount > 0 && (
        <button
          onClick={clear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
      )}

      {children}
    </div>
  );
}

export function applyFilters<T extends {
  id: string;
  title: string;
  content_type_id: string | null;
  status: string | null;
  priority: string;
  channel: string;
  project_id?: string | null;
}>(items: T[], filters: FilterState, linkedItemIds?: Map<string, string[]>): T[] {
  return items.filter(item => {
    if (filters.search && !item.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.contentType && item.content_type_id !== filters.contentType) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.channel && item.channel !== filters.channel) return false;
    if (filters.project && item.project_id !== filters.project) return false;
    if (filters.hasLinks) {
      const platforms = linkedItemIds?.get(item.id) ?? [];
      if (filters.hasLinks === 'has_any' && platforms.length === 0) return false;
      else if (filters.hasLinks !== 'has_any' && !platforms.includes(filters.hasLinks)) return false;
    }
    // Source filter
    if (filters.source) {
      const customFields = (item as unknown as { custom_fields?: Record<string, unknown> }).custom_fields ?? {};
      const tags = (item as unknown as { tags?: string[] }).tags ?? [];
      const source = customFields._source as string | undefined;

      if (filters.source === 'ordinal') {
        if (source !== 'ordinal' && !tags.includes('ordinal-sync')) return false;
      } else if (filters.source === 'slack') {
        if (!tags.includes('slack-request')) return false;
      } else if (filters.source === 'intake') {
        if (source !== 'intake') return false;
      } else if (filters.source === 'calendar') {
        if (source === 'ordinal' || tags.includes('ordinal-sync') || tags.includes('slack-request')) return false;
      }
    }
    return true;
  });
}
