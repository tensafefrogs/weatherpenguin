// Every English string the app shows, for the translation tables and their test (test/i18n.test.js).
// Strings passed to T() as literals are found in the source; this adds the ones passed indirectly.
import { readFileSync } from 'node:fs';
import { OUTFITS, ADVICE } from './rules.js';
import { CONDITION_TEXT } from './samples.js';

const here = new URL('.', import.meta.url);
const read = (f) => readFileSync(new URL(f, here), 'utf8');

export function englishKeys() {
  const keys = new Set(['Today', 'Tomorrow', 'Loading...', ...Object.values(OUTFITS), ...Object.values(ADVICE), ...Object.values(CONDITION_TEXT)]);
  for (const file of ['main.js', 'morning.js']) {
    const src = read(file);
    // T('…') / T("…") literals
    for (const m of src.matchAll(/\bT\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) keys.add(m[2].replace(/\\(['"])/g, '$1'));
    // the error messages and slider labels, passed through T() by variable
    for (const block of src.matchAll(/const (?:MESSAGES|EDGES) = [\[{]([\s\S]*?)\n?[\]}];/g)) {
      for (const m of block[1].matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)) {
        const s = m[2].replace(/\\(['"])/g, '$1');
        if (/[A-Z]/.test(s[0])) keys.add(s);
      }
    }
  }
  // the page's static text
  const html = read('index.html');
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-t(?=[\s>])[^>]*>([^<]+)</g)) keys.add(m[2].trim());
  for (const m of html.matchAll(/data-t-label="([^"]+)"/g)) keys.add(m[1]);
  keys.delete('');
  return [...keys].sort();
}

if (process.argv[1] === new URL(import.meta.url).pathname) console.log(JSON.stringify(englishKeys(), null, 2));
