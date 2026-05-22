import React, { useState, useMemo } from 'react';
import {
  Plus, ChevronUp, ChevronDown, MoreHorizontal,
  Trash2, CheckSquare, Square, X, ArrowUpDown, Zap, ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem } from '../../lib/database.types';
import { formatDate, isOverdue, getPriorityDot } from '../../lib/utils';
import { FilterBar, FilterState, applyFilters } from '../ui/FilterBar';
import { isOrdinalItem, getOrdinalProfile, ORDINAL_COLOR, getPlatformFromChannel, PLATFORM_META } from '../../lib/ordinal';

interface Props {
  onItemClick: (item: ContentItem) => void;
  onCreateClick: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

type SortField = 'title' | 'due_date' | 'priority' | 'created_at';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// Helper component to show Ordinal profile info in a compact row
function OrdinalProfileRow({ item }: { item: ContentItem }) {
  const profile = getOrdinalProfile(item);
  const platform = getPlatformFromChannel(item.channel);

  if (!profile && !platform) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
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
        <span className="text-xs text-gray-500">
          <span className="text-gray-400">@</span>
          {profile.handle.replace('@', '')}
        </span>
      )}
    </div>
  );
}

export function ListView({ onItemClick, onCreateClick, addToast, filters, onFiltersChange }: Props) {
  const { contentItems, contentTypes, boardColumns, refreshContentItems, linkedItemIds } = useApp();

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const uniqueChannels = useMemo(() =>
    Array.from(new Set(contentItems.map(i => i.channel).filter(Boolean) as string[])),
    [contentItems]
  );

  const filtered = useMemo(() => {
    let items = applyFilters(contentItems, filters, linkedItemIds);
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'due_date') cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
      else if (sortField === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      else if (sortField === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [contentItems, filters, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)));
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} item(s)?`)) return;
    const { error } = await supabase.from('content_items').delete().in('id', Array.from(selected));
    if (error) { addToast(error.message, 'error'); return; }
    addToast(`Deleted ${selected.size} item(s)`);
    setSelected(new Set());
    refreshContentItems();
  }

  async function bulkChangeStatus(statusId: string) {
    const { error } = await supabase.from('content_items').update({ status: statusId }).in('id', Array.from(selected));
    if (error) { addToast(error.message, 'error'); return; }
    addToast(`Updated status for ${selected.size} item(s)`);
    setSelected(new Set());
    refreshContentItems();
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterBar filters={filters} onChange={onFiltersChange} channels={uniqueChannels} showLinksFilter showProject />
          <div className="ml-auto">
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New item
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-mint border-b border-brand-100 px-6 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-brand-700">{selected.size} selected</span>
          <select
            onChange={e => { if (e.target.value) bulkChangeStatus(e.target.value); }}
            className="px-3 py-1 text-xs border border-brand-100 rounded-lg bg-white text-gray-700"
            defaultValue=""
          >
            <option value="" disabled>Change status...</option>
            {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
          </select>
          <button onClick={bulkDelete} className="flex items-center gap-1 px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-lg font-medium mb-1">No content items</p>
            <p className="text-sm">
              {filters.search || filters.contentType || filters.status || filters.priority || filters.channel
                ? 'Try adjusting your filters'
                : 'Create your first content item to get started'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="w-10 pl-6 py-3">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare className="w-4 h-4 text-brand-500" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => toggleSort('title')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Title <SortIcon field="title" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => toggleSort('due_date')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Due <SortIcon field="due_date" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Priority <SortIcon field="priority" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                <th className="w-10 pr-4"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(item => {
                const contentType = contentTypes.find(ct => ct.id === item.content_type_id);
                const status = boardColumns.find(col => col.id === item.status);
                const overdue = isOverdue(item.due_date);
                const isSelected = selected.has(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`group cursor-pointer hover:bg-mint/50 transition-colors ${isSelected ? 'bg-mint' : ''}`}
                    onClick={() => onItemClick(item)}
                  >
                    <td className="pl-6 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(item.id)} className="text-gray-400 hover:text-gray-600">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-brand-500" />
                          : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-start gap-2">
                        {isOrdinalItem(item) && (
                          <span
                            title="Synced from Ordinal"
                            className="inline-flex items-center justify-center w-4 h-4 rounded flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
                          >
                            <Zap className="w-2.5 h-2.5" style={{ color: ORDINAL_COLOR }} />
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 line-clamp-1 block">{item.title}</span>
                          {isOrdinalItem(item) && (
                            <OrdinalProfileRow item={item} />
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {item.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {contentType ? (
                        <span className="flex items-center gap-1.5 text-sm text-gray-600">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: contentType.color }} />
                          {contentType.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {status ? (
                        <span
                          className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: status.color + '20', color: status.color }}
                        >
                          {status.name}
                        </span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${overdue ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                        {formatDate(item.due_date)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 capitalize">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getPriorityDot(item.priority)}`} />
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        {getPlatformFromChannel(item.channel) ? (
                          <>
                            <span
                              className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold"
                              style={{
                                backgroundColor: PLATFORM_META[getPlatformFromChannel(item.channel) ?? '']?.bgColor ?? '#F5F5F5',
                                color: PLATFORM_META[getPlatformFromChannel(item.channel) ?? '']?.color ?? '#666',
                              }}
                            >
                              {PLATFORM_META[getPlatformFromChannel(item.channel) ?? '']?.icon?.charAt(1) ?? '●'}
                            </span>
                            <span>{item.channel}</span>
                          </>
                        ) : (
                          <span>{item.channel || '—'}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4" onClick={e => e.stopPropagation()}>
                      <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <span className="text-xs text-gray-500">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          {contentItems.length !== filtered.length && ` of ${contentItems.length}`}
        </span>
      </div>
    </div>
  );
}
