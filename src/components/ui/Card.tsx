import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Extra Tailwind classes merged onto the wrapper */
  className?: string;
  /** Render as a clickable card (button semantics) */
  as?: 'div' | 'section' | 'button';
}

/**
 * Design-system card surface.
 * bg-surface-card, rounded-xl, shadow-sm, 1px #00233930 border.
 */
export function Card({ children, className = '', as: Tag = 'div', style, ...rest }: CardProps) {
  return (
    <Tag
      className={`bg-surface-card rounded-xl shadow-sm overflow-hidden ${className}`}
      style={{ border: '1px solid #00233930', ...style }}
      {...(rest as any)}
    >
      {children}
    </Tag>
  );
}
