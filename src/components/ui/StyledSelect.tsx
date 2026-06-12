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
  /**
   * Render variant. `default` (the original look) shows a small color dot
   * next to the label. `pill` renders the entire button as a colored pill
   * (12% bg + colored text + 30% border) when the selected option has a
   * color — used for custom field selects with semantic per-option colors.
   */
  variant?: 'default' | 'pill';
}


export function StyledSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  variant = 'default',
}: StyledSelectProps) {
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

  const isPillMode = variant === 'pill' && !!selected?.color;
  const pillColor = selected?.color;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`field-select w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium border rounded-lg text-left transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-nested'
        }`}
        style={
          isPillMode && pillColor
            ? {
                backgroundColor: `${pillColor}12`,
                borderColor: `${pillColor}30`,
                color: pillColor,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          {!isPillMode && selected?.color && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
          )}
          <span
            className={
              isPillMode
                ? 'font-semibold truncate'
                : selected
                  ? 'text-slate-800 truncate'
                  : 'text-slate-400 truncate'
            }
            style={isPillMode && pillColor ? { color: pillColor } : undefined}
          >
            {selected?.label || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={isPillMode && pillColor ? { color: pillColor, opacity: 0.7 } : { color: 'rgb(var(--color-slate-400))' }}
        />
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
            borderColor: 'rgb(var(--color-brand-900) / 0.188)',
            background: 'linear-gradient(135deg, rgb(var(--color-brand-600) / 0.094) 0%, transparent 50%), #ffffff',
          }}
        >
          <div className="p-1 space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              const showInlinePill = variant === 'pill' && !!option.color;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isSelected ? '' : 'hover:bg-brand-600/[0.094]'
                  }`}
                  style={{ backgroundColor: isSelected ? '#e8f0fe' : undefined }}
                >
                  {showInlinePill && option.color ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold truncate"
                      style={{
                        backgroundColor: `${option.color}12`,
                        color: option.color,
                        border: `1px solid ${option.color}30`,
                      }}
                    >
                      {option.label}
                    </span>
                  ) : (
                    <>
                      {option.color && (
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
                      )}
                      <span className={`flex-1 text-left truncate ${isSelected ? 'text-brand-900 font-semibold' : 'text-slate-800'}`}>
                        {option.label}
                      </span>
                    </>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0 ml-auto" />}
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
