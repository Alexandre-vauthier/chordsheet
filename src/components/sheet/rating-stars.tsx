'use client';

import { useState } from 'react';
import { useFormatter } from 'next-intl';

interface RatingStarsProps {
  value: number | null;
  onChange?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCount?: number;
  /**
   * `stars` : les 5 étoiles, pour *donner* une note.
   * `summary` : la note chiffrée suivie d'une seule étoile, pour *afficher* une
   * moyenne. Cinq étoiles à côté du contrôle de notation prêtaient à confusion,
   * et une moyenne de 4,8 se lit mal sur une échelle discrète.
   */
  variant?: 'stars' | 'summary';
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showCount,
  variant = 'stars',
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const format = useFormatter();

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const displayValue = hoverValue ?? value ?? 0;

  if (variant === 'summary') {
    // Rien à afficher tant que personne n'a noté : cinq étoiles grises laissaient
    // croire à une note de zéro.
    if (value === null) return null;

    return (
      <span className="inline-flex items-baseline gap-1">
        <span className={`font-medium text-[var(--ink)] ${sizeClasses[size]}`}>
          {format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </span>
        <span className={`text-amber-400 ${sizeClasses[size]}`} aria-hidden>★</span>
        {showCount !== undefined && showCount > 0 && (
          <span className="text-xs text-[var(--ink-faint)]">({showCount})</span>
        )}
      </span>
    );
  }

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
