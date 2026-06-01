import type { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Visual intensity: 1 = page-level, 2 = section/panel, 3 = inline */
  level?: 1 | 2 | 3;
  /** Icon color state */
  state?: 'success' | 'info' | 'neutral' | 'waiting';
  /** Lucide icon JSX */
  icon: ReactNode;
  /** Heading text — use "yet" for transient states ("No projects yet") */
  title: string;
  /** Optional body copy */
  description?: string;
  /** Optional CTA (level 1 only) */
  action?: EmptyStateAction;
}

/* ------------------------------------------------------------------ */
/*  Icon color / background tokens per state                          */
/* ------------------------------------------------------------------ */

const stateStyles = {
  success: {
    color: '#357254',
    bg: 'linear-gradient(135deg, #92D1B228 0%, #FBE7F140 100%)',
  },
  info: {
    color: '#005D97',
    bg: '#005D9712',
  },
  neutral: {
    color: '#64748b',
    bg: '#94A3B820',
  },
  waiting: {
    color: '#A05042',
    bg: '#FFC3B820',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  level = 1,
  state = 'neutral',
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const { color, bg } = stateStyles[state];
  const isSuccess = state === 'success';

  /* ---- Icon container ---- */

  function renderIcon() {
    // Level 3: plain icon, no container
    if (level === 3) {
      return (
        <div style={{ color: '#cbd5e1' }} className="flex justify-center mb-2">
          {icon}
        </div>
      );
    }

    // Level 2: 36×36 circle or plain centered icon
    if (level === 2) {
      return (
        <div className="flex justify-center mb-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: bg,
              color,
            }}
          >
            {icon}
          </div>
        </div>
      );
    }

    // Level 1: 40×40 (or 48×48 for success) rounded-xl container
    const size = isSuccess ? 48 : 40;
    const radius = isSuccess ? 16 : 12; // rounded-2xl vs rounded-xl

    return (
      <div className="flex justify-center mb-4">
        <div
          className="flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: bg,
            color,
          }}
        >
          {icon}
        </div>
      </div>
    );
  }

  /* ---- Container styles by level ---- */

  const containerStyle: React.CSSProperties =
    level === 1
      ? {
          border: '1.5px solid #002339',
          borderRadius: 12,
          padding: 32,
          textAlign: 'center' as const,
          backgroundColor: '#F7F9FC',
        }
      : level === 2
        ? {
            border: '1px solid #00233930',
            borderRadius: 10,
            padding: '22px 28px',
            textAlign: 'center' as const,
            backgroundColor: '#F7F9FC',
          }
        : {
            padding: '16px 22px',
            textAlign: 'center' as const,
          };

  /* ---- Title / description styles by level ---- */

  const titleStyle: React.CSSProperties =
    level === 1
      ? {
          fontFamily: 'Faune-Text_Bold, sans-serif',
          fontSize: 14,
          fontWeight: 700,
          color: '#002339',
          margin: 0,
        }
      : level === 2
        ? { fontSize: 13, fontWeight: 600, color: '#334155', margin: 0 }
        : { fontSize: 12, color: '#94a3b8', margin: 0 };

  const descriptionStyle: React.CSSProperties = {
    fontSize: level === 2 ? 11 : 12,
    color: '#94a3b8',
    lineHeight: 1.5,
    marginTop: 4,
  };

  /* ---- Render ---- */

  return (
    <div style={containerStyle}>
      {renderIcon()}

      {/* Level 3 only shows a single-line message */}
      {level === 3 ? (
        <p style={titleStyle}>{title}</p>
      ) : (
        <>
          <h3 style={titleStyle}>{title}</h3>
          {description && <p style={descriptionStyle}>{description}</p>}
          {level === 1 && action && (
            <button
              type="button"
              onClick={action.onClick}
              style={{
                marginTop: 12,
                backgroundColor: '#005D97',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 8px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
