import { useState } from 'react';
import { User, Camera } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Size = 'xs' | 'xs-inline' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  /** Full name used to derive initials */
  name?: string | null;
  size?: Size;
  className?: string;
  /** Shows hover overlay with camera icon (sm and up only) */
  editable?: boolean;
  /** Shows ring-sweep overlay + 60% opacity */
  uploading?: boolean;
  /** Fired when the editable overlay is clicked */
  onEditClick?: () => void;
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

// 'xs-inline' is the 18px size used in board cards + activity log actor blocks.
// Falls between xs (16) and sm (20). Promoted to canonical after 3+ surface uses.
const PX: Record<Size, number> = { xs: 16, 'xs-inline': 18, sm: 20, md: 24, lg: 32, xl: 40 };
const FONT: Record<Size, number> = { xs: 7, 'xs-inline': 8, sm: 9, md: 10, lg: 13, xl: 16 };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string, size: Size): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';

  // XS / XS-inline / SM → one letter max
  if (size === 'xs' || size === 'xs-inline' || size === 'sm') return first.toUpperCase();
  return (first + last).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export function Avatar({
  src,
  name,
  size = 'md',
  className = '',
  editable = false,
  uploading = false,
  onEditClick,
}: AvatarProps) {
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

  // xs is too small for the hover affordance — fall back to non-editable
  const showEditable = editable && size !== 'xs';
  const showLabel = size === 'lg' || size === 'xl';

  /* Render the inner avatar visual (image / initials / silhouette) */
  let inner: React.ReactNode;

  if (src && !imgError) {
    inner = (
      <span style={base}>
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
  } else if (name?.trim()) {
    inner = (
      <span
        role="img"
        aria-label={name}
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
  } else {
    const iconPx = Math.round(px * 0.5);
    inner = (
      <span
        role="img"
        aria-label="User avatar"
        style={{ ...base, background: '#e2e8f0' }}
      >
        <User size={iconPx} color="#94a3b8" strokeWidth={2} />
      </span>
    );
  }

  // No overlay needed — return inner directly, preserving className on the outer span
  if (!showEditable && !uploading) {
    return <span className={className} style={base}>{inner}</span>;
  }

  // Wrapped: relative container with optional editable overlay + uploading ring
  const overlayIconPx = size === 'sm' || size === 'md' ? Math.round(px * 0.55) : 20;
  const ringStrokeRadius = (px / 2) - 1.5; // inset so 3px stroke sits inside
  const ringCircumference = 2 * Math.PI * ringStrokeRadius;

  return (
    <span
      className={`group ${className}`}
      style={{
        ...base,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <span
        style={{
          ...base,
          opacity: uploading ? 0.6 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {inner}
      </span>

      {showEditable && !uploading && (
        <button
          type="button"
          onClick={onEditClick}
          aria-label="Change avatar"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgba(0,35,57,.55)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            lineHeight: 1,
          }}
        >
          <Camera size={overlayIconPx} strokeWidth={2} />
          {showLabel && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                marginTop: 2,
              }}
            >
              Change
            </span>
          )}
        </button>
      )}

      {uploading && (
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <circle
            className="cc-avatar-ring"
            cx={px / 2}
            cy={px / 2}
            r={ringStrokeRadius}
            fill="none"
            stroke="#005D97"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="40 200"
            style={{
              // Override generic 240 default so the dash anim wraps fully on any size
              strokeDashoffset: ringCircumference,
            }}
          />
        </svg>
      )}
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

  // Smaller sizes use a thinner border + tighter overlap, per canonical Draft 5.2.
  const isSmall = size === 'xs' || size === 'xs-inline' || size === 'sm';
  const borderWidth = isSmall ? 1.5 : 2;
  const overlap = isSmall ? -6 : -8;
  const borderStyle = `${borderWidth}px solid #fff`;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {visible.map((u, i) => (
        <span
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : overlap,
            borderRadius: '50%',
            border: borderStyle,
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
            marginLeft: overlap,
            width: px,
            height: px,
            borderRadius: '50%',
            border: borderStyle,
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
