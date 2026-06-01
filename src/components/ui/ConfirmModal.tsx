import type { ReactNode } from 'react';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variant?: 'destructive' | 'warning';
  icon?: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
}

const iconCircleBg: Record<string, string> = {
  destructive: '#BA2C2C15',
  warning: '#FFC3B830',
};

const confirmBg: Record<string, string> = {
  destructive: '#BA2C2C',
  warning: '#A05042',
};

/**
 * Shared confirmation modal with two variants: `destructive` (red) and `warning` (coral).
 * Used for any action that needs a "pause and confirm" moment before proceeding.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  variant = 'destructive',
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth: 420,
          width: '100%',
          backgroundColor: '#fff',
          border: '1.5px solid #002339',
          borderRadius: 14,
          boxShadow:
            '0 2px 4px rgba(186,44,44,.25), 0 20px 40px -8px rgba(0,35,57,.22)',
          overflow: 'hidden',
        }}
      >
        {/* Body */}
        <div
          style={{ padding: 22 }}
          className="flex flex-row items-start"
        >
          {icon && (
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 40,
                height: 40,
                backgroundColor: iconCircleBg[variant],
                marginRight: 14,
              }}
            >
              {icon}
            </div>
          )}

          <div style={{ gap: 14 }}>
            <h2
              className="font-heading"
              style={{
                fontSize: 15,
                color: '#002339',
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                lineHeight: 1.55,
                margin: '6px 0 0',
              }}
            >
              {description}
            </p>
          </div>
        </div>

        {/* Action bar */}
        <div
          className="flex justify-end"
          style={{
            backgroundColor: '#F7F9FC',
            borderTop: '1px solid #00233918',
            padding: '14px 22px',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              backgroundColor: confirmBg[variant],
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
