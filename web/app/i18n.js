// Translations. Text the user sees goes through T("English text"); each language's table is
// lang/<tag>.js (English text → translation), loaded only for the language in use. A missing
// key shows in English. {name} placeholders are filled in from T's second argument.
//
// The language: ?lang=de (tests, screenshots), else the first of the browser's or iOS's
// preferred languages that has a table. In the app, iOS picks from CFBundleLocalizations
// (app/ios/project.yml), which lists the same languages.

export const LANGS = ['en', 'da', 'de', 'es', 'fi', 'fr', 'it', 'ja', 'ko', 'nb', 'nl', 'pl', 'pt', 'ru', 'sv', 'zh', 'zh-Hant'];

let table = {};
export let LANG = 'en';

/** The table for a BCP 47 tag such as "pt-BR", "zh-TW" or "no", or null. */
export function pick(tag) {
  const t = String(tag).toLowerCase();
  if (/^zh-(hant|tw|hk|mo)/.test(t)) return 'zh-Hant';
  if (t.startsWith('zh')) return 'zh';
  if (/^(nb|no|nn)\b/.test(t)) return 'nb';
  const base = t.split('-')[0];
  return LANGS.includes(base) ? base : null;
}

export async function loadLanguage() {
  const asked = new URLSearchParams(location.search).get('lang');
  const prefs = asked ? [asked] : navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  LANG = prefs.map(pick).find(Boolean) ?? 'en';
  document.documentElement.lang = LANG;
  if (LANG !== 'en') table = (await import(`./lang/${LANG}.js`)).default;
}

export function T(text, vars = {}) {
  const s = table[text] ?? text;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Translates the page's static text: data-t (text), data-t-label (aria-label). The English is the key. */
export function translateDocument(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) el.textContent = T(el.dataset.t || el.textContent.trim());
  for (const el of root.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', T(el.dataset.tLabel));
}

/** Whether a region uses °F by default (the United States and a few others). */
export function prefersFahrenheit(tag = navigator.language) {
  const region = (String(tag).match(/-([A-Z]{2})\b/) || [])[1];
  return ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'].includes(region);
}
