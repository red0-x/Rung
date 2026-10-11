import { useEffect, useState, type MouseEvent } from 'react';

// Tiny pathname router: history.pushState + popstate. No dependency.
const EVENT = 'rung:navigate';

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (to === current) return;
  if (opts.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVENT));
  if (!opts.replace) window.scrollTo(0, 0);
}

export interface Location {
  path: string;
  search: URLSearchParams;
}

function read(): Location {
  return { path: window.location.pathname.replace(/\/+$/, '') || '/', search: new URLSearchParams(window.location.search) };
}

export function useLocation(): Location {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('popstate', on);
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  return loc;
}

/** onClick for <a href>: client-side navigation for plain left clicks, normal browser behavior otherwise. */
export function linkClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('/') || e.currentTarget.target) return;
  e.preventDefault();
  navigate(href);
}

/** Redirect during render without a flash: navigates after commit. */
export function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}
