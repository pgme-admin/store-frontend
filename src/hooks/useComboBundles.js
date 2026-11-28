import { useEffect, useState } from 'react';
import { loadPackageDetail, resolveBundledPackages } from '../lib/packageCatalog';
import { packageKind } from '../utils/packageTiers';

/**
 * For a list of packages (list-endpoint rows), resolve what each combo bundles
 * so combo cards can show their contents. Only combo-typed rows are looked up,
 * one cached detail request each.
 *
 * Returns { [package_id]: [{ package_id, name, thumbnail_url, package_type, kind }] }.
 */
export default function useComboBundles(packages) {
  const [bundles, setBundles] = useState({});

  useEffect(() => {
    const combos = (packages || []).filter((p) => packageKind(p) === 'combo');
    if (combos.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        combos.map(async (c) => {
          try {
            const detail = await loadPackageDetail(c.package_id);
            const resolved = await resolveBundledPackages(detail?.bundled_packages || [], packages);
            return [String(c.package_id), resolved];
          } catch {
            return [String(c.package_id), []];
          }
        })
      );
      if (!cancelled) setBundles(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [packages]);

  return bundles;
}
