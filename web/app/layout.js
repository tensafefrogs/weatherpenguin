// Screen shapes beyond a phone held upright. Sets classes on <html> for style.css:
//   two-up   Today and Tomorrow side by side (iPad, an iPhone Duo opened flat, sideways phones)
//   fold-v   iPhone Duo held like a book: Today on the left page, Tomorrow on the right
//   fold-h   iPhone Duo propped up like a laptop: penguins on the upright half, the text on the flat half
// --fold-a is where the fold starts and --fold-w its width, in CSS pixels.
//
// Where the fold is: the iOS app reports it (window.WP.onFold, from reservedRegions in app/ios), other
// foldables through the browser's viewport segments, and ?fold=h or ?fold=v fakes one across the middle of
// the screen, for testing and the store screenshots. As in tensafefrogs/king-walk.

/** Wide enough for two penguins side by side. */
const TWO_UP = 640;

import { track } from './stats.js';

const fake = (location.search.match(/[?&]fold=([vh])/) || [])[1];
let appFold = null;

function foldRect() {
  if (appFold) return appFold;
  const seg = window.viewport?.segments;
  if (seg?.length === 2) {
    const [a, b] = seg;
    return Math.abs(a.top - b.top) < 2
      ? { x: a.right, y: 0, w: Math.max(0, b.left - a.right), h: innerHeight }
      : { x: 0, y: a.bottom, w: innerWidth, h: Math.max(0, b.top - a.bottom) };
  }
  if (fake === 'v') return { x: innerWidth / 2, y: 0, w: 0, h: innerHeight };
  if (fake === 'h') return { x: 0, y: innerHeight / 2, w: innerWidth, h: 0 };
  return null;
}

export function applyLayout() {
  const root = document.documentElement;
  const f = foldRect();
  const kind = f ? (f.w > f.h ? 'h' : 'v') : '';
  root.classList.toggle('fold-v', kind === 'v');
  root.classList.toggle('fold-h', kind === 'h');
  const twoUp = Boolean(kind) || innerWidth >= TWO_UP;
  root.classList.toggle('two-up', twoUp);
  track(`layout/${kind === 'v' ? 'duo-book' : kind === 'h' ? 'duo-laptop' : twoUp ? 'two-up' : 'phone'}`, { once: true });
  if (kind) {
    root.style.setProperty('--fold-a', `${Math.max(0, kind === 'v' ? f.x : f.y)}px`);
    root.style.setProperty('--fold-w', `${Math.max(0, kind === 'v' ? f.w : f.h)}px`);
  }
}

export function watchLayout() {
  window.WP = window.WP ?? {};
  /** From the app: the fold in CSS pixels, or null when the phone is closed or fully open. */
  window.WP.onFold = (r) => {
    appFold = r && (r.w > 0 || r.h > 0 || r.x > 0 || r.y > 0) ? r : null;
    applyLayout();
  };
  addEventListener('resize', applyLayout);
  applyLayout();
}
