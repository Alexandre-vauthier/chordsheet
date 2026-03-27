'use client';

import { useState } from 'react';

interface RatingStarsProps {
  value: number | null;
  onChange?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCount?: number;
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showCount,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      <div className={`flex ${sizeClasses[size]}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star as 1 | 2 | 3 | 4 | 5)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            className={`transition-colors ${
              readonly ? 'cursor-default' : 'cursor-pointer'
            } ${
              star <= displayValue
                ? 'text-amber-400'
                : 'text-gray-300'
            } ${
              !readonly && 'hover:scale-110'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="text-sm text-[var(--ink-light)] ml-1">
          {value.toFixed(1)}
        </span>
      )}
      {showCount !== undefined && showCount > 0 && (
        <span className="text-xs text-[var(--ink-faint)]">
          ({showCount} avis)
        </span>
      )}
    </div>
  );
}
