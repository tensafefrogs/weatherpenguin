import { isNative, post } from './bridge.js';
import { LANG, T, loadLanguage, prefersFahrenheit, translateDocument } from './i18n.js';
import { morningItems } from './morning.js';
import { DEFAULT_SETTINGS, OUTFITS, formatTemp, pages } from './rules.js';
import { RangeSlider } from './range-slider.js';
import { watchLayout } from './layout.js';
import { startStats, track } from './stats.js';
import { sampleWeather } from './samples.js';

const $ = (id) => document.getElementById(id);
const state = { settings: { ...DEFAULT_SETTINGS, morning: null }, weather: null, error: null, loading: true };

/** What the native shell offers, set before the page loads (app/ios: AppModel). Null in a browser. */
const APP = window.WPApp ?? null;

// ---- Native → web --------------------------------------------------------

window.WP = {
  // App Review video only (the app's debug builds, launch argument -sample): sample weather instead of
  // WeatherKit, then a short tour of the app (tour.js). Release builds never call it.
  demo(sample, tour) {
    window.WP.onWeather(sampleWeather(sample, new Date(), T));
    if (tour) import('./tour.js').then((m) => m.runTour());
  },
  onSettings({ defaults, ...s }) {
    // defaults: the app's clothing temperatures for the local climate, when it chose them (Reset goes back to them)
    state.defaults = defaults ?? null;
    state.settings = { ...DEFAULT_SETTINGS, morning: null, ...s };
    render();
    scheduleMorning();
  },
  onLoading() {
    state.loading = true;
    loadingSince = Date.now();
    render();
  },
  onWeather(w) {
    clearTimeout(errorTimer);
    Object.assign(state, { weather: w, error: null, loading: false });
    render();
    const [today] = pages(w, state.settings);
    track(`outfit/${today.outfit}`, { once: true });
    track(`units/${state.settings.celsius ? 'c' : 'f'}`, { once: true });
    scheduleMorning();
  },
  onError(e) {
    track(`error/${e.code}`, { once: true });
    // show "Loading..." for a moment even when it fails at once, so Try Again visibly does something
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      Object.assign(state, { error: e, loading: false });
      render();
    }, Math.max(0, loadingSince + MIN_LOADING_MS - Date.now()));
  },
  /** Whether iOS lets the app send notifications, after the morning reminder was turned on. */
  onReminders(allowed) {
    $('morning-denied').hidden = allowed;
  },
};

// ---- Rendering -------------------------------------------------------------

const temp = (c) => formatTemp(c, state.settings.celsius, LANG);

function render() {
  const main = $('pages');
  const { weather, error } = state;

  if (!weather) {
    // while loading, the loading page, not the last error
    main.replaceChildren(messagePage(state.loading ? null : error));
    $('dots').replaceChildren();
    $('attribution').replaceChildren();
    return;
  }

  const scrollLeft = main.scrollLeft;
  main.replaceChildren(...pages(weather, state.settings).map((p) => dayPage(p, weather.place)));
  main.scrollLeft = scrollLeft;
  renderDots();
  renderAttribution(weather.attribution);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

/** The condition, plus "Rain likely." when the penguin dresses for rain and the condition doesn't say so. */
function summary(p) {
  if (!p.rain || p.rainyCondition) return p.condition;
  return p.condition ? T('{condition}. Rain likely.', { condition: p.condition }) : T('Rain likely.');
}

function dayPage(p, place) {
  const big = temp(p.temp);
  const high = temp(p.high);
  const low = temp(p.low);
  const label = p.high != null ? T('Now {t} degrees', { t: big }) : T('High of {t} degrees', { t: big });
  return el(
    'section',
    { class: `page${p.rain ? ' rain' : ''}`, 'aria-label': T(p.title) },
    // upper and lower: on an iPhone Duo propped up like a laptop, they go on either side of the fold (layout.js)
    el('div', { class: 'upper' },
      el('h1', { class: 'title' }, T(p.title)),
      el('p', { class: 'place' }, place ?? ''),
      el('div', { class: 'penguin-frame' }, el('img', { src: `images/${p.outfit}.png`, alt: T(OUTFITS[p.outfit]) }))),
    el('div', { class: 'lower' },
      el('p', { class: 'temp', 'aria-label': big ? label : null }, big),
      el('p', { class: 'high' }, high ? T('High of {t}', { t: high }) : low ? T('Low of {t}', { t: low }) : ''),
      el('p', { class: 'summary' }, summary(p))),
  );
}

const MIN_LOADING_MS = 600;
let loadingSince = 0;
let errorTimer = 0;

const openAppSettings = () => post({ type: 'openAppSettings' });
const MESSAGES = {
  locationDenied: ['Location Access Denied', 'Please enable location services so the penguin can check your weather.', 'Settings', openAppSettings],
  locationOff: ['Location Services Are Off', 'Turn on Location Services in Settings so the penguin can check your weather.', 'Settings', openAppSettings],
  locationFailed: ['Error', 'Failed to get location.', 'Try Again', () => refresh()],
  offline: ['No Internet', "Weather Penguin doesn't work without internet :(", 'Try Again', () => refresh()],
  weatherFailed: ['Error', "Couldn't get the weather. Please try again in a moment.", 'Try Again', () => refresh()],
};

function messagePage(error) {
  const [title, body, action, onAction] = error
    ? MESSAGES[error.code] ?? MESSAGES.weatherFailed
    : ['Loading...', '', null, null];
  const button = action ? el('button', { class: 'pill', type: 'button' }, T(action)) : null;
  button?.addEventListener('click', onAction);
  return el(
    'section',
    { class: 'page solo' },
    el('div', { class: 'upper' }, el('div', { class: 'penguin-frame' }, el('img', { src: 'images/naked.png', alt: T(OUTFITS.naked) }))),
    el(
      'div',
      { class: 'lower message' },
      el('h1', {}, T(title)),
      body ? el('p', {}, T(body)) : null,
      button,
      // the app's error code from Apple (like "WeatherDaemon.WDSJWTAuthenticatorServiceListener.Errors 2"), for bug reports
      error?.detail ? el('p', { class: 'detail' }, String(error.detail)) : null,
    ),
  );
}

function renderDots() {
  const main = $('pages');
  const count = main.children.length;
  const index = Math.round(main.scrollLeft / Math.max(main.clientWidth, 1));
  if (index === 1) track('view/tomorrow', { once: true });
  $('dots').replaceChildren(...Array.from({ length: count }, (_, i) => el('span', { class: i === index ? 'on' : '' })));
}

/** Apple requires the Apple Weather mark and a link to its data sources. */
function renderAttribution(a) {
  $('settings-attribution').replaceChildren();
  if (new URLSearchParams(location.search).has('shots')) return $('attribution').replaceChildren();
  if (!a) {
    $('attribution').replaceChildren(isNative ? '' : T('Demo weather'));
    return;
  }
  // Apple asks for its mark and a link to the other data sources wherever its weather is shown. The weather page
  // keeps just the small mark, which is the link; Settings shows both. The app is always light, so the light mark.
  $('attribution').replaceChildren(
    el('a', { href: a.legal, 'data-external': '', 'aria-label': `Apple Weather. ${T('Other data sources')}` },
      el('img', { src: a.markLight, alt: '' })),
  );
  $('settings-attribution').replaceChildren(
    el('img', { src: a.markLight, alt: 'Apple Weather' }),
    el('a', { href: a.legal, 'data-external': '' }, T('Other data sources')),
  );
}

// ---- Morning notification (morning.js) ------------------------------------------

function scheduleMorning() {
  if (!APP?.reminders) return;
  post({ type: 'reminders', time: state.settings.morning, items: morningItems(state.weather, state.settings) });
}

// ---- Settings --------------------------------------------------------------

let draft = null;

// v1's four rows. Each handle edits one edge; the neighbouring row moves with it.
/** The three edges, in order, with what VoiceOver calls each handle. */
const EDGES = [['coldUpper', 'Jacket from'], ['warmLower', 'T-shirt from'], ['hotLower', 'Bikini from']];

let slider = null;

function buildSliders() {
  slider = new RangeSlider({
    handles: EDGES.map(([key, label]) => ({ key, label: T(label) })),
    fillFrom: null,
    fillTo: null,
    onInput: (key, shown) => {
      const celsius = draft.celsius ? shown : ((shown - 32) * 5) / 9;
      draft = clampEdge(draft, key, celsius);
      syncSettingsForm();
    },
  });
  $('scale').querySelector('.scale-labels').before(slider.el);
  window.addEventListener('resize', () => $('settings').open && layoutScale());
}

/** Centres each item over its spot (px), at least `size` apart, inside 0..width: a forward then a backward pass. */
function spread(centres, size, width) {
  const out = centres.map((c) => Math.min(width - size / 2, Math.max(size / 2, c)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + size);
  out[out.length - 1] = Math.min(out.at(-1), width - size / 2);
  for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - size);
  return out;
}

/** Puts each penguin over its stretch of the track and each temperature under its handle. */
function layoutScale() {
  const box = $('scale');
  const width = box.clientWidth;
  if (!width || !slider) return;
  const thumb = 28;
  const at = (key) => thumb / 2 + slider.fraction(slider.values[key]) * (width - thumb);
  const edges = EDGES.map(([key]) => at(key));
  const bounds = [thumb / 2, ...edges, width - thumb / 2];
  const penguins = [...box.querySelectorAll('.scale-penguins img')];
  const size = Math.min(64, (width - 6) / 4);
  spread(bounds.slice(0, -1).map((b, i) => (b + bounds[i + 1]) / 2), size + 2, width).forEach((x, i) => {
    penguins[i].style.width = `${size}px`;
    penguins[i].style.left = `${x - size / 2}px`;
  });
  const labels = [...box.querySelectorAll('.scale-labels span')];
  spread(edges, 46, width).forEach((x, i) => (labels[i].style.left = `${x}px`));
}

/** Moves one edge, keeping at least one degree between edges, within v1's 0–37.77 °C range. */
function clampEdge(s, key, c) {
  const gap = s.celsius ? 0.5 : 5 / 9;
  const bounds = {
    coldUpper: [0, s.warmLower - gap],
    warmLower: [s.coldUpper + gap, s.hotLower - gap],
    hotLower: [s.warmLower + gap, 37.77],
  }[key];
  return { ...s, [key]: Math.min(bounds[1], Math.max(bounds[0], c)) };
}

/** The morning notification's preset times; Other time… allows any. */
const MORNING_TIMES = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];
let customTime = false;

function openSettings() {
  draft = { ...state.settings };
  customTime = false;
  $('settings').showModal();
  syncSettingsForm(); // after opening, so the scale can measure its width
}

function syncSettingsForm() {
  const c = draft.celsius;
  // v1 slider range: 0–37.77 °C (32–100 °F), in whole °F or half °C.
  const shown = (v) => (c ? Math.round(v * 2) / 2 : Math.round((v * 9) / 5 + 32));
  const t = (v) => `${formatTemp(v, c, LANG)}°`;
  const values = { coldUpper: shown(draft.coldUpper), warmLower: shown(draft.warmLower), hotLower: shown(draft.hotLower) };
  const range = c ? { min: 0, max: 37.5, step: 0.5 } : { min: 32, max: 100, step: 1 };
  const format = (v) => T('{t} degrees', { t: c ? formatTemp(v, true, LANG) : v });
  slider.update({ ...range, values, format });
  const labels = $('scale').querySelectorAll('.scale-labels span');
  EDGES.forEach(([key], i) => (labels[i].textContent = t(draft[key])));
  layoutScale();
  document.querySelector(`.units input[value=${c ? 'c' : 'f'}]`).checked = true;

  // Off, a preset time, or Other time… with the exact time beside it
  const custom = draft.morning && (customTime || !MORNING_TIMES.includes(draft.morning));
  $('morning-pick').value = !draft.morning ? 'off' : custom ? 'other' : draft.morning;
  $('morning-time').hidden = !custom;
  $('morning-time').value = draft.morning ?? '07:00';
}

function wireSettings() {
  buildSliders();
  for (const radio of document.querySelectorAll('.units input')) {
    radio.addEventListener('change', (e) => {
      draft.celsius = e.target.value === 'c';
      syncSettingsForm();
    });
  }
  $('morning').hidden = !APP?.reminders;
  const clock = new Intl.DateTimeFormat(LANG, { hour: 'numeric', minute: '2-digit' });
  const label = (hhmm) => clock.format(new Date(2000, 0, 1, ...hhmm.split(':').map(Number)));
  $('morning-pick').replaceChildren(
    el('option', { value: 'off' }, T('Off')),
    ...MORNING_TIMES.map((t) => el('option', { value: t }, label(t))),
    el('option', { value: 'other' }, T('Other time…')),
  );
  $('morning-pick').addEventListener('change', (e) => {
    const v = e.target.value;
    customTime = v === 'other';
    draft.morning = v === 'off' ? null : customTime ? draft.morning || $('morning-time').value || '07:00' : v;
    syncSettingsForm();
  });
  $('morning-time').addEventListener('change', (e) => {
    if (draft.morning && e.target.value) draft.morning = e.target.value;
  });
  $('reset').addEventListener('click', () => {
    draft = { ...DEFAULT_SETTINGS, ...state.defaults, celsius: draft.celsius, morning: draft.morning };
    syncSettingsForm();
  });
  $('settings').addEventListener('close', () => {
    if ($('settings').returnValue !== 'done') return;
    const before = state.settings;
    if (Boolean(draft.morning) !== Boolean(before.morning)) track(`morning/${draft.morning ? 'on' : 'off'}`);
    if (draft.celsius !== before.celsius) track(`units/changed-to-${draft.celsius ? 'c' : 'f'}`);
    if (['coldUpper', 'warmLower', 'hotLower'].some((k) => draft[k] !== before[k])) track('settings/temperatures');
    state.settings = draft;
    saveSettings(draft);
    render();
    scheduleMorning();
  });
  $('gear').addEventListener('click', openSettings);
}

// ---- Plumbing --------------------------------------------------------------

function saveSettings(s) {
  if (isNative) return post({ type: 'saveSettings', settings: s });
  try {
    localStorage.setItem('wp.settings', JSON.stringify(s));
  } catch {
    // Private browsing: settings last for this visit only.
  }
}

function refresh() {
  if (isNative) return post({ type: 'refresh' });
  const params = new URLSearchParams(location.search);
  window.WP.onLoading();
  setTimeout(() => {
    const error = params.get('error');
    if (error) window.WP.onError({ code: error });
    else window.WP.onWeather(sampleWeather(params.get('sample') ?? 'warm', new Date(), T));
  }, 150);
}

async function start() {
  startStats({ app: isNative });
  watchLayout();
  await loadLanguage();
  track(`platform/${isNative ? 'ios' : 'web'}`, { once: true });
  track(`lang/${LANG}`, { once: true });
  try {
    if (!localStorage.getItem('wp.started')) {
      localStorage.setItem('wp.started', '1');
      track('start');
    }
  } catch {
    // no storage: skip the first-launch count
  }
  translateDocument();
  wireSettings();
  // iOS shows :active (the button's pressed look) only when the page listens for touches
  document.addEventListener('touchstart', () => {}, { passive: true });
  $('pages').addEventListener('scroll', () => requestAnimationFrame(renderDots), { passive: true });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-external]');
    if (a && isNative) {
      e.preventDefault();
      post({ type: 'openURL', url: a.href });
    }
  });

  if (isNative) {
    post({ type: 'ready' });
    return;
  }
  // In a browser: °F where that's the custom, else °C, until changed in Settings.
  state.settings.celsius = !prefersFahrenheit();
  try {
    const saved = JSON.parse(localStorage.getItem('wp.settings') ?? 'null');
    if (saved) state.settings = { ...state.settings, ...saved };
  } catch {
    // Ignore unreadable settings.
  }
  render();
  refresh();
}

start();
