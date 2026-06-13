import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { BoardColumn } from '../../lib/database.types';
import {
  Plus, Trash2, Layout, Edit2,
  ChevronDown, ChevronUp, GripVertical, AlertTriangle,
} from 'lucide-react';
import { BOARD_COLUMN_PALETTE } from '../../lib/colors';

// Canonical 8-color board status spectrum (see colors.ts). Swatch set for the picker.
const COLOR_PALETTE = BOARD_COLUMN_PALETTE.map((c) => c.hex);

interface BoardColumnsTabProps {
  workspaceId: string | null;
}

export function BoardColumnsTab({ workspaceId }: BoardColumnsTabProps) {
  const { refreshWorkspaceData } = useApp();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null);
  const [formData, setFormData] = useState({ name: '', color: COLOR_PALETTE[0], position: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<BoardColumn | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchColumns = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('board_columns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('position');
    if (error) {
      toast.error('Failed to load board columns');
    } else {
      setColumns(data || []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const handleSave = async () => {
    if (!workspaceId || !formData.name.trim()) return;
    setIsSaving(true);

    if (editingColumn) {
      const { error } = await supabase
        .from('board_columns')
        .update({ name: formData.name.trim(), color: formData.color })
        .eq('id', editingColumn.id);
      if (error) {
        toast.error('Failed to update: ' + error.message);
      } else {
        toast.success('Board column updated');
        setShowForm(false);
        setEditingColumn(null);
        fetchColumns();
        refreshWorkspaceData();
      }
    } else {
      const maxPosition = columns.length > 0 ? Math.max(...columns.map((c) => c.position)) : -1;
      const { error } = await supabase
        .from('board_columns')
        .insert({
          workspace_id: workspaceId,
          name: formData.name.trim(),
          color: formData.color,
          position: maxPosition + 1,
        });
      if (error) {
        toast.error('Failed to create: ' + error.message);
      } else {
        toast.success('Board column created');
        setShowForm(false);
        setFormData({ name: '', color: COLOR_PALETTE[0], position: 1 });
        fetchColumns();
        refreshWorkspaceData();
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (columns.length <= 1) {
      toast.error('Cannot delete the last board column');
      setShowDeleteConfirm(null);
      return;
    }
    const { error } = await supabase.from('board_columns').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
    } else {
      toast.success('Board column deleted');
      setShowDeleteConfirm(null);
      fetchColumns();
      refreshWorkspaceData();
    }
  };

  const moveColumn = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === columns.length - 1) return;

    const prevColumns = columns;
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    setColumns(newColumns);

    const results = await Promise.all(
      newColumns.map((col, i) =>
        supabase.from('board_columns').update({ position: i }).eq('id', col.id)
      )
    );
    if (results.some(r => r.error)) {
      toast.error('Failed to reorder columns');
      setColumns(prevColumns);
      fetchColumns();
      return;
    }
    refreshWorkspaceData();
  };

  const handleDragStart = (e: React.DragEvent, column: BoardColumn) => {
    setDraggedItem(column);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedItem) return;

    const dragIndex = columns.findIndex((c) => c.id === draggedItem.id);
    if (dragIndex === dropIndex) return;

    const prevColumns = columns;
    const newColumns = [...columns];
    newColumns.splice(dragIndex, 1);
    newColumns.splice(dropIndex, 0, draggedItem);
    setColumns(newColumns);
    setDraggedItem(null);

    const results = await Promise.all(
      newColumns.map((col, i) =>
        supabase.from('board_columns').update({ position: i }).eq('id', col.id)
      )
    );
    if (results.some(r => r.error)) {
      toast.error('Failed to reorder columns');
      setColumns(prevColumns);
      fetchColumns();
      return;
    }
    refreshWorkspaceData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">Board Columns</h3>
        <button
          onClick={() => {
            setEditingColumn(null);
            setFormData({ name: '', color: COLOR_PALETTE[0], position: columns.length });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Drag and drop to reorder columns. The order here determines how they appear on the board.
      </p>

      {columns.length === 0 ? (
        <div className="text-center py-12 bg-surface-nested rounded-lg border border-dashed border-slate-300">
          <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No board columns yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-brand-600 hover:text-brand-700 font-medium text-sm"
          >
            Create your first column
          </button>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
          <table className="w-full">
            <thead className="bg-brand-600/[0.071]">
              <tr>
                <th className="px-2 py-3 w-10" />
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Color</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {columns.map((column, index) => (
                <tr
                  key={column.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, column)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`hover:bg-brand-600/[0.094] ${dragOverIndex === index ? 'bg-brand-50' : ''} ${draggedItem?.id === column.id ? 'opacity-50' : ''}`}
                >
                  <td className="px-2 py-3">
                    <div className="cursor-move text-slate-400">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ backgroundColor: column.color ?? undefined }}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{column.name}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => moveColumn(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveColumn(index, 'down')}
                        disabled={index === columns.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingColumn(column);
                          setFormData({ name: column.name, color: (column.color ?? COLOR_PALETTE[0]) as typeof COLOR_PALETTE[number], position: column.position });
                          setShowForm(true);
                        }}
                        className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded ml-2"
                        title="Edit column"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(column.id)}
                        className="p-1 text-slate-400 hover:text-accent-crimson hover:bg-accent-crimson/[0.031] rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/[0.376]" onClick={() => setShowForm(false)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingColumn ? 'Edit Column' : 'Create Column'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g., In Progress"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-600/[0.063] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingColumn ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/[0.376]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-crimson/[0.071] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-accent-crimson" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Column?</h3>
            </div>
            <p className="text-slate-600 mb-4">
              This action cannot be undone. Items in this column will become unassigned.
            </p>
            {columns.length <= 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  You cannot delete the last column. Create another column first.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-600/[0.063] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                disabled={columns.length <= 1}
                className="px-4 py-2 text-sm font-medium text-white bg-accent-crimson hover:bg-[#a02525] rounded-lg transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
