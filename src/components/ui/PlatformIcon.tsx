import type { ExternalLinkPlatform } from '../../lib/database.types';

/**
 * Unified platform icon for expanded contexts (slide-over Assets section,
 * Content Library "From Tasks" rows). Compact contexts (Board / List /
 * Calendar cards) use a single paperclip indicator instead.
 *
 * Hybrid strategy locked 2026-06-05:
 *   - Official-style brand SVGs for platforms with high recognition value
 *     (Figma · Canva · Notion · Google Docs · Google Drive · Miro · Granola
 *     · Ordinal). Approximations here; production may swap to actual brand
 *     SVGs pulled from each vendor's brand kit.
 *   - Custom generic icons for platforms with weak public recognition
 *     (Linear · File upload · Other link).
 *   - Uniform rounded-square tile container so the visual rhythm holds
 *     across mixed brands. Background tint + optional border are tuned
 *     per platform to honor each brand's palette.
 *
 * Adding a new platform = add an entry to PLATFORM_CONFIG. Brand refresh
 * = swap the icon SVG, container stays. See spec doc:
 *   docs/project-spec-design-tokens-extraction-2026-06-05.md
 */

interface PlatformIconProps {
  platform: ExternalLinkPlatform;
  /** Outer tile size in px. Default 32. Icon scales to ~56% of tile. */
  size?: number;
}

interface PlatformConfig {
  bg: string;
  border?: string;
  icon: (iconSize: number) => React.ReactNode;
}

const PLATFORM_CONFIG: Record<ExternalLinkPlatform, PlatformConfig> = {
  figma: {
    bg: '#F5F3FF',
    border: '#7C3AED20',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 38 57" fill="none">
        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
        <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
      </svg>
    ),
  },
  canva: {
    bg: 'linear-gradient(135deg, #00C4CC, #7D2AE7)',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a4 4 0 0 0-8 0v8a4 4 0 0 0 8 0" />
      </svg>
    ),
  },
  notion: {
    bg: '#FFFFFF',
    border: '#00000020',
    icon: (s) => (
      <svg width={s * 1.22} height={s * 1.22} viewBox="0 0 30 30" fill="none">
        <path d="M5.5 5v20l3 2 14-1V8L19 5H5.5Z" fill="white" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 10v10M10 10l9 10V10" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  google_docs: {
    bg: '#E8F0FE',
    border: '#2563EB20',
    icon: (s) => (
      <svg width={s} height={s * 1.22} viewBox="0 0 18 22" fill="none">
        <path d="M11 1H3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-6-6Z" fill="#4285F4" />
        <path d="M11 1v6h6L11 1Z" fill="#A1C2FA" />
        <path d="M5 11h8M5 14h8M5 17h5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  google_drive: {
    bg: 'white',
    border: '#00000010',
    icon: (s) => (
      <svg width={s * 1.11} height={s} viewBox="0 0 20 18" fill="none">
        <path d="M6.5 1L13.5 1L20 13L13 13L6.5 1Z" fill="#FBBC04" />
        <path d="M0 13L3.5 7L10.5 7L7 13L0 13Z" fill="#34A853" />
        <path d="M6.5 1L13.5 1L10 7L3.5 7L6.5 1Z" fill="#4285F4" />
        <path d="M7 13L10.5 7L17 7L13.5 13L7 13Z" fill="#1A73E8" />
        <path d="M3 17.5L6.5 11.5L20 11.5L16.5 17.5L3 17.5Z" fill="#EA4335" />
      </svg>
    ),
  },
  miro: {
    bg: '#FFD02F',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 30 30" fill="none">
        <path d="M22 4l-3 5 3-5Zm-5 0l-4 6 3 9-3-9 4-6Zm-5 0L7 12l3 11-3-11 5-8Zm-5 0L3 18l3 8-3-8 4-14Z" fill="#050038" stroke="#050038" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  linear: {
    bg: 'linear-gradient(135deg, #5E6AD2, #7173D6)',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <path d="M1.4 64.8c-.7-3-.5-2.1 1.5-.1l34.6 34.5c2.1 2.1 2.9 2.4-.1 1.6C20.6 95.4 6 80.8 1.4 64.8Z" fill="white" />
        <path d="M.1 51c-.2-2.5-.3-1.8 1.5 0L48.9 98.4c1.8 1.8 2.5 1.7 0 1.5C25.1 98 2 75 .1 51Z" fill="white" />
        <path d="M4.5 36.4c-.7-1.8-.6-1.3 1-.1l58.2 58.2c1.4 1.4 1.5 1.7-.3 1C40.9 89 11 59 4.5 36.4Z" fill="white" />
        <path d="M16.4 17c6.6-6.6 16-9 23.2-7C58.5 14.6 85.4 41.6 90 60.5c2 7.2-.4 16.7-7 23.3L16.4 17Z" fill="white" />
      </svg>
    ),
  },
  granola: {
    bg: '#E8F5EE',
    border: '#35725420',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#357254" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
  },
  ordinal: {
    bg: '#000000',
    icon: (s) => (
      <svg width={s * 1.22} height={s * 1.22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2">
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-30 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(0 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(90 12 12)" />
      </svg>
    ),
  },
  file: {
    bg: '#F0F9FF',
    border: '#0369A120',
    icon: (s) => (
      <svg width={s} height={s * 1.22} viewBox="0 0 18 22" fill="none" stroke="#0369A1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 1H3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-6-6Z" />
        <polyline points="11 1 11 7 17 7" />
      </svg>
    ),
  },
  other: {
    bg: '#F9FAFB',
    border: '#4B556320',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
};

export function PlatformIcon({ platform, size = 32 }: PlatformIconProps) {
  const config = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.other;
  const iconSize = Math.round(size * 0.56);

  return (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: config.bg,
        border: config.border ? `1px solid ${config.border}` : undefined,
      }}
    >
      {config.icon(iconSize)}
    </div>
  );
}
