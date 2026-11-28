/**
 * Placeholders in the shape of the product cards they stand in for (cover,
 * tag, title, price row), so a grid keeps its layout while it loads.
 */
export default function CardSkeletons({ count, cover = 'aspect-video', className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-border/60 overflow-hidden">
          <div className={`skeleton rounded-none ${cover}`} />
          <div className="p-3.5 sm:p-5 space-y-2.5">
            <div className="skeleton h-3 w-16 rounded-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-8 w-12 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
