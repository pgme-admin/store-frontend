import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Header from './Header';

const footerLink = 'flex items-center min-h-10 text-sm text-text-secondary hover:text-primary active:text-primary no-underline transition-colors';

export default function Layout() {
  return (
    <div className="min-h-dvh flex flex-col relative">
      <Header />

      {/* Main content. At least one screen tall (minus the header), so the
          footer starts below the fold and is never seen sliding away when the
          page's content arrives. */}
      <main className="flex-1 max-w-7xl 2xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 sm:py-8 md:py-10 2xl:py-14 min-h-[calc(100svh-5rem)] sm:min-h-[calc(100svh-6rem)]">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-auto relative">
        <div className="h-0.5 bg-linear-to-r from-primary via-accent to-primary"></div>
        <div className="h-px bg-linear-to-r from-transparent via-border to-transparent"></div>

        <div className="bg-white">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-12 sm:pt-16 2xl:pt-20 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:pb-16 2xl:pb-20">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-x-10 gap-y-8 md:gap-12 2xl:gap-16">
              {/* Brand */}
              <div className="col-span-2 md:col-span-2">
                <div className="flex items-center gap-2.5 mb-5">
                  <img src="/pgme-mark.svg" alt="" aria-hidden="true" width="40" height="40" decoding="async" className="w-10 h-10 shrink-0 rounded-full shadow-sm ring-1 ring-black/5" />
                  <span className="text-lg font-bold text-text font-display">PGME</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                  Your trusted platform for postgraduate medical education resources, courses, and exam preparation.
                </p>
              </div>

              {/* Browse */}
              <div>
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2.5">Browse</h4>
                <div>
                  <Link to="/packages" className={footerLink}>Course Packages</Link>
                  <Link to="/ebooks" className={footerLink}>eBooks</Link>
                  <Link to="/sessions" className={footerLink}>Live Sessions</Link>
                  <Link to="/forms" className={footerLink}>Exam Forms</Link>
                </div>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2.5">Legal</h4>
                <div>
                  <Link to="/terms-and-conditions" className={footerLink}>Terms & Conditions</Link>
                  <Link to="/refund-policy" className={footerLink}>Refund Policy</Link>
                  <Link to="/privacy-policy" className={footerLink}>Privacy Policy</Link>
                </div>
              </div>

              {/* Company */}
              <div className="col-span-2 md:col-span-1">
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2.5">Company</h4>
                <div>
                  <Link to="/about" className={footerLink}>About Us</Link>
                  <Link to="/contact" className={footerLink}>Contact Us</Link>
                  <Link to="/careers" className={footerLink}>Careers</Link>
                  <Link to="/my-purchases" className={footerLink}>My Purchases</Link>
                </div>
              </div>
            </div>

            <div className="border-t border-border-light mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <p className="text-sm text-text-secondary">
                &copy; {new Date().getFullYear()} PGME Medical Education LLP. All rights reserved.
              </p>
              <p className="text-xs text-text-tertiary">
                Access purchased content via the PGME mobile app
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
