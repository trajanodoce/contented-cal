import type { ContentItem } from './database.types';

// ── Source colors (per the ContentedCal design system) ──────────────────────
// Each source has a tint color (used for backgrounds / row washes) and a
// matched darker tone used for icons and badge text where readable contrast
// is needed. The bg tints get an alpha suffix (e.g. ${ORDINAL_COLOR}18) at
// the call site to soften them for row backgrounds.

export const ORDINAL_COLOR = '#D3CDEC';   // purple — Ordinal posts
export const ORDINAL_TEXT  = '#5B4F8A';   // deeper purple for icons/text

export const LINEAR_COLOR  = '#FFC3B8';   // coral — Linear issues
export const LINEAR_TEXT   = '#A05042';   // rust for icons/text

export const GRANOLA_COLOR = '#92D1B2';   // mint — Granola notes
export const GRANOLA_TEXT  = '#357254';   // deep green for icons/text

export const SLACK_COLOR   = '#9B3A3A';   // red — Slack requests
export const SLACK_TEXT    = '#9B3A3A';   // same — base is already dark enough

export const INTERNAL_COLOR = '#005D97';  // navy — native ContentedCal items
export const INTERNAL_TEXT  = '#003d66';  // deeper navy for icons/text

// Check if an item is from Ordinal (synced)
export function isOrdinalItem(item: ContentItem): boolean {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  return customFields._source === 'ordinal' || (item.tags?.includes('ordinal-sync') ?? false);
}

// Check if an item is from Linear (synced)
export function isLinearItem(item: ContentItem): boolean {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  return customFields._source === 'linear' || (item.tags?.includes('linear') ?? false);
}

// Get Linear issue info from custom fields
export interface LinearIssueInfo {
  identifier: string;
  url: string;
  team: string;
  project: string | null;
  status: string | null;
}

export function getLinearIssueInfo(item: ContentItem): LinearIssueInfo | null {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  if (customFields._source !== 'linear') return null;

  return {
    identifier: (customFields._linear_identifier as string) ?? '',
    url: (customFields._linear_url as string) ?? '',
    team: (customFields._linear_team as string) ?? 'Unknown',
    project: (customFields._linear_project as string) ?? null,
    status: (customFields._linear_status as string) ?? null,
  };
}

// Get the source of an item
export type ItemSource = 'calendar' | 'ordinal' | 'linear' | 'slack' | 'intake' | 'unknown';

export function getItemSource(item: ContentItem): ItemSource {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  const source = customFields._source as string | undefined;

  if (source === 'ordinal') return 'ordinal';
  if (item.tags?.includes('ordinal-sync')) return 'ordinal';
  if (source === 'linear') return 'linear';
  if (item.tags?.includes('slack-request')) return 'slack';
  if (source === 'intake') return 'intake';
  if (source === 'calendar' || !source) return 'calendar';

  return 'unknown';
}

// Platform icons and colors
export interface PlatformMeta {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  LinkedIn: {
    icon: 'in',
    color: '#0A66C2',
    bgColor: '#E8F4FC',
    label: 'LinkedIn',
  },
  X: {
    icon: '𝕏',
    color: '#000000',
    bgColor: '#F5F5F5',
    label: 'X',
  },
  Instagram: {
    icon: '📷',
    color: '#E4405F',
    bgColor: '#FCE8EC',
    label: 'Instagram',
  },
  TikTok: {
    icon: '🎵',
    color: '#000000',
    bgColor: '#F5F5F5',
    label: 'TikTok',
  },
  ordinal: {
    icon: '⚡',
    color: ORDINAL_TEXT,
    bgColor: `${ORDINAL_COLOR}40`,
    label: 'Ordinal',
  },
  linear: {
    icon: 'L',
    color: LINEAR_TEXT,
    bgColor: `${LINEAR_COLOR}40`,
    label: 'Linear',
  },
};

// Get Ordinal profile info from custom fields
export interface OrdinalProfile {
  name: string;
  handle: string;
  platform: string;
}

export function getOrdinalProfile(item: ContentItem): OrdinalProfile | null {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  const source = customFields._source as string | undefined;

  if (source !== 'ordinal' && !item.tags?.includes('ordinal-sync')) {
    return null;
  }

  return {
    name: (customFields._ordinal_profile as string) ?? 'Unknown',
    handle: (customFields._ordinal_handle as string) ?? '@unknown',
    platform: (customFields._ordinal_channel as string) ?? 'LinkedIn',
  };
}

// Get social platform from channel (e.g., "Social - LinkedIn" -> "LinkedIn")
export function getPlatformFromChannel(channel: string | null): string | null {
  if (!channel) return null;
  if (channel.includes('LinkedIn')) return 'LinkedIn';
  if (channel.includes('X') || channel.includes('Twitter')) return 'X';
  if (channel.includes('Instagram')) return 'Instagram';
  if (channel.includes('TikTok')) return 'TikTok';
  return null;
}

// Draft styling constants — Ordinal posts are always treated as drafts in the calendar
export const DRAFT_COLOR = '#D97706'; // amber-600

// Source filter options
export const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'calendar', label: 'Calendar (native)' },
  { value: 'ordinal', label: 'Ordinal (synced)' },
  { value: 'linear', label: 'Linear (synced)' },
  { value: 'slack', label: 'Slack requests' },
  { value: 'intake', label: 'Intake forms' },
] as const;
