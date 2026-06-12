import { useEffect, useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Hash,
  Users,
  Clock,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SLACK_COLOR } from '../../lib/ordinal';
import { formatRelativeTime } from '../../lib/relativeTime';
import { ConfirmModal } from '../ui/ConfirmModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  contentItemId: string;
  /** Bumps when the parent wants to force a refetch (e.g. after unlink). */
  refreshKey?: number;
  /** Called after a successful unlink so the parent (and SlackSourceBanner) can refresh. */
  onUnlink?: () => void;
}

interface SlackMessage {
  user?: string;
  text?: string;
  ts?: string;
}

interface SlackThreadLink {
  id: string;
  channel_name: string | null;
  permalink: string;
  parent_message: string | null;
  parent_author_id: string | null;
  parent_author_name: string | null;
  requester_id: string | null;
  requester_name: string | null;
  participant_count: number | null;
  thread_start_at: string | null;
  captured_at: string;
  is_origin: boolean;
  raw_thread_snapshot: SlackMessage[] | null;
}

// Author colors for transcript rows. Slack-red for the requester; navy for the
// CC user (if we can spot them). Otherwise slate. We can't reliably map Slack
// user IDs to roles client-side — best effort using the requester_id we have.
const TRANSCRIPT_AUTHOR_COLOR_DEFAULT = 'rgb(var(--color-slate-700))';
const TRANSCRIPT_AUTHOR_COLOR_REQUESTER = SLACK_COLOR;

/**
 * Detail-panel section listing linked Slack threads (canonical Draft 4.7).
 *
 * Mirrors GranolaNoteSection's structure: per-thread cards with collapsed +
 * expanded states. Reads from `slack_thread_links` table directly.
 *
 * Scope notes:
 * - "+ Link Thread" / Manual Thread Linking (Draft 4.8) is deferred to v2.
 *   Team can paste Slack URLs into the Linked Assets box as a workaround.
 * - Inline transcript rendering also deferred — needs bot enhancement to
 *   capture resolved user names in raw_thread_snapshot. v1 surfaces the
 *   parent message + a count of replies and routes users to Slack for the
 *   full conversation.
 */
export function SlackThreadsSection({ contentItemId, refreshKey, onUnlink }: Props) {
  const [links, setLinks] = useState<SlackThreadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('slack_thread_links')
      .select('id, channel_name, permalink, parent_message, parent_author_id, parent_author_name, requester_id, requester_name, participant_count, thread_start_at, captured_at, is_origin, raw_thread_snapshot')
      .eq('content_item_id', contentItemId)
      .order('captured_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setLinks((data ?? []) as SlackThreadLink[]);
        if (data && data.length === 1) {
          // Auto-expand if there's only one thread
          setExpandedIds(new Set([data[0].id]));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contentItemId, refreshKey]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleUnlink() {
    if (!confirmUnlinkId) return;
    setUnlinking(true);
    const { error } = await supabase
      .from('slack_thread_links')
      .delete()
      .eq('id', confirmUnlinkId);
    setUnlinking(false);
    setConfirmUnlinkId(null);
    if (error) {
      toast.error('Failed to unlink thread: ' + error.message);
      return;
    }
    toast.success('Slack thread unlinked');
    setLinks((prev) => prev.filter((l) => l.id !== confirmUnlinkId));
    onUnlink?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading Slack threads...</span>
      </div>
    );
  }

  // No threads — render compact empty state.
  if (links.length === 0) {
    return (
      <div>
        <SectionHeader count={0} />
        <p className="text-xs italic text-slate-400 mt-2">
          No Slack threads linked yet. Threads attach automatically when items are created via @cc-bot.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader count={links.length} />

      <div className="mt-3 space-y-2.5">
        {links.map((link) => {
          const isExpanded = expandedIds.has(link.id);
          const author = link.parent_author_name?.trim() || link.requester_name?.trim();
          const threadStart = link.thread_start_at
            ? format(new Date(link.thread_start_at), 'MMM d, h:mm a')
            : null;
          const replyCount = Math.max(0, (link.participant_count ?? 1) - 1);

          return (
            <div
              key={link.id}
              className="bg-surface-card rounded-xl"
              style={{
                border: isExpanded ? '1.5px solid rgb(var(--color-slate-300))' : '1px solid rgb(var(--color-slate-300))',
                padding: isExpanded ? '14px 16px' : '12px 14px',
                transition: 'border 150ms ease',
              }}
            >
              {/* Header row — clickable to toggle */}
              <button
                type="button"
                onClick={() => toggleExpand(link.id)}
                className="w-full text-left flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  {link.parent_message ? (
                    <p
                      className={`text-[13px] text-slate-700 font-medium ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      &ldquo;{link.parent_message.replace(/\s+/g, ' ')}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[13px] text-slate-500 italic">
                      Parent message not captured
                    </p>
                  )}

                  {/* Collapsed meta line */}
                  {!isExpanded && (
                    <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {link.channel_name && (
                        <span className="font-mono font-semibold" style={{ color: SLACK_COLOR }}>
                          #{link.channel_name}
                        </span>
                      )}
                      {author && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>{author}</span>
                        </>
                      )}
                      <span className="text-slate-300">·</span>
                      <span>{formatRelativeTime(link.captured_at)}</span>
                      {replyCount > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                        </>
                      )}
                      {link.is_origin && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span
                            className="font-semibold uppercase tracking-wide"
                            style={{ color: SLACK_COLOR, fontSize: 9 }}
                          >
                            Origin
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isExpanded && (
                    <a
                      href={link.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md transition-opacity hover:opacity-90"
                      style={{
                        padding: '4px 9px',
                        color: SLACK_COLOR,
                        backgroundColor: '#ffffff',
                        border: `1px solid ${SLACK_COLOR}30`,
                      }}
                    >
                      Open
                    </a>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded body */}
              {isExpanded && (
                <div className="mt-3 space-y-3">
                  {/* Chip metadata */}
                  <div className="flex flex-wrap gap-1.5">
                    {link.channel_name && (
                      <Chip color={SLACK_COLOR} tone="slack">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono">{link.channel_name}</span>
                      </Chip>
                    )}
                    {threadStart && (
                      <Chip>
                        <Clock className="w-3 h-3" />
                        {author ? `${author} · ${threadStart}` : threadStart}
                      </Chip>
                    )}
                    {link.participant_count != null && link.participant_count > 0 && (
                      <Chip>
                        <Users className="w-3 h-3" />
                        {link.participant_count} {link.participant_count === 1 ? 'participant' : 'participants'}
                      </Chip>
                    )}
                    {link.is_origin && (
                      <Chip color={SLACK_COLOR} tone="slack">
                        Origin thread
                      </Chip>
                    )}
                  </div>

                  {/* Transcript preview — parent + 4 most recent replies */}
                  <TranscriptPreview link={link} replyCount={replyCount} />


                  {/* Footer: Open + Unlink */}
                  <div className="flex justify-end gap-2 pt-1">
                    <a
                      href={link.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md transition-opacity hover:opacity-90"
                      style={{
                        padding: '5px 10px',
                        color: SLACK_COLOR,
                        backgroundColor: '#ffffff',
                        border: `1px solid ${SLACK_COLOR}30`,
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in Slack
                    </a>
                    <button
                      type="button"
                      onClick={() => setConfirmUnlinkId(link.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md transition-colors hover:bg-accent-crimson/[0.031]"
                      style={{
                        padding: '5px 10px',
                        color: 'rgb(var(--color-accent-crimson))',
                        backgroundColor: '#ffffff',
                        border: '1px solid rgb(var(--color-accent-crimson) / 0.188)',
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Unlink
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={confirmUnlinkId !== null}
        onClose={() => setConfirmUnlinkId(null)}
        onConfirm={handleUnlink}
        variant="warning"
        icon={<Trash2 className="w-5 h-5" style={{ color: '#A05042' }} />}
        title="Unlink this Slack thread?"
        description="The thread itself isn't deleted — you can manually re-link it later. Use this when the thread is no longer relevant to this item."
        confirmLabel="Unlink"
        loading={unlinking}
      />
    </div>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      <MessageSquare className="w-3.5 h-3.5" style={{ color: SLACK_COLOR }} />
      <span
        className="font-bold uppercase"
        style={{
          fontFamily: 'Faune-Text_Bold, sans-serif',
          fontSize: 11,
          color: 'rgb(var(--color-slate-500))',
          letterSpacing: '0.06em',
        }}
      >
        Slack Threads
      </span>
      {count > 0 && (
        <span
          className="text-xs font-semibold rounded-full"
          style={{
            padding: '3px 10px',
            backgroundColor: `${SLACK_COLOR}15`,
            color: SLACK_COLOR,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function TranscriptPreview({ link, replyCount }: { link: SlackThreadLink; replyCount: number }) {
  const snapshot = Array.isArray(link.raw_thread_snapshot) ? link.raw_thread_snapshot : null;

  // No raw snapshot — show a soft fallback that routes to Slack.
  if (!snapshot || snapshot.length === 0) {
    return (
      <p className="text-[11px] text-slate-400">
        {replyCount > 0
          ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'} captured · `
          : ''}
        <a
          href={link.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: SLACK_COLOR }}
        >
          Open in Slack
        </a>
        {' for full thread'}
      </p>
    );
  }

  // Parent is messages[0]; replies are everything after.
  const [parent, ...replies] = snapshot;
  const visibleReplies = replies.slice(-4);
  const shownCount = (parent ? 1 : 0) + visibleReplies.length;
  const totalCount = snapshot.length;

  // Best-effort name resolution: prefer the captured parent_author_name when
  // we're rendering the parent message; otherwise fall back to user ID.
  // Future enhancement: store resolved names in raw_thread_snapshot at
  // capture time so we don't lean on IDs here.
  function authorFor(msg: SlackMessage, isParent: boolean): string {
    if (isParent && link.parent_author_name) return link.parent_author_name;
    if (msg.user === link.requester_id && link.requester_name) return link.requester_name;
    return msg.user ?? 'Unknown';
  }

  function colorFor(msg: SlackMessage): string {
    if (msg.user && msg.user === link.requester_id) return TRANSCRIPT_AUTHOR_COLOR_REQUESTER;
    return TRANSCRIPT_AUTHOR_COLOR_DEFAULT;
  }

  function formatTs(ts: string | undefined): string {
    if (!ts) return '';
    const ms = parseFloat(ts) * 1000;
    if (!isFinite(ms)) return '';
    return format(new Date(ms), 'HH:mm');
  }

  return (
    <div>
      <div
        className="rounded-lg"
        style={{
          backgroundColor: 'rgb(var(--color-surface-page))',
          padding: 12,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {[parent, ...visibleReplies].filter(Boolean).map((msg, idx) => {
          const isParent = idx === 0;
          const time = formatTs(msg.ts);
          const author = authorFor(msg, isParent);
          const color = isParent ? SLACK_COLOR : colorFor(msg);
          return (
            <div key={`${msg.ts ?? idx}`} className={idx > 0 ? 'mt-2' : undefined}>
              {time && <span style={{ color: 'rgb(var(--color-slate-400))' }}>[{time}] </span>}
              <strong style={{ color }}>{author}:</strong>{' '}
              <span style={{ color: 'rgb(var(--color-slate-700))' }}>{msg.text}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">
        {`${shownCount} of ${totalCount} ${totalCount === 1 ? 'message' : 'messages'} · `}
        <a
          href={link.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: SLACK_COLOR }}
        >
          Open in Slack
        </a>
        {' for full thread'}
      </p>
    </div>
  );
}

function Chip({
  children,
  color,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  color?: string;
  tone?: 'neutral' | 'slack';
}) {
  const isSlack = tone === 'slack' && color;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full"
      style={{
        padding: '2px 7px',
        backgroundColor: isSlack ? `${color}15` : 'rgb(var(--color-surface-page))',
        color: isSlack ? color : 'rgb(var(--color-slate-500))',
        border: isSlack ? `1px solid ${color}30` : '1px solid rgb(var(--color-brand-900) / 0.094)',
      }}
    >
      {children}
    </span>
  );
}
