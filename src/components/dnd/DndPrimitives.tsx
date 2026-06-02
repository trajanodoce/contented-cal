/**
 * Drag-and-Drop Visual Feedback — canonical primitives.
 *
 * Three-color semantic system:
 *   • Brand navy  #005D97 — drop target / user action
 *   • Delete red  #BA2C2C — invalid drop
 *   • Brand pink           — the piece in motion
 *       Pink 50  #FDF2F7 (wash)
 *       Pink 200 #F0BBD0 (dashed border)
 *
 * Spec lives in ContentedCal-Design-System.html under
 * <h2>Drag-and-Drop Visual Feedback</h2>.
 */
import { CSSProperties, ReactNode } from 'react';

const NAVY = '#005D97';
const NAVY_WASH = '#005D9710';
const RED = '#BA2C2C';
const RED_WASH = '#BA2C2C06';
const PINK_50 = '#FDF2F7';
const PINK_200 = '#F0BBD0';

// Canonical shadow-md from Hover & Active States.
const SHADOW_MD = '0 4px 6px rgba(0,35,57,.11), 0 10px 16px rgba(0,35,57,.16)';

// ─────────────────────────────────────────────────────────────────────────────
// <DropTarget>
// Zone-level drop target. Wraps any container and applies the canonical
// 2px dashed border + brand wash (or delete-red variant when invalid).
// When not over, passes through children/className/style unchanged.
// ─────────────────────────────────────────────────────────────────────────────
export interface DropTargetProps {
  isOver: boolean;
  invalid?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function DropTarget({
  isOver,
  invalid = false,
  children,
  className,
  style,
}: DropTargetProps) {
  if (!isOver) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const overStyle: CSSProperties = invalid
    ? {
        ...style,
        border: `2px dashed ${RED}`,
        backgroundColor: RED_WASH,
        cursor: 'not-allowed',
      }
    : {
        ...style,
        border: `2px dashed ${NAVY}`,
        backgroundColor: NAVY_WASH,
      };

  return (
    <div className={className} style={overStyle}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <DropIndicatorLine>
// 2px solid brand-navy line for between-items insertion points.
// Caller decides position (block flow / absolute) via wrapper.
// ─────────────────────────────────────────────────────────────────────────────
export interface DropIndicatorLineProps {
  className?: string;
  style?: CSSProperties;
}

export function DropIndicatorLine({ className, style }: DropIndicatorLineProps) {
  return (
    <div
      className={className}
      style={{
        height: 2,
        background: NAVY,
        borderRadius: 99,
        margin: '2px 0',
        ...style,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <ListPlaceholderSlot>
// Pink 50 wash + navy left bar marking the would-be drop position in a list.
// "Pink = the moving piece. Navy = land here." Two-color split.
// ─────────────────────────────────────────────────────────────────────────────
export interface ListPlaceholderSlotProps {
  label?: string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function ListPlaceholderSlot({
  label = '— drop position —',
  height,
  className,
  style,
}: ListPlaceholderSlotProps) {
  return (
    <div
      className={className}
      style={{
        background: PINK_50,
        borderLeft: `2px solid ${NAVY}`,
        padding: '7px 10px',
        color: '#94a3b8', // slate-400
        fontSize: 13,
        height,
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <BoardSourcePlaceholder>
// The empty pink rectangle left where a board card used to be — distinguishes
// "the item moved" from "the item disappeared."
// ─────────────────────────────────────────────────────────────────────────────
export interface BoardSourcePlaceholderProps {
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function BoardSourcePlaceholder({
  height,
  className,
  style,
}: BoardSourcePlaceholderProps) {
  return (
    <div
      className={className}
      style={{
        border: `1.5px dashed ${PINK_200}`,
        background: PINK_50,
        borderRadius: 8,
        height: height ?? 80,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <DragGhost>
// Wrapper for the DragOverlay item (or any "in-flight" visual representation).
// Applies canonical shadow-md, opacity, rotation, grabbing cursor.
// rotate default -0.6 (narrow rows / list); pass -1.5 for cards.
// ─────────────────────────────────────────────────────────────────────────────
export interface DragGhostProps {
  rotate?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function DragGhost({
  rotate = -0.6,
  children,
  className,
  style,
}: DragGhostProps) {
  return (
    <div
      className={className}
      style={{
        opacity: 0.9,
        transform: `rotate(${rotate}deg)`,
        boxShadow: SHADOW_MD,
        cursor: 'grabbing',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
