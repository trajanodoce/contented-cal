import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { BoardColumn } from '../lib/database.types';
import { ContentTypeEditor } from '../components/settings/ContentTypesTab';
import { IntegrationsPage } from '../components/settings/IntegrationsPage';
import { IntakeFormsList } from '../components/settings/IntakeFormBuilder';
import { TeamTab } from '../components/settings/TeamTab';
import { CustomFieldsTab } from '../components/settings/CustomFieldsTab';
import { ChannelsTab } from '../components/settings/ChannelsTab';
import { ApiKeysTab } from '../components/settings/ApiKeysTab';
import {
  Settings, FileText, Layout, Save, Trash2, Plus, Inbox, Users,
  ChevronDown, ChevronUp, GripVertical, AlertTriangle, Zap, Upload, X, ImageIcon,
  SlidersHorizontal,
  Radio,
  Key,
  type LucideIcon,
} from 'lucide-react';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#94a3b8',
];

type Tab = 'general' | 'team' | 'content-types' | 'channels' | 'custom-fields' | 'board-columns' | 'intake-forms' | 'integrations' | 'api';

export function SettingsPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  if (userRole !== 'admin') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">Only workspace admins can access settings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your workspace configuration</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1">
          <TabBtn active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={Settings} label="General" />
          <TabBtn active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={Users} label="Team" />
          <TabBtn active={activeTab === 'content-types'} onClick={() => setActiveTab('content-types')} icon={FileText} label="Content Types" />
          <TabBtn active={activeTab === 'channels'} onClick={() => setActiveTab('channels')} icon={Radio} label="Channels" />
          <TabBtn active={activeTab === 'custom-fields'} onClick={() => setActiveTab('custom-fields')} icon={SlidersHorizontal} label="Custom Fields" />
          <TabBtn active={activeTab === 'board-columns'} onClick={() => setActiveTab('board-columns')} icon={Layout} label="Board Columns" />
          <TabBtn active={activeTab === 'intake-forms'} onClick={() => setActiveTab('intake-forms')} icon={Inbox} label="Intake Forms" />
          <TabBtn active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} icon={Zap} label="Integrations" />
          <TabBtn active={activeTab === 'api'} onClick={() => setActiveTab('api')} icon={Key} label="API" />
        </nav>
      </div>

      <div className="bg-surface-card rounded-lg p-6" style={{ border: '1px solid #00233930' }}>
        {activeTab === 'general' && <GeneralTab workspace={currentWorkspace} />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'content-types' && <ContentTypeEditor workspaceId={currentWorkspace?.id || null} />}
        {activeTab === 'channels' && <ChannelsTab workspaceId={currentWorkspace?.id || null} />}
        {activeTab === 'custom-fields' && <CustomFieldsTab workspaceId={currentWorkspace?.id || null} />}
        {activeTab === 'board-columns' && <BoardColumnsTab workspaceId={currentWorkspace?.id || null} />}
        {activeTab === 'intake-forms' && <IntakeFormsList addToast={(msg, type = 'success') => { if (type === 'error') toast.error(msg); else toast.success(msg); }} />}
        {activeTab === 'integrations' && <IntegrationsPage addToast={(msg, type = 'success') => { if (type === 'error') toast.error(msg); else toast.success(msg); }} />}
        {activeTab === 'api' && <ApiKeysTab workspaceId={currentWorkspace?.id || null} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function GeneralTab({ workspace }: { workspace: { id: string; name: string; slug: string; logo_url?: string | null } | null }) {
  const { refreshWorkspaces } = useWorkspace();
  const [name, setName] = useState(workspace?.name || '');
  const [slug, setSlug] = useState(workspace?.slug || '');
  const [logoUrl, setLogoUrl] = useState(workspace?.logo_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setSlug(workspace.slug);
      setLogoUrl(workspace.logo_url || '');
    }
  }, [workspace]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${workspace.id}.${ext}`;

      // Delete old logo if it exists (ignore errors for non-existent files)
      try {
        await supabase.storage.from('workspace-assets').remove([`logos/${workspace.id}.png`, `logos/${workspace.id}.jpg`, `logos/${workspace.id}.jpeg`, `logos/${workspace.id}.webp`]);
      } catch {
        // Non-critical — proceed with upload
      }

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        toast.error('Failed to upload logo: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('workspace-assets')
        .getPublicUrl(path);

      // Add cache-busting param so the browser fetches the new image
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ logo_url: publicUrl })
        .eq('id', workspace.id);

      if (updateError) {
        toast.error('Failed to save logo: ' + updateError.message);
      } else {
        setLogoUrl(publicUrl);
        toast.success('Logo updated!');
        await refreshWorkspaces();
      }
    } catch (err) {
      toast.error('Logo upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!workspace) return;
    setIsUploading(true);
    try {
      try {
        await supabase.storage.from('workspace-assets').remove([`logos/${workspace.id}.png`, `logos/${workspace.id}.jpg`, `logos/${workspace.id}.jpeg`, `logos/${workspace.id}.webp`]);
      } catch {
        // Non-critical — proceed with DB update
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ logo_url: null })
        .eq('id', workspace.id);

      if (error) {
        toast.error('Failed to remove logo: ' + error.message);
      } else {
        setLogoUrl('');
        toast.success('Logo removed');
        await refreshWorkspaces();
      }
    } catch {
      toast.error('Failed to remove logo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!workspace) return;
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2) {
      toast.error('Slug must be lowercase letters, numbers, and hyphens only (min 2 characters)');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('workspaces')
      .update({ name: name.trim(), slug: slug.toLowerCase() })
      .eq('id', workspace.id);

    setIsSaving(false);

    if (error) {
      toast.error('Failed to update workspace: ' + error.message);
    } else {
      toast.success('Workspace updated successfully');
      await refreshWorkspaces();
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Workspace Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-surface-nested overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-surface-card border border-slate-300 rounded-lg hover:bg-[#005D9718] cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : logoUrl ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            {logoUrl && (
              <button
                onClick={handleRemoveLogo}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent-crimson hover:bg-[#BA2C2C08] rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Square image recommended. Max 2MB.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="My Workspace"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="my-workspace"
        />
        <p className="mt-1 text-xs text-slate-500">Lowercase letters, numbers, and hyphens only. Used in URLs.</p>
      </div>

      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function BoardColumnsTab({ workspaceId }: { workspaceId: string | null }) {
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

    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];

    // Update positions
    const updates = newColumns.map((col, i) =>
      supabase.from('board_columns').update({ position: i }).eq('id', col.id)
    );
    await Promise.all(updates);
    setColumns(newColumns);
    refreshWorkspaceData();
  };

  // Drag and drop handlers
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

    const newColumns = [...columns];
    newColumns.splice(dragIndex, 1);
    newColumns.splice(dropIndex, 0, draggedItem);

    // Update positions in database
    const updates = newColumns.map((col, i) =>
      supabase.from('board_columns').update({ position: i }).eq('id', col.id)
    );
    await Promise.all(updates);
    setColumns(newColumns);
    setDraggedItem(null);
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
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #00233930' }}>
          <table className="w-full">
            <thead className="bg-[#005D9712]">
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
                  className={`hover:bg-[#005D9718] ${dragOverIndex === index ? 'bg-brand-50' : ''} ${draggedItem?.id === column.id ? 'opacity-50' : ''}`}
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
                          setFormData({ name: column.name, color: column.color ?? COLOR_PALETTE[0], position: column.position });
                          setShowForm(true);
                        }}
                        className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded ml-2"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(column.id)}
                        className="p-1 text-slate-400 hover:text-accent-crimson hover:bg-[#BA2C2C08] rounded"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00233960]" onClick={() => setShowForm(false)}>
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
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00233960]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#BA2C2C12] flex items-center justify-center">
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
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors"
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
