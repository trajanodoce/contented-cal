import { FilterX } from 'lucide-react';

interface FilteredEmptyStateProps {
  /** Total items hidden by the active filters (the unfiltered count). */
  hiddenCount?: number;
  /** Clears all active filters. */
  onClear: () => void;
}

/**
 * Shown when active filters reduce a view to zero results — so an empty view
 * never reads as "there's nothing here" when it's really "a filter is hiding
 * everything." One-click escape hatch back to the full set.
 */
export function FilteredEmptyState({ hiddenCount, onClear }: FilteredEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl"
      style={{
        backgroundColor: 'rgb(var(--color-brand-50))',
        border: '1px dashed rgb(var(--color-brand-600) / 0.35)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: 'rgb(var(--color-brand-600) / 0.10)' }}
      >
        <FilterX className="w-6 h-6" style={{ color: 'rgb(var(--color-brand-700))' }} />
      </div>
      <h3 className="font-heading text-lg mb-1" style={{ color: 'rgb(var(--color-brand-900))' }}>
        No items match your filters
      </h3>
      {hiddenCount !== undefined && hiddenCount > 0 && (
        <p className="text-xs text-slate-400 mb-1">
          {hiddenCount} item{hiddenCount === 1 ? '' : 's'} hidden by the current filters
        </p>
      )}
      <p className="text-sm text-slate-500 mb-4 max-w-sm">
        Clear the filters to see everything again.
      </p>
      <button
        onClick={onClear}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'rgb(var(--color-brand-600))' }}
      >
        <FilterX className="w-4 h-4" />
        Clear filters
      </button>
    </div>
  );
}
