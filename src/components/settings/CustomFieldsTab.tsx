import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useApp } from '../../contexts/AppContext';
import type { CustomFieldDefinition, CustomFieldType, SelectOption, ContentType, Json } from '../../lib/database.types';
import {
  Plus,
  Trash2,
  Save,
  X,
  Edit2,
  FileText,
  Globe,
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { StyledSelect } from '../ui/StyledSelect';

const FIELD_TYPES: { value: CustomFieldType; label: string; description: string }[] = [
  { value: 'text', label: 'Text', description: 'Single-line text input' },
  { value: 'long_text', label: 'Long Text', description: 'Multi-line text area' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'single_select', label: 'Single Select', description: 'Choose one option' },
  { value: 'multi_select', label: 'Multi Select', description: 'Choose multiple options' },
  { value: 'url', label: 'URL', description: 'Web link' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
  { value: 'user', label: 'Team Member', description: 'Assign a team member' },
];

const fieldTypeLabels: Record<string, string> = Object.fromEntries(
  FIELD_TYPES.map(ft => [ft.value, ft.label])
);

// Scope chip rendering — maps `applies_to` value to its visual treatment.
// Content = brand navy, Design = berry from board palette, Both = neutral slate.
const SCOPE_META: Record<'content' | 'design' | 'both', { label: string; color: string }> = {
  content: { label: 'Content', color: '#005D97' },
  design: { label: 'Design', color: '#B8447A' },
  both: { label: 'Both', color: '#64748B' },
};

const SCOPE_OPTIONS = [
  { value: 'both', label: 'Both — Content and Design tasks' },
  { value: 'content', label: 'Content tasks only' },
  { value: 'design', label: 'Design tasks only' },
];

interface Props {
  workspaceId: string | null;
}

export function CustomFieldsTab({ workspaceId }: Props) {
  const { customFieldDefs, contentTypes, refreshWorkspaceData } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | null>(null);

  const fields = useMemo(
    () => [...customFieldDefs].sort((a, b) => {
      // Group by content type, then by position
      const aType = a.content_type_id || '';
      const bType = b.content_type_id || '';
      if (aType !== bType) return aType.localeCompare(bType);
      return a.position - b.position;
    }),
    [customFieldDefs]
  );

  // Group fields: global first, then by content type
  const globalFields = fields.filter(f => !f.content_type_id);
  const byContentType = useMemo(() => {
    const map = new Map<string, CustomFieldDefinition[]>();
    for (const f of fields) {
      if (!f.content_type_id) continue;
      const list = map.get(f.content_type_id) || [];
      list.push(f);
      map.set(f.content_type_id, list);
    }
    return map;
  }, [fields]);

  const getContentTypeName = (id: string) =>
    contentTypes.find(ct => ct.id === id)?.name || 'Unknown';

  const getContentTypeColor = (id: string) =>
    contentTypes.find(ct => ct.id === id)?.color || '#94a3b8';

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Failed to delete field');
      setDeleteTarget(null);
      return;
    }
    toast.success(`Deleted "${deleteTarget.name}"`);
    setDeleteTarget(null);
    refreshWorkspaceData();
  };

  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Custom Fields</h3>
          <p className="text-sm text-slate-500 mt-1">
            Define fields that appear on content items. Fields can be global or scoped to a content type.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Create / Edit form */}
      {showCreate && (
        <FieldForm
          workspaceId={workspaceId}
          contentTypes={contentTypes}
          existingCount={fields.length}
          onDone={() => {
            setShowCreate(false);
            refreshWorkspaceData();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {editingId && (
        <FieldForm
          workspaceId={workspaceId}
          contentTypes={contentTypes}
          existingCount={fields.length}
          editing={fields.find(f => f.id === editingId) || undefined}
          onDone={() => {
            setEditingId(null);
            refreshWorkspaceData();
          }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Global fields */}
      {globalFields.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-700">Global Fields</h4>
            <span className="text-xs text-slate-400">Appear on all content types</span>
          </div>
          <FieldTable
            fields={globalFields}
            onEdit={(f) => { setEditingId(f.id); setShowCreate(false); }}
            onDelete={setDeleteTarget}
          />
        </div>
      )}

      {/* Fields by content type */}
      {Array.from(byContentType.entries()).map(([ctId, ctFields]) => (
        <div key={ctId}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getContentTypeColor(ctId) }}
            />
            <h4 className="text-sm font-semibold text-slate-700">{getContentTypeName(ctId)}</h4>
            <span className="text-xs text-slate-400">{ctFields.length} field{ctFields.length !== 1 ? 's' : ''}</span>
          </div>
          <FieldTable
            fields={ctFields}
            onEdit={(f) => { setEditingId(f.id); setShowCreate(false); }}
            onDelete={setDeleteTarget}
          />
        </div>
      ))}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        variant="destructive"
        icon={<Trash2 className="w-5 h-5" style={{ color: '#BA2C2C' }} />}
        title="Delete Custom Field?"
        description={
          deleteTarget
            ? `Delete the "${deleteTarget.name}" field? This will remove it from all content items.`
            : ''
        }
        confirmLabel="Delete field"
      />

      {/* Empty state */}
      {fields.length === 0 && !showCreate && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-slate-900 mb-1">No custom fields yet</h4>
          <p className="text-xs text-slate-500 mb-4">
            Custom fields let you track extra data on content items — word counts, campaign tags, review links, and more.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first field
          </button>
        </div>
      )}
    </div>
  );
}

// ── Field table ──────────────────────────────────────────────────────────────

function FieldTable({
  fields,
  onEdit,
  onDelete,
}: {
  fields: CustomFieldDefinition[];
  onEdit: (f: CustomFieldDefinition) => void;
  onDelete: (f: CustomFieldDefinition) => void;
}) {
  return (
    <div className="bg-surface-card rounded-lg overflow-hidden" style={{ border: '1px solid #00233930' }}>
      <table className="w-full">
        <thead className="bg-[#005D9712] border-b border-slate-200">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Scope</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Required</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Options</th>
            <th className="px-4 py-2.5 w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fields.map(field => {
            const opts = parseOptions(field.options);
            const scopeMeta = SCOPE_META[field.applies_to];
            return (
              <tr key={field.id} className="hover:bg-[#005D9718] transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{field.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: `${scopeMeta.color}12`,
                      color: scopeMeta.color,
                      border: `1px solid ${scopeMeta.color}30`,
                    }}
                  >
                    {scopeMeta.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {fieldTypeLabels[field.field_type] || field.field_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {field.required ? (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                  ) : (
                    <span className="text-xs text-slate-400">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {opts.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {opts.slice(0, 4).map((opt, i) => (
                        <span key={i} className="text-xs bg-[#005D9712] text-slate-600 px-2 py-0.5 rounded-full">
                          {opt.label}
                        </span>
                      ))}
                      {opts.length > 4 && (
                        <span className="text-xs text-slate-400">+{opts.length - 4}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(field)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      title="Edit field"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(field)}
                      className="p-1.5 text-slate-400 hover:text-accent-crimson hover:bg-[#BA2C2C08] rounded transition-colors"
                      title="Delete field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Create / Edit form ───────────────────────────────────────────────────────

function FieldForm({
  workspaceId,
  contentTypes,
  existingCount,
  editing,
  onDone,
  onCancel,
}: {
  workspaceId: string;
  contentTypes: ContentType[];
  existingCount: number;
  editing?: CustomFieldDefinition;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [fieldType, setFieldType] = useState<CustomFieldType>(editing?.field_type || 'text');
  const [required, setRequired] = useState(editing?.required || false);
  const [contentTypeId, setContentTypeId] = useState(editing?.content_type_id || '');
  const [appliesTo, setAppliesTo] = useState<'content' | 'design' | 'both'>(editing?.applies_to || 'both');
  const [options, setOptions] = useState<SelectOption[]>(() => parseOptions(editing?.options ?? null));
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);

  const needsOptions = fieldType === 'single_select' || fieldType === 'multi_select';

  const addOption = () => {
    if (!optionInput.trim()) return;
    const val = optionInput.toLowerCase().replace(/\s+/g, '_');
    setOptions(prev => [...prev, { value: val, label: optionInput.trim() }]);
    setOptionInput('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Field name is required');
      return;
    }
    if (needsOptions && options.length === 0) {
      toast.error('Add at least one option');
      return;
    }

    setSaving(true);

    const payload = {
      workspace_id: workspaceId,
      content_type_id: contentTypeId || null,
      applies_to: appliesTo,
      name: name.trim(),
      field_type: fieldType,
      options: (needsOptions ? options : []) as unknown as Json,
      required,
      position: editing?.position ?? existingCount,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from('custom_field_definitions')
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase
        .from('custom_field_definitions')
        .insert(payload));
    }

    setSaving(false);

    if (error) {
      toast.error(editing ? 'Failed to update field' : 'Failed to create field');
      return;
    }

    toast.success(editing ? `Updated "${name.trim()}"` : `Created "${name.trim()}"`);
    onDone();
  };

  return (
    <div className="border border-brand-200 rounded-lg p-5 bg-brand-50/30 space-y-4">
      <h4 className="text-sm font-semibold text-slate-900">
        {editing ? 'Edit Field' : 'New Custom Field'}
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Field Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="e.g., Word Count, Campaign, Review Link"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Field Type</label>
          <StyledSelect
            value={fieldType}
            onChange={v => {
              setFieldType(v as CustomFieldType);
              if (v !== 'single_select' && v !== 'multi_select') {
                setOptions([]);
              }
            }}
            options={FIELD_TYPES.map(ft => ({
              value: ft.value,
              label: `${ft.label} — ${ft.description}`,
            }))}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Content Type Scope</label>
        <StyledSelect
          value={contentTypeId}
          onChange={v => setContentTypeId(v)}
          options={[
            { value: '', label: 'All content types (global)' },
            ...contentTypes.map(ct => ({ value: ct.id, label: ct.name })),
          ]}
        />
        <p className="text-xs text-slate-400 mt-1">
          Global fields appear on every content item. Scoped fields only appear for the selected type.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Applies to</label>
        <StyledSelect
          value={appliesTo}
          onChange={v => setAppliesTo(v as 'content' | 'design' | 'both')}
          options={SCOPE_OPTIONS}
        />
        <p className="text-xs text-slate-400 mt-1">
          Choose which task type this field shows up on. "Both" appears on every task; "Content" only on content tasks; "Design" only on design tasks.
        </p>
      </div>

      {/* Options for select types */}
      {needsOptions && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Options</label>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {options.map((opt, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 rounded-full">
                  {opt.label}
                  <button
                    type="button"
                    onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                    className="hover:text-accent-crimson"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Type an option and press Enter"
            />
            <button
              type="button"
              onClick={addOption}
              className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={required}
          onChange={e => setRequired(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-slate-700">Required field</span>
      </label>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-[#005D9710] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim() || (needsOptions && options.length === 0)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Field'}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseOptions(raw: Json | null): SelectOption[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as unknown as SelectOption[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}
