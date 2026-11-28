import { getPackages, getPackageById } from '../api/packages';
import { packageKind } from '../utils/packageTiers';

/**
 * Read-only lookups that let a package page talk about its siblings: what a
 * combo bundles, and which combo bundles a Theory or Practical package.
 *
 * The list endpoint does not return `bundled_packages` and the detail endpoint
 * does not return the package type, so the two are joined here. Promises are
 * cached for the life of the page: the data used (names, types, thumbnails,
 * prices, bundle membership) is catalogue data, not the viewer's purchases.
 */

let allPackagesPromise = null;
const detailPromises = new Map();

export function loadAllPackages() {
  if (!allPackagesPromise) {
    allPackagesPromise = getPackages()
      .then((r) => r?.packages || r || [])
      .catch((err) => {
        allPackagesPromise = null;
        throw err;
      });
  }
  return allPackagesPromise;
}

export function loadPackageDetail(packageId) {
  const key = String(packageId);
  if (!detailPromises.has(key)) {
    detailPromises.set(
      key,
      getPackageById(key)
        .then((r) => r?.package || r)
        .catch((err) => {
          detailPromises.delete(key);
          throw err;
        })
    );
  }
  return detailPromises.get(key);
}

/**
 * Enrich a combo's `bundled_packages` ({ package_id, name, thumbnail_url })
 * with each package's type and description. `catalog` (list rows already on
 * screen) is used first; anything missing is fetched.
 */
export async function resolveBundledPackages(bundled, catalog = []) {
  if (!bundled?.length) return [];
  const byId = new Map(catalog.map((p) => [String(p.package_id), p]));
  return Promise.all(
    bundled.map(async (b) => {
      let row = byId.get(String(b.package_id));
      let detail = null;
      try {
        detail = await loadPackageDetail(b.package_id);
      } catch {
        detail = null;
      }
      if (!row) {
        try {
          const all = await loadAllPackages();
          row = all.find((p) => String(p.package_id) === String(b.package_id));
        } catch {
          row = null;
        }
      }
      return {
        package_id: b.package_id,
        name: b.name || detail?.name || row?.name || 'Package',
        thumbnail_url: b.thumbnail_url || detail?.thumbnail_url || row?.thumbnail_url || null,
        package_type: row?.package_type || null,
        kind: row ? packageKind(row) : 'other',
        description: detail?.description || row?.description || '',
        duration_days: row?.duration_days || detail?.duration_days || null,
      };
    })
  );
}

/**
 * The same-subject Theory / Practical / Combo siblings of a package, plus the
 * combos that actually bundle it (confirmed from each combo's detail).
 */
export async function loadSiblings(packageId) {
  const all = await loadAllPackages();
  const self = all.find((p) => String(p.package_id) === String(packageId));
  if (!self) return { self: null, siblings: [], combosContaining: [] };
  const siblings = all.filter((p) => p.subject_id === self.subject_id);
  const combos = siblings.filter((p) => packageKind(p) === 'combo' && String(p.package_id) !== String(packageId));
  const details = await Promise.all(combos.map((c) => loadPackageDetail(c.package_id).catch(() => null)));
  const combosContaining = combos
    .map((c, i) => ({ ...c, bundled_packages: details[i]?.bundled_packages || [] }))
    .filter((c) => c.bundled_packages.some((b) => String(b.package_id) === String(packageId)));
  return { self, siblings, combosContaining };
}
