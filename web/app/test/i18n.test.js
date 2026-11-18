import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { englishKeys } from '../keys.js';
import { LANGS, pick, prefersFahrenheit } from '../i18n.js';

const keys = englishKeys();
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const files = readdirSync(new URL('../lang/', import.meta.url)).filter((f) => f.endsWith('.js'));

test('every language in LANGS has a table, and every table is in LANGS', () => {
  assert.deepEqual(files.map((f) => f.replace(/\.js$/, '')).sort(), LANGS.filter((l) => l !== 'en').sort());
});

for (const file of files) {
  test(`lang/${file} has every string, with the same placeholders`, async () => {
    const table = (await import(`../lang/${file}`)).default;
    const missing = keys.filter((k) => !(k in table));
    const extra = Object.keys(table).filter((k) => !keys.includes(k));
    assert.deepEqual(missing, [], 'missing');
    assert.deepEqual(extra, [], 'not used any more');
    for (const k of keys) {
      assert.equal(placeholders(table[k]), placeholders(k), `placeholders in ${JSON.stringify(k)}`);
      assert.ok(table[k].trim(), `empty: ${JSON.stringify(k)}`);
    }
  });
}

test('the language picker', () => {
  assert.equal(pick('de-AT'), 'de');
  assert.equal(pick('pt-PT'), 'pt');
  assert.equal(pick('zh-Hans-CN'), 'zh');
  assert.equal(pick('zh-TW'), 'zh-Hant');
  assert.equal(pick('zh-Hant-HK'), 'zh-Hant');
  assert.equal(pick('no'), 'nb');
  assert.equal(pick('nn-NO'), 'nb');
  assert.equal(pick('xx'), null);
});

test('°F only where that is the custom', () => {
  assert.equal(prefersFahrenheit('en-US'), true);
  assert.equal(prefersFahrenheit('es-US'), true);
  assert.equal(prefersFahrenheit('en-GB'), false);
  assert.equal(prefersFahrenheit('de'), false);
});
