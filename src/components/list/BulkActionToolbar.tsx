import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Clock, Users, Calendar, Archive, Trash2, AlertTriangle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import {
  DatePickerPanel,
  datePickerPopoverClass,
  datePickerPopoverStyle,
} from '../ui/DatePicker';
import { isDoneStatus } from '../../lib/itemHelpers';
import type { Profile, BoardColumn } from '../../lib/database.types';

/**
 * Tailwind class to apply to selected rows in list-style consumers.
 * Pattern: <tr className={isSelected ? selectedRowClass : ''}> ...
 */
export const selectedRowClass = 'bg-brand-600/[0.063]';

interface BulkActionToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  members: Profile[];
  boardColumns: BoardColumn[];
  onClear: () => void;
  onUpdate: () => void;
}

type ActivePopover = null | 'status' | 'assign' | 'date';

export function BulkActionToolbar({
  selectedCount,
  selectedIds,
  members,
  boardColumns,
  onClear,
  onUpdate,
}: BulkActionToolbarProps) {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Trigger refs (for popover positioning)
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const triggerRefFor = (which: ActivePopover) => {
    if (which === 'status') return statusBtnRef;
    if (which === 'assign') return assignBtnRef;
    if (which === 'date') return dateBtnRef;
    return null;
  };

  // Compute popover position above the trigger
  const computePosition = useCallback(() => {
    const ref = triggerRefFor(activePopover);
    const trigger = ref?.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const width = popoverEl?.offsetWidth ?? 240;
    const height = popoverEl?.offsetHeight ?? 280;
    const margin = 8;
    const viewportW = window.innerWidth;

    let top = rect.top - margin - height;
    if (top < 8) top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - width / 2;
    if (left < 8) left = 8;
    if (left + width > viewportW - 8) left = viewportW - width - 8;

    setPopoverPos({ top, left });
  }, [activePopover]);

  useEffect(() => {
    if (!activePopover) {
      setPopoverPos(null);
      return;
    }
    // measure twice — once after mount for size, then re-position
    computePosition();
    const raf = requestAnimationFrame(computePosition);
    return () => cancelAnimationFrame(raf);
  }, [activePopover, computePosition]);

  useEffect(() => {
    if (!activePopover) return;
    const handler = () => computePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [activePopover, computePosition]);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!activePopover) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      const ref = triggerRefFor(activePopover);
      if (ref?.current?.contains(target)) return;
      setActivePopover(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActivePopover(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activePopover]);

  // ── Bulk actions ────────────────────────────────────────────────

  async function handleBulkAssign(memberId: string) {
    setActivePopover(null);
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const member = members.find((m) => m.id === memberId);

      const updates = selectedIds.map(async (id) => {
        const { data: item } = await supabase
          .from('content_items')
          .select('assignee_ids')
          .eq('id', id)
          .single();

        const currentIds = item?.assignee_ids || [];
        const newIds = currentIds.includes(memberId) ? currentIds : [...currentIds, memberId];

        await supabase.from('content_items').update({ assignee_ids: newIds }).eq('id', id);

        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: `assigned to ${member?.full_name || member?.email || 'member'}`,
          metadata: { assigneeId: memberId, assigneeIds: newIds },
        });
      });

      await Promise.all(updates);

      toast.success(`Set ${member?.full_name || member?.email} as owner of ${selectedCount} item(s)`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to bulk assign: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkStatusChange(statusId: string) {
    setActivePopover(null);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const status = boardColumns.find((bc) => bc.id === statusId);

      const isDone = isDoneStatus(status?.name);
      const payload: Record<string, unknown> = { status: statusId };
      if (isDone) {
        payload.completed = true;
        payload.completed_at = new Date().toISOString();
      } else {
        // Moving OUT of a done column → reset completed flags so view stays consistent
        payload.completed = false;
        payload.completed_at = null;
      }

      const updates = selectedIds.map(async (id) => {
        await supabase.from('content_items').update(payload).eq('id', id);

        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: `changed status to ${status?.name || 'None'}`,
          metadata: { newStatus: statusId },
        });
      });

      await Promise.all(updates);

      toast.success(`Updated status for ${selectedCount} item(s) to ${status?.name}`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to bulk update status: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkDueDate(date: string) {
    setActivePopover(null);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = { due_date: date || null };

      const updates = selectedIds.map(async (id) => {
        await supabase.from('content_items').update(payload).eq('id', id);
        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: date ? `set due date to ${date}` : 'cleared due date',
          metadata: { dueDate: date || null },
        });
      });

      await Promise.all(updates);
      toast.success(date ? `Set due date for ${selectedCount} item(s)` : `Cleared due date for ${selectedCount} item(s)`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to update due date: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkArchive() {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        archived: true,
      };

      const updates = selectedIds.map(async (id) => {
        await supabase.from('content_items').update(payload).eq('id', id);
        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: 'archived',
          metadata: {},
        });
      });

      await Promise.all(updates);
      toast.success(`Archived ${selectedCount} item(s)`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to archive: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkDelete() {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('content_items').delete().in('id', selectedIds);
      if (error) throw error;

      toast.success(`Deleted ${selectedCount} item(s)`);
      onUpdate();
      onClear();
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error('Failed to delete: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 40,
    backgroundColor: '#ffffff',
    border: '1.5px solid rgb(var(--color-brand-900))',
    borderRadius: 14,
    boxShadow:
      '0 6px 10px rgba(0,35,57,.14), 0 20px 32px -8px rgba(0,35,57,.22)',
    padding: '8px 8px 8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    animation: 'cc-bulk-bar-enter 180ms ease-out',
  };

  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: 22,
    background: 'rgb(var(--color-brand-900) / 0.094)',
    flexShrink: 0,
  };

  const actionBtnBase: React.CSSProperties = {
    background: 'transparent',
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgb(var(--color-slate-700))',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    lineHeight: 1,
  };

  const deleteBtnStyle: React.CSSProperties = { ...actionBtnBase, color: 'rgb(var(--color-accent-crimson))' };

  const clearBtnStyle: React.CSSProperties = { ...actionBtnBase, color: 'rgb(var(--color-slate-500))' };

  function ActionButton({
    icon,
    label,
    onClick,
    btnRef,
    style,
    isActive,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    btnRef?: React.RefObject<HTMLButtonElement>;
    style?: React.CSSProperties;
    isActive?: boolean;
  }) {
    return (
      <button
        ref={btnRef}
        type="button"
        disabled={isProcessing}
        onClick={onClick}
        style={{
          ...actionBtnBase,
          ...style,
          background: isActive ? 'rgb(var(--color-brand-600) / 0.031)' : 'transparent',
          opacity: isProcessing ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) e.currentTarget.style.background = 'rgb(var(--color-brand-600) / 0.031)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isActive ? 'rgb(var(--color-brand-600) / 0.031)' : 'transparent';
        }}
      >
        {icon}
        {label}
      </button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      <div role="toolbar" aria-label="Bulk actions" style={cardStyle}>
        {/* Selection count chip + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
          <span
            style={{
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgb(var(--color-brand-600))',
              borderRadius: 99,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {selectedCount}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-brand-900))' }}>selected</span>
        </div>

        <div style={dividerStyle} />

        <ActionButton
          btnRef={statusBtnRef}
          icon={<Clock size={13} />}
          label="Status"
          isActive={activePopover === 'status'}
          onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
        />
        <ActionButton
          btnRef={assignBtnRef}
          icon={<Users size={13} />}
          label="Assign"
          isActive={activePopover === 'assign'}
          onClick={() => setActivePopover(activePopover === 'assign' ? null : 'assign')}
        />
        <ActionButton
          btnRef={dateBtnRef}
          icon={<Calendar size={13} />}
          label="Due date"
          isActive={activePopover === 'date'}
          onClick={() => setActivePopover(activePopover === 'date' ? null : 'date')}
        />
        <ActionButton
          icon={<Archive size={13} />}
          label="Archive"
          onClick={handleBulkArchive}
        />
        <ActionButton
          icon={<Trash2 size={13} />}
          label="Delete"
          style={deleteBtnStyle}
          onClick={() => setShowDeleteConfirm(true)}
        />

        <div style={dividerStyle} />

        <button
          type="button"
          disabled={isProcessing}
          onClick={onClear}
          style={clearBtnStyle}
          onMouseEnter={(e) => {
            if (!isProcessing) e.currentTarget.style.background = 'rgb(var(--color-brand-600) / 0.031)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Clear
        </button>
      </div>

      {/* Portaled popovers */}
      {activePopover && popoverPos && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          className={activePopover === 'date' ? datePickerPopoverClass : 'bg-surface-card rounded-xl p-2 animate-in fade-in slide-in-from-bottom-1 duration-150'}
          style={
            activePopover === 'date'
              ? { ...datePickerPopoverStyle, top: popoverPos.top, left: popoverPos.left }
              : {
                  position: 'fixed',
                  top: popoverPos.top,
                  left: popoverPos.left,
                  zIndex: 9999,
                  minWidth: 220,
                  maxHeight: 320,
                  overflowY: 'auto',
                  border: '1.5px solid rgb(var(--color-brand-900))',
                  borderRadius: 12,
                  background: '#ffffff',
                  boxShadow: '0 4px 20px rgba(0,35,57,.12)',
                }
          }
        >
          {activePopover === 'status' && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">Select status</p>
              {[...boardColumns]
                .sort((a, b) => a.position - b.position)
                .map((column) => (
                  <button
                    key={column.id}
                    onClick={() => handleBulkStatusChange(column.id)}
                    className="w-full px-2 py-2 text-left text-sm hover:bg-brand-600/[0.094] flex items-center gap-2 rounded"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: column.color ?? undefined }}
                    />
                    <span className="text-slate-700">{column.name}</span>
                  </button>
                ))}
            </div>
          )}

          {activePopover === 'assign' && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">Select member</p>
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleBulkAssign(member.id)}
                  className="w-full px-2 py-2 text-left text-sm hover:bg-brand-600/[0.094] flex items-center gap-2 rounded"
                >
                  <Avatar src={member.avatar_url} name={member.full_name} size="md" />
                  <span className="text-slate-700">{member.full_name || member.email}</span>
                </button>
              ))}
            </div>
          )}

          {activePopover === 'date' && (
            <DatePickerPanel
              value={null}
              onChange={(d) => handleBulkDueDate(d)}
              onClose={() => setActivePopover(null)}
            />
          )}
        </div>,
        document.body,
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        variant="destructive"
        icon={<AlertTriangle size={20} style={{ color: 'rgb(var(--color-accent-crimson))' }} />}
        title={`Delete ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
        description="This action cannot be undone. The selected content items will be permanently deleted."
        confirmLabel="Delete"
        loading={isProcessing}
      />
    </>
  );
}
