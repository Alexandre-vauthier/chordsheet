'use client';

interface CoachMarkProps {
  text: string;
  position?: 'top' | 'bottom' | 'right' | 'left';
  onDismiss: () => void;
}

export function CoachMark({ text, position = 'bottom', onDismiss }: CoachMarkProps) {
  const posClass = {
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
  }[position];

  const arrowClass = {
    top:    'top-full left-1/2 -translate-x-1/2 -mt-[3px]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-[3px]',
    right:  'right-full top-1/2 -translate-y-1/2 -mr-[3px]',
    left:   'left-full top-1/2 -translate-y-1/2 -ml-[3px]',
  }[position];

  return (
    <div className={`absolute z-40 pointer-events-auto ${posClass}`}>
      <div className="relative flex items-center gap-2 bg-[var(--nav-bg)] text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
        <span>{text}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="opacity-50 hover:opacity-100 transition-opacity ml-1"
          title="Fermer"
        >
          ✕
        </button>
        <div className={`absolute w-[6px] h-[6px] bg-[var(--nav-bg)] rotate-45 ${arrowClass}`} />
      </div>
    </div>
  );
}
