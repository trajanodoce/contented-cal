import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useApp } from '../../contexts/AppContext';
import type { ContentType, BoardColumn, CustomFieldDefinition, CustomFieldType, SelectOption, Json } from '../../lib/database.types';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  Layout,
  FileText,
  Settings,
  AlertTriangle,
  X,
} from 'lucide-react';

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'url', label: 'URL' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'user', label: 'Team Member' },
];

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
  const { refreshWorkspaceData } = useApp();
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
      icon: type.icon ?? 'FileText',
      color: type.color ?? COLOR_PALETTE[0],
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
      columns: (formData.defaultWorkflow.columns?.length ?? 0) > 0
        ? formData.defaultWorkflow.columns!
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
          default_workflow: workflowToSave as unknown as Json,
        })
        .eq('id', expandedType);

      if (error) {
        toast.error('Failed to update: ' + error.message);
      } else {
        toast.success('Content type updated');
        setExpandedType(null);
        fetchData();
        refreshWorkspaceData();
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
          default_workflow: workflowToSave as unknown as Json,
        });

      if (error) {
        toast.error('Failed to create: ' + error.message);
      } else {
        toast.success('Content type created');
        setShowCreateModal(false);
        fetchData();
        refreshWorkspaceData();
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
      refreshWorkspaceData();
    }
  };

  const toggleField = (fieldKey: string) => {
    setFormData(prev => ({
      ...prev,
      defaultWorkflow: {
        ...prev.defaultWorkflow,
        fields: {
          ...(prev.defaultWorkflow.fields ?? {}),
          [fieldKey]: !(prev.defaultWorkflow.fields ?? {})[fieldKey as keyof typeof prev.defaultWorkflow.fields],
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
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
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
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
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
            className="text-brand-600 hover:text-brand-700 font-medium text-sm"
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
                expandedType === type.id ? 'border-brand-300 ring-1 ring-brand-300' : 'border-slate-200'
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
                    style={{ backgroundColor: type.color ?? undefined }}
                  />
                  <span className="font-medium text-slate-900">{type.name}</span>
                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-200 rounded-full">
                    {type.icon ?? 'FileText'}
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Icon</label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                              formData.defaultWorkflow.fields?.[field.key]
                                ? 'bg-brand-600'
                                : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.defaultWorkflow.fields?.[field.key]
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
                        const isSelected = (formData.defaultWorkflow.columns ?? []).includes(column.id);
                        return (
                          <label
                            key={column.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-brand-50 border border-brand-200' : 'bg-slate-50 border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleColumn(column.id)}
                              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                            />
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: column.color ?? undefined }}
                            />
                            <span className="text-sm font-medium text-slate-900">{column.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {(formData.defaultWorkflow.columns?.length ?? 0) === 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        No columns selected. All columns will be available for this content type.
                      </p>
                    )}
                  </div>

                  {/* Custom Fields Section */}
                  {expandedType && (
                    <CustomFieldsManager
                      workspaceId={workspaceId!}
                      contentTypeId={expandedType}
                      refreshWorkspaceData={refreshWorkspaceData}
                    />
                  )}

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
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
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
                  className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g., Blog Post"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
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

// Inline custom field definition manager for a content type
function CustomFieldsManager({
  workspaceId,
  contentTypeId,
  refreshWorkspaceData,
}: {
  workspaceId: string;
  contentTypeId: string;
  refreshWorkspaceData: () => Promise<void>;
}) {
  const { customFieldDefs } = useApp();
  const typeFields = customFieldDefs
    .filter(f => f.content_type_id === contentTypeId)
    .sort((a, b) => a.position - b.position);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState<SelectOption[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);

  const needsOptions = newType === 'single_select' || newType === 'multi_select';

  const addOption = () => {
    if (!optionInput.trim()) return;
    const val = optionInput.toLowerCase().replace(/\s+/g, '_');
    setNewOptions(prev => [...prev, { value: val, label: optionInput.trim() }]);
    setOptionInput('');
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('custom_field_definitions').insert({
      workspace_id: workspaceId,
      content_type_id: contentTypeId,
      name: newName.trim(),
      field_type: newType,
      options: (needsOptions ? newOptions : []) as unknown as Json,
      required: newRequired,
      position: typeFields.length,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to add field: ' + error.message);
      return;
    }
    toast.success('Custom field added');
    setAdding(false);
    setNewName('');
    setNewType('text');
    setNewRequired(false);
    setNewOptions([]);
    refreshWorkspaceData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete field: ' + error.message);
      return;
    }
    toast.success('Custom field deleted');
    refreshWorkspaceData();
  };

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4" />
        Custom Fields
      </h4>
      <p className="text-xs text-slate-500 mb-3">
        Add custom fields specific to this content type
      </p>

      {typeFields.length === 0 && !adding && (
        <p className="text-xs text-slate-400 mb-3">No custom fields defined yet.</p>
      )}

      {typeFields.length > 0 && (
        <div className="space-y-2 mb-3">
          {typeFields.map(field => (
            <div key={field.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-slate-900">{field.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  {FIELD_TYPES.find(ft => ft.value === field.field_type)?.label || field.field_type}
                </span>
                {field.required && <span className="text-xs text-red-500 ml-1">*</span>}
              </div>
              <button
                onClick={() => handleDelete(field.id)}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="border border-brand-200 rounded-lg p-4 bg-brand-50/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Field Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., Word Count"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select
                value={newType}
                onChange={e => {
                  setNewType(e.target.value as CustomFieldType);
                  setNewOptions([]);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>
          </div>

          {needsOptions && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Options</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newOptions.map((opt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-200 rounded-full">
                    {opt.label}
                    <button onClick={() => setNewOptions(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Option label"
                />
                <button onClick={addOption} className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg">Add</button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-700">Required field</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim() || (needsOptions && newOptions.length === 0)}
              className="px-3 py-1.5 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Field'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Custom Field
        </button>
      )}
    </div>
  );
}
