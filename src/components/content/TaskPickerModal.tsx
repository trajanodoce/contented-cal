import { useState, useMemo } from 'react';
import { X, Search, Link2 } from 'lucide-react';
import type { ContentItem, BoardColumn, TaskCategory } from '../../lib/database.types';
import { TaskCategoryIcon } from './TaskCategoryIcon';
import { formatDate } from '../../lib/utils';

const BERRY = 'rgb(var(--color-accent-berry))';
const BERRY_TINT = 'rgb(var(--color-accent-berry) / 0.082)';

interface Props {
  tasks: ContentItem[];
  excludedIds: Set<string>;
  boardColumns: BoardColumn[];
  defaultCategoryFilter?: TaskCategory | 'all';
  onClose: () => void;
  onPick: (taskId: string) => Promise<void> | void;
}

type CategoryFilter = 'all' | TaskCategory;

/**
 * Modal for picking a workspace task to link to the current one.
 *
 * - Excludes self + already-linked tasks (filtered server-side would be
 *   ideal but caller already has the full list — cheap client filter).
 * - Default category filter is "all" (caller passes defaultCategoryFilter;
 *   LinkedTasksSection sends "all" so the picker never looks empty in
 *   workspaces dominated by one category). User can narrow with the chips.
 * - Search is title-substring case-insensitive.
 */
export function TaskPickerModal({
  tasks,
  excludedIds,
  boardColumns,
  defaultCategoryFilter = 'all',
  onClose,
  onPick,
}: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(defaultCategoryFilter);
  const [picking, setPicking] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => !excludedIds.has(t.id))
      .filter((t) => !t.archived)
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      // Order: undone tasks first, then by updated_at desc
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      })
      .slice(0, 50); // cap for perf
  }, [tasks, excludedIds, search, categoryFilter]);

  const handlePick = async (taskId: string) => {
    if (picking) return;
    setPicking(taskId);
    await onPick(taskId);
    setPicking(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgb(var(--color-brand-900) / 0.376)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: BERRY_TINT }}
            >
              <Link2 className="w-4 h-4" style={{ color: BERRY }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Link a Task</h2>
              <p className="text-xs text-slate-500">Pick a peer task to relate to this one</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-brand-600/[0.063] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2">
          {(['all', 'content', 'design'] as const).map((c) => {
            const active = categoryFilter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors ${
                  active ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
                style={
                  active
                    ? c === 'design'
                      ? { background: BERRY }
                      : c === 'content'
                        ? { background: 'rgb(var(--color-brand-600))' }
                        : { background: '#0F172A' }
                    : { background: '#f1f5f9' }
                }
              >
                {c === 'all' ? 'All' : c}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 px-6 text-sm text-slate-400 space-y-2">
              {(() => {
                // Available = everything except self + already-linked.
                // Different exhaustion sources have different copy + fixes.
                const available = tasks.filter((t) => !excludedIds.has(t.id) && !t.archived);
                if (available.length === 0) {
                  return <div>No other tasks in this workspace yet to link to.</div>;
                }
                if (search) {
                  return <div>No tasks match &ldquo;{search}&rdquo;.</div>;
                }
                if (categoryFilter !== 'all') {
                  return (
                    <>
                      <div>No {categoryFilter} tasks available to link.</div>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('all')}
                        className="text-xs font-medium underline"
                        style={{ color: BERRY }}
                      >
                        Show all categories
                      </button>
                    </>
                  );
                }
                return <div>No more tasks available to link.</div>;
              })()}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredTasks.map((task) => {
                const statusCol = boardColumns.find((c) => c.id === task.status);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handlePick(task.id)}
                    disabled={picking === task.id}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-600/[0.063] transition-colors text-left disabled:opacity-50"
                  >
                    <TaskCategoryIcon category={task.category} size={14} />
                    <span className="text-[13px] font-medium text-slate-900 flex-1 truncate" title={task.title}>
                      {task.title}
                    </span>
                    {statusCol && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          color: statusCol.color ?? '#64748b',
                          background: statusCol.color ? `${statusCol.color}1F` : '#f1f5f9',
                        }}
                      >
                        {statusCol.name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[11px] text-slate-400 flex-shrink-0">
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          Showing {filteredTasks.length} of {tasks.filter((t) => !excludedIds.has(t.id)).length} tasks
        </div>
      </div>
    </div>
  );
}
