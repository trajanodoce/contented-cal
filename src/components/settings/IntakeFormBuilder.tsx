import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, GripVertical, Eye, EyeOff, Check,
  Copy, ArrowLeft, Loader2, Link, ToggleLeft, ToggleRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { IntakeForm, IntakeFormField } from '../../lib/database.types';

const STANDARD_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'description', label: 'Description', type: 'long_text' },
  { key: 'channel', label: 'Channel', type: 'text' },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  { key: 'publish_date', label: 'Publish Date', type: 'date' },
  { key: 'tags', label: 'Tags', type: 'text' },
  { key: 'submitter_email', label: 'Your Email', type: 'text' },
  { key: 'submitter_name', label: 'Your Name', type: 'text' },
];

interface FieldRowProps {
  field: IntakeFormField;
  onDelete: () => void;
  onToggleRequired: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

function FieldRow({ field, onDelete, onToggleRequired, onDragStart, onDragOver, onDrop, isDragOver }: FieldRowProps) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, field.id)}
      onDragOver={e => onDragOver(e, field.id)}
      onDrop={onDrop}
      className={`flex items-center gap-3 p-3 bg-white rounded-lg border transition-colors group
        ${isDragOver ? 'border-brand-300 bg-mint' : 'border-gray-200'}`}
    >
      <div className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">{field.label}</span>
          {field.required && (
            <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Required</span>
          )}
        </div>
        <span className="text-xs text-gray-400 capitalize">{field.field_type.replace('_', ' ')} · {field.field_key}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleRequired}
          className="text-xs px-2 py-1 rounded border transition-colors text-gray-500 border-gray-200 hover:bg-gray-50"
          title={field.required ? 'Make optional' : 'Make required'}
        >
          {field.required ? 'Required' : 'Optional'}
        </button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

interface FormBuilderProps {
  form: IntakeForm;
  onBack: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function FormBuilder({ form, onBack, addToast }: FormBuilderProps) {
  const { refreshIntakeForms } = useApp();
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [fields, setFields] = useState<IntakeFormField[]>([]);
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description);
  const [isPublic, setIsPublic] = useState(form.is_public);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/intake/${form.share_slug}`;

  const loadFields = useCallback(async () => {
    const { data } = await supabase
      .from('intake_form_fields')
      .select('*')
      .eq('form_id', form.id)
      .order('position');
    if (data) {
      setFields(data);
      setFieldOrder(data.map(f => f.id));
    }
    setLoading(false);
  }, [form.id]);

  useEffect(() => { loadFields(); }, [loadFields]);

  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase
      .from('intake_forms')
      .update({ name, description, is_public: isPublic })
      .eq('id', form.id);
    setSaving(false);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshIntakeForms();
    addToast('Form settings saved');
  }

  async function addField(fieldKey: string, label: string, fieldType: string) {
    const maxPos = fields.length;
    const { data, error } = await supabase.from('intake_form_fields').insert({
      form_id: form.id,
      field_key: fieldKey,
      label,
      field_type: fieldType,
      position: maxPos,
      required: fieldKey === 'title',
    }).select().single();
    if (error) { addToast(error.message, 'error'); return; }
    if (data) {
      setFields(prev => [...prev, data]);
      setFieldOrder(prev => [...prev, data.id]);
    }
  }

  async function deleteField(id: string) {
    await supabase.from('intake_form_fields').delete().eq('id', id);
    setFields(prev => prev.filter(f => f.id !== id));
    setFieldOrder(prev => prev.filter(fid => fid !== id));
  }

  async function toggleRequired(field: IntakeFormField) {
    const { error } = await supabase
      .from('intake_form_fields')
      .update({ required: !field.required })
      .eq('id', field.id);
    if (error) return;
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, required: !f.required } : f));
  }

  function handleDragStart(_e: React.DragEvent, id: string) {
    dragId.current = id;
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  async function handleDrop(e: React.DragEvent) {
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
    setFields(prev => {
      const map = new Map(prev.map(f => [f.id, f]));
      return newOrder.map(id => map.get(id)!).filter(Boolean);
    });
    await Promise.all(
      newOrder.map((id, idx) =>
        supabase.from('intake_form_fields').update({ position: idx }).eq('id', id)
      )
    );
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sortedFields = fieldOrder.map(id => fields.find(f => f.id === id)).filter(Boolean) as IntakeFormField[];
  const existingKeys = new Set(fields.map(f => f.field_key));

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-5" style={{ backgroundColor: '#0B2763' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Intake Forms
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{form.name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">Form builder</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors
              ${previewMode ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {previewMode ? (
        <FormPreview form={{ ...form, name, description }} fields={sortedFields} />
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {/* Left: fields */}
          <div className="col-span-2 space-y-4">
            {/* Field list */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Form fields</h3>
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : sortedFields.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No fields yet. Add from the panel →</p>
              ) : (
                <div className="space-y-2">
                  {sortedFields.map(field => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      onDelete={() => deleteField(field.id)}
                      onToggleRequired={() => toggleRequired(field)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDragOver={dragOverId === field.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: settings + add fields */}
          <div className="space-y-4">
            {/* Form settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Settings</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Form name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  value={description ?? ''}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-700">Public access</p>
                  <p className="text-xs text-gray-400">Anyone with the link can submit</p>
                </div>
                <button onClick={() => setIsPublic(!isPublic)}>
                  {isPublic
                    ? <ToggleRight className="w-8 h-8 text-brand-500" />
                    : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                </button>
              </div>
              <button onClick={saveSettings} disabled={saving} className="w-full py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-60 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save settings
              </button>
            </div>

            {/* Share link */}
            {isPublic && (
              <div className="bg-mint rounded-xl border border-brand-100 p-4">
                <p className="text-xs font-medium text-brand-700 mb-2 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5" /> Share link
                </p>
                <p className="text-xs text-brand-600 break-all mb-2 font-mono">{shareUrl}</p>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            )}

            {/* Add standard fields */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Standard fields</h3>
              <div className="space-y-1">
                {STANDARD_FIELDS.map(f => {
                  const added = existingKeys.has(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => !added && addField(f.key, f.label, f.type)}
                      disabled={added}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-lg transition-colors
                        ${added ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50 cursor-pointer'}`}
                    >
                      <span>{f.label}</span>
                      {added ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormPreview({ form, fields }: { form: IntakeForm; fields: IntakeFormField[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 max-w-lg mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
        {form.description && <p className="text-gray-500 mt-1 text-sm">{form.description}</p>}
      </div>
      <div className="space-y-4">
        {fields.map(field => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.field_type === 'long_text' ? (
              <textarea rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none" placeholder={field.label} disabled />
            ) : field.field_type === 'date' ? (
              <input type="date" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" disabled />
            ) : (
              <input type="text" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder={field.label} disabled />
            )}
          </div>
        ))}
        <button className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg mt-2" disabled>
          Submit
        </button>
      </div>
    </div>
  );
}

// ── Intake Forms List ─────────────────────────────────────────────────────────

interface IntakeFormsListProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function IntakeFormsList({ addToast }: IntakeFormsListProps) {
  const { workspace, contentTypes, intakeForms, refreshIntakeForms, userRole } = useApp();
  const [editingForm, setEditingForm] = useState<IntakeForm | null>(null);
  const [addingForm, setAddingForm] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [newFormTypeId, setNewFormTypeId] = useState('');
  const [creating, setCreating] = useState(false);

  if (editingForm) {
    return <FormBuilder form={editingForm} onBack={() => setEditingForm(null)} addToast={addToast} />;
  }

  const isAdmin = userRole === 'admin';

  function generateSlug() {
    return Math.random().toString(36).slice(2, 10);
  }

  async function createForm() {
    if (!newFormName.trim() || !workspace) return;
    setCreating(true);
    const { data, error } = await supabase.from('intake_forms').insert({
      workspace_id: workspace.id,
      name: newFormName.trim(),
      content_type_id: newFormTypeId || null,
      share_slug: generateSlug(),
      is_public: false,
    }).select().single();
    setCreating(false);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshIntakeForms();
    setAddingForm(false);
    setNewFormName('');
    if (data) setEditingForm(data);
    addToast('Form created');
  }

  async function deleteForm(id: string) {
    if (!confirm('Delete this intake form?')) return;
    await supabase.from('intake_forms').delete().eq('id', id);
    await refreshIntakeForms();
    addToast('Form deleted');
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-gray-900">Intake Forms</h2>
        {isAdmin && (
          <button
            onClick={() => setAddingForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500"
          >
            <Plus className="w-4 h-4" /> New form
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">Create shareable forms to collect content requests from external contributors.</p>

      {addingForm && (
        <div className="bg-mint border border-brand-100 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Form name</label>
            <input
              autoFocus
              value={newFormName}
              onChange={e => setNewFormName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createForm()}
              placeholder="e.g. Blog post request"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Content type (optional)</label>
            <select
              value={newFormTypeId}
              onChange={e => setNewFormTypeId(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Any type</option>
              {contentTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={createForm} disabled={!newFormName.trim() || creating} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-60 flex items-center gap-1.5">
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
            </button>
            <button onClick={() => setAddingForm(false)} className="px-3 py-1.5 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {intakeForms.length === 0 && !addingForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-sm">No intake forms yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {intakeForms.map(form => {
            const ct = contentTypes.find(c => c.id === form.content_type_id);
            return (
              <div key={form.id} className="flex items-center gap-4 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{form.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${form.is_public ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {form.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                  {ct && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ct.color ?? undefined }} />
                      {ct.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingForm(form)}
                    className="px-3 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteForm(form.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
