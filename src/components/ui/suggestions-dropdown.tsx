'use client';

import type { ReactNode } from 'react';

interface SuggestionsDropdownProps<T> {
  items: T[];
  activeIndex: number;
  getKey: (item: T) => string;
  renderItem: (item: T, isActive: boolean) => ReactNode;
  onSelect: (item: T) => void;
  onHover?: (index: number) => void;
  footer?: ReactNode;
}

// Liste déroulante de suggestions sous un input : navigation clavier gérée par l'appelant
// (activeIndex contrôlé depuis l'extérieur), ce composant ne fait que l'affichage + le clic.
// onMouseDown + preventDefault (plutôt que onClick) pour que le clic soit pris en compte
// avant que le blur de l'input ne ferme le dropdown.
export function SuggestionsDropdown<T>({
  items,
  activeIndex,
  getKey,
  renderItem,
  onSelect,
  onHover,
  footer,
}: SuggestionsDropdownProps<T>) {
  if (items.length === 0 && !footer) return null;

  return (
    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden">
      {items.map((item, i) => (
        <button
          key={getKey(item)}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          onMouseEnter={() => onHover?.(i)}
          className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
            i === activeIndex ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--ink)] hover:bg-[var(--accent-soft)]'
          }`}
        >
          {renderItem(item, i === activeIndex)}
        </button>
      ))}
      {footer && <div className="border-t border-[var(--line)]">{footer}</div>}
    </div>
  );
}
