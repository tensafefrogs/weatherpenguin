import { test } from 'node:test';
import assert from 'node:assert/strict';

test('nothing is queued without a GoatCounter address', async () => {
  globalThis.WP_CONFIG = { goatcounter: '' };
  const { track, _queue } = await import('../stats.js?empty');
  track('start');
  assert.equal(_queue.length, 0);
});

test('events go to GoatCounter under the app prefix, once-only events once', async () => {
  globalThis.WP_CONFIG = { goatcounter: 'https://example.goatcounter.com/count' };
  const sent = [];
  globalThis.goatcounter = { count: (e) => sent.push(e) };
  const { track } = await import('../stats.js?configured');
  track('outfit/jacket', { once: true });
  track('outfit/jacket', { once: true });
  track('morning/on');
  assert.deepEqual(sent.map((e) => [e.path, e.event]), [['weatherpenguin/outfit/jacket', true], ['weatherpenguin/morning/on', true]]);
  delete globalThis.goatcounter;
});
