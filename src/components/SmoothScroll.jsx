import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import { registerLenis } from '../lib/scrollLock';

let lenis;

// Lenis only smooths mouse-wheel scrolling (touch stays native), so phones and
// tablets skip it and its per-frame loop; so do people who ask for less motion.
function wantsSmoothWheel() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !touchOnly && !reduced;
}

export default function SmoothScroll({ children }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!wantsSmoothWheel()) return undefined;
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      smoothTouch: false,
    });
    registerLenis(lenis);

    let rafId;
    function raf(time) {
      if (!lenis) return;
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      registerLenis(null);
      lenis.destroy();
      lenis = null;
    };
  }, []);

  // Scroll to top on route change, at once (the page is new; no glide).
  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [pathname]);

  return children;
}
