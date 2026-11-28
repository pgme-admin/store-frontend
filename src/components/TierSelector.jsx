import { useId } from 'react';
import { formatPrice } from './PriceDisplay';
import {
  formatDuration,
  tierPrice,
  tierOriginalPrice,
  tierNameRepeatsDuration,
  perMonth,
} from '../utils/packageTiers';

/**
 * Plan picker for a package's tiers: the duration leads ("6 months"), then the
 * admin's tier name, the price (with any strike-through) and a per-month figure
 * so 6 vs 12 months can be compared at a glance. Behaves as a radio group.
 */
export default function TierSelector({
  tiers,
  selected,
  onSelect,
  ownedTierIndex = null,
  compact = false,
  label = 'Choose your plan',
}) {
  const labelId = useId();
  if (!tiers?.length) return null;

  // "Best value" only when one plan is clearly cheapest per month.
  const monthly = tiers.map(perMonth);
  const comparable = monthly.filter((m) => m != null);
  let bestIdx = null;
  if (tiers.length > 1 && comparable.length > 1) {
    const min = Math.min(...comparable);
    const hits = monthly.reduce((acc, m, i) => (m === min ? [...acc, i] : acc), []);
    if (hits.length === 1 && Math.max(...comparable) > min) bestIdx = hits[0];
  }

  return (
    <div>
      <p id={labelId} className={`font-semibold text-text ${compact ? 'text-xs sm:text-sm mb-2' : 'text-base mb-1'}`}>
        {label}
      </p>
      {!compact && (
        <p className="text-xs text-text-secondary mb-4">
          Same content on every plan — pick how long you want access.
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={`grid gap-2.5 sm:gap-3 ${tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3'}`}
      >
        {tiers.map((tier, idx) => {
          const isSelected = selected === idx;
          const isOwned = ownedTierIndex === idx;
          const price = tierPrice(tier);
          const original = tierOriginalPrice(tier);
          const duration = formatDuration(tier.duration_days);
          const showName = tier.name && !tierNameRepeatsDuration(tier);
          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(idx)}
              className={`relative text-left rounded-xl border-2 transition-[color,background-color,border-color,box-shadow,transform] cursor-pointer ${compact ? 'p-3' : 'p-3.5 sm:p-4'} ${
                isSelected
                  ? 'border-primary bg-primary/[0.06] shadow-sm'
                  : 'border-border bg-white hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span
                  className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'border-primary bg-primary' : 'border-border bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                {isOwned ? (
                  <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-md">Your plan</span>
                ) : bestIdx === idx ? (
                  <span className="text-[10px] font-semibold text-accent-dark bg-accent/15 px-1.5 py-0.5 rounded-md">Best value</span>
                ) : null}
              </div>
              <div className={`font-bold text-text leading-tight ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
                {duration || tier.name}
              </div>
              {showName && duration && (
                <div className="text-[11px] sm:text-xs text-text-secondary mt-0.5 truncate">{tier.name}</div>
              )}
              <div className="flex items-baseline gap-1.5 flex-wrap mt-2">
                <span className={`font-bold text-primary ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>{formatPrice(price)}</span>
                {original && (
                  <span className="text-[11px] text-text-tertiary line-through">{formatPrice(original)}</span>
                )}
              </div>
              {monthly[idx] != null && (
                <div className="text-[10px] sm:text-[11px] text-text-tertiary mt-0.5">
                  about {formatPrice(monthly[idx])} / month
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
