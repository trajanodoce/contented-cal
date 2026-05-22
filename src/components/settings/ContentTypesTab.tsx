import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { ContentType, BoardColumn } from '../../lib/database.types';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  EyeOff,
  Layout,
  Columns,
  FileText,
  Settings,
  AlertTriangle,
} from 'lucide-react';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#94a3b8',
];

const ICON_OPTIONS = [
  { value: 'FileText', label: 'Document' },
  { value: 'Image', label: 'Image' },
  { value: 'Video', label: 'Video' },
  { value: 'Link', label: 'Link' },
  { value: 'Book', label: 'Book' },
  { value: 'Newspaper', label: 'News' },
  { value: 'MessageSquare', label: 'Chat' },
  { value: 'PenTool', label: 'Creative' },
  { value: 'Layout', label: 'Layout' },
  { value: 'Share2', label: 'Social' },
  { value: 'Mail', label: 'Email' },
  { value: 'Globe', label: 'Web' },
];

// Standard fields that can be toggled
const STANDARD_FIELDS = [
  { key: 'channel', label: 'Channel', description: 'Where the content will be published (e.g., Blog, Email, Social)' },
  { key: 'priority', label: 'Priority', description: 'Urgency level: Low, Medium, High, or Urgent' },
  { key: 'publishDate', label: 'Publish Date', description: 'When the content should be published' },
  { key: 'dueDate', label: 'Due Date', description: 'Internal deadline for completion' },
  { key: 'tags', label: 'Tags', description: 'Keywords for organization and search' },
  { key: 'description', label: 'Description', description: 'Detailed content description and notes' },
];

interface DefaultWorkflow {
  fields?: Record<string, boolean>;
  columns?: string[];
}

interface ContentTypeEditorProps {
  workspaceId: string | null;
}

export function ContentTypeEditor({ workspaceId }: ContentTypeEditorProps) {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for creating/editing
  const [formData, setFormData] = useState({
    name: '',
    icon: 'FileText',
    color: COLOR_PALETTE[0],
    defaultWorkflow: {
      fields: {
        channel: true,
        priority: true,
        publishDate: true,
        dueDate: true,
        tags: true,
        description: true,
      },
      columns: [] as string[],
    } as DefaultWorkflow,
  });

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    const [typesRes, columnsRes] = await Promise.all([
      supabase.from('content_types').select('*').eq('workspace_id', workspaceId).order('name'),
      supabase.from('board_columns').select('*').eq('workspace_id', workspaceId).order('position'),
    ]);

    if (typesRes.data) {
      setContentTypes(typesRes.data);
    }
    if (columnsRes.data) {
      setBoardColumns(columnsRes.data);
    }

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize form data when editing
  const openEditForm = (type: ContentType) => {
    const workflow = (type.default_workflow as DefaultWorkflow) || {};
    setFormData({
      name: type.name,
      icon: type.icon,
      color: type.color,
      defaultWorkflow: {
        fields: {
          channel: true,
          priority: true,
          publishDate: true,
          dueDate: true,
          tags: true,
          description: true,
          ...workflow.fields,
        },
        columns: workflow.columns || [],
      },
    });
    setExpandedType(type.id);
  };

  const openCreateForm = () => {
    setFormData({
      name: '',
      icon: 'FileText',
      color: COLOR_PALETTE[0],
      defaultWorkflow: {
        fields: {
          channel: true,
          priority: true,
          publishDate: true,
          dueDate: true,
          tags: true,
          description: true,
        },
        columns: [],
      },
    });
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!workspaceId || !formData.name.trim()) return;
    setIsSaving(true);

    // Ensure all columns are selected if none specified
    const workflowToSave: DefaultWorkflow = {
      fields: formData.defaultWorkflow.fields,
      columns: formData.defaultWorkflow.columns?.length > 0
        ? formData.defaultWorkflow.columns
        : boardColumns.map(c => c.id),
    };

    if (expandedType) {
      // Update existing
      const { error } = await supabase
        .from('content_types')
        .update({
          name: formData.name.trim(),
          icon: formData.icon,
          color: formData.color,
          default_workflow: workflowToSave,
        })
        .eq('id', expandedType);

      if (error) {
        toast.error('Failed to update: ' + error.message);
      } else {
        toast.success('Content type updated');
        setExpandedType(null);
        fetchData();
      }
    } else if (showCreateModal) {
      // Create new
      const { error } = await supabase
        .from('content_types')
        .insert({
          workspace_id: workspaceId,
          name: formData.name.trim(),
          icon: formData.icon,
          color: formData.color,
          default_workflow: workflowToSave,
        });

      if (error) {
        toast.error('Failed to create: ' + error.message);
      } else {
        toast.success('Content type created');
        setShowCreateModal(false);
        fetchData();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('content_types').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
    } else {
      toast.success('Content type deleted');
      setShowDeleteConfirm(null);
      fetchData();
    }
  };

  const toggleField = (fieldKey: string) => {
    setFormData(prev => ({
      ...prev,
      defaultWorkflow: {
        ...prev.defaultWorkflow,
        fields: {
          ...prev.defaultWorkflow.fields,
          [fieldKey]: !prev.defaultWorkflow.fields[fieldKey as keyof typeof prev.defaultWorkflow.fields],
        },
      },
    }));
  };

  const toggleColumn = (columnId: string) => {
    setFormData(prev => {
      const currentColumns = prev.defaultWorkflow.columns || [];
      const newColumns = currentColumns.includes(columnId)
        ? currentColumns.filter(id => id !== columnId)
        : [...currentColumns, columnId];
      return {
        ...prev,
        defaultWorkflow: {
          ...prev.defaultWorkflow,
          columns: newColumns,
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Content Types</h3>
          <p className="text-sm text-slate-500 mt-1">Configure content types with custom fields and workflows</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Content Type
        </button>
      </div>

      {/* Content Types List */}
      {contentTypes.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No content types yet</p>
          <button
            onClick={openCreateForm}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Create your first content type
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {contentTypes.map((type) => (
            <div
              key={type.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                expandedType === type.id ? 'border-blue-300 ring-1 ring-blue-300' : 'border-slate-200'
              }`}
            >
              {/* Header - Always visible */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => {
                  if (expandedType === type.id) {
                    setExpandedType(null);
                  } else {
                    openEditForm(type);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="font-medium text-slate-900">{type.name}</span>
                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-200 rounded-full">
                    {type.icon}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(type.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedType === type.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedType === type.id && (
                <div className="p-4 border-t border-slate-200 bg-white">
                  {/* Basic Info Section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                      <Settings className="w-4 h-4" />
                      Basic Info
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Icon</label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {ICON_OPTIONS.map((icon) => (
                            <option key={icon.value} value={icon.value}>{icon.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-slate-700 mb-2">Color</label>
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

                  {/* Field Visibility Section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4" />
                      Field Visibility
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">
                      Toggle which fields appear when creating or editing items of this type
                    </p>
                    <div className="space-y-2">
                      {STANDARD_FIELDS.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div>
                            <span className="text-sm font-medium text-slate-900">{field.label}</span>
                            <p className="text-xs text-slate-500">{field.description}</p>
                          </div>
                          <button
                            onClick={() => toggleField(field.key)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.defaultWorkflow.fields[field.key]
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.defaultWorkflow.fields[field.key]
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workflow Section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                      <Layout className="w-4 h-4" />
                      Workflow Columns
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">
                      Select which board columns/statuses apply to this content type. If none selected, all columns will be available.
                    </p>
                    <div className="space-y-2">
                      {boardColumns.map((column) => {
                        const isSelected = formData.defaultWorkflow.columns.includes(column.id);
                        return (
                          <label
                            key={column.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleColumn(column.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: column.color }}
                            />
                            <span className="text-sm font-medium text-slate-900">{column.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {formData.defaultWorkflow.columns.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        No columns selected. All columns will be available for this content type.
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setExpandedType(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !formData.name.trim()}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Content Type</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Blog Post"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon.value} value={icon.value}>{icon.label}</option>
                  ))}
                </select>
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
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Content Type?</h3>
            </div>
            <p className="text-slate-600 mb-4">
              This action cannot be undone. Content items using this type will lose their type assignment.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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
