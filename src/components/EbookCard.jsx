import { Link } from 'react-router-dom';
import { formatPrice } from './PriceDisplay';

export default function EbookCard({ book, purchased, onClick }) {
  const price = book.effective_price || book.price;
  const showSample = !!book.has_sample && !purchased;
  const discount = !purchased && book.is_on_sale && book.original_price && book.original_price > price
    ? Math.round(((book.original_price - price) / book.original_price) * 100)
    : null;
  const discountBadge = (where) => (
    <span className={`${where} text-[10px] sm:text-xs font-semibold bg-white text-accent-dark px-2 py-0.5 rounded-full shadow-sm`}>
      {discount}% off
    </span>
  );

  const card = (
    <button
      type="button"
      onClick={onClick}
      className="tap-press group relative flex flex-col w-full h-full text-left bg-white rounded-2xl border border-border/60 overflow-hidden hover:shadow-lg hover:border-primary/20 duration-200 cursor-pointer"
    >
      {/* Cover image */}
      <div className="relative bg-surface-dim">
        {book.thumbnail_url ? (
          <div className="aspect-3/4 overflow-hidden">
            {/* The whole cover, never cropped (a cover's title often runs edge to edge) */}
            <img
              src={book.thumbnail_url}
              alt={book.title}
              width="300"
              height="400"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="aspect-3/4 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary/30">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              <path d="M8 7h6" />
              <path d="M8 11h8" />
            </svg>
          </div>
        )}
        {/* Badges */}
        {purchased && (
          <span className="absolute top-2.5 right-2.5 text-[10px] sm:text-xs font-semibold bg-success text-white px-2 py-0.5 rounded-full shadow-sm">
            Owned
          </span>
        )}
        {discount != null && !showSample && discountBadge('absolute top-2.5 left-2.5')}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4">
        {/* Subject tag */}
        {book.subject && (
          <span className="self-start text-[9px] sm:text-[10px] font-medium text-primary bg-primary/6 px-1.5 py-0.5 rounded-full mb-2">
            {book.subject.name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-xs sm:text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-3 leading-snug mb-1.5 break-words">
          {book.title}
        </h3>

        {/* Author */}
        {book.author && (
          <p className="text-[10px] sm:text-xs text-text-tertiary line-clamp-1 mb-2">
            by {book.author}
          </p>
        )}

        {/* Price — pushed to bottom */}
        <div className="mt-auto pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
          {purchased ? (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-success">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Owned
            </span>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-text">{formatPrice(price)}</span>
                {book.is_on_sale && book.original_price && book.original_price > price && (
                  <span className="text-[10px] sm:text-xs text-text-tertiary line-through">{formatPrice(book.original_price)}</span>
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
  if (!showSample) return card;

  // A link cannot sit inside the card's button, so it is laid over the top of
  // the cover, where a tap in the middle of the card never reaches it. The
  // "% off" badge shares its row and wraps instead of colliding on narrow cards.
  return (
    <div className="relative flex">
      {card}
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start gap-1.5 p-2 pointer-events-none">
        {discount != null && discountBadge('mt-0.5 ml-0.5')}
        <Link
          to={`/ebooks/${book.book_id}/sample`}
          aria-label={`Read a free sample of ${book.title}`}
          className="pointer-events-auto ml-auto min-h-10 px-3 inline-flex items-center justify-center rounded-lg bg-white/95 border border-border text-xs sm:text-sm font-semibold text-primary no-underline shadow-sm hover:bg-white active:bg-white"
        >
          Free sample
        </Link>
      </div>
    </div>
  );
}
