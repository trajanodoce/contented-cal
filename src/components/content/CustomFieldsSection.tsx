import type { CustomFieldDefinition, SelectOption, Profile, TaskCategory } from '../../lib/database.types';
import DatePicker from '../ui/DatePicker';
import { StyledSelect } from '../ui/StyledSelect';
import { pillTextColor } from '../../lib/utils';

// Category colors used by pill-row rendering (single_select with ≤5 options).
// Aligned with TaskCategoryIcon + Optional Details zone tint.
const CATEGORY_COLOR: Record<TaskCategory, string> = {
  content: '#005D97',
  design: '#B8447A',
};

// Single-select fields with this many or fewer options render as a pill row
// (per the v2 Optional Details spec) instead of a dropdown.
const PILL_ROW_MAX_OPTIONS = 5;

interface Props {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  compact?: boolean;
  members?: Profile[];
  /**
   * Task category context. Used by pill-row renderer (single_select with ≤5
   * options) to pick the right category color. Defaults to 'content' if not
   * supplied — preserves visual behavior for places that render this section
   * outside the detail panel (e.g. intake forms).
   */
  taskCategory?: TaskCategory;
}

export function CustomFieldsSection({
  fields,
  values,
  onChange,
  compact = false,
  members = [],
  taskCategory = 'content',
}: Props) {
  if (fields.length === 0) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {fields.map(field => (
        <div key={field.id}>
          <label className={`block font-semibold text-slate-500 mb-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
            {field.name}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <CustomFieldInput
            field={field}
            value={values[field.id]}
            onChange={v => onChange(field.id, v)}
            compact={compact}
            members={members}
            taskCategory={taskCategory}
          />
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
  taskCategory?: TaskCategory;
}

function CustomFieldInput({ field, value, onChange, compact, members = [], taskCategory = 'content' }: InputProps) {
  const cls = `w-full px-3 py-2 text-sm text-slate-700 bg-surface-card border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${compact ? 'py-1.5' : ''}`;
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
        <DatePicker
          value={(value as string) ?? ''}
          onChange={v => onChange(v || null)}
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

    case 'single_select': {
      // Per the v2 Optional Details spec: ≤5 options render as a pill row
      // using the TASK's category color (not per-option colors). 6+ options
      // keep the StyledSelect dropdown so the picker stays manageable.
      if (options.length > 0 && options.length <= PILL_ROW_MAX_OPTIONS) {
        const selected = (value as string) ?? '';
        const categoryColor = CATEGORY_COLOR[taskCategory];
        return (
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => {
              const active = opt.value === selected;
              const activeStyle = {
                backgroundColor: `${categoryColor}12`,
                color: categoryColor,
                borderColor: `${categoryColor}30`,
              };
              const inactiveStyle = {
                backgroundColor: 'transparent',
                color: '#475569',
                borderColor: '#cbd5e1',
              };
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(active ? null : opt.value)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors"
                  style={active ? activeStyle : inactiveStyle}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }
      return (
        <StyledSelect
          value={(value as string) ?? ''}
          onChange={v => onChange(v || null)}
          options={options}
          placeholder="Select..."
          variant="pill"
        />
      );
    }

    case 'multi_select': {
      const selected = (value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => {
            const active = selected.includes(opt.value);
            const color = opt.color;

            // With color: active pills use canonical pill styling (color-12 bg,
            // color text, color-30 border); inactive pills carry a faint border
            // hint of their color so users can preview before clicking.
            // Without color: fall back to the original brand-blue treatment.
            // Force readable contrast on light/pastel option colors via
            // pillTextColor (high saturation + low lightness). Apply to both
            // text and border so pastels stay visible against the tinted bg.
            const safeColor = color ? pillTextColor(color) : undefined;
            const style = color
              ? active
                ? {
                    backgroundColor: `${color}12`,
                    color: safeColor,
                    borderColor: `${safeColor}55`,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: '#475569',
                    borderColor: `${safeColor}55`,
                  }
              : undefined;

            const fallbackClass = color
              ? ''
              : active
                ? 'bg-brand-600 text-white border-brand-600'
                : 'text-slate-600 border-slate-300 hover:border-slate-400';

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
                className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${fallbackClass}`}
                style={style}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'user': {
      const memberOptions = members.map(m => ({
        value: m.id,
        label: m.full_name || m.email || 'Unknown',
      }));
      return (
        <StyledSelect
          value={(value as string) ?? ''}
          onChange={v => onChange(v || null)}
          options={memberOptions}
          placeholder="Select team member..."
        />
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
