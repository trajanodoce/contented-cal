import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isToday as isTodayFn } from 'date-fns';

interface DatePickerProps {
  value: string | null | undefined; // yyyy-MM-dd
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Parse yyyy-MM-dd as local midnight (not UTC). */
function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format Date to yyyy-MM-dd. */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DatePicker({ value, onChange, disabled, placeholder = 'Pick a date', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parseLocal(value) : undefined;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const displayText = selected
    ? isTodayFn(selected)
      ? 'Today'
      : format(selected, 'MMM d, yyyy')
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`
          w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left
          ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-surface-card border-slate-300 hover:border-[#005D97] text-slate-700 cursor-pointer'}
          ${open ? 'border-[#005D97] ring-2 ring-[#005D9725]' : ''}
        `}
      >
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className={selected ? '' : 'text-slate-400'}>{displayText}</span>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setOpen(false);
            }}
            className="ml-auto p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 bg-surface-card rounded-xl shadow-lg shadow-black/8 p-3 animate-in fade-in slide-in-from-top-1 duration-150" style={{ border: '1px solid #00233930' }}>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (day) {
                onChange(toDateString(day));
                setOpen(false);
              }
            }}
            showOutsideDays
            classNames={{
              root: 'cc-datepicker',
              months: '',
              month_caption: 'flex items-center justify-center font-semibold text-sm text-slate-800 mb-2 py-2 -mx-3 px-3 rounded-t-xl [background:#005D9712] [border-bottom:1px_solid_#005D9720]',
              nav: 'flex items-center justify-between absolute top-3 left-3 right-3',
              button_previous: 'p-1 rounded-md hover:bg-[#005D9710] text-slate-500 hover:text-slate-700 transition-colors',
              button_next: 'p-1 rounded-md hover:bg-[#005D9710] text-slate-500 hover:text-slate-700 transition-colors',
              weekdays: 'grid grid-cols-7 mb-1',
              weekday: 'text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center py-1',
              weeks: '',
              week: 'grid grid-cols-7',
              day: 'text-center',
              day_button: 'w-8 h-8 text-[13px] rounded-lg transition-colors hover:bg-[#005D9710] text-slate-700 font-medium',
              selected: '!bg-[#005D97] !text-white !font-semibold hover:!bg-[#004d80]',
              today: 'ring-1 ring-[#005D97] ring-inset rounded-lg',
              outside: '!text-slate-300',
              disabled: '!text-slate-200 !cursor-not-allowed',
              hidden: 'invisible',
            }}
          />
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#005D9720]">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-[#005D9708] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(toDateString(new Date()));
                setOpen(false);
              }}
              className="text-xs font-semibold text-[#005D97] hover:text-[#003d66] px-2 py-1 rounded hover:bg-[#005D9708] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
