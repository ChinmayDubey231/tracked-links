import { useEffect, useRef } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from './lib/auth';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import DocumentPage from './pages/documents/DocumentPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import EditLinkPage from './pages/links/EditLinkPage';
import LinkPage from './pages/links/LinkPage';
import NewLinkPage from './pages/links/NewLinkPage';
import { ViewerPlaceholder } from './pages/Placeholders';
import { HelpPage, NotFoundPage, PrivacyPage, TermsPage } from './pages/public/InfoPages';
import LandingPage from './pages/public/LandingPage';

/**
 * After client-side navigation, move focus so keyboard and screen reader users start in the right place:
 * the section a #hash link points at (as a plain anchor would), otherwise the new page's main region.
 * preventScroll leaves the scrolling, smooth on the landing page, to ScrollRestoration.
 */
function FocusOnNavigate() {
  const { pathname, hash } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const section = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (section && !section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
    (section ?? document.getElementById('main'))?.focus({ preventScroll: true });
  }, [pathname, hash]);
  return null;
}

/**
 * Opening or reloading a page starts at the top (or at the #section the address names) instead of where
 * it was last scrolled. Back and forward inside the app still return to the same place: React Router
 * keeps those positions in memory.
 *
 * Two things would otherwise restore the old position on a reload: React Router's copy in sessionStorage
 * (cleared here), and the browser's own restore, which React Router switches back on as the page unloads
 * (switched off here, before the first render, so the old position never flashes up).
 */
const SCROLL_STORAGE_KEY = 'tracked-links-scroll';
window.history.scrollRestoration = 'manual';
try {
  sessionStorage.removeItem(SCROLL_STORAGE_KEY);
} catch {
  // Storage blocked (private mode, site data off): nothing was saved, so nothing to clear.
}

function Root() {
  return (
    <>
      <Outlet />
      <ScrollRestoration storageKey={SCROLL_STORAGE_KEY} />
      <FocusOnNavigate />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        path: '/login',
        element: (
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        ),
      },
      {
        path: '/signup',
        element: (
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        ),
      },
      { path: '/help', element: <HelpPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/v/:slug', element: <ViewerPlaceholder /> },
      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: '/documents', element: <DocumentsPage /> },
          { path: '/documents/:id', element: <DocumentPage /> },
          { path: '/documents/:id/links/new', element: <NewLinkPage /> },
          { path: '/links/:id', element: <LinkPage /> },
          { path: '/links/:id/edit', element: <EditLinkPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
