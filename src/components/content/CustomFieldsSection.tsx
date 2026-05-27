import type { CustomFieldDefinition, SelectOption, Profile } from '../../lib/database.types';

interface Props {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  compact?: boolean;
  members?: Profile[];
}

export function CustomFieldsSection({ fields, values, onChange, compact = false, members = [] }: Props) {
  if (fields.length === 0) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {fields.map(field => (
        <div key={field.id}>
          <label className={`block font-medium text-slate-700 mb-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
            {field.name}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <CustomFieldInput field={field} value={values[field.id]} onChange={v => onChange(field.id, v)} compact={compact} members={members} />
        </div>
      ))}
    </div>
  );
}

interface InputProps {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
  compact?: boolean;
  members?: Profile[];
}

function CustomFieldInput({ field, value, onChange, compact, members = [] }: InputProps) {
  const cls = `w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${compact ? 'py-1.5' : ''}`;
  const rawOpts = field.options;
  const options: SelectOption[] = Array.isArray(rawOpts)
    ? rawOpts
    : typeof rawOpts === 'string'
      ? (() => { try { const p = JSON.parse(rawOpts); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : [];

  switch (field.field_type) {
    case 'text':
    case 'url':
      return (
        <input
          type={field.field_type === 'url' ? 'url' : 'text'}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className={cls}
          placeholder={field.field_type === 'url' ? 'https://' : ''}
        />
      );

    case 'long_text':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className={`${cls} resize-none`}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={cls}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={cls}
        />
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-400"
          />
          <span className="text-sm text-slate-600">Enabled</span>
        </label>
      );

    case 'single_select':
      return (
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={`${cls} bg-white`}
        >
          <option value="">Select...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'multi_select': {
      const selected = (value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = active
                    ? selected.filter(v => v !== opt.value)
                    : [...selected, opt.value];
                  onChange(next);
                }}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors
                  ${active
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'text-slate-600 border-slate-300 hover:border-slate-400'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'user': {
      return (
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={`${cls} bg-white`}
        >
          <option value="">Select team member...</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
          ))}
        </select>
      );
    }

    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className={cls}
        />
      );
  }
}

export function renderCustomFieldValue(field: CustomFieldDefinition, value: unknown, members?: Profile[]): string {
  if (value === null || value === undefined || value === '') return '—';
  const rawOpts = field.options;
  const options: SelectOption[] = Array.isArray(rawOpts)
    ? rawOpts
    : typeof rawOpts === 'string'
      ? (() => { try { const p = JSON.parse(rawOpts); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : [];
  switch (field.field_type) {
    case 'checkbox': return value ? 'Yes' : 'No';
    case 'single_select': return options.find(o => o.value === value)?.label ?? String(value);
    case 'multi_select': return (value as string[]).map(v => options.find(o => o.value === v)?.label ?? v).join(', ');
    case 'user': {
      const member = members?.find(m => m.id === value);
      return member?.full_name || member?.email || String(value);
    }
    default: return String(value);
  }
}
