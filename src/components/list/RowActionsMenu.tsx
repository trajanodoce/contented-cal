import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Eye, Archive, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { ContentItem } from '../../lib/database.types';

interface RowActionsMenuProps {
  item: ContentItem;
  onOpen: () => void;
  onUpdate: () => void;
}

/**
 * Always-visible ghosted 3-dot row actions menu (canonical Draft 5.1).
 *
 * Color ladder via parent's `group` class:
 *   default        → slate-300 (#cbd5e1)
 *   row hover      → slate-500 (#64748b) via group-hover
 *   icon hover     → slate-700 (#334155)
 *   menu open      → slate-700 + brand-navy wash bg
 *
 * v1 actions: Open · Archive · Delete.
 * Deferred: Duplicate, Move to project (require additional UI/state).
 */
export function RowActionsMenu({ item, onOpen, onUpdate }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Right-align the menu under the icon
    setPos({ top: rect.bottom + 4, left: rect.right - 180 });

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleArchive() {
    setOpen(false);
    const { error } = await supabase
      .from('content_items')
      .update({ archived: true })
      .eq('id', item.id);
    if (error) {
      toast.error('Failed to archive: ' + error.message);
      return;
    }
    toast.success(`Archived "${item.title}"`);
    onUpdate();
  }

  async function handleDelete() {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', item.id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
      return;
    }
    toast.success(`Deleted "${item.title}"`);
    setConfirmDelete(false);
    onUpdate();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`p-1 rounded transition-colors ${
          open
            ? 'text-slate-700 bg-brand-600/[0.063]'
            : 'text-slate-300 group-hover:text-slate-500 hover:text-slate-700 hover:bg-brand-600/[0.063]'
        }`}
        title="Item actions"
        aria-label="Item actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed bg-white rounded-lg shadow-lg py-1 z-50"
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: 180,
            border: '1px solid rgb(var(--color-brand-900) / 0.188)',
            backgroundImage: 'linear-gradient(135deg, rgb(var(--color-brand-600) / 0.031) 0%, transparent 60%)',
          }}
        >
          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onOpen();
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-brand-600/[0.094] transition-colors flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5" />
            Open
          </button>
          <div className="border-t my-1" style={{ borderColor: 'rgb(var(--color-brand-900) / 0.094)' }} />
          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              handleArchive();
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-brand-600/[0.094] transition-colors flex items-center gap-2"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>
          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              setConfirmDelete(true);
            }}
            className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 hover:bg-accent-crimson/[0.031]"
            style={{ color: 'rgb(var(--color-accent-crimson))' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        variant="destructive"
        icon={<Trash2 className="w-5 h-5" style={{ color: 'rgb(var(--color-accent-crimson))' }} />}
        title={`Delete "${item.title}"?`}
        description="This permanently removes the item, its comments, subtasks, and activity log. This can't be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
