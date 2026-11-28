import { formatPrice } from './PriceDisplay';
import ComboContents from './ComboContents';
import { getTiers, getPricing, cheapestTierIndex, formatDuration, formatDate } from '../utils/packageTiers';

export default function PackageCard({ pkg, purchased, illustrationIndex = 0, onClick, onUpgrade, onRenew, bundled }) {
  const tiers = getTiers(pkg);
  const hasTiers = !!tiers;
  // "From" must be the cheapest plan, not whichever tier the admin listed first.
  const { price, originalPrice, isOnSale } = getPricing(pkg, cheapestTierIndex(pkg));
  const hasThumbnail = !!pkg.thumbnail_url;
  // A multi-plan package's own duration_days is not what anyone buys.
  const singleDuration = !tiers || tiers.length === 1
    ? formatDuration(tiers ? tiers[0].duration_days : pkg.duration_days)
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-press group relative flex flex-col w-full h-full text-left bg-white rounded-2xl border border-border/60 overflow-hidden hover:shadow-lg hover:border-primary/20 duration-200 cursor-pointer"
    >
      {/* Cover image */}
      <div className="relative bg-surface-dim">
        {hasThumbnail ? (
          <div className="aspect-video overflow-hidden">
            <img
              src={pkg.thumbnail_url}
              alt={pkg.name}
              width="640"
              height="360"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary/30">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
        )}
        {/* Badges on image */}
        {purchased && (
          <span className="absolute top-3 right-3 text-[10px] sm:text-xs font-semibold bg-success text-white px-2.5 py-1 rounded-full shadow-sm">
            Purchased
          </span>
        )}
        {!purchased && isOnSale && originalPrice > price && (
          <span className="absolute top-3 left-3 text-[10px] sm:text-xs font-semibold bg-white text-accent-dark px-2 py-0.5 rounded-full shadow-sm">
            {Math.round(((originalPrice - price) / originalPrice) * 100)}% off
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 sm:p-5">
        {/* Type badge */}
        {(pkg.type || pkg.package_type) && (
          <span className="self-start text-[10px] sm:text-xs font-medium text-primary bg-primary/6 px-2 py-0.5 rounded-full mb-2.5">
            {pkg.type || pkg.package_type}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm sm:text-base font-semibold text-text group-hover:text-primary transition-colors line-clamp-3 leading-snug mb-2 break-words">
          {pkg.name}
        </h3>

        {/* Description */}
        {pkg.description && (
          <p className="text-[11px] sm:text-xs text-text-tertiary line-clamp-2 leading-relaxed mb-3">
            {pkg.description}
          </p>
        )}

        {/* Meta row */}
        {(singleDuration || pkg.features?.length > 0) && (
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-text-secondary mb-3">
            {singleDuration && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="font-medium">{singleDuration}</span>
              </>
            )}
            {singleDuration && pkg.features?.length > 0 && (
              <span className="text-text-tertiary">·</span>
            )}
            {pkg.features?.length > 0 && (
              <span>{pkg.features.length} features</span>
            )}
          </div>
        )}

        {/* Tier options */}
        {/* Combo contents */}
        {bundled?.length > 0 && <ComboContents items={bundled} variant="compact" />}

        {hasTiers && tiers.length > 1 && (
          <div className="mb-3">
            <div className="text-[11px] sm:text-xs font-medium text-text mb-1.5">
              {tiers.length} plans
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map((t, i) => (
                <span
                  key={i}
                  title={t.name}
                  className={`text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-md border ${
                    pkg.current_tier_index === i && purchased
                      ? 'border-success/30 bg-success/8 text-success'
                      : 'border-border bg-surface-dim text-text-secondary'
                  }`}
                >
                  {formatDuration(t.duration_days) || t.name}
                  <span className="text-text-tertiary"> · </span>
                  {formatPrice(t.effective_price ?? t.price)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Price footer — pushed to bottom */}
        <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between gap-2">
          {purchased ? (
            <>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-success bg-success/8 px-2.5 py-1 rounded-full">Purchased</span>
                {pkg.expires_at && (
                  <p className="text-[10px] sm:text-[11px] text-text-tertiary mt-1.5">Ends {formatDate(pkg.expires_at)}</p>
                )}
              </div>
              {/* Owning a package used to be a dead end here. stopPropagation
                  so this doesn't also open the card's detail modal. */}
              <div className="flex items-center gap-1.5 shrink-0">
                {onUpgrade && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpgrade();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpgrade();
                      }
                    }}
                    className="inline-flex items-center min-h-10 text-xs sm:text-sm font-semibold text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors"
                  >
                    Upgrade
                  </span>
                )}
                {onRenew && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenew();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onRenew();
                      }
                    }}
                    className="inline-flex items-center min-h-10 text-xs sm:text-sm font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 active:bg-primary/90 transition-colors"
                  >
                    Renew
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-sm sm:text-base font-bold text-text">
                  {hasTiers ? `From ${formatPrice(price)}` : formatPrice(price)}
                </span>
                {isOnSale && originalPrice > price && (
                  <span className="text-[10px] sm:text-xs text-text-tertiary line-through">{formatPrice(originalPrice)}</span>
                )}
              </div>
              <span className="shrink-0 text-xs sm:text-sm font-semibold text-white bg-primary px-3.5 py-1.5 rounded-lg group-hover:bg-primary/90 transition-colors">
                Buy
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
