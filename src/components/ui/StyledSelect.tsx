import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

const COOL_WASHES = ['#f0f4f8', '#edf2f8', '#f0f1f6', '#eef3f7', '#f1f0f6', '#edf1f7', '#f0f2f5'];

export function StyledSelect({ value, onChange, options, placeholder = 'Select...', disabled = false, className = '' }: StyledSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const selected = options.find(o => o.value === value);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScroll() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`field-select w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium border rounded-lg text-left transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-nested'
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

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed border rounded-lg shadow-lg overflow-y-auto max-h-[240px]"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
            borderColor: '#00233930',
            background: 'linear-gradient(135deg, #005D9708 0%, transparent 40%), #F7F9FC',
          }}
        >
          <div className="p-1 space-y-0.5">
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const rowBg = isSelected ? '#005D9715' : COOL_WASHES[idx % COOL_WASHES.length];
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
                  <span className={`flex-1 text-left truncate ${isSelected ? 'text-brand-900 font-semibold' : 'text-slate-800'}`}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
