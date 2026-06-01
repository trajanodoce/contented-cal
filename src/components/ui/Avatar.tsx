import { useState } from 'react';
import { User } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  /** Full name used to derive initials */
  name?: string | null;
  size?: Size;
  className?: string;
}

interface AvatarStackProps {
  users: Array<{ src?: string | null; name?: string | null }>;
  size?: Size;
  /** Maximum visible avatars before the "+N" chip (default 3) */
  max?: number;
}

/* ------------------------------------------------------------------ */
/*  Size maps                                                          */
/* ------------------------------------------------------------------ */

const PX: Record<Size, number> = { xs: 16, sm: 20, md: 24, lg: 32, xl: 40 };
const FONT: Record<Size, number> = { xs: 7, sm: 9, md: 10, lg: 13, xl: 16 };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string, size: Size): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';

  // XS / SM → one letter max
  if (size === 'xs' || size === 'sm') return first.toUpperCase();
  return (first + last).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const px = PX[size];

  const base: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    lineHeight: 1,
  };

  /* 1️ Image */
  if (src && !imgError) {
    return (
      <span className={className} style={base}>
        <img
          src={src}
          alt={name ?? ''}
          width={px}
          height={px}
          onError={() => setImgError(true)}
          style={{ width: px, height: px, objectFit: 'cover', display: 'block' }}
        />
      </span>
    );
  }

  /* 2️ Initials */
  if (name?.trim()) {
    return (
      <span
        className={className}
        style={{
          ...base,
          background: 'linear-gradient(135deg, #005D97, #D4729E)',
          color: '#fff',
          fontWeight: 700,
          fontSize: FONT[size],
        }}
      >
        {getInitials(name, size)}
      </span>
    );
  }

  /* 3️ User icon silhouette */
  const iconPx = Math.round(px * 0.5);
  return (
    <span
      className={className}
      style={{ ...base, background: '#e2e8f0' }}
    >
      <User size={iconPx} color="#94a3b8" strokeWidth={2} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  AvatarStack                                                        */
/* ------------------------------------------------------------------ */

export function AvatarStack({ users, size = 'md', max = 3 }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;
  const px = PX[size];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {visible.map((u, i) => (
        <span
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            borderRadius: '50%',
            border: '2px solid #fff',
            display: 'inline-flex',
            zIndex: visible.length - i,
            position: 'relative',
          }}
        >
          <Avatar src={u.src} name={u.name} size={size} />
        </span>
      ))}

      {overflow > 0 && (
        <span
          style={{
            marginLeft: -8,
            width: px,
            height: px,
            borderRadius: '50%',
            border: '2px solid #fff',
            background: '#cbd5e1',
            color: '#475569',
            fontSize: FONT[size],
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 0,
            lineHeight: 1,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
