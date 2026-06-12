import { ListChecks, Paperclip, Link2, Mic } from 'lucide-react';
import { GRANOLA_TEXT } from '../../lib/ordinal';
import { LINK_PLATFORM_LABELS } from '../../lib/linkPlatforms';
import type { SubtaskCount } from '../../hooks/useSubtaskCounts';
import type { LinkInfo } from '../../hooks/useExternalLinkCounts';

/**
 * Canonical card-indicator atoms. Single source of truth for the four
 * "task metadata" indicators that appear on every task surface (Board,
 * List, Calendar, Project detail). Each atom owns its icon, color, size
 * scale, and tooltip; surfaces compose them in whatever order/placement
 * their layout already uses (so this is a pure styling-dedup — it does
 * not reorder anything).
 *
 * Family logic (design system §Card Indicator Family — Shape + Color Split):
 *   - Subtasks    → ListChecks · navy  #005D97 · {done}/{total}
 *   - Assets      → Paperclip  · navy  #005D97 · count + platform tooltip
 *   - Linked tasks→ Link2      · berry #B8447A · count
 *   - Granola     → Mic        · green #357254 · presence only
 *
 * Size scale:
 *   - 'sm' = cards / list rows (14px icon, 11px text)
 *   - 'xs' = calendar chips    (12px icon, 10px text, count omitted when 1)
 */

const NAVY = '#005D97';
const BERRY = '#B8447A';

type Size = 'sm' | 'xs';

// Full literal class strings (not interpolated fragments) so Tailwind's
// content scanner sees every candidate class.
const ICON: Record<Size, string> = { sm: 'w-3.5 h-3.5', xs: 'w-3 h-3' };
const TEXT: Record<Size, string> = { sm: 'text-[11px]', xs: 'text-[10px]' };
const GAP: Record<Size, string> = { sm: 'gap-1', xs: 'gap-0.5' };

/** ListChecks + completed/total. Renders only when there are subtasks. */
export function SubtaskIndicator({ count, size = 'sm' }: { count?: SubtaskCount; size?: Size }) {
  if (!count || count.total === 0) return null;
  return (
    <span
      className={`inline-flex items-center ${GAP[size]} ${TEXT[size]} font-semibold flex-shrink-0`}
      style={{ color: NAVY }}
      title={`${count.completed}/${count.total} subtasks done`}
    >
      <ListChecks className={ICON[size]} />
      {count.completed}/{count.total}
    </span>
  );
}

/**
 * Paperclip + attachment count. Tooltip enumerates the platforms
 * (Figma · Canva · …) on every surface. On 'xs' (calendar chips) the
 * numeral is omitted when the count is 1 to save chip space.
 */
export function AssetIndicator({ info, size = 'sm' }: { info?: LinkInfo; size?: Size }) {
  if (!info || info.count === 0) return null;
  const platforms = info.platforms.map((p) => LINK_PLATFORM_LABELS[p] ?? p).join(' · ');
  const title = `${info.count} attachment${info.count !== 1 ? 's' : ''}${platforms ? `: ${platforms}` : ''}`;
  return (
    <span
      className={`inline-flex items-center ${GAP[size]} ${TEXT[size]} font-semibold flex-shrink-0`}
      style={{ color: NAVY }}
      title={title}
    >
      <Paperclip className={ICON[size]} />
      {size === 'xs' ? (info.count > 1 ? info.count : null) : info.count}
    </span>
  );
}

/** Link2 (chain) + linked-task count. Berry, to read as a different family. */
export function LinkedTaskIndicator({ count, size = 'sm' }: { count?: number; size?: Size }) {
  if (!count || count === 0) return null;
  return (
    <span
      className={`inline-flex items-center ${GAP[size]} ${TEXT[size]} font-semibold flex-shrink-0`}
      style={{ color: BERRY }}
      title={`${count} linked task${count !== 1 ? 's' : ''}`}
    >
      <Link2 className={ICON[size]} />
      {size === 'xs' ? (count > 1 ? count : null) : count}
    </span>
  );
}

/** Mic presence flag (no count) for tasks with linked meeting notes. */
export function GranolaIndicator({ size = 'sm' }: { size?: Size }) {
  return (
    <span title="Has meeting notes" className="flex-shrink-0 inline-flex">
      <Mic className={ICON[size]} style={{ color: GRANOLA_TEXT }} />
    </span>
  );
}
