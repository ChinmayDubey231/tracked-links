import type { MouseEvent } from 'react';

/**
 * Click handler for links to a section on the same page (to="#id" or href="#id"): glides to the section
 * without putting #id in the address, so a reload starts at the top again rather than mid-page.
 * Smooth unless the visitor asks for reduced motion. Focus moves to the section, as a plain anchor
 * would, so keyboard users carry on from there. Ctrl, Shift or middle clicks still open the link normally.
 */
export function scrollToSection(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const id = decodeURIComponent(event.currentTarget.hash.slice(1));
  const section = id ? document.getElementById(id) : null;
  if (!section) return;

  event.preventDefault();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
  section.focus({ preventScroll: true });
}
