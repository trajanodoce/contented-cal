import { FileText, Palette } from 'lucide-react';
import type { TaskCategory } from '../../lib/database.types';

interface Props {
  category: TaskCategory | null | undefined;
  /** Pixel size (width + height). Defaults to 14 (matches w-3.5 h-3.5 / other inline icons). */
  size?: number;
}

/**
 * Inline icon indicating whether a task is a content task (paper / navy)
 * or a design task (palette / berry). Matches the icons in the "+ New" menu
 * dropdown so users carry the meaning between surfaces.
 *
 * Used as a leading anchor in task title rows (list view, board cards,
 * project detail surfaces) so category is at-a-glance.
 */
export function TaskCategoryIcon({ category, size = 14 }: Props) {
  // Defensive: legacy rows without category (shouldn't happen post-migration) fall back to content.
  const resolved: TaskCategory = category === 'design' ? 'design' : 'content';

  if (resolved === 'design') {
    return (
      <span title="Design task" className="inline-flex flex-shrink-0">
        <Palette
          style={{ width: size, height: size, color: '#B8447A' }}
          aria-label="Design task"
        />
      </span>
    );
  }
  return (
    <span title="Content task" className="inline-flex flex-shrink-0">
      <FileText
        style={{ width: size, height: size, color: '#005D97' }}
        aria-label="Content task"
      />
    </span>
  );
}
