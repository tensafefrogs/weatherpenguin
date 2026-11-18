import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, clampEdge, formatTemp, outfitFor, pages, rainToday, rainTomorrow } from '../rules.js';
import { SAMPLE_NAMES, sampleWeather } from '../samples.js';

test('bands follow v1 defaults and edges', () => {
  assert.equal(outfitFor(7.1, false), 'cold');
  assert.equal(outfitFor(7.2, false), 'jacket');
  assert.equal(outfitFor(20.1, false), 'jacket');
  assert.equal(outfitFor(20.2, true), 'warm_rain');
  assert.equal(outfitFor(32.3, false), 'warm');
  assert.equal(outfitFor(32.4, true), 'hot_rain');
  assert.equal(outfitFor(2, true), 'cold');
  assert.equal(outfitFor(null, false), 'naked');
});

test('v1 rain thresholds', () => {
  const w = (now, nextHour, today, tomorrow) => ({
    current: { temperature: 10, precipitationIntensity: now },
    hourly: [{ precipitationChance: nextHour, precipitationType: 'rain' }],
    daily: [
      { precipitationChance: today, precipitationType: 'rain' },
      { precipitationChance: tomorrow, precipitationType: 'rain' },
    ],
  });
  assert.equal(rainToday(w(0, 0, 0, 0)), false);
  assert.equal(rainToday(w(0.5, 0, 0, 0)), true);
  assert.equal(rainToday(w(0, 0.25, 0, 0)), true);
  assert.equal(rainToday(w(0, 0.24, 0.34, 0)), false);
  assert.equal(rainToday(w(0, 0, 0.35, 0)), true);
  assert.equal(rainTomorrow(w(0, 0, 0, 0.35)), true);
  assert.equal(rainTomorrow(w(0, 0, 0, 0.3)), false);
});

test('snow is not rain', () => {
  const w = { current: { temperature: -2, precipitationIntensity: 2 }, hourly: [{ precipitationChance: 0.9, precipitationType: 'snow' }], daily: [{ precipitationChance: 0.9, precipitationType: 'snow' }] };
  assert.equal(rainToday(w), false);
});

test('pages use current temp today and the high tomorrow', () => {
  const [today, tomorrow] = pages(sampleWeather('rainLater'));
  assert.deepEqual([today.title, today.temp, today.high, today.outfit], ['Today', 15, 17, 'jacket_rain']);
  assert.deepEqual([today.condition, today.rain, today.rainyCondition], ['Mostly Cloudy', true, false]);
  assert.deepEqual([tomorrow.title, tomorrow.temp, tomorrow.low, tomorrow.outfit], ['Tomorrow', 12, 7, 'jacket']);
});

test('every sample produces two pages with real outfits', () => {
  for (const name of SAMPLE_NAMES) {
    for (const p of pages(sampleWeather(name))) assert.notEqual(p.outfit, 'naked', name);
  }
});

test('v1 temperature display, in the user\'s number format', () => {
  assert.equal(formatTemp(15, false), '59');
  assert.equal(formatTemp(15, true), '15.0');
  assert.equal(formatTemp(15.25, true, 'de'), '15,3');
  assert.equal(formatTemp(-3, true, 'fr'), '-3,0');
  assert.equal(formatTemp(null, true), '');
});

test('a condition that already says rain is not repeated', () => {
  const [, tomorrow] = pages(sampleWeather('hot'));
  assert.deepEqual([tomorrow.outfit, tomorrow.rain, tomorrow.rainyCondition], ['hot_rain', true, true]);
});

test('a moved edge stays between its neighbours and inside the slider', () => {
  const s = clampEdge(DEFAULT_SETTINGS, 'coldUpper', 25);
  assert.ok(s.coldUpper < s.warmLower && s.warmLower < s.hotLower);
  assert.equal(clampEdge(DEFAULT_SETTINGS, 'hotLower', 50).hotLower, 37.77);
  assert.equal(clampEdge(DEFAULT_SETTINGS, 'coldUpper', -5).coldUpper, 0);
});
