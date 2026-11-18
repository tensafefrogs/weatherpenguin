// Anonymous usage counts with GoatCounter (no cookies, nothing that identifies anyone), as in
// tensafefrogs/king-walk. Only when config.js has a GoatCounter address; docs/STATS.md lists the events.
// The website counts page views; the app sends only events (no page view, it's always the same page).

const CONFIG = Object.assign({ goatcounter: '' }, globalThis.WP_CONFIG || {});
const queue = [];
let timer = 0;
let prefix = 'weatherpenguin/';
const sent = new Set();

/** Loads GoatCounter's script. app: true in the iOS app (events only, under weatherpenguin-ios/). */
export function startStats({ app = false } = {}) {
  if (!CONFIG.goatcounter || typeof document === 'undefined') return;
  prefix = app ? 'weatherpenguin-ios/' : 'weatherpenguin/';
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = CONFIG.goatcounter;
  if (app) s.dataset.goatcounterSettings = '{"no_onload":true}';
  document.head.append(s);
}

/** Counts an event, e.g. track('outfit/jacket_rain'). once: at most once per visit (per launch in the app). */
export function track(name, { once = false } = {}) {
  if (!CONFIG.goatcounter) return;
  if (once) {
    if (sent.has(name)) return;
    sent.add(name);
  }
  queue.push(name);
  flush();
}

function flush() {
  try {
    const gc = globalThis.goatcounter;
    if (gc?.count) {
      while (queue.length) {
        const n = queue.shift();
        gc.count({ path: prefix + n, title: n, event: true });
      }
      return;
    }
  } catch {
    return;
  }
  // count.js may still be loading: try for a minute, then give up quietly (blocked, offline)
  if (!timer && queue.length) {
    let tries = 0;
    timer = setInterval(() => {
      if (++tries > 60 || globalThis.goatcounter?.count) {
        clearInterval(timer);
        timer = 0;
        if (tries <= 60) flush();
        else queue.length = 0;
      }
    }, 1000);
  }
}

/** For tests. */
export const _queue = queue;
