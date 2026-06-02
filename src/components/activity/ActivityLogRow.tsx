import React from 'react';
import {
  Check,
  Users,
  MessageCircle,
  Plus,
  ChevronRight,
  Trash2,
  Sun,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/relativeTime';
import { parseActivityAction, type ActionPart } from './parseActivityAction';

export type ActivityType =
  | 'status'
  | 'assignment'
  | 'comment'
  | 'subtask'
  | 'move'
  | 'delete'
  | 'create';

export interface ActivityLogRowProps {
  type: ActivityType;
  actor: { name: string; avatarUrl?: string | null };
  timestamp: string | Date;
  action?: string;
  metadata?: unknown;
  children?: React.ReactNode;
}

export interface ActivityLogProps {
  children: React.ReactNode;
}

type IconStyle = {
  background: string;
  color: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const ICON_STYLES: Record<ActivityType, IconStyle> = {
  status:     { background: '#92D1B220', color: '#357254', Icon: Check },
  assignment: { background: '#005D9712', color: '#005D97', Icon: Users },
  comment:    { background: '#FFC3B830', color: '#A05042', Icon: MessageCircle },
  subtask:    { background: '#005D9712', color: '#005D97', Icon: Plus },
  move:       { background: '#94A3B820', color: '#64748b', Icon: ChevronRight },
  delete:     { background: '#BA2C2C15', color: '#BA2C2C', Icon: Trash2 },
  create:     {
    background: 'linear-gradient(135deg, #92D1B228 0%, #FBE7F140 100%)',
    color: '#357254',
    Icon: Sun,
  },
};

export function ActivityLog({ children }: ActivityLogProps) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 11,
          top: 14,
          bottom: 14,
          width: 1,
          background: '#00233910',
        }}
      />
      {children}
    </div>
  );
}

export function ActivityLogRow({ type, actor, timestamp, action, metadata, children }: ActivityLogRowProps) {
  const { background, color, Icon } = ICON_STYLES[type];
  const content = children !== undefined
    ? children
    : action !== undefined
      ? <RenderedParts parts={parseActivityAction(action, metadata).parts} />
      : null;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Icon size={11} color={color} strokeWidth={2.25} />
      </div>
      <div style={{ paddingTop: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: '#002339' }}>
          <Actor name={actor.name} /> {content}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {formatRelativeTime(timestamp)}
        </div>
      </div>
    </div>
  );
}

function RenderedParts({ parts }: { parts: ActionPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === 'text') {
          return <span key={i} style={{ color: '#475569' }}>{part.value}</span>;
        }
        if (part.kind === 'quote') {
          return (
            <span
              key={i}
              style={{
                color: '#334155',
                fontStyle: part.italic ? 'italic' : 'normal',
                fontWeight: part.italic ? 400 : 500,
              }}
            >
              &ldquo;{part.value}&rdquo;
            </span>
          );
        }
        if (part.kind === 'bold') {
          return <strong key={i} style={{ color: '#002339', fontWeight: 600 }}>{part.value}</strong>;
        }
        // pill
        return <StatusPill key={i} label={part.label} color={part.color} />;
      })}
    </>
  );
}

function StatusPill({ label, color }: { label: string; color?: string }) {
  // Default neutral palette
  const bg = color ? `${color}12` : '#005D9712';
  const fg = color || '#005D97';
  const border = color ? `${color}30` : '#005D9730';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        color: fg,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 99,
        lineHeight: 1.5,
        verticalAlign: 'baseline',
      }}
    >
      {label}
    </span>
  );
}

export function Actor({ name }: { name: string; avatarUrl?: string | null }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'baseline' }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #005D97, #002339)',
          color: '#ffffff',
          fontSize: 9,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#002339' }}>{name}</span>
    </span>
  );
}

export function mapActionToType(action: string): ActivityType {
  const a = action.toLowerCase();
  if (a.includes('moved to project') || a.includes('reordered')) return 'move';
  if (a.includes('status') || a.includes('moved')) return 'status';
  if (a.includes('assigned')) return 'assignment';
  if (a.includes('comment')) return 'comment';
  if (a.includes('subtask')) return 'subtask';
  if (a.includes('delete') || a.includes('removed')) return 'delete';
  if (a.includes('created')) return 'create';
  return 'move';
}
