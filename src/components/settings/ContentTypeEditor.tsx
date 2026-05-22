import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Check, X, GripVertical,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentType, CustomFieldDefinition, CustomFieldType, SelectOption } from '../../lib/database.types';

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#6366F1',
  '#6B7280', '#84CC16', '#A855F7', '#0EA5E9', '#F43F5E',
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'url', label: 'URL' },
  { value: 'checkbox', label: 'Checkbox' },
];

interface Props {
  contentType: ContentType;
  onBack: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface NewField {
  name: string;
  field_type: CustomFieldType;
  required: boolean;
  options: SelectOption[];
}

function DraggableField({
  field, onEdit, onDelete, onDragStart, onDragOver, onDrop, isDragOver
}: {
  field: CustomFieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const options = (field.options as SelectOption[]) ?? [];

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, field.id)}
      onDragOver={e => onDragOver(e, field.id)}
      onDrop={onDrop}
      className={`flex items-center gap-3 px-4 py-3 group bg-white transition-colors ${isDragOver ? 'bg-mint' : ''}`}
    >
      <div className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{field.name}</span>
          {field.required && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 capitalize">{field.field_type.replace('_', ' ')}</span>
          {options.length > 0 && (
            <span className="text-xs text-gray-400">· {options.length} options</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ContentTypeEditor({ contentType, onBack, addToast }: Props) {
  const { workspace, boardColumns, customFieldDefs, refreshWorkspaceData } = useApp();
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [name, setName] = useState(contentType.name);
  const [color, setColor] = useState(contentType.color);
  const [saving, setSaving] = useState(false);

  // Workflow (selected column ids)
  const [workflow, setWorkflow] = useState<string[]>(() => {
    try { return (contentType.default_workflow as string[]) ?? []; } catch { return []; }
  });

  // Custom fields for this type
  const typeFields = customFieldDefs
    .filter(f => f.content_type_id === contentType.id)
    .sort((a, b) => a.position - b.position);

  const [fieldOrder, setFieldOrder] = useState<string[]>(() => typeFields.map(f => f.id));
  useEffect(() => {
    setFieldOrder(typeFields.map(f => f.id));
  }, [customFieldDefs]);

  // Add field form
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState<NewField>({ name: '', field_type: 'text', required: false, options: [] });
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  async function saveBasics() {
    setSaving(true);
    const { error } = await supabase
      .from('content_types')
      .update({ name, color, default_workflow: workflow })
      .eq('id', contentType.id);
    setSaving(false);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Content type saved');
  }

  function toggleWorkflowColumn(colId: string) {
    setWorkflow(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  }

  function addOption() {
    if (!newOptionLabel.trim()) return;
    const val = newOptionLabel.toLowerCase().replace(/\s+/g, '_');
    setNewField(f => ({ ...f, options: [...f.options, { value: val, label: newOptionLabel.trim() }] }));
    setNewOptionLabel('');
  }

  async function saveNewField() {
    if (!newField.name.trim() || !workspace) return;
    const { error } = await supabase.from('custom_field_definitions').insert({
      workspace_id: workspace.id,
      content_type_id: contentType.id,
      name: newField.name.trim(),
      field_type: newField.field_type,
      options: newField.options,
      required: newField.required,
      position: typeFields.length,
    });
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    setAddingField(false);
    setNewField({ name: '', field_type: 'text', required: false, options: [] });
    addToast('Custom field added');
  }

  async function deleteField(id: string) {
    if (!confirm('Delete this custom field? Existing values will be lost.')) return;
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Custom field deleted');
  }

  function handleFieldDragStart(_e: React.DragEvent, id: string) {
    dragId.current = id;
  }

  function handleFieldDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  async function handleFieldDrop(e: React.DragEvent) {
    e.preventDefault();
    const fromId = dragId.current;
    const toId = dragOverId;
    dragId.current = null;
    setDragOverId(null);
    if (!fromId || !toId || fromId === toId) return;
    const oldIdx = fieldOrder.indexOf(fromId);
    const newIdx = fieldOrder.indexOf(toId);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = [...fieldOrder];
    newOrder.splice(oldIdx, 1);
    newOrder.splice(newIdx, 0, fromId);
    setFieldOrder(newOrder);
    await Promise.all(
      newOrder.map((id, idx) =>
        supabase.from('custom_field_definitions').update({ position: idx }).eq('id', id)
      )
    );
    await refreshWorkspaceData();
  }

  const needsOptions = newField.field_type === 'single_select' || newField.field_type === 'multi_select';
  const sortedFields = fieldOrder.map(id => typeFields.find(f => f.id === id)).filter(Boolean) as CustomFieldDefinition[];

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Content Types
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: color }} />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{contentType.name}</h2>
          <p className="text-sm text-gray-400">Configure this content type</p>
        </div>
      </div>

      {/* Basics */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Basic settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Default workflow */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Default workflow</h3>
        <p className="text-xs text-gray-400 mb-4">Select which board columns apply to this content type. Leave all unchecked to use all columns.</p>
        <div className="flex flex-wrap gap-2">
          {boardColumns.map(col => {
            const active = workflow.includes(col.id);
            return (
              <button
                key={col.id}
                onClick={() => toggleWorkflowColumn(col.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors
                  ${active ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}
                style={active ? { backgroundColor: col.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'white' : col.color }} />
                {col.name}
              </button>
            );
          })}
        </div>
        {workflow.length > 0 && (
          <button onClick={() => setWorkflow([])} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
            Clear all
          </button>
        )}
      </div>

      {/* Save basics button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={saveBasics}
          disabled={saving}
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-60 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save changes
        </button>
      </div>

      {/* Custom fields */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Custom fields</h3>
            <p className="text-xs text-gray-400 mt-0.5">Extra fields specific to {contentType.name}</p>
          </div>
          <button
            onClick={() => setAddingField(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add field
          </button>
        </div>

        {/* Add field form */}
        {addingField && (
          <div className="p-4 bg-mint border-b border-brand-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Field name</label>
                <input
                  autoFocus
                  value={newField.name}
                  onChange={e => setNewField(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Word Count"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Field type</label>
                <select
                  value={newField.field_type}
                  onChange={e => setNewField(f => ({ ...f, field_type: e.target.value as CustomFieldType, options: [] }))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                >
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newField.required}
                onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Required field</span>
            </label>

            {needsOptions && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Options</label>
                <div className="space-y-1 mb-2">
                  {newField.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">{opt.label}</span>
                      <button
                        onClick={() => setNewField(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newOptionLabel}
                    onChange={e => setNewOptionLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOption()}
                    placeholder="Add option..."
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button onClick={addOption} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveNewField}
                disabled={!newField.name.trim() || (needsOptions && newField.options.length === 0)}
                className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50"
              >
                Add field
              </button>
              <button onClick={() => setAddingField(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {sortedFields.length === 0 && !addingField ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No custom fields yet. Add fields to capture additional information for this content type.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedFields.map(field => (
              <DraggableField
                key={field.id}
                field={field}
                onEdit={() => setEditingFieldId(field.id)}
                onDelete={() => deleteField(field.id)}
                onDragStart={handleFieldDragStart}
                onDragOver={handleFieldDragOver}
                onDrop={handleFieldDrop}
                isDragOver={dragOverId === field.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
