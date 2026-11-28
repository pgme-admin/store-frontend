/**
 * One place for everything the store says about a package's plans (tiers):
 * how long a plan lasts in words people use ("6 months", not "180 days"),
 * what it costs, which tier a URL points at, and what kind of package it is.
 *
 * Tier indexes are positions in the `tiers` array the API returns. The API
 * already sorts tiers by display_order, and create-order / coupon validation
 * resolve `tier_index` against that same sorted order, so the array position
 * is the contract — never a tier's own display_order.
 */

const DAYS_PER_MONTH = 365.25 / 12; // 30.4375

/**
 * Human duration for a number of days.
 *   180 -> "6 months", 365 -> "12 months", 30 -> "1 month", 45 -> "45 days".
 * A day count is shown as months only when it sits close to a whole number
 * of months (admins enter 180/182/183 or 360/365/366 for the same plan);
 * anything else stays in days so it is never rounded into a lie.
 */
export function formatDuration(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return '';
  const months = Math.round(n / DAYS_PER_MONTH);
  if (months >= 1) {
    const tolerance = Math.max(2.5, months * 0.5);
    if (Math.abs(n - months * DAYS_PER_MONTH) <= tolerance) {
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    }
  }
  const whole = Math.round(n);
  return `${whole} ${whole === 1 ? 'day' : 'days'}`;
}

/** "6 months access" — or '' when the duration is unknown. */
export function formatAccess(days) {
  const d = formatDuration(days);
  return d ? `${d} access` : '';
}

/** "23 Nov 2026" */
export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getTiers(pkg) {
  return pkg?.has_tiers && Array.isArray(pkg.tiers) && pkg.tiers.length > 0 ? pkg.tiers : null;
}

/** What a tier is actually charged (sale-adjusted), before GST. */
export function tierPrice(tier) {
  if (!tier) return null;
  return tier.effective_price ?? tier.price;
}

/**
 * The strike-through price for a tier: the admin's "original price" when set,
 * otherwise the list price when a sale has brought the effective price below it.
 */
export function tierOriginalPrice(tier) {
  if (!tier) return null;
  const price = tierPrice(tier);
  if (tier.original_price && tier.original_price > price) return tier.original_price;
  if (tier.price && tier.price > price) return tier.price;
  return null;
}

/**
 * Price, strike-through price and duration for a package at a given tier.
 * Packages without tiers fall back to the package-level price and duration.
 */
export function getPricing(pkg, tierIndex) {
  const tiers = getTiers(pkg);
  if (tiers) {
    const tier = tiers[tierIndex] || null;
    if (!tier) return { tier: null, price: null, originalPrice: null, isOnSale: false, durationDays: null };
    const price = tierPrice(tier);
    const originalPrice = tierOriginalPrice(tier);
    return {
      tier,
      price,
      originalPrice,
      isOnSale: !!originalPrice && originalPrice > price,
      durationDays: tier.duration_days || null,
    };
  }
  const price = pkg?.sale_price || pkg?.price;
  return {
    tier: null,
    price,
    originalPrice: pkg?.original_price ?? null,
    isOnSale: !!pkg?.is_on_sale,
    durationDays: pkg?.duration_days || null,
  };
}

/** Index of the cheapest tier (the honest "From" price), or 0. */
export function cheapestTierIndex(pkg) {
  const tiers = getTiers(pkg);
  if (!tiers) return 0;
  let best = 0;
  tiers.forEach((t, i) => {
    if (tierPrice(t) < tierPrice(tiers[best])) best = i;
  });
  return best;
}

/**
 * Read a tier index from a URL value. Returns the index when it points at a
 * real tier of this package, otherwise null — callers must then ask the
 * customer to choose rather than quietly substituting another tier.
 */
export function parseTierIndex(pkg, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (!/^\d+$/.test(String(raw))) return null;
  const idx = Number(raw);
  const tiers = getTiers(pkg);
  if (!tiers) return null;
  return idx >= 0 && idx < tiers.length ? idx : null;
}

/**
 * Whether the tier's admin-given name already says its duration
 * ("6 Months"), so the card doesn't print "6 Months · 6 months".
 */
export function tierNameRepeatsDuration(tier) {
  if (!tier?.name) return true;
  const name = tier.name.toLowerCase().replace(/\s+/g, ' ');
  const dur = formatDuration(tier.duration_days).toLowerCase();
  if (!dur) return false;
  const [num, unit] = dur.split(' ');
  return name.includes(num) && (name.includes(unit.replace(/s$/, '')) || /\bmo\b|\bmon\b/.test(name));
}

/**
 * Approximate monthly cost, to make 6 vs 12 months comparable at a glance.
 * Only for plans of two months or more.
 */
export function perMonth(tier) {
  const days = Number(tier?.duration_days);
  const price = tierPrice(tier);
  if (!days || !price || days < 2 * DAYS_PER_MONTH - 3) return null;
  return Math.round(price / (days / DAYS_PER_MONTH));
}

/**
 * Theory / Practical / Combo, from the stable slug first and the admin-editable
 * display name second (a type named "Combos" still counts as combo).
 */
export function packageKind(pkg) {
  if (!pkg) return 'other';
  if (pkg.is_combo || (pkg.bundled_packages?.length || 0) > 0) return 'combo';
  const label = `${pkg.package_type_slug || ''} ${pkg.package_type || ''} ${pkg.type || ''}`.toLowerCase();
  if (/combo|bundle/.test(label)) return 'combo';
  if (/practical/.test(label)) return 'practical';
  if (/theory/.test(label)) return 'theory';
  return 'other';
}

export const KIND_LABEL = { theory: 'Theory', practical: 'Practical', combo: 'Combo', other: 'Other' };
export const KIND_ORDER = ['theory', 'practical', 'combo', 'other'];

/** Checkout URL that survives a reload: the tier (and upgrade mode) live in the query. */
export function packageCheckoutPath(packageId, { tierIndex = null, mode = null } = {}) {
  const params = new URLSearchParams();
  if (tierIndex !== null && tierIndex !== undefined) params.set('tier', String(tierIndex));
  if (mode) params.set('mode', mode);
  const qs = params.toString();
  return `/checkout/packages/${packageId}${qs ? `?${qs}` : ''}`;
}

/**
 * Renewal copy for someone who already owns the package. Renewal extends from
 * the current end date (backend change tracked under A11), so nothing is lost.
 */
export function renewalCopy(durationDays, endsAt) {
  const d = formatDuration(durationDays) || 'the new plan';
  const end = formatDate(endsAt);
  return end
    ? `Adds ${d} after your current end date ${end}, so you keep every day you have left.`
    : `Adds ${d} after your current plan ends, so you keep every day you have left.`;
}

/** Packages of one kind ('all' or empty returns the list unchanged). */
export function filterByKind(packages, kind) {
  if (!kind || kind === 'all') return packages || [];
  return (packages || []).filter((p) => packageKind(p) === kind);
}
