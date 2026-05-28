import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const COOL_WASHES = ['#f0f4f8', '#f5f0f8', '#f0f6f5', '#f2f4f8', '#f5f3f0', '#f0f2f6', '#f4f0f5'];

export function StyledSelect({ value, onChange, options, placeholder = 'Select...', disabled = false, className = '' }: StyledSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`field-select w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium border rounded-lg text-left transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.color && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
          )}
          <span className={selected ? 'text-slate-800 truncate' : 'text-slate-400 truncate'}>
            {selected?.label || placeholder}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 top-full mt-1 w-full border rounded-lg shadow-lg overflow-y-auto max-h-[240px]"
          style={{ borderColor: '#002339', backgroundColor: '#fafbfc' }}
        >
          <div className="p-1 space-y-0.5">
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const rowBg = isSelected ? '#e8f0fe' : COOL_WASHES[idx % COOL_WASHES.length];
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:brightness-95"
                  style={{ backgroundColor: rowBg }}
                >
                  {option.color && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
                  )}
                  <span className={`flex-1 text-left truncate ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-800'}`}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
