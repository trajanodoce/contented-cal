import { useMemo } from 'react';
import { AvatarStack } from '../ui/Avatar';
import { usePresenceForTask } from '../../contexts/PresenceContext';

interface Props {
  taskId: string | null | undefined;
  /** Visual density variant. */
  variant?: 'chip' | 'inline-dot';
}

/**
 * Phase 6.6 — TaskPresenceChip (lean v1).
 *
 * Two render modes:
 *   - `chip` (default): pill with avatar stack + "{name} is viewing" / "N viewing".
 *     Use in the slide-over header.
 *   - `inline-dot`: tiny stacked avatars only, for list rows + board cards.
 *     Render conditionally — returns null when nobody else is viewing.
 */
export function TaskPresenceChip({ taskId, variant = 'chip' }: Props) {
  const viewers = usePresenceForTask(taskId);

  const users = useMemo(
    () =>
      viewers.map((v) => ({
        src: v.avatar_url ?? null,
        name: v.full_name || v.email || 'Someone',
      })),
    [viewers],
  );

  if (viewers.length === 0) return null;

  if (variant === 'inline-dot') {
    return (
      <span
        className="inline-flex items-center"
        title={
          viewers.length === 1
            ? `${viewers[0].full_name || viewers[0].email || 'Someone'} is viewing`
            : `${viewers.length} people viewing`
        }
        aria-label={
          viewers.length === 1
            ? `${viewers[0].full_name || viewers[0].email || 'Someone'} is viewing this`
            : `${viewers.length} people are viewing this`
        }
      >
        <AvatarStack users={users} size="xs-inline" max={2} />
      </span>
    );
  }

  // Default: chip variant — pill with avatars + label, mounted in slide-over header.
  const label =
    viewers.length === 1
      ? `${viewers[0].full_name || viewers[0].email || 'Someone'} is viewing`
      : `${viewers.length} people viewing`;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: '#0F8B8D12',
        color: '#0F8B8D',
        border: '1px solid #0F8B8D25',
      }}
      role="status"
      aria-live="polite"
      title={label}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#0F8B8D' }}
        aria-hidden
      />
      <AvatarStack users={users} size="xs-inline" max={3} />
      <span className="ml-0.5">{label}</span>
    </span>
  );
}
