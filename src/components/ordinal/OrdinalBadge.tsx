import { Zap, ExternalLink } from 'lucide-react';
import { isOrdinalItem, ORDINAL_COLOR, PLATFORM_META, getOrdinalProfile, getPlatformFromChannel } from '../../lib/ordinal';
import type { ContentItem } from '../../lib/database.types';

interface Props {
  item: ContentItem;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

export function OrdinalBadge({ item, showTooltip = true, size = 'sm' }: Props) {
  if (!isOrdinalItem(item)) return null;

  const sizeClasses = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <span
      title={showTooltip ? 'Synced from Ordinal' : undefined}
      className="inline-flex items-center justify-center rounded-md shrink-0"
      style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
    >
      <Zap className={`${sizeClasses}`} style={{ color: ORDINAL_COLOR }} />
    </span>
  );
}

interface OrdinalLinkButtonProps {
  item: ContentItem;
  postUrl?: string | null;
  size?: 'sm' | 'md';
}

export function OrdinalLinkButton({ item, postUrl, size = 'sm' }: OrdinalLinkButtonProps) {
  if (!isOrdinalItem(item)) return null;
  if (!postUrl) return null;

  const sizeClasses = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <a
      href={postUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Ordinal"
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border transition-colors hover:bg-opacity-10"
      style={{
        color: ORDINAL_COLOR,
        borderColor: `${ORDINAL_COLOR}40`,
        backgroundColor: `${ORDINAL_COLOR}08`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span>Open in Ordinal</span>
      <ExternalLink className={sizeClasses} />
    </a>
  );
}

// Platform icon component for social platforms
interface PlatformIconProps {
  platform: string;
  size?: 'sm' | 'md';
}

export function PlatformIcon({ platform, size = 'sm' }: PlatformIconProps) {
  const meta = PLATFORM_META[platform] ?? { icon: '●', color: '#666', bgColor: '#F5F5F5' };
  const sizeClasses = size === 'md' ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[10px]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold ${sizeClasses}`}
      style={{
        backgroundColor: meta.bgColor,
        color: meta.color,
      }}
    >
      {meta.icon}
    </span>
  );
}

// Profile chip for Ordinal posts
interface OrdinalProfileChipProps {
  name?: string;
  handle?: string;
  platform?: string;
}

export function OrdinalProfileChip({ name, handle, platform }: OrdinalProfileChipProps) {
  if (!name && !handle) return null;

  const displayName = name ?? 'Unknown';
  const displayHandle = handle ?? '@unknown';
  const platformLabel = platform ?? 'Social';

  // Normalize handle - strip leading @ if present
  const normalizedHandle = displayHandle.startsWith('@')
    ? displayHandle
    : `@${displayHandle}`;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
      <PlatformIcon platform={platformLabel} size="sm" />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-900">{displayName}</span>
        <span className="text-[10px] text-gray-500">{normalizedHandle}</span>
      </div>
    </div>
  );
}

// Row component for displaying Ordinal profile in list views
interface OrdinalProfileRowProps {
  item: ContentItem;
}

export function OrdinalProfileRow({ item }: OrdinalProfileRowProps) {
  const profile = getOrdinalProfile(item);
  const platform = getPlatformFromChannel(item.channel);

  if (!profile && !platform) return null;

  // Normalize handle
  const normalizedHandle = profile?.handle.startsWith('@')
    ? profile.handle
    : `@${profile?.handle ?? 'unknown'}`;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {platform && (
        <PlatformIcon platform={platform} size="sm" />
      )}
      {profile && (
        <span className="text-xs text-gray-500">
          <span className="text-gray-400">@</span>
          {normalizedHandle.replace('@', '')}
        </span>
      )}
    </div>
  );
}
