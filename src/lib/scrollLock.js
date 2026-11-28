/**
 * Page scroll lock for menus and sheets. Reference counted, so two open layers
 * do not unlock each other. While locked, Lenis (desktop wheel smoothing) is
 * paused too: it scrolls the window from script, which overflow: hidden alone
 * does not stop. `scrollbar-gutter: stable` on <html> keeps the page from
 * shifting sideways when the scrollbar goes away.
 */
let lenis = null;
let locks = 0;

export function registerLenis(instance) {
  lenis = instance;
}

export function lockPageScroll() {
  if (typeof document === 'undefined') return () => {};
  if (locks === 0) {
    document.documentElement.style.overflow = 'hidden';
    lenis?.stop();
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      document.documentElement.style.overflow = '';
      lenis?.start();
    }
  };
}
