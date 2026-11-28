import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getPackageById, calculateComboUpgrade } from '../api/packages';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import PriceDisplay, { formatPrice } from '../components/PriceDisplay';
import UpsellModal from '../components/UpsellModal';
import TierUpgradeModal from '../components/TierUpgradeModal';
import TierSelector from '../components/TierSelector';
import ComboContents from '../components/ComboContents';
import PackageChoice from '../components/PackageChoice';
import { loadSiblings, resolveBundledPackages } from '../lib/packageCatalog';
import {
  getTiers,
  getPricing,
  parseTierIndex,
  formatDuration,
  formatAccess,
  formatDate,
  renewalCopy,
  packageCheckoutPath,
  tierNameRepeatsDuration,
} from '../utils/packageTiers';

const SIBLING_WAIT_MS = 800;

export default function PackageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isPackagePurchased } = usePurchase();
  const [pkg, setPkg] = useState(null);
  const [selectedTier, setSelectedTier] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Same-subject Theory / Practical / Combo, and what a combo bundles.
  const [siblingInfo, setSiblingInfo] = useState({ self: null, siblings: [], combosContaining: [] });
  const [bundledItems, setBundledItems] = useState([]);
  // The type badge and "Choose your package" come from the sibling request.
  // The page waits briefly for it (never more than SIBLING_WAIT_MS) so they
  // are there on first paint instead of pushing the page down when they land.
  const [siblingsFor, setSiblingsFor] = useState(null);
  const [siblingWaitOverFor, setSiblingWaitOverFor] = useState(null);

  const [upgradeQuote, setUpgradeQuote] = useState(null);
  // "Buy Now" opens the upsell step first, mirroring the app's enrollment
  // dialog, rather than dropping straight into checkout.
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(null);

  const tierParam = searchParams.get('tier');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setUpgradeQuote(null);
    setBundledItems([]);
    (async () => {
      try {
        const result = await getPackageById(id);
        if (cancelled) return;
        const p = result.package || result;
        setPkg(p);
        // A ?tier= link (expiry emails, My Purchases, back from checkout)
        // preselects that plan; an owner otherwise lands on their own plan.
        const fromUrl = parseTierIndex(p, tierParam);
        const owned = parseTierIndex(p, p.current_tier?.tier_index);
        setSelectedTier(fromUrl ?? owned ?? 0);
      } catch {
        if (!cancelled) setError('Failed to load package');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // tierParam is read once per package load; selecting a tier below writes
    // it back to the URL and must not trigger a refetch.
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    loadSiblings(id)
      .then((info) => {
        if (!cancelled) setSiblingInfo(info);
      })
      .catch(() => {
        if (!cancelled) setSiblingInfo({ self: null, siblings: [], combosContaining: [] });
      })
      .finally(() => {
        if (!cancelled) setSiblingsFor(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (loading || siblingsFor === id) return undefined;
    const timer = setTimeout(() => setSiblingWaitOverFor(id), SIBLING_WAIT_MS);
    return () => clearTimeout(timer);
  }, [loading, siblingsFor, id]);

  useEffect(() => {
    if (!pkg?.bundled_packages?.length) return;
    let cancelled = false;
    resolveBundledPackages(pkg.bundled_packages, siblingInfo.siblings)
      .then((items) => {
        if (!cancelled) setBundledItems(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pkg, siblingInfo.siblings]);

  // If this is a combo and the customer already owns part of it, they can pay
  // just the difference. The endpoint itself enforces every eligibility rule
  // (owns none / owns all / already owns the combo), so a rejection here
  // simply means the offer doesn't apply — not an error worth showing.
  useEffect(() => {
    // Only combos can be upgraded into, so skip the lookup entirely for
    // ordinary packages rather than firing a request that always fails.
    if (!isAuthenticated || !pkg?.is_combo) return;
    let cancelled = false;
    (async () => {
      try {
        const quote = await calculateComboUpgrade(id, null);
        if (!cancelled) setUpgradeQuote(quote);
      } catch {
        if (!cancelled) setUpgradeQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, pkg?.is_combo]);

  const siblingsReady = siblingsFor === id || siblingWaitOverFor === id;

  if (loading || (pkg && !error && !siblingsReady)) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !pkg) {
    return <div className="text-center py-12 text-error text-sm">{error || 'Package not found'}</div>;
  }

  const tiers = getTiers(pkg);
  const { tier: currentTier, price, originalPrice, isOnSale, durationDays } = getPricing(pkg, selectedTier);
  const purchased = !!(pkg.is_enrolled || pkg.is_purchased || isPackagePurchased(pkg.package_id || id));
  const ownedTierIndex = parseTierIndex(pkg, pkg.current_tier?.tier_index);
  const ownedTier = ownedTierIndex != null ? tiers[ownedTierIndex] : null;
  const ownedEndsAt = pkg.current_tier?.expires_at || null;
  const ownedDaysLeft = pkg.current_tier?.days_remaining ?? null;
  // The detail endpoint carries no type; the catalogue row does.
  const typeLabel = pkg.type || pkg.package_type || siblingInfo.self?.package_type || (pkg.is_combo ? 'Combo' : null);
  const planName = currentTier?.name && !tierNameRepeatsDuration(currentTier) ? currentTier.name : null;
  const tierIndexForCheckout = tiers ? selectedTier : null;

  // On a combo's own page, show it in the Theory / Practical / Combo row with
  // its own contents, not only combos that contain something else.
  const combosForChoice = pkg.is_combo
    ? [...siblingInfo.combosContaining, { package_id: pkg.package_id || id, bundled_packages: pkg.bundled_packages }]
    : siblingInfo.combosContaining;

  const selectTier = (idx) => {
    setSelectedTier(idx);
    const next = new URLSearchParams(searchParams);
    next.set('tier', String(idx));
    setSearchParams(next, { replace: true });
  };

  const handleBuy = () => {
    if (!isAuthenticated) {
      const search = tiers ? `?tier=${selectedTier}` : '';
      navigate('/login', { state: { from: { pathname: `/packages/${id}`, search } } });
      return;
    }
    navigate(packageCheckoutPath(id, { tierIndex: tierIndexForCheckout }));
  };

  // Renewal is an ordinary purchase of the chosen plan; checkout recognises
  // the existing plan and explains that the new time is added after it.
  const handleRenew = () => {
    navigate(packageCheckoutPath(id, { tierIndex: tierIndexForCheckout }));
  };

  const handleUpgrade = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/packages/${id}` } } });
      return;
    }
    navigate(packageCheckoutPath(id, { tierIndex: tierIndexForCheckout, mode: 'combo' }), {
      state: { upgradeQuote },
    });
  };

  const renewNote = renewalCopy(durationDays, ownedEndsAt);
  const ownedPlanLabel = ownedTier
    ? formatDuration(ownedTier.duration_days) || ownedTier.name
    : pkg.current_tier?.tier_name || null;

  return (
    <>
    <div className="animate-fade-in-up">
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
        {/* Header card */}
        <div className="gradient-hero rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-12 text-white mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white opacity-[0.06]" />
          <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-white opacity-[0.06] -translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white opacity-[0.06]" />
          <div className="relative">
            {typeLabel && (
              <span className="inline-flex items-center text-xs font-medium bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full mb-3">
                {typeLabel}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-bold font-display mb-1">{pkg.name}</h1>
            {tiers && tiers.length > 1 ? (
              <p className="text-white/70 text-sm">
                {tiers.length} plans: {tiers.map((t) => formatDuration(t.duration_days) || t.name).join(' or ')}
              </p>
            ) : (
              durationDays && <p className="text-white/70 text-sm">{formatAccess(durationDays)}</p>
            )}
            {pkg.is_combo && bundledItems.length > 0 && (
              <p className="text-white/80 text-sm mt-1">
                Includes {bundledItems.map((b) => b.package_type || b.name).join(' + ')}
              </p>
            )}
          </div>
        </div>

        {/* Thumbnail Banner */}
        {pkg.thumbnail_url && (
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 aspect-video max-h-80 w-full bg-surface-dim">
            <img
              src={pkg.thumbnail_url}
              alt={pkg.name}
              width="1280"
              height="720"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 2xl:gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            {/* Theory / Practical / Combo */}
            <PackageChoice
              currentId={pkg.package_id || id}
              siblings={siblingInfo.siblings}
              combosContaining={combosForChoice}
            />

            {/* Tier selection */}
            {tiers && tiers.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-border p-5 sm:p-6">
                <TierSelector
                  tiers={tiers}
                  selected={selectedTier}
                  onSelect={selectTier}
                  ownedTierIndex={purchased ? ownedTierIndex : null}
                  label={purchased ? 'Choose a plan to renew or extend' : 'Choose your plan'}
                />
              </div>
            )}

            {/* Combo contents */}
            {pkg.is_combo && <ComboContents items={bundledItems} />}

            {/* Description */}
            {pkg.description && (
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-base font-semibold text-text mb-3 pb-2 border-b border-border">Description</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{pkg.description}</p>
              </div>
            )}

            {/* Bought before and the access ended (refund, dispute): buyable
                again like for anyone. A quiet line, never "revoked". */}
            {!purchased && pkg.previous_access_ended && (
              <p className="lg:hidden text-xs text-text-secondary">Your earlier access to this package ended.</p>
            )}

            {/* Features */}
            {pkg.features?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-base font-semibold text-text mb-4 pb-2 border-b border-border">What's Included</h3>
                <ul className="space-y-3">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-text-secondary">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mobile: the renewal explanation needs more room than the sticky bar has. */}
            {purchased && (
              <div className="lg:hidden bg-white rounded-xl shadow-sm border border-border p-5">
                <OwnedSummary planLabel={ownedPlanLabel} endsAt={ownedEndsAt} daysLeft={ownedDaysLeft} />
                <p className="text-xs text-text-secondary leading-relaxed mt-3 pt-3 border-t border-border">
                  <span className="font-semibold text-text">Renew / Extend: </span>{renewNote}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar - Desktop sticky CTA */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-xl border border-border p-6 shadow-md">
              {purchased ? (
                <>
                  <OwnedSummary planLabel={ownedPlanLabel} endsAt={ownedEndsAt} daysLeft={ownedDaysLeft} />

                  <div className="mt-5 pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-text mb-2">Renew / Extend</h3>
                    {tiers && (
                      <p className="text-xs text-text-secondary mb-1.5">
                        {formatDuration(durationDays) || currentTier?.name} plan{planName ? ` · ${planName}` : ''}
                      </p>
                    )}
                    <PriceDisplay price={price} originalPrice={originalPrice} isOnSale={isOnSale} size="lg" />
                    <p className="text-xs text-text-secondary leading-relaxed mt-2">{renewNote}</p>
                    <button onClick={handleRenew} className="btn-primary w-full mt-4 !py-3.5">
                      Renew / Extend — {formatPrice(price)}
                    </button>
                  </div>

                  {/* Owning it isn't the end of the road: a longer tier or the
                      combo that bundles it may still be worth showing. */}
                  <button
                    onClick={() => setUpgradeTarget({ package_id: id, name: pkg.name })}
                    className="btn-outline w-full mt-3 !py-2.5 justify-center text-xs sm:text-sm"
                  >
                    Upgrade Plan
                  </button>
                  <p className="text-[11px] text-text-tertiary mt-2 text-center leading-relaxed">
                    Upgrade switches you now to a bigger plan or the Combo, with your unused days credited.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-text mb-4 pb-2 border-b border-border">Order Summary</h3>
                  {tiers && (
                    <p className="text-xs font-semibold text-text mb-1.5">
                      {formatDuration(durationDays) || currentTier?.name} plan
                      {planName && <span className="font-normal text-text-secondary"> · {planName}</span>}
                    </p>
                  )}
                  <PriceDisplay price={price} originalPrice={originalPrice} isOnSale={isOnSale} size="lg" />
                  <TesterPriceNote pkg={pkg} />
                  {durationDays && (
                    <p className="text-xs text-text-secondary mt-2">{formatAccess(durationDays)}</p>
                  )}
                  {pkg.previous_access_ended && (
                    <p className="text-xs text-text-secondary mt-2">Your earlier access to this package ended.</p>
                  )}

                  {/* Combo upgrade: they already own part of this bundle, so
                      charge only the difference. */}
                  {upgradeQuote ? (
                    <>
                      <div className="mt-4 rounded-lg bg-success/8 border border-success/25 p-3">
                        <p className="text-xs font-semibold text-success mb-1.5">
                          You already own part of this combo
                        </p>
                        <div className="flex items-center justify-between text-xs text-text-secondary">
                          <span>Credit applied</span>
                          <span className="text-success font-semibold">
                            −{formatPrice(upgradeQuote.credit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-success/20">
                          <span className="text-xs font-semibold text-text">You pay</span>
                          <span className="text-sm font-bold text-primary">
                            {formatPrice(upgradeQuote.upgrade_base_price)}
                          </span>
                        </div>
                      </div>
                      <button onClick={handleUpgrade} className="btn-primary w-full mt-4 !py-3.5">
                        {upgradeQuote.is_free_upgrade
                          ? 'Unlock Combo — Free'
                          : `Upgrade for ${formatPrice(upgradeQuote.upgrade_base_price)}`}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setUpsellOpen(true)}
                      className="btn-primary w-full mt-5 !py-3.5"
                    >
                      Buy Now
                    </button>
                  )}
                  <p className="text-xs text-text-tertiary mt-3 text-center">Secure payment via Zoho</p>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>

      {/* Mobile sticky bottom CTA */}
      {purchased ? (
        <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5">
            {/* The desktop sidebar carries this too; on mobile the sticky bar
                is the only control, so it must offer the upgrade as well. */}
            <button
              onClick={() => setUpgradeTarget({ package_id: id, name: pkg.name })}
              className="btn-outline shrink-0 !py-3 !px-3.5 text-xs"
            >
              Upgrade
            </button>
            <button onClick={handleRenew} className="btn-primary flex-1 min-w-0 !py-3 text-sm">
              <span className="truncate">Renew / Extend — {formatPrice(price)}</span>
            </button>
          </div>
        </div>
      ) : (
        <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="min-w-0">
              <PriceDisplay price={price} originalPrice={originalPrice} isOnSale={isOnSale} size="lg" />
              <TesterPriceNote pkg={pkg} compact />
              {tiers && durationDays && (
                <p className="text-[11px] text-text-secondary">{formatAccess(durationDays)}</p>
              )}
            </div>
            <button onClick={() => setUpsellOpen(true)} className="btn-primary flex-1 !py-3">
              Buy Now
            </button>
          </div>
        </div>
      )}
      <div className="h-20 sm:h-24 lg:hidden" />

      <TierUpgradeModal
        open={!!upgradeTarget}
        purchase={upgradeTarget}
        onClose={() => setUpgradeTarget(null)}
      />

      <UpsellModal
        open={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        onContinue={handleBuy}
        packageId={id}
        isCombo={!!pkg.is_combo}
        productName={pkg.name}
        productType={typeLabel}
        description={pkg.description}
        features={pkg.features || []}
        price={price}
        originalPrice={originalPrice}
        isOnSale={isOnSale}
        durationDays={durationDays}
        planName={planName}
        tierIndex={tierIndexForCheckout}
        bundledItems={bundledItems}
      />
    </>
  );
}

function OwnedSummary({ planLabel, endsAt, daysLeft }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-sm font-semibold text-success">You own this package</span>
      </div>
      {(planLabel || endsAt) && (
        <p className="text-xs text-text">
          {planLabel && <>Current plan: <span className="font-semibold">{planLabel}</span></>}
          {planLabel && endsAt && ' · '}
          {endsAt && <>ends <span className="font-semibold">{formatDate(endsAt)}</span></>}
          {daysLeft != null && <span className="text-text-secondary"> ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} left)</span>}
        </p>
      )}
      <p className="text-xs text-text-secondary leading-relaxed mt-1">Open the PGME app to access it.</p>
    </div>
  );
}

/**
 * A tester account pays INR 1 for every checkout (27 Nov 2026). The API adds
 * is_test / test_price only for a signed-in tester, so nobody else sees this.
 */
function TesterPriceNote({ pkg, compact = false }) {
  if (!pkg?.is_test) return null;
  return (
    <p className={`${compact ? 'text-[11px] mt-0.5' : 'text-xs mt-2'} inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-text`}>
      Tester price: {formatPrice(pkg.test_price ?? 1)}
    </p>
  );
}
