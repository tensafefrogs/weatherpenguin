// Makes the App Store screenshots: the app (web/app) with sample weather on each device Apple asks for:
// iPhone 6.9" (1320x2868), iPad 13" (2064x2752) and iPhone Duo's inner screen (2007x2853; open flat, held like a
// book and propped up like a laptop, the fold faked with ?fold=v|h as in web/app/layout.js).
// usage: node app/ios/store/screenshots.js [--lang <App Store locale>]   Needs Playwright (NODE_PATH or installed).
// English goes to app/ios/store/screenshots/<device>-<n>.png (committed; listing.json lists them).
// --lang de-DE: the app in German, to screenshots/l10n/de-DE/ (not committed: the App Store listing
// workflow makes them, then uploads them to that language's page).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const LOCALE = process.argv[process.argv.indexOf('--lang') + 1] && process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : '';
// App Store locale → the app's language table (web/app/i18n.js)
const LANG = { 'zh-Hans': 'zh', 'zh-Hant': 'zh-Hant', no: 'nb' }[LOCALE] || (LOCALE ? LOCALE.split('-')[0] : 'en');
const DEVICES = {
  iphone: { viewport: [440, 956], scale: 3, shots: [
    { n: 1, q: 'sample=rainLater', c: 'today' }, { n: 2, q: 'sample=hot', swipe: true, c: 'tomorrow' },
    { n: 3, q: 'sample=cold', c: 'handDrawn' }, { n: 4, q: 'sample=warm', settings: true, c: 'settings' },
    { n: 5, image: 'widgets', c: 'widgets' }] },
  ipad: { viewport: [1032, 1376], scale: 2, shots: [
    { n: 1, q: 'sample=rainLater', c: 'today' }, { n: 2, q: 'sample=hot', c: 'sideBySide' },
    { n: 3, q: 'sample=cold', c: 'handDrawn' }, { n: 4, q: 'sample=warm', settings: true, c: 'settings' }] },
  // the iMessage sticker pack's own page on the App Store (Apple requires an iPhone and an iPad 13" set for it)
  imessage: { viewport: [440, 956], scale: 3, shots: [{ n: 1, stickers: 2, c: 'stickers' }] },
  'imessage-ipad': { viewport: [1032, 1376], scale: 2, shots: [{ n: 1, stickers: 4, c: 'stickers' }] },
  duo: { viewport: [669, 951], scale: 3, shots: [
    { n: 1, q: 'sample=rainLater', c: 'sideBySide' }, { n: 2, q: 'sample=hot&fold=v', c: 'book' },
    { n: 3, q: 'sample=cold&fold=h', viewport: [951, 669], c: 'laptop' }] },
};
// Each picture: the caption (captions.json) above the real screen, on Sky, at the size Apple asks for.
// n: 5 on iPhone is the widgets sheet the Store widget screenshots workflow makes (screenshots/widgets/).
const CAPTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'captions.json'), 'utf8'));
const caption = (key) => (CAPTIONS[LOCALE || 'en-US'] || CAPTIONS['en-US'])[key];
// The frame: the app's Link blue (docs/DESIGN.md), so the Sky screen stands out from it, with white captions a
// step heavier than the app's text (thin white on blue thins out). WP_FRAME=yellow|sky|navy tries another.
const FRAMES = { blue: { bg: '#1f5fbf', ink: '#fff', weight: 300 }, yellow: { bg: '#ffff96', ink: '#000', weight: 200 },
  sky: { bg: '#d8e2ff', ink: '#000', weight: 200 }, navy: { bg: '#24304f', ink: '#fff', weight: 300 } };
const FRAME = FRAMES[process.env.WP_FRAME || 'blue'];
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const root = path.join(__dirname, '..', '..', '..', 'web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data)));
});

// The frame: a flat colour, the caption in Inter (sentence case), and the screen below it with rounded corners and a
// hairline outline. No gradients or shadows.
// The eight stickers (app/ios/Stickers, the hand-drawn penguins cropped) as the Messages sticker drawer shows them:
// a grid on white, `columns` across.
const STICKERS = path.join(__dirname, '..', 'Stickers', 'Stickers.xcassets', 'Sticker Pack.stickerpack');
async function stickerSheet(browser, width, height, scale, columns) {
  const pngs = fs.readdirSync(STICKERS).filter((d) => d.endsWith('.sticker')).sort()
    .map((d) => fs.readdirSync(path.join(STICKERS, d)).filter((f) => f.endsWith('.png')).map((f) => path.join(STICKERS, d, f))[0]);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const cell = Math.floor((width - 48) / columns);
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;background:#fff;display:grid;
    grid-template-columns:repeat(${columns},${cell}px);justify-content:center;align-content:center;gap:0">
    ${pngs.map((p) => `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" style="width:${cell}px;height:${cell}px;object-fit:contain">`).join('')}
  </body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const png = await page.screenshot();
  await ctx.close();
  return png;
}

async function frame(browser, base, width, height, scale, text, png, file) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const wide = width > height;
  const top = Math.round(height * (wide ? 0.19 : 0.15));
  const room = height - top - Math.round(height * 0.03);
  const size = Math.round(Math.min(width, height) * (wide ? 0.06 : 0.075));
  await page.goto(base);   // same origin as the font
  await page.setContent(`<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><style>
    @font-face { font-family: Inter; src: url(${base}fonts/Inter.woff2) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; height: 100%; background: ${FRAME.bg}; overflow: hidden; }
    body { font-family: Inter, -apple-system, 'Noto Sans CJK JP', 'Noto Sans CJK KR', 'Noto Sans CJK SC', sans-serif; }
    h1 { position: absolute; left: 6%; right: 6%; top: 0; height: ${top}px; margin: 0; display: flex; align-items: center;
      justify-content: center; text-align: center; text-wrap: balance; font-weight: ${FRAME.weight}; font-size: ${size}px; line-height: 1.15; color: ${FRAME.ink}; }
    img { position: absolute; top: ${top}px; left: 50%; transform: translateX(-50%); height: ${room}px; max-width: 92%;
      object-fit: contain; border-radius: ${Math.round(size * 0.9)}px; outline: 1.5px solid rgba(0,0,0,.25); }
  </style></head><body><h1>${esc(text)}</h1><img src="data:image/png;base64,${png.toString('base64')}"></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('img').complete);
  await page.screenshot({ path: file });
  await ctx.close();
}

(async () => {
  const out = LOCALE ? path.join(__dirname, 'screenshots', 'l10n', LOCALE) : path.join(__dirname, 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/app/`;
  const browser = await chromium.launch();
  let failed = false;
  for (const [device, d] of Object.entries(DEVICES)) for (const s of d.shots) {
    const [width, height] = s.viewport || d.viewport;
    const file = path.join(out, `${device}-${s.n}.png`);
    let screen;
    if (s.stickers) {
      screen = await stickerSheet(browser, width, height, d.scale, s.stickers);
    } else if (s.image) {
      const src = path.join(__dirname, 'screenshots', s.image, `${LOCALE || 'en-US'}.png`);
      if (!fs.existsSync(src)) { console.log(`skipped ${file}: no ${src} (run the Store widget screenshots workflow)`); continue; }
      screen = fs.readFileSync(src);
    } else {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: d.scale, isMobile: true, hasTouch: true,
      reducedMotion: 'reduce', locale: LANG === 'en' ? 'en-US' : LANG,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { failed = true; console.error(`shot ${s.n}: ${e.message}`); });
    await page.goto(`${base}?${s.q}&lang=${LANG}&shots=1`);
    await page.waitForSelector('.page img');
    await page.evaluate(() => document.fonts.ready);
    if (s.swipe) {   // once the forecast has drawn Tomorrow too (the loading page comes first)
      await page.waitForFunction(() => document.querySelectorAll('#pages .page').length > 1);
      await page.evaluate(() => { const p = document.getElementById('pages'); p.scrollLeft = p.scrollWidth; });
    }
    if (s.settings) await page.click('#gear');
    await page.waitForTimeout(400);
    screen = await page.screenshot();
    await ctx.close();
    }
    await frame(browser, base, width, height, d.scale, caption(s.c), screen, file);
    console.log(file);
  }
  await browser.close();
  server.close();
  if (failed) process.exit(1);
})();
