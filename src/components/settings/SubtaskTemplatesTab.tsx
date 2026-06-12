import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { getWorkspaceSubtaskTemplates, type SubtaskTemplate } from '../../lib/utils';
import type { Json } from '../../lib/database.types';
import {
  Plus, Trash2, GripVertical, ClipboardCheck, Copy, Edit2, X,
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EmptyState } from '../ui/EmptyState';

const MAX_ITEMS = 10;

interface SubtaskTemplatesTabProps {
  workspaceId: string | null;
}

export function SubtaskTemplatesTab({ workspaceId }: SubtaskTemplatesTabProps) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  // Source of truth: workspace.settings. Local state mirrors it so optimistic
  // updates render instantly, but server-confirmed changes flow back through
  // currentWorkspace via refreshWorkspaces() and we re-sync on each remote update.
  const remoteTemplates = useMemo(
    () => getWorkspaceSubtaskTemplates(currentWorkspace?.settings),
    [currentWorkspace?.settings]
  );
  const [templates, setTemplates] = useState<SubtaskTemplate[]>(remoteTemplates);
  const pendingRef = useRef(false);

  // Sync local state when remote changes (another tab, another admin)
  // — skip while an optimistic update is in flight.
  useEffect(() => {
    if (!pendingRef.current) {
      setTemplates(remoteTemplates);
    }
  }, [remoteTemplates]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalItems, setModalItems] = useState<string[]>(['']);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Drag state — list level
  const [listDragIndex, setListDragIndex] = useState<number | null>(null);
  const [listDragOverIndex, setListDragOverIndex] = useState<number | null>(null);

  // Drag state — modal items
  const [itemDragIndex, setItemDragIndex] = useState<number | null>(null);
  const [itemDragOverIndex, setItemDragOverIndex] = useState<number | null>(null);

  const lastItemRef = useRef<HTMLInputElement>(null);

  // ── Persist to workspace.settings ───────────────────────────────────
  const saveTemplates = useCallback(
    async (updated: SubtaskTemplate[]) => {
      if (!workspaceId || !currentWorkspace) return false;
      setIsSaving(true);
      pendingRef.current = true;
      const currentSettings =
        currentWorkspace.settings &&
        typeof currentWorkspace.settings === 'object' &&
        !Array.isArray(currentWorkspace.settings)
          ? (currentWorkspace.settings as Record<string, unknown>)
          : {};
      const { error } = await supabase
        .from('workspaces')
        .update({
          settings: { ...currentSettings, subtask_templates: updated } as unknown as Json,
        })
        .eq('id', workspaceId);
      setIsSaving(false);
      if (error) {
        pendingRef.current = false;
        toast.error('Failed to save templates: ' + error.message);
        return false;
      }
      await refreshWorkspaces();
      pendingRef.current = false;
      return true;
    },
    [workspaceId, currentWorkspace, refreshWorkspaces]
  );

  // ── Modal helpers ───────────────────────────────────────────────────
  const openCreate = () => {
    setEditIndex(null);
    setModalName('');
    setModalItems(['']);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const t = templates[index];
    setEditIndex(index);
    setModalName(t.name);
    setModalItems([...t.items]);
    setModalOpen(true);
  };

  const openDuplicate = (index: number) => {
    const t = templates[index];
    setEditIndex(null);
    setModalName(`${t.name} (copy)`);
    setModalItems([...t.items]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditIndex(null);
  };

  // True when the user has typed anything in the modal — used to prevent
  // accidental backdrop dismissal mid-edit.
  const isModalDirty =
    modalName.trim().length > 0 ||
    modalItems.some(i => i.trim().length > 0);

  const handleBackdropClick = () => {
    if (isModalDirty) {
      const ok = window.confirm('Discard this template? Your changes will be lost.');
      if (!ok) return;
    }
    closeModal();
  };

  const handleModalSave = async () => {
    const name = modalName.trim();
    if (!name) return;

    const items = modalItems.map(i => i.trim()).filter(Boolean);
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    const template: SubtaskTemplate = { name, items };
    const prev = templates;
    let updated: SubtaskTemplate[];

    if (editIndex !== null) {
      updated = templates.map((t, i) => (i === editIndex ? template : t));
    } else {
      updated = [...templates, template];
    }

    setTemplates(updated);
    closeModal();

    const ok = await saveTemplates(updated);
    if (ok) {
      toast.success(editIndex !== null ? 'Template updated' : `Template "${name}" created`);
    } else {
      setTemplates(prev);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (deleteIndex === null) return;
    const removed = templates[deleteIndex];
    const prev = templates;
    const updated = templates.filter((_, i) => i !== deleteIndex);
    setTemplates(updated);
    setDeleteIndex(null);
    const ok = await saveTemplates(updated);
    if (ok) {
      toast.success(`Template "${removed.name}" deleted`);
    } else {
      setTemplates(prev);
    }
  };

  // ── Modal item management ──────────────────────────────────────────
  const addItem = () => {
    if (modalItems.length >= MAX_ITEMS) return;
    setModalItems([...modalItems, '']);
    requestAnimationFrame(() => lastItemRef.current?.focus());
  };

  const removeItem = (index: number) => {
    setModalItems(modalItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    setModalItems(modalItems.map((item, i) => (i === index ? value : item)));
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === modalItems.length - 1 && modalItems.length < MAX_ITEMS) {
        addItem();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent, index: number) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;

    e.preventDefault();
    // Replace the target slot with the first pasted line, then splice the
    // remaining lines in directly after — up to the max cap.
    const updated = [...modalItems];
    updated.splice(index, 1, ...lines);
    const accepted = Math.min(updated.length, MAX_ITEMS);
    const dropped = updated.length - accepted;
    updated.length = accepted;

    setModalItems(updated);
    if (dropped > 0) {
      toast.warning(`Pasted ${lines.length - dropped} items — ${dropped} dropped (max ${MAX_ITEMS})`);
    }
  };

  // ── List drag-and-drop ─────────────────────────────────────────────
  const handleListDrop = async (dropIndex: number) => {
    if (listDragIndex === null || listDragIndex === dropIndex) {
      setListDragIndex(null);
      setListDragOverIndex(null);
      return;
    }
    const prev = templates;
    const updated = [...templates];
    const [moved] = updated.splice(listDragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setTemplates(updated);
    setListDragIndex(null);
    setListDragOverIndex(null);
    const ok = await saveTemplates(updated);
    if (!ok) setTemplates(prev);
  };

  // ── Modal item drag-and-drop ───────────────────────────────────────
  const handleItemDrop = (dropIndex: number) => {
    if (itemDragIndex === null || itemDragIndex === dropIndex) {
      setItemDragIndex(null);
      setItemDragOverIndex(null);
      return;
    }
    const updated = [...modalItems];
    const [moved] = updated.splice(itemDragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setModalItems(updated);
    setItemDragIndex(null);
    setItemDragOverIndex(null);
  };

  const filledCount = modalItems.filter(i => i.trim()).length;
  const atMax = modalItems.length >= MAX_ITEMS;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Subtask Templates</h3>
          <p className="text-sm text-slate-500 mt-1">
            Reusable checklists that can be added to any content item
          </p>
        </div>
        {templates.length > 0 && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: 'rgb(var(--color-brand-600))' }}
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        )}
      </div>

      {/* Template list or empty state */}
      {templates.length === 0 ? (
        <EmptyState
          level={1}
          state="neutral"
          icon={<ClipboardCheck className="w-5 h-5" />}
          title="No subtask templates yet"
          description="Create reusable checklists that your team can add to any content item with one click."
          action={{ label: '+ Create your first template', onClick: openCreate }}
        />
      ) : (
        <div className="space-y-2">
          {templates.map((template, index) => (
            <div
              key={`${template.name}-${index}`}
              onDragOver={e => { e.preventDefault(); setListDragOverIndex(index); }}
              onDrop={() => handleListDrop(index)}
              className={`group flex items-start gap-3 p-4 rounded-xl transition-colors ${
                listDragOverIndex === index
                  ? 'bg-brand-600/[0.063]'
                  : 'bg-surface-nested hover:bg-brand-600/[0.031]'
              } ${listDragIndex === index ? 'opacity-50' : ''}`}
              style={{
                border: listDragOverIndex === index
                  ? '2px dashed rgb(var(--color-brand-600))'
                  : '1px solid rgb(var(--color-brand-900) / 0.094)',
              }}
            >
              {/* Drag handle */}
              <span
                draggable
                onDragStart={() => setListDragIndex(index)}
                onDragEnd={() => { setListDragIndex(null); setListDragOverIndex(null); }}
                className="cursor-grab flex-shrink-0 mt-0.5"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-4 h-4 text-slate-300" />
              </span>

              {/* Card body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[15px] font-bold text-slate-900 truncate"
                    style={{ fontFamily: 'Faune-Text_Bold, sans-serif' }}
                  >
                    {template.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-1.5">
                  {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {template.items.slice(0, 3).join(' · ')}
                  {template.items.length > 3 && ` · +${template.items.length - 3} more`}
                </p>
              </div>

              {/* Actions — always visible per spec */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(index)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-600/[0.063] rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openDuplicate(index)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-600/[0.063] rounded transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteIndex(index)}
                  className="p-1.5 text-slate-400 hover:text-accent-crimson hover:bg-accent-crimson/[0.031] rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--color-brand-900) / 0.376)' }}
          onClick={handleBackdropClick}
        >
          <div
            className="bg-surface-card shadow-xl w-full max-w-[520px] mx-4"
            style={{ border: '1.5px solid rgb(var(--color-brand-900))', borderRadius: 14 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h4 className="text-lg font-heading text-slate-900">
                {editIndex !== null ? 'Edit Template' : 'Create Template'}
              </h4>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 pb-4 space-y-4">
              {/* Name input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Template name
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="e.g. Blog Post Checklist"
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
                />
              </div>

              {/* Items list */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Checklist items
                </label>
                <div className="space-y-1.5">
                  {modalItems.map((item, index) => (
                    <div
                      key={index}
                      onDragOver={e => { e.preventDefault(); setItemDragOverIndex(index); }}
                      onDrop={() => handleItemDrop(index)}
                      className={`flex items-center gap-2 ${
                        itemDragOverIndex === index ? 'bg-brand-600/[0.063] rounded' : ''
                      } ${itemDragIndex === index ? 'opacity-50' : ''}`}
                    >
                      <span
                        draggable
                        onDragStart={() => setItemDragIndex(index)}
                        onDragEnd={() => { setItemDragIndex(null); setItemDragOverIndex(null); }}
                        className="cursor-grab shrink-0 flex items-center"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                      </span>
                      <input
                        ref={index === modalItems.length - 1 ? lastItemRef : undefined}
                        type="text"
                        value={item}
                        onChange={e => updateItem(index, e.target.value)}
                        onKeyDown={e => handleItemKeyDown(e, index)}
                        onPaste={e => handlePaste(e, index)}
                        placeholder={`Item ${index + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                        style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
                      />
                      <button
                        onClick={() => removeItem(index)}
                        disabled={modalItems.length <= 1}
                        className="w-[26px] h-[26px] flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-brand-600/[0.031] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add item button */}
                <button
                  onClick={addItem}
                  disabled={atMax}
                  className="w-full mt-2 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{
                    border: atMax ? '1.5px dashed rgb(var(--color-slate-300))' : '1.5px dashed rgb(var(--color-brand-600) / 0.188)',
                    color: atMax ? 'rgb(var(--color-slate-400))' : 'rgb(var(--color-brand-600))',
                    cursor: atMax ? 'not-allowed' : 'pointer',
                    backgroundColor: 'transparent',
                  }}
                  title={atMax ? `Templates max out at ${MAX_ITEMS} items. If a task needs more, split it into separate templates.` : undefined}
                >
                  + Add item
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div
              className="flex items-center justify-between px-6 py-3.5"
              style={{
                backgroundColor: 'rgb(var(--color-surface-card))',
                borderTop: '1px solid rgb(var(--color-brand-900) / 0.094)',
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: atMax ? 'rgb(var(--color-accent-crimson))' : 'rgb(var(--color-slate-500))' }}
              >
                {atMax ? `${modalItems.length} / ${MAX_ITEMS} — max` : `${modalItems.length} / ${MAX_ITEMS} items`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSave}
                  disabled={!modalName.trim() || filledCount === 0 || isSaving}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'rgb(var(--color-brand-600))' }}
                >
                  {isSaving ? 'Saving...' : editIndex !== null ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={handleDelete}
        variant="destructive"
        icon={<Trash2 className="w-5 h-5" style={{ color: 'rgb(var(--color-accent-crimson))' }} />}
        title="Delete Template?"
        description={
          deleteIndex !== null
            ? `Remove "${templates[deleteIndex]?.name}"? Items already added to existing tasks stay where they are.`
            : ''
        }
        confirmLabel="Delete template"
      />
    </div>
  );
}
