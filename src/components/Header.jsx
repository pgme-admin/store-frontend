import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { lockPageScroll } from '../lib/scrollLock';

// The full nav needs about 760px between the logo and the account controls;
// below this width the menu button takes over (at 768-1279 the links ran into
// the logo and the Login / account button).
const DESKTOP_NAV_QUERY = '(min-width: 1280px)';

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const displayName = user?.name || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const phone = user?.phone_number ? `+91 ${user.phone_number}` : '';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="flex items-center gap-2.5 min-h-11 px-1.5 sm:px-3.5 py-1.5 rounded-xl transition-colors duration-200 bg-transparent border-0 cursor-pointer hover:bg-surface-dim active:bg-surface-dim"
      >
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <div className="text-sm font-medium text-text leading-tight truncate max-w-28">{displayName}</div>
          {phone && <div className="text-[11px] text-text-secondary leading-tight mt-0.5 whitespace-nowrap">{phone}</div>}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
          className={`text-text-tertiary hidden sm:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2.5 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-border shadow-lg py-1.5 animate-slide-down z-50">
          <div className="px-4 py-3.5 border-b border-border-light">
            <div className="text-sm font-semibold text-text truncate">{displayName}</div>
            {phone && <div className="text-xs text-text-secondary mt-1">{phone}</div>}
          </div>
          <div className="py-1.5">
            <Link
              to="/my-purchases"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 min-h-11 px-4 py-2.5 text-sm text-text hover:bg-surface-dim active:bg-surface-dim rounded-lg mx-1.5 transition-colors no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              My Purchases
            </Link>
            <Link
              to="/invoices"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 min-h-11 px-4 py-2.5 text-sm text-text hover:bg-surface-dim active:bg-surface-dim rounded-lg mx-1.5 transition-colors no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              My Invoices
            </Link>
          </div>
          <div className="border-t border-border-light mx-3"></div>
          <div className="py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); logout(); }}
              className="w-[calc(100%-12px)] min-h-11 text-left mx-1.5 px-4 py-2.5 text-sm text-error hover:bg-error/5 active:bg-error/5 rounded-lg transition-colors bg-transparent border-0 cursor-pointer flex items-center gap-3"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  // Hide on scroll down, show on scroll up. Read once per frame, ignore small
  // moves and the rubber-band bounce past either end of the page, so the bar
  // never flickers.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 10);
      if (y <= 0) {
        setHidden(false);
        lastScrollY.current = 0;
        return;
      }
      if (y >= max - 1) return;
      const delta = y - lastScrollY.current;
      if (Math.abs(delta) < 8) return;
      setHidden(delta > 0 && y > 80);
      lastScrollY.current = y;
    };
    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // While the menu is open: the page behind stays put, Escape closes it, and
  // it closes by itself if the window grows wide enough for the full nav.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const unlock = lockPageScroll();
    const handleKey = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const wide = window.matchMedia ? window.matchMedia(DESKTOP_NAV_QUERY) : null;
    const handleWide = (e) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    wide?.addEventListener?.('change', handleWide);
    return () => {
      unlock();
      document.removeEventListener('keydown', handleKey);
      wide?.removeEventListener?.('change', handleWide);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { to: '/home', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/packages', label: 'Packages' },
    { to: '/ebooks', label: 'eBooks' },
    { to: '/sessions', label: 'Live Sessions' },
    { to: '/workshops', label: 'Workshops' },
    ...(isAuthenticated
      ? [{ to: '/my-purchases', label: 'My Purchases' }]
      : [{ to: '/contact', label: 'Contact' }]),
    { to: '/careers', label: 'Careers' },
  ];

  const isActive = (path) => location.pathname.startsWith(path);
  const headerHidden = hidden && !mobileMenuOpen;

  return (
    <>
      {/* Tap outside the open menu to close it. Outside the header, whose
          transform would otherwise pin this to the header box. */}
      <div
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
        className={`xl:hidden fixed inset-0 z-[45] bg-black/20 transition-opacity duration-200 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <header
        onFocusCapture={() => setHidden(false)}
        className={`sticky top-0 z-50 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))] px-4 sm:px-6 lg:px-10 2xl:px-16 pb-3 sm:pb-4 pointer-events-none transition-transform duration-300 ease-out ${headerHidden ? '-translate-y-full' : 'translate-y-0'}`}
      >
        <div className="max-w-350 2xl:max-w-[1700px] mx-auto pointer-events-auto relative">
          <div className={`flex items-center justify-between gap-3 h-14 sm:h-16 pl-3 pr-2 sm:px-6 lg:px-8 rounded-full border border-white/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-[background-color] duration-300 ${
            scrolled || mobileMenuOpen ? 'bg-white/70' : 'bg-white/40'
          }`}>
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 min-h-11 no-underline shrink-0 rounded-full">
              <img
                src="/pgme-mark.svg"
                alt=""
                aria-hidden="true"
                width="36"
                height="36"
                decoding="async"
                className="w-9 h-9 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
              />
              <span className="text-base sm:text-lg font-bold text-text font-display tracking-tight">PGME</span>
            </Link>

            {/* Nav links (center) */}
            <nav aria-label="Main" className="hidden xl:flex flex-1 min-w-0 items-center justify-center gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                  className={`inline-flex items-center min-h-10 px-3.5 2xl:px-5 py-2 text-sm 2xl:text-base font-medium whitespace-nowrap no-underline rounded-full transition-colors duration-200 ${
                    isActive(link.to)
                      ? 'text-primary font-semibold'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {isAuthenticated ? (
                <UserMenu user={user} logout={logout} />
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-2 min-h-11 px-5 sm:px-6 py-2 sm:py-2.5 text-sm font-semibold text-white bg-primary rounded-full no-underline transition-[box-shadow,transform] duration-300 hover:shadow-[0_4px_20px_rgba(0,0,200,0.3)] hover:scale-105 active:scale-[0.97]"
                >
                  Login
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              )}

              {/* Menu button (below the full-nav width) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-controls="site-menu"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                className="xl:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-text-secondary hover:text-text active:bg-black/5 transition-colors duration-200 bg-transparent border-0 cursor-pointer"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  {mobileMenuOpen ? (
                    <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
                  ) : (
                    <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu: always mounted so it can animate out as well as in */}
          <div
            id="site-menu"
            className={`xl:hidden absolute left-0 right-0 top-full mt-3 z-50 origin-top transition-[opacity,transform,visibility] duration-200 ease-out ${
              mobileMenuOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible pointer-events-none'
            }`}
          >
            <nav
              aria-label="Menu"
              data-lenis-prevent
              className="bg-white border border-gray-200 rounded-2xl shadow-xl p-2 sm:p-3 space-y-0.5 max-h-[calc(100dvh-6.5rem)] overflow-y-auto overscroll-contain"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                  className={`flex items-center min-h-12 px-4 text-[15px] font-medium rounded-xl no-underline transition-colors ${
                    isActive(link.to)
                      ? 'text-primary bg-primary/5 font-semibold'
                      : 'text-text-secondary hover:text-text hover:bg-surface-dim active:bg-surface-dim'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <>
                  <div className="border-t border-border/30 mx-2 my-2" />
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center min-h-12 px-4 text-[15px] font-semibold text-primary rounded-xl no-underline active:bg-primary/5"
                  >
                    Login
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
