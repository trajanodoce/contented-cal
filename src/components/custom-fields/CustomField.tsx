import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, X, Plus, Check } from 'lucide-react';
import { format } from 'date-fns';
import DatePicker from '../ui/DatePicker';
import { Avatar } from '../ui/Avatar';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FieldVariant = 'text' | 'number' | 'date' | 'single_select' | 'multi_select' | 'user';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface User {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface CustomFieldInputProps {
  variant: FieldVariant;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  options?: SelectOption[];
  users?: User[];
  placeholder?: string;
  disabled?: boolean;
}

export interface CustomFieldReadoutProps {
  variant: FieldVariant;
  label: string;
  value: unknown;
  options?: SelectOption[];
  users?: User[];
}

/* ------------------------------------------------------------------ */
/*  Shared style tokens                                                */
/* ------------------------------------------------------------------ */

const inputLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  display: 'block',
};

const readoutLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
};

const readoutValueTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#334155', // slate-700
};

const notSetStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8', // slate-400
  fontStyle: 'italic',
};

const softChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#F4F8FB',
  border: '1px solid #00233918',
  borderRadius: 99,
  padding: '3px 9px',
  fontSize: 12,
  color: '#334155',
};

const baseInputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 ' +
  'focus:outline-none focus:border-[#005D97] focus:ring-2 focus:ring-[#005D9725] transition-colors ' +
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function firstNameLastInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function firstNameOnly(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function isEmpty(value: unknown, variant: FieldVariant): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (variant === 'multi_select' && Array.isArray(value) && value.length === 0) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  StatusBadge — colored pill for single-select                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ option }: { option: SelectOption }) {
  const color = option.color || '#64748b';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        borderRadius: 99,
        padding: '3px 9px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {option.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  MultiSelectChip                                                    */
/* ------------------------------------------------------------------ */

function MultiSelectChip({
  option,
  onRemove,
}: {
  option: SelectOption;
  onRemove?: () => void;
}) {
  const color = option.color || '#64748b';
  const removable = !!onRemove;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        borderRadius: 4,
        padding: removable ? '3px 8px 3px 10px' : '2px 8px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {option.label}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${option.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            color: color,
            opacity: 0.7,
          }}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  UserChip — readout                                                 */
/* ------------------------------------------------------------------ */

function UserChip({ user }: { user: User }) {
  const name = user.full_name ?? '';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#F4F8FB',
        border: '1px solid #00233918',
        borderRadius: 99,
        padding: '3px 9px 3px 3px',
        fontSize: 12,
        fontWeight: 500,
        color: '#334155',
      }}
    >
      <Avatar src={user.avatar_url} name={name} size="xs" />
      {firstNameOnly(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic portaled dropdown                                          */
/* ------------------------------------------------------------------ */

function useDropdown<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<T>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    update();
    const onScroll = () => update();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, update]);

  return { open, setOpen, triggerRef, popoverRef, pos };
}

const dropdownPanelStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: '#fff',
  border: '1.5px solid #002339',
  borderRadius: 12,
  boxShadow: '0 4px 20px rgba(0,35,57,.08)',
  padding: 4,
  maxHeight: 280,
  overflowY: 'auto',
};

/* ------------------------------------------------------------------ */
/*  Single-select Input                                                */
/* ------------------------------------------------------------------ */

function SingleSelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const { open, setOpen, triggerRef, popoverRef, pos } = useDropdown<HTMLButtonElement>();
  const selected = options.find((o) => o.value === value) || null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={baseInputClass + ' flex items-center gap-2 text-left'}
        style={{ paddingTop: 6, paddingBottom: 6 }}
      >
        {selected ? (
          <>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: selected.color || '#64748b',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: '#334155' }}>{selected.label}</span>
          </>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{placeholder || 'Select...'}</span>
        )}
        <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#64748b' }} />
      </button>
      {open && pos && createPortal(
        <div ref={popoverRef} style={{ ...dropdownPanelStyle, top: pos.top, left: pos.left, width: pos.width }}>
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: opt.color || '#64748b',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: '#334155' }}>{opt.label}</span>
                {isSel && <Check size={14} style={{ marginLeft: 'auto', color: '#005D97' }} />}
              </button>
            );
          })}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full px-2 py-1.5 rounded-md hover:bg-slate-50 text-left text-[11px] text-slate-500 border-t border-slate-100 mt-1"
            >
              Clear
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-select Input                                                 */
/* ------------------------------------------------------------------ */

function MultiSelectInput({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: SelectOption[];
  disabled?: boolean;
}) {
  const { open, setOpen, triggerRef, popoverRef, pos } = useDropdown<HTMLDivElement>();
  const selectedOpts = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is SelectOption => !!o);
  const remaining = options.filter((o) => !value.includes(o.value));

  return (
    <>
      <div
        ref={triggerRef}
        className={
          baseInputClass +
          ' flex items-center flex-wrap gap-1.5 ' +
          (disabled ? '' : 'cursor-text')
        }
        style={{ minHeight: 38, paddingTop: 5, paddingBottom: 5 }}
        onClick={() => !disabled && setOpen(true)}
      >
        {selectedOpts.map((opt) => (
          <MultiSelectChip
            key={opt.value}
            option={opt}
            onRemove={
              disabled
                ? undefined
                : () => onChange(value.filter((v) => v !== opt.value))
            }
          />
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="inline-flex items-center gap-1 text-[12px] text-[#005D97] hover:text-[#003d66] px-1.5 py-0.5 rounded"
          >
            <Plus size={12} strokeWidth={2.5} />
            Add
          </button>
        )}
      </div>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ ...dropdownPanelStyle, top: pos.top, left: pos.left, width: Math.max(pos.width, 200) }}
        >
          {remaining.length === 0 && (
            <div className="px-2 py-2 text-[12px] text-slate-400 italic">No more options</div>
          )}
          {remaining.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange([...value, opt.value])}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: opt.color || '#64748b',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, color: '#334155' }}>{opt.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  User Input                                                          */
/* ------------------------------------------------------------------ */

function UserInput({
  value,
  onChange,
  users,
  placeholder,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const { open, setOpen, triggerRef, popoverRef, pos } = useDropdown<HTMLButtonElement>();
  const selected = users.find((u) => u.id === value) || null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={baseInputClass + ' flex items-center gap-2 text-left'}
        style={{ paddingTop: 6, paddingBottom: 6 }}
      >
        {selected ? (
          <>
            <Avatar src={selected.avatar_url} name={selected.full_name} size="sm" />
            <span style={{ fontSize: 13, color: '#334155' }}>
              {firstNameLastInitial(selected.full_name ?? '')}
            </span>
          </>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{placeholder || 'Select user...'}</span>
        )}
        <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#64748b' }} />
      </button>
      {open && pos && createPortal(
        <div ref={popoverRef} style={{ ...dropdownPanelStyle, top: pos.top, left: pos.left, width: Math.max(pos.width, 200) }}>
          {users.map((u) => {
            const isSel = u.id === value;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
              >
                <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                <span style={{ fontSize: 13, color: '#334155' }}>
                  {firstNameLastInitial(u.full_name ?? '')}
                </span>
                {isSel && <Check size={14} style={{ marginLeft: 'auto', color: '#005D97' }} />}
              </button>
            );
          })}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full px-2 py-1.5 rounded-md hover:bg-slate-50 text-left text-[11px] text-slate-500 border-t border-slate-100 mt-1"
            >
              Clear
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Number Input with steppers                                         */
/* ------------------------------------------------------------------ */

function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const current = typeof value === 'number' ? value : 0;
  const step = (delta: number) => {
    if (disabled) return;
    onChange(current + delta);
  };
  return (
    <div className="relative">
      <input
        type="number"
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange(null);
          else {
            const n = Number(v);
            if (!Number.isNaN(n)) onChange(n);
          }
        }}
        className={baseInputClass + ' pr-8'}
        style={{ MozAppearance: 'textfield' } as React.CSSProperties}
      />
      <div
        className="absolute right-1 top-1 bottom-1 flex flex-col"
        style={{ width: 20 }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          className="flex-1 flex items-center justify-center rounded-t hover:bg-slate-100 text-slate-500"
          aria-label="Increment"
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(-1)}
          className="flex-1 flex items-center justify-center rounded-b hover:bg-slate-100 text-slate-500"
          aria-label="Decrement"
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CustomFieldInput                                                   */
/* ------------------------------------------------------------------ */

export function CustomFieldInput({
  variant,
  label,
  value,
  onChange,
  options = [],
  users = [],
  placeholder,
  disabled,
}: CustomFieldInputProps) {
  let control: React.ReactNode = null;

  switch (variant) {
    case 'text':
      control = (
        <input
          type="text"
          disabled={disabled}
          value={(value as string) ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
      break;
    case 'number':
      control = (
        <NumberInput
          value={typeof value === 'number' ? value : value == null || value === '' ? null : Number(value)}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'date':
      control = (
        <DatePicker
          value={(value as string) ?? null}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      );
      break;
    case 'single_select':
      control = (
        <SingleSelectInput
          value={(value as string) ?? null}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'multi_select':
      control = (
        <MultiSelectInput
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          options={options}
          disabled={disabled}
        />
      );
      break;
    case 'user':
      control = (
        <UserInput
          value={(value as string) ?? null}
          onChange={onChange}
          users={users}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
  }

  return (
    <div>
      <label style={inputLabelStyle}>{label}</label>
      {control}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CustomFieldReadout                                                 */
/* ------------------------------------------------------------------ */

export function CustomFieldReadout({
  variant,
  label,
  value,
  options = [],
  users = [],
}: CustomFieldReadoutProps) {
  const empty = isEmpty(value, variant);

  let valueNode: React.ReactNode;

  if (empty) {
    valueNode = <span style={notSetStyle}>Not set</span>;
  } else {
    switch (variant) {
      case 'text':
        valueNode = <span style={readoutValueTextStyle}>{String(value)}</span>;
        break;
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        valueNode = (
          <span style={{ ...readoutValueTextStyle, fontVariantNumeric: 'tabular-nums' }}>
            {Number.isFinite(n) ? formatNumber(n) : String(value)}
          </span>
        );
        break;
      }
      case 'date': {
        let display = String(value);
        try {
          const [y, m, d] = String(value).split('-').map(Number);
          if (y && m && d) {
            display = format(new Date(y, m - 1, d), 'MMM d, yyyy');
          }
        } catch {
          /* keep raw */
        }
        valueNode = <span style={softChipStyle}>{display}</span>;
        break;
      }
      case 'single_select': {
        const opt = options.find((o) => o.value === value);
        valueNode = opt ? (
          <StatusBadge option={opt} />
        ) : (
          <span style={readoutValueTextStyle}>{String(value)}</span>
        );
        break;
      }
      case 'multi_select': {
        const vals = Array.isArray(value) ? (value as string[]) : [];
        const opts = vals
          .map((v) => options.find((o) => o.value === v))
          .filter((o): o is SelectOption => !!o);
        valueNode = (
          <span className="inline-flex flex-wrap gap-1 align-middle">
            {opts.map((o) => (
              <MultiSelectChip key={o.value} option={o} />
            ))}
          </span>
        );
        break;
      }
      case 'user': {
        const u = users.find((x) => x.id === value);
        valueNode = u ? <UserChip user={u} /> : <span style={readoutValueTextStyle}>{String(value)}</span>;
        break;
      }
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span style={readoutLabelStyle}>{label}:</span>
      {valueNode}
    </span>
  );
}
