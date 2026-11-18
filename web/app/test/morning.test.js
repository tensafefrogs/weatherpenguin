import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morningItems } from '../morning.js';
import { DEFAULT_SETTINGS } from '../rules.js';
import { sampleWeather } from '../samples.js';

const evening = new Date(2026, 10, 17, 21, 0);
const dawn = new Date(2026, 10, 17, 5, 30);

test('off unless a time is set', () => {
  assert.deepEqual(morningItems(sampleWeather('rainLater', evening), { ...DEFAULT_SETTINGS, morning: null }, evening), []);
});

test('in the evening: tomorrow only, from tomorrow\'s forecast', () => {
  const items = morningItems(sampleWeather('hot', evening), { ...DEFAULT_SETTINGS, morning: '07:00' }, evening);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { date: '2026-11-18', time: '07:00', title: 'Hot and showery. Swim cap on.', body: 'Thunderstorms. High of 99.', outfit: 'hot_rain' });
});

test('a forecast from yesterday: only its second day, dated today, and nothing already past', () => {
  const lastNight = new Date(2026, 10, 16, 23, 50);
  const items = morningItems(sampleWeather('hot', lastNight), { ...DEFAULT_SETTINGS, morning: '07:00' }, dawn);
  assert.deepEqual(items.map((i) => [i.date, i.outfit]), [['2026-11-17', 'hot_rain']]);
});

test('before the time: today too, with rain added when the condition doesn\'t say so', () => {
  const items = morningItems(sampleWeather('rainLater', dawn), { ...DEFAULT_SETTINGS, celsius: true, morning: '07:00' }, dawn);
  assert.deepEqual(items.map((i) => i.date), ['2026-11-17', '2026-11-18']);
  assert.deepEqual(items[0], { date: '2026-11-17', time: '07:00', title: 'Raincoat and rain hat today.', body: 'Mostly Cloudy. High of 17.0. Rain likely.', outfit: 'jacket_rain' });
});
