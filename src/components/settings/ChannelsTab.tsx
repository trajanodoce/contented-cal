import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getWorkspaceChannels, DEFAULT_CHANNELS } from '../../lib/utils';
import {
  Plus,
  Trash2,
  GripVertical,
  X,
  Radio,
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ChannelsTabProps {
  workspaceId: string | null;
}

export function ChannelsTab({ workspaceId }: ChannelsTabProps) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [channels, setChannels] = useState<string[]>(() =>
    getWorkspaceChannels(currentWorkspace?.settings)
  );
  const [newChannel, setNewChannel] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const saveChannels = useCallback(
    async (updated: string[]) => {
      if (!workspaceId || !currentWorkspace) return false;
      setIsSaving(true);
      const currentSettings =
        currentWorkspace.settings &&
        typeof currentWorkspace.settings === 'object' &&
        !Array.isArray(currentWorkspace.settings)
          ? (currentWorkspace.settings as Record<string, unknown>)
          : {};
      const { error } = await supabase
        .from('workspaces')
        .update({
          settings: { ...currentSettings, channels: updated },
        })
        .eq('id', workspaceId);
      setIsSaving(false);
      if (error) {
        toast.error('Failed to save channels: ' + error.message);
        return false;
      }
      await refreshWorkspaces();
      return true;
    },
    [workspaceId, currentWorkspace, refreshWorkspaces]
  );

  const handleAdd = async () => {
    const name = newChannel.trim();
    if (!name) return;
    if (channels.some((c) => c.toLowerCase() === name.toLowerCase())) {
      toast.error('Channel already exists');
      return;
    }
    const updated = [...channels, name];
    setChannels(updated);
    setNewChannel('');
    const ok = await saveChannels(updated);
    if (ok) toast.success(`Channel "${name}" added`);
  };

  const handleRename = async (index: number) => {
    const name = editValue.trim();
    if (!name) return;
    if (
      channels.some(
        (c, i) => i !== index && c.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error('Channel name already in use');
      return;
    }
    const updated = channels.map((c, i) => (i === index ? name : c));
    setChannels(updated);
    setEditingIndex(null);
    const ok = await saveChannels(updated);
    if (ok) toast.success('Channel renamed');
  };

  const handleDelete = async (index: number) => {
    const removed = channels[index];
    const updated = channels.filter((_, i) => i !== index);
    setChannels(updated);
    setShowDeleteConfirm(null);
    const ok = await saveChannels(updated);
    if (ok) toast.success(`Channel "${removed}" deleted`);
  };

  const handleResetDefaults = async () => {
    setChannels(DEFAULT_CHANNELS);
    const ok = await saveChannels(DEFAULT_CHANNELS);
    if (ok) toast.success('Channels reset to defaults');
  };

  // Drag-and-drop reorder
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...channels];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setChannels(updated);
    setDragIndex(null);
    setDragOverIndex(null);
    await saveChannels(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Channels</h3>
          <p className="text-sm text-slate-500 mt-1">
            Configure where content can be published (e.g., Blog, Social, Email)
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {/* Add new channel */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newChannel}
          onChange={(e) => setNewChannel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a new channel..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 bg-surface-card text-slate-700"
        />
        <button
          onClick={handleAdd}
          disabled={!newChannel.trim() || isSaving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Channel list */}
      {channels.length === 0 ? (
        <div className="text-center py-12 bg-surface-nested rounded-lg border border-dashed border-slate-300">
          <Radio className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No channels configured</p>
          <button
            onClick={handleResetDefaults}
            className="text-brand-600 hover:text-brand-700 font-medium text-sm"
          >
            Load default channels
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {channels.map((channel, index) => (
            <div
              key={`${channel}-${index}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                dragOverIndex === index
                  ? 'bg-brand-50 border border-brand-200'
                  : 'bg-surface-nested hover:bg-[#005D9718]'
              }`}
              style={
                dragOverIndex !== index
                  ? { border: '1px solid transparent' }
                  : undefined
              }
            >
              <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />

              <Radio className="w-4 h-4 text-slate-400 flex-shrink-0" />

              {editingIndex === index ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRename(index);
                      }
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 text-sm border border-brand-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                  <button
                    onClick={() => handleRename(index)}
                    className="text-xs text-brand-600 font-medium hover:text-brand-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="flex-1 text-sm font-medium text-slate-900 cursor-pointer"
                    onDoubleClick={() => {
                      setEditingIndex(index);
                      setEditValue(channel);
                    }}
                  >
                    {channel}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingIndex(index);
                        setEditValue(channel);
                      }}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-brand-600 hover:bg-[#005D9710] rounded transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(index)}
                      className="p-1.5 text-slate-400 hover:text-accent-crimson hover:bg-[#BA2C2C08] rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Drag to reorder. Double-click a channel name to rename it. Changes to
        channel names won't update existing content items.
      </p>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm !== null && handleDelete(showDeleteConfirm)}
        variant="destructive"
        icon={<Trash2 className="w-5 h-5" style={{ color: '#BA2C2C' }} />}
        title="Delete Channel?"
        description={
          showDeleteConfirm !== null
            ? `Remove "${channels[showDeleteConfirm]}" from the channel list? Existing content items using this channel won't be affected.`
            : ''
        }
        confirmLabel="Delete channel"
      />
    </div>
  );
}
