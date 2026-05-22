import type { ContentItem } from './database.types';

// Ordinal brand color
export const ORDINAL_COLOR = '#7E61FF';

// Check if an item is from Ordinal (synced)
export function isOrdinalItem(item: ContentItem): boolean {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  return customFields._source === 'ordinal' || item.tags?.includes('ordinal-sync');
}

// Get the source of an item
export type ItemSource = 'calendar' | 'ordinal' | 'slack' | 'intake' | 'unknown';

export function getItemSource(item: ContentItem): ItemSource {
  const customFields = (item.custom_fields as Record<string, unknown>) ?? {};
  const source = customFields._source as string | undefined;

  if (source === 'ordinal') return 'ordinal';
  if (item.tags?.includes('ordinal-sync')) return 'ordinal';
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
    color: '#7E61FF',
    bgColor: '#F3F0FF',
    label: 'Ordinal',
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

// Source filter options
export const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'calendar', label: 'Calendar (native)' },
  { value: 'ordinal', label: 'Ordinal (synced)' },
  { value: 'slack', label: 'Slack requests' },
  { value: 'intake', label: 'Intake forms' },
] as const;
