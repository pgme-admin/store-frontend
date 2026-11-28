import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getEbookById, getEbookSample, getEbookSamplePreview } from '../api/ebooks';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { formatPrice } from '../components/PriceDisplay';
import SampleHtml from '../components/SampleHtml';

const messageFor = (err) => {
  const status = err?.response?.status;
  if (status === 404) return { title: 'No free sample', text: 'This eBook does not have a free sample right now.', retry: false };
  if (status === 400) return { title: 'eBook not found', text: 'The link does not lead to an eBook.', retry: false };
  if (status === 429) return { title: 'Too many requests', text: 'Wait a minute, then try again.', retry: true };
  return { title: 'The sample could not be loaded', text: 'Check your connection and try again.', retry: true };
};

/** /ebooks/:id/sample - read the first pages of an eBook before buying it. */
export default function EbookSample() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isEbookPurchased } = usePurchase();

  const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
  const [book, setBook] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null); // { url, format } for samples that open as a file
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const request = useRef(0);
  const heading = useRef(null);
  const moved = useRef(false);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await getEbookSamplePreview(id, page);
      if (mine !== request.current) return;
      setPreview(next);
      document.title = `${next.title}: free sample | PGME`;
    } catch (err) {
      if (mine !== request.current) return;
      // A page past the end (an old link): start again from the first
      if (err?.response?.data?.error_code === 'NO_SUCH_PAGE' && page > 1) {
        setParams({}, { replace: true });
        return;
      }
      setError(messageFor(err));
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [id, page, setParams]);

  useEffect(() => {
    load();
    return () => { request.current += 1; };
  }, [load]);

  // Price for the buy button. The sample still reads without it.
  useEffect(() => {
    let live = true;
    setBook(null);
    getEbookById(id).then((r) => { if (live) setBook(r.book || r); }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    const before = document.title;
    return () => { document.title = before; };
  }, []);

  // A sample without pages to show here opens as a file (a PDF shows in the page)
  const asFile = !!preview && !preview.available;
  const isPdf = asFile && preview.format === 'pdf';
  const openFile = useCallback(async () => {
    setOpening(true);
    setOpenError('');
    try {
      const sample = await getEbookSample(id);
      setFile(sample);
      return sample;
    } catch (err) {
      setOpenError(messageFor(err).text);
      return null;
    } finally {
      setOpening(false);
    }
  }, [id]);
  useEffect(() => { if (isPdf) openFile(); }, [isPdf, openFile]);

  const total = preview?.total_pages || 0;
  const isLast = !!preview?.available && page >= total;

  const goTo = useCallback((next) => {
    if (next < 1 || (total && next > total)) return;
    moved.current = true;
    setParams(next > 1 ? { page: String(next) } : {}, { replace: true });
    window.scrollTo(0, 0);
  }, [total, setParams]);

  // After turning a page, start reading from its heading
  useEffect(() => {
    if (!loading && moved.current && preview?.available) {
      moved.current = false;
      heading.current?.focus({ preventScroll: true });
    }
  }, [loading, preview]);

  useEffect(() => {
    if (!preview?.available) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.target.closest?.('.sample-table')) return; // arrows scroll a wide table
      if (e.key === 'ArrowRight') goTo(page + 1);
      if (e.key === 'ArrowLeft') goTo(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, page, goTo]);

  const purchased = isEbookPurchased(id);
  const price = book ? book.effective_price || book.price : null;
  const buy = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/ebooks/${id}` } } });
      return;
    }
    navigate(`/checkout/ebooks/${id}`);
  };
  const title = preview?.title || book?.title || 'Free sample';

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto h-14 sm:h-16 px-3 sm:px-6 flex items-center gap-2 sm:gap-4">
          <Link to={`/ebooks/${id}`} className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl text-text hover:bg-surface-dim no-underline" aria-label="Back to the eBook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-text truncate">{title}</p>
            {title !== 'Free sample' && <p className="text-xs text-text-secondary">Free sample</p>}
          </div>
          {!error && (purchased
            ? <span className="shrink-0 text-xs sm:text-sm font-semibold text-success">Owned</span>
            : (
              <button type="button" onClick={buy} className="btn-primary shrink-0 px-4! py-2.5! text-sm!">
                <span className="sm:hidden">Buy</span>
                <span className="hidden sm:inline">{price != null ? `Buy for ${formatPrice(price)}` : 'Buy eBook'}</span>
              </button>
            ))}
        </div>
        {preview?.available && total > 1 && (
          <div className="h-0.5 bg-border-light" role="progressbar" aria-label="Sample read" aria-valuemin={1} aria-valuemax={total} aria-valuenow={Math.min(page, total)}>
            <div className="h-full w-full bg-primary origin-left transition-transform duration-200" style={{ transform: `scaleX(${Math.min(page, total) / total})` }} />
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
        {error ? (
          <div role="alert" className="max-w-md mx-auto text-center py-16">
            <h1 className="text-lg font-semibold text-text mb-2">{error.title}</h1>
            <p className="text-sm text-text-secondary mb-6">{error.text}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {error.retry && <button type="button" onClick={load} className="btn-primary">Try again</button>}
              <Link to={`/ebooks/${id}`} className="btn-outline no-underline">Back to the eBook</Link>
            </div>
          </div>
        ) : !preview || (loading && preview.page !== page && preview.available) ? (
          <div role="status" aria-label="Loading the sample" className="max-w-2xl mx-auto space-y-4 py-4">
            <div className="skeleton h-7 w-2/3 rounded-lg" />
            {[100, 96, 99, 92, 97, 60].map((w) => <div key={w} className="skeleton h-4 rounded-lg" style={{ width: `${w}%` }} />)}
            <div className="skeleton h-44 w-full rounded-xl" />
            {[98, 94, 70].map((w) => <div key={w} className="skeleton h-4 rounded-lg" style={{ width: `${w}%` }} />)}
          </div>
        ) : asFile ? (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-lg sm:text-xl font-bold text-text mb-2">Free sample of {title}</h1>
            <p className="text-sm text-text-secondary mb-5">
              {/* No file format (PDF, EPUB) for students: Aviraj, 28 Nov 2026 */}
              {isPdf ? 'If the sample does not show below, open it in a new tab.' : 'This sample opens in the PGME app or any e-book reader.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button
                type="button"
                className="btn-outline"
                disabled={opening}
                onClick={async () => {
                  const sample = await openFile(); // links expire, so ask for a fresh one
                  if (sample?.url) window.location.assign(sample.url);
                }}
              >
                {opening ? 'Getting the sample…' : isPdf ? 'Open the sample' : 'Download the sample'}
              </button>
              {openError && <p role="alert" className="text-sm text-error">{openError}</p>}
            </div>
            {isPdf && file?.url && <iframe title={`Free sample of ${title}`} src={file.url} className="hidden sm:block w-full h-[75dvh] rounded-xl border border-border" />}
            <EndOfSample purchased={purchased} price={price} onBuy={buy} id={id} pages={book?.pages} />
          </div>
        ) : (
          <article className="max-w-2xl mx-auto">
            <h1 ref={heading} tabIndex={-1} className="sr-only">{`${preview.page_title || title}, part ${page} of ${total} of the free sample`}</h1>
            {preview.page_titles?.length > 1 && (
              <nav aria-label="Parts of the sample" className="mb-6">
                <label htmlFor="sample-part" className="sr-only">Go to a part of the sample</label>
                <select id="sample-part" value={page} onChange={(e) => goTo(Number(e.target.value))} className="w-full h-11 rounded-xl border border-border bg-white px-3 text-sm text-text">
                  {preview.page_titles.map((name, i) => <option key={`${i}-${name}`} value={i + 1}>{name || `Part ${i + 1}`}</option>)}
                </select>
              </nav>
            )}
            <SampleHtml html={preview.html} />
            {page === 1 && preview.images_omitted > 0 && (
              <p className="mt-6 text-xs text-text-secondary">Some large pictures are left out of this sample. They are in the full eBook.</p>
            )}
            {isLast && <EndOfSample purchased={purchased} price={price} onBuy={buy} id={id} pages={book?.pages} />}
          </article>
        )}
      </main>

      {preview?.available && !error && total > 1 && (
        <nav aria-label="Sample pages" className="sticky bottom-0 z-30 bg-white border-t border-border pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-2xl mx-auto px-3 sm:px-8 py-2.5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1 || loading} className="btn-outline px-5! py-2.5! text-sm! disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <p className="text-sm text-text-secondary tabular-nums" aria-live="polite">{`${Math.min(page, total)} of ${total}`}</p>
            {isLast && !purchased
              ? <button type="button" onClick={buy} className="btn-primary px-5! py-2.5! text-sm!">Buy eBook</button>
              : <button type="button" onClick={() => goTo(page + 1)} disabled={isLast || loading} className="btn-primary px-5! py-2.5! text-sm!">Next</button>}
          </div>
        </nav>
      )}
    </div>
  );
}

function EndOfSample({ purchased, price, onBuy, id, pages }) {
  return (
    <section aria-labelledby="sample-end" className="mt-10 rounded-2xl border border-border bg-surface-dim p-6 sm:p-8 text-center">
      <h2 id="sample-end" className="text-lg sm:text-xl font-bold text-text">{purchased ? 'You own this eBook' : 'You have reached the end of the free sample'}</h2>
      <p className="text-sm text-text-secondary mt-2 mb-5">
        {purchased
          ? 'Open the PGME app to read the full eBook.'
          : `Buy the eBook to keep reading${pages ? ` all ${pages} pages` : ''} in the PGME app.`}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {!purchased && <button type="button" onClick={onBuy} className="btn-primary w-full sm:w-auto">{price != null ? `Buy for ${formatPrice(price)}` : 'Buy eBook'}</button>}
        <Link to={`/ebooks/${id}`} className="btn-outline w-full sm:w-auto no-underline">Back to the eBook</Link>
      </div>
    </section>
  );
}
