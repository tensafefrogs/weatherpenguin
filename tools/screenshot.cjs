// Screenshots pages of web/ at iPhone 17 size (393×852 @3x), or another device named before the path.
//
//   node tools/screenshot.cjs <out-dir> <path>...   e.g. app/?sample=hot index.html ipad:app/?sample=cold
//   devices: phone, phone-land, ipad, ipad-land, slideover, duo (open flat), duo-land (open flat, sideways), duo-book (?fold=v), duo-table (?fold=h)
//
// Serves web/ itself on a free port. Needs Playwright (NODE_PATH to it).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', 'web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(data);
  });
});

(async () => {
  const [outDir, ...pages] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const DEVICES = {
    phone: [393, 852, 3], 'phone-land': [852, 393, 3], ipad: [1032, 1376, 2], 'ipad-land': [1376, 1032, 2],
    slideover: [320, 1000, 2], duo: [669, 951, 3], 'duo-book': [669, 951, 3, 'fold=v'], 'duo-table': [951, 669, 3, 'fold=h'], 'duo-land': [951, 669, 3],
  };
  for (const arg of pages) {
    const [device, rest] = /^[a-z-]+:/.test(arg) && !arg.startsWith('app/') ? [arg.split(':')[0], arg.slice(arg.indexOf(':') + 1)] : ['phone', arg];
    const [width, height, deviceScaleFactor, q] = DEVICES[device];
    const p = q ? rest.replace(/(\?|$)/, (m) => (m ? `?${q}&` : `?${q}`)) : rest;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error(`${p}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && console.error(`${p}: ${m.text()}`));
    await page.goto(base + p);
    await page.waitForTimeout(600);
    const [file, action] = p.split('#');
    if (action === 'tomorrow') await page.evaluate(() => document.getElementById('pages').scrollTo({ left: 9999 }));
    if (action === 'settings') await page.click('#gear');
    await page.waitForTimeout(300);
    const name = (device === 'phone' ? '' : device + '_') + rest.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') + '.png';
    await page.screenshot({ path: path.join(outDir, name), fullPage: !file.startsWith('app') });
    console.log(path.join(outDir, name));
    await ctx.close();
  }
  await browser.close();
  server.close();
})();
