import { packageKind, KIND_LABEL, KIND_ORDER } from '../utils/packageTiers';

/**
 * All / Theory / Practical / Combo filter for a package list. Only kinds that
 * actually appear are offered; with fewer than two there is nothing to choose.
 */
export default function PackageKindTabs({ packages, value, onChange, className = '' }) {
  const counts = {};
  (packages || []).forEach((p) => {
    const k = packageKind(p);
    counts[k] = (counts[k] || 0) + 1;
  });
  const kinds = KIND_ORDER.filter((k) => counts[k]);
  if (kinds.length < 2) return null;

  const options = [{ key: 'all', label: 'All', count: packages.length }, ...kinds.map((k) => ({ key: k, label: KIND_LABEL[k], count: counts[k] }))];

  return (
    <div role="tablist" aria-label="Package type" className={`flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide pb-1 -mx-1 px-1 ${className}`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-10 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-[color,background-color,border-color,transform] active:scale-[0.97] cursor-pointer ${
              active
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-secondary border-border hover:border-primary/40 hover:text-text'
            }`}
          >
            {o.label}
            <span className={`text-[10px] sm:text-[11px] font-medium ${active ? 'text-white/75' : 'text-text-tertiary'}`}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
