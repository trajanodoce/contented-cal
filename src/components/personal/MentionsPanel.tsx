import { useMemo, useState } from 'react';
import { AtSign, ListChecks, X, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useUserAlerts, type UserAlertWithContext } from '../../hooks/useUserAlerts';
import { formatRelativeTime } from '../../lib/relativeTime';

interface Props {
  /** Called when an alert row is clicked — open the source item. */
  onOpenItem: (contentItemId: string) => void;
  /** Optional cap on how many alerts to show without expanding. */
  initialLimit?: number;
}

/**
 * Phase 6.5 — Sidebar dot + minimal mentions list (lean v1).
 *
 * Surfaces the most recent `user_alerts` rows (mention + subtask_assigned)
 * in a single section at the top of My Work. Click a row to open the source
 * item and mark the alert as read. Per-row dismiss (×) hard-deletes the
 * alert; "Mark all read" flips read_at without dismissing.
 *
 * Hidden entirely when the user has zero alerts — no empty-state noise on
 * the most-visited screen.
 *
 * Defer to v2 (per the Phase 6 bloat review):
 *   - "Project adds" + "New tasks in your projects" alert types
 *   - Full Mentions + Updates Panel banner treatment
 */
export function MentionsPanel({ onOpenItem, initialLimit = 8 }: Props) {
  const { alerts, unreadCount, markRead, markAllRead, dismiss } = useUserAlerts();
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (expanded) return alerts;
    return alerts.slice(0, initialLimit);
  }, [alerts, expanded, initialLimit]);

  if (alerts.length === 0) return null;

  return (
    <section
      className="bg-surface-card rounded-xl shadow-sm overflow-hidden"
      style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
    >
      <div className="cc-banner-section-header flex items-center gap-2 border-b border-slate-100">
        <h2 className="text-base font-heading" style={{ color: 'rgb(var(--color-brand-900))' }}>
          Heads Up
        </h2>
        {unreadCount > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: 'rgb(var(--color-accent-crimson))' }}
          >
            {unreadCount} unread
          </span>
        )}
        <span className="text-xs text-slate-400 ml-1">
          · {alerts.length} total
        </span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Check className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {visible.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onOpen={async () => {
              if (alert.read_at === null) await markRead(alert.id);
              if (alert.content_item_id) onOpenItem(alert.content_item_id);
            }}
            onDismiss={() => dismiss(alert.id)}
          />
        ))}
      </ul>

      {alerts.length > initialLimit && (
        <div className="px-4 py-2 border-t border-slate-100 text-center">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {expanded ? 'Show less' : `View all ${alerts.length}`}
          </button>
        </div>
      )}
    </section>
  );
}

interface AlertRowProps {
  alert: UserAlertWithContext;
  onOpen: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}

function AlertRow({ alert, onOpen, onDismiss }: AlertRowProps) {
  const actorName = alert.actor?.full_name || alert.actor?.email || 'Someone';
  const itemTitle = alert.content_item?.title ?? 'an item';
  const isUnread = alert.read_at === null;

  const { actionLabel, Icon, iconColor } = (() => {
    switch (alert.alert_type) {
      case 'mention':
        return {
          actionLabel: 'mentioned you in',
          Icon: AtSign,
          iconColor: 'rgb(var(--color-brand-600))',
        };
      case 'subtask_assigned':
        return {
          actionLabel: 'assigned you a subtask in',
          Icon: ListChecks,
          iconColor: '#7C3AED',
        };
      default:
        return {
          actionLabel: 'updated',
          Icon: AtSign,
          iconColor: 'rgb(var(--color-slate-500))',
        };
    }
  })();

  return (
    <li
      className="group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-brand-600/[0.031]"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={isUnread ? { backgroundColor: 'rgb(var(--color-brand-600) / 0.024)' } : undefined}
    >
      {/* Unread dot */}
      <span
        className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: isUnread ? 'rgb(var(--color-accent-crimson))' : 'transparent' }}
        aria-hidden
      />

      {/* Actor avatar */}
      <Avatar
        src={alert.actor?.avatar_url ?? undefined}
        name={actorName}
        size="md"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: iconColor }}>
            <Icon className="w-3 h-3" />
          </span>
          <span className="text-sm text-slate-700">
            <strong className="font-medium text-slate-900">{actorName}</strong>{' '}
            {actionLabel}{' '}
            <strong className="font-medium text-slate-900">{itemTitle}</strong>
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {formatRelativeTime(alert.created_at)}
        </div>
      </div>

      {/* Dismiss (×) — revealed on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Dismiss"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
