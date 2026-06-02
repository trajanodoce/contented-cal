import { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SLACK_COLOR, SLACK_TEXT } from '../../lib/ordinal';
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
}

/**
 * Source banner for items originated in Slack (canonical Draft 4.6).
 *
 * Mounted at the top of the detail panel above the title — same slot as the
 * Ordinal/Linear banner but for Slack-originated items. Reads from
 * `slack_thread_links` where `is_origin = true`, NOT from custom_fields, so
 * the banner disappears cleanly if the origin link is unlinked later. The
 * item itself stays fully editable (unlike Ordinal which forces read-only).
 */
export function SlackSourceBanner({ contentItemId, refreshKey }: Props) {
  const [link, setLink] = useState<OriginLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('slack_thread_links')
      .select('channel_name, permalink, requester_name, captured_at')
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

  const channelLabel = link.channel_name ? `#${link.channel_name}` : 'a Slack thread';
  const requester = link.requester_name?.trim();

  return (
    <div
      className="px-6 py-3 border-b"
      style={{
        backgroundColor: `${SLACK_COLOR}30`,
        borderColor: SLACK_TEXT,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: SLACK_TEXT, color: 'white' }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: SLACK_TEXT }}>
              Sourced from Slack — {channelLabel}
            </p>
            <p className="text-xs truncate" style={{ color: SLACK_TEXT, opacity: 0.85 }}>
              {requester ? `Requested by ${requester}` : 'Requested via Slack'}
              {' · '}
              {formatRelativeTime(link.captured_at)}
            </p>
          </div>
        </div>
        <a
          href={link.permalink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex-shrink-0 hover:opacity-90"
          style={{
            color: SLACK_TEXT,
            borderColor: `${SLACK_COLOR}60`,
            border: `1px solid ${SLACK_COLOR}60`,
            backgroundColor: '#ffffff',
          }}
        >
          Open in Slack
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
