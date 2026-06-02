import { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SLACK_COLOR } from '../../lib/ordinal';
import { formatRelativeTime } from '../../lib/relativeTime';

interface Props {
  contentItemId: string;
  /** Bumps when SlackThreadsSection unlinks/relinks; forces a refetch. */
  refreshKey?: number;
}

interface OriginLink {
  channel_name: string | null;
  permalink: string;
  requester_name: string | null;
  captured_at: string;
  parent_message: string | null;
}

/**
 * Source banner for items originated in Slack (canonical Draft 4.6).
 *
 * Mounted at the top of the detail panel above the title. Mirrors the
 * Ordinal/Linear source-identification pattern (NOT the Batch 5 banner
 * tokens — those are for page/section headers).
 *
 * Data: reads from `slack_thread_links` where `is_origin = true`, not from
 * `custom_fields`, so the banner disappears cleanly if the origin link is
 * unlinked later. The item itself stays fully editable (unlike Ordinal
 * which forces read-only).
 */
export function SlackSourceBanner({ contentItemId, refreshKey }: Props) {
  const [link, setLink] = useState<OriginLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('slack_thread_links')
      .select('channel_name, permalink, requester_name, captured_at, parent_message')
      .eq('content_item_id', contentItemId)
      .eq('is_origin', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setLink(data as OriginLink | null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [contentItemId, refreshKey]);

  if (loading || !link) return null;

  const requester = link.requester_name?.trim();
  const parentPreview = link.parent_message?.trim().replace(/\s+/g, ' ');

  return (
    <div
      className="mx-6 my-4 flex items-center gap-3"
      style={{
        backgroundColor: `${SLACK_COLOR}08`,
        border: `1px solid ${SLACK_COLOR}20`,
        borderLeft: `3px solid ${SLACK_COLOR}`,
        borderRadius: 8,
        padding: '12px 16px',
      }}
    >
      {/* Icon tile */}
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: `${SLACK_COLOR}15`,
        }}
      >
        <MessageSquare className="w-3.5 h-3.5" style={{ color: SLACK_COLOR }} />
      </span>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug text-slate-600">
          <strong className="text-slate-900">From Slack</strong>
          {link.channel_name && (
            <>
              <span> · </span>
              <span
                className="font-mono font-semibold"
                style={{ color: SLACK_COLOR }}
              >
                #{link.channel_name}
              </span>
            </>
          )}
          {requester && (
            <>
              <span> · captured by </span>
              <strong className="text-slate-900">{requester}</strong>
            </>
          )}
          <span> {formatRelativeTime(link.captured_at)}</span>
        </div>
        {parentPreview && (
          <div className="text-[11px] italic text-slate-400 mt-0.5 truncate">
            "{parentPreview}"
          </div>
        )}
      </div>

      {/* Open in Slack CTA — solid Slack-red */}
      <a
        href={link.permalink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs font-semibold rounded-md transition-opacity flex-shrink-0 hover:opacity-90"
        style={{
          padding: '6px 11px',
          color: '#ffffff',
          backgroundColor: SLACK_COLOR,
        }}
      >
        Open in Slack
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
