import { Link } from 'react-router-dom';
import { formatPrice } from './PriceDisplay';
import { packageKind, KIND_LABEL, KIND_ORDER, getPricing, cheapestTierIndex, getTiers } from '../utils/packageTiers';

/**
 * Theory / Practical / Combo for the same subject, side by side, so someone
 * looking at Theory sees at once that Practical and the Combo exist too —
 * and what the Combo bundles. The package on screen is marked, not linked.
 *
 * `siblings` are list-endpoint rows for the subject; `combosContaining` are
 * combo rows (with bundled_packages) that bundle the current package.
 */
export default function PackageChoice({ currentId, siblings, combosContaining = [] }) {
  const options = (siblings || [])
    .map((p) => ({ ...p, kind: packageKind(p) }))
    .filter((p) => p.kind !== 'other')
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.display_order || 0) - (b.display_order || 0));

  const kinds = new Set(options.map((o) => o.kind));
  if (options.length < 2 || kinds.size < 2) return null;

  const containing = new Map(combosContaining.map((c) => [String(c.package_id), c]));
  const byId = new Map((siblings || []).map((p) => [String(p.package_id), p]));
  const typeOf = (b) => {
    const row = byId.get(String(b.package_id));
    return row ? row.package_type || KIND_LABEL[packageKind(row)] : b.name;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text mb-1">Choose your package</h3>
      <p className="text-xs text-text-secondary mb-4">
        {kinds.has('combo')
          ? 'Each package is sold on its own. A Combo bundles them in one purchase.'
          : 'Each package is sold on its own.'}
      </p>
      <div className={`grid gap-2.5 sm:gap-3 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3'}`}>
        {options.map((o) => {
          const isCurrent = String(o.package_id) === String(currentId);
          const tiered = !!getTiers(o);
          const { price } = getPricing(o, cheapestTierIndex(o));
          const combo = containing.get(String(o.package_id));
          const includes =
            o.kind === 'combo' && combo?.bundled_packages?.length
              ? combo.bundled_packages.map(typeOf).join(' + ')
              : null;
          const body = (
            <>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  o.kind === 'combo' ? 'bg-accent/15 text-accent-dark' : 'bg-primary/6 text-primary'
                }`}>
                  {o.package_type || KIND_LABEL[o.kind]}
                </span>
                {isCurrent && <span className="text-[10px] font-semibold text-text-tertiary">Viewing</span>}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-text leading-snug line-clamp-2">{o.name}</p>
              {includes && (
                <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">Includes {includes}</p>
              )}
              {price != null && (
                <p className="text-xs sm:text-sm font-bold text-primary mt-1.5">
                  {tiered ? 'From ' : ''}{formatPrice(price)}
                </p>
              )}
            </>
          );
          return isCurrent ? (
            <div key={o.package_id} aria-current="page" className="rounded-xl border-2 border-primary bg-primary/6 p-3 sm:p-3.5">
              {body}
            </div>
          ) : (
            <Link
              key={o.package_id}
              to={`/packages/${o.package_id}`}
              className="rounded-xl border-2 border-border bg-white p-3 sm:p-3.5 hover:border-primary/40 transition-colors no-underline"
            >
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
