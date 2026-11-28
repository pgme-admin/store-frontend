import { Link } from 'react-router-dom';
import { KIND_LABEL } from '../utils/packageTiers';

function Thumb({ src, alt, className }) {
  return src ? (
    <img src={src} alt={alt} className={`object-cover ${className}`} loading="lazy" />
  ) : (
    <div className={`bg-surface-dim flex items-center justify-center ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary/50">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    </div>
  );
}

function typeLabel(item) {
  return item.package_type || (item.kind && item.kind !== 'other' ? KIND_LABEL[item.kind] : null);
}

/**
 * What a combo bundles. `items` come from resolveBundledPackages().
 *
 *   variant="full"    — package page: thumbnail, type, name, description, link.
 *   variant="compact" — cards: one "Includes" line with mini thumbnails. Not
 *                       interactive, since cards are themselves buttons.
 */
export default function ComboContents({ items, variant = 'full', onNavigate }) {
  if (!items?.length) return null;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 mb-3">
        <div className="flex -space-x-2 shrink-0">
          {items.slice(0, 3).map((it) => (
            <Thumb key={it.package_id} src={it.thumbnail_url} alt="" className="w-7 h-7 rounded-md border-2 border-white" />
          ))}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold text-text">
            Includes {items.length} {items.length === 1 ? 'package' : 'packages'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-text-secondary truncate">
            {items.map((it) => typeLabel(it) || it.name).join(' + ')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text mb-1">This combo includes</h3>
      <p className="text-xs text-text-secondary mb-4 pb-3 border-b border-border">
        One purchase gives you full access to all {items.length} packages below, for the plan you choose.
      </p>
      <ul className="space-y-4">
        {items.map((it) => {
          const type = typeLabel(it);
          return (
            <li key={it.package_id}>
              <Link
                to={`/packages/${it.package_id}`}
                onClick={onNavigate}
                className="flex items-start gap-3 sm:gap-4 rounded-lg p-2 -m-2 hover:bg-surface-dim transition-colors no-underline"
              >
                <Thumb src={it.thumbnail_url} alt={it.name} className="w-20 sm:w-24 aspect-video rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  {type && (
                    <span className="inline-block text-[10px] sm:text-[11px] font-semibold text-primary bg-primary/6 px-2 py-0.5 rounded-full mb-1">
                      {type}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-text leading-snug">{it.name}</p>
                  {it.description && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mt-0.5">{it.description}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
