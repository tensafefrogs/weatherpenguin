// The trailers and the App Store app preview: the app (web/app) with sample weather, played frame by frame and cut
// into short shots with a caption each, the app in a phone-shaped window on the store screenshots' blue, joined with
// crossfades, over quiet music (tools/music.py). A title card (the website's umbrella penguin) opens it and an end card closes it. Adapted from King
// Walk's and Spark's trailers (tensafefrogs/king-walk, scripts/trailer.js).
// Filming is frame by frame on a stepped clock (CLOCK below), so the motion is even however slowly the machine draws:
// every frame of the video is one thirtieth of a second of the app.
// usage: node tools/trailer.js [--vertical | --preview]     Needs Playwright (NODE_PATH or installed) and ffmpeg.
// Output: web/press/weather-penguin-trailer.mp4 (1920x1080) or web/press/weather-penguin-trailer-vertical.mp4
// (1080x1920), each with a poster .jpg. --preview makes the App Store app preview instead:
// app/ios/store/previews/iphone-1.mp4 (886x1920, 15 to 30 seconds, a silent stereo track, no URL or price on screen;
// no title or end card, and no Apple Watch, since it plays on iPhone pages).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const preview = process.argv.includes('--preview');
const vertical = preview || process.argv.includes('--vertical');
// page size in CSS pixels and scale; the app is a phone (gw x gh) scaled by s, at (x, top)
const F = preview ? { w: 443, h: 960, dpr: 2, gw: 390, gh: 844, s: 0.92, top: 150, name: 'iphone-1' }
  : vertical ? { w: 540, h: 960, dpr: 2, gw: 390, gh: 844, s: 0.92, top: 150, name: 'weather-penguin-trailer-vertical' }
  : { w: 1280, h: 720, dpr: 1.5, gw: 390, gh: 844, s: 0.78, top: 31, name: 'weather-penguin-trailer' };
F.x = vertical ? Math.round((F.w - F.gw * F.s) / 2) : 250;
const OUT = preview ? path.join(ROOT, 'app', 'ios', 'store', 'previews') : path.join(ROOT, 'web', 'press');
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-trailer-'));
const FPS = 30, FADE = 0.6;

// CLOCK runs in the stage and in the app's frame before anything else (copied from King Walk's, which copied Spark's).
// It replaces the clock, timers and requestAnimationFrame with ones that follow real time, until __vt.enter(): from then
// time only moves when __vt.tick(ms) says so, which also runs due timers and frame callbacks and moves CSS animations.
const CLOCK = `(()=>{let C;const isTop=window.top===window;
  try{C=isTop?(window.__clock=window.__clock||{virtual:false,v:0,off:0,dv:0,doff:0,wins:[],rpn:performance.now.bind(performance),rdn:Date.now.bind(Date)}):window.top.__clock;}catch(e){return;}
  if(!C)return;
  const now=()=>C.virtual?C.v:C.rpn()+C.off;
  const rRAF=window.requestAnimationFrame.bind(window),rCAF=window.cancelAnimationFrame.bind(window),rSI=window.setInterval.bind(window);
  performance.now=now;Date.now=()=>Math.round(C.virtual?C.dv:C.rdn()+C.doff);
  let rid=0;const rafq=new Map(),real=new Map();
  window.requestAnimationFrame=cb=>{const id=++rid;if(C.virtual)rafq.set(id,cb);else real.set(id,rRAF(()=>{real.delete(id);cb(now());}));return id;};
  window.cancelAnimationFrame=id=>{rafq.delete(id);if(real.has(id)){rCAF(real.get(id));real.delete(id);}};
  let tid=0;const timers=new Map();
  const add=(fn,d,args,every)=>{const id=++tid;d=Math.max(0,+d||0);timers.set(id,{fn,due:now()+d,d:Math.max(1,d),args,every});return id;};
  window.setTimeout=(fn,d,...a)=>add(fn,d,a,false);window.setInterval=(fn,d,...a)=>add(fn,d,a,true);
  window.clearTimeout=window.clearInterval=id=>{timers.delete(id);};
  const due=()=>{const n=now();for(let i=0;i<500;i++){let best=null,bid=0;for(const [id,t] of timers)if(t.due<=n&&(!best||t.due<best.due)){best=t;bid=id;}
    if(!best)return;if(best.every)best.due=Math.max(best.due+best.d,n-best.d);else timers.delete(bid);
    try{if(typeof best.fn==='function')best.fn(...best.args);}catch(e){console.error(e);}}};
  rSI(()=>{if(!C.virtual)due();},4);
  const anims=()=>{for(const a of document.getAnimations()){
    if(a.__t0===undefined){a.__t0=C.v-(Number(a.currentTime)||0);try{a.pause();}catch(e){}}
    const t=C.v-a.__t0,end=a.effect?a.effect.getComputedTiming().endTime:Infinity;
    try{if(t>=end)a.finish();else a.currentTime=t;}catch(e){}}};
  C.wins.push({doc:document,
    run(){due();const q=[...rafq.values()];rafq.clear();for(const cb of q)try{cb(C.v);}catch(e){console.error(e);}anims();},
    leave(){for(const a of document.getAnimations())if(a.__t0!==undefined){delete a.__t0;try{if(a.playState==='paused')a.play();}catch(e){}}
      const q=[...rafq.values()];rafq.clear();for(const cb of q)window.requestAnimationFrame(cb);}});
  if(isTop)window.__vt={
    enter(){C.v=now();C.dv=Date.now();C.virtual=true;},
    leave(){C.off=C.v-C.rpn();C.doff=C.dv-C.rdn();C.virtual=false;for(const w of C.wins)if(w.doc.defaultView)w.leave();},
    tick(ms){C.v+=ms;C.dv+=ms;C.wins=C.wins.filter(w=>w.doc.defaultView);for(const w of C.wins)w.run();}};
})();`;

const data = (f, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, f)).toString('base64')}`;
const FONTS = `@font-face{font-family:Inter;font-weight:100 900;src:url(${data('web/app/fonts/Inter.woff2', 'font/woff2')})}
@font-face{font-family:Hand;src:url(${data('web/fonts/SueEllenFrancisco-Regular.ttf', 'font/ttf')})}`;
const UMBRELLA = data('web/img/main_umbrella.png', 'image/png');
const WIDGETS = data('app/ios/store/screenshots/widgets/en-US.png', 'image/png');
const WATCH = data('app/ios/store/screenshots/watch/en-US/watch-1.png', 'image/png');
const BLUE = '#1f5fbf', SKY = '#d8e2ff';

const CARD = (end) => `<div class="art"><img class="umbrella" src="${UMBRELLA}" alt=""><h1>Weather Penguin</h1></div>
  <h2>${end ? 'Free on the App Store' : 'What to wear, at a glance.'}</h2>
  ${end ? '<p>iPhone, iPad and Apple Watch</p><p class="url">weatherpenguin.com</p>' : ''}`;

const STAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${FONTS}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${BLUE};color:#fff;font-family:Inter,system-ui,sans-serif}
#win{position:absolute;left:${F.x}px;top:${F.top}px;width:${F.gw * F.s}px;height:${F.gh * F.s}px;border-radius:${vertical ? 30 : 26}px;overflow:hidden;
  outline:1.5px solid rgba(0,0,0,.25);background:${SKY};opacity:0;transition:opacity .7s ease}
#win.on{opacity:1}
#scale{position:relative;width:${F.gw}px;height:${F.gh}px;transform:scale(${F.s});transform-origin:0 0}
iframe{width:${F.gw}px;height:${F.gh}px;border:0;display:block;background:${SKY}}
#still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}
#watch{position:absolute;left:${F.x + (F.gw * F.s - 310) / 2}px;top:${F.top + (F.gh * F.s - 380) / 2}px;width:310px;height:380px;border-radius:66px;
  outline:1.5px solid rgba(0,0,0,.25);opacity:0;transition:opacity .7s ease}
#watch.on{opacity:1}
#taps{position:absolute;inset:0;pointer-events:none}
.ring{position:absolute;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;border:3px solid #fff;box-sizing:border-box;
  background:rgba(255,255,255,.3);animation:ring .7s ease-out forwards}
@keyframes ring{0%{transform:scale(.45);opacity:1}40%{opacity:.95}100%{transform:scale(1.3);opacity:0}}
.finger{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid #fff;box-sizing:border-box}
#cap{position:absolute;font-weight:300;color:#fff;text-wrap:balance;display:flex;align-items:center;box-sizing:border-box;line-height:1.2;
  ${vertical ? `left:0;right:0;top:0;height:${F.top}px;justify-content:center;text-align:center;font-size:${preview ? 27 : 29}px;padding:0 ${preview ? 24 : 34}px;`
    : `left:${F.x + F.gw * F.s + 70}px;right:70px;top:0;bottom:0;font-size:46px;`}
  opacity:0;transform:translateY(8px);transition:opacity .6s ease,transform .8s cubic-bezier(.2,.7,.2,1)}
#cap.on{opacity:1;transform:none}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0;transition:opacity .8s ease}
.card.on{opacity:1}
.card .art{display:flex;flex-direction:column;align-items:center;transform:translateY(14px) scale(.96);transition:transform 1.6s cubic-bezier(.2,.7,.2,1)}
.card.on .art{transform:none}
.umbrella{width:${vertical ? 330 : 300}px;display:block}
.card h1{margin:${vertical ? 18 : 10}px 0 0;font:400 ${vertical ? 64 : 72}px/1 Hand,cursive;color:#fff}
.card h2{margin:${vertical ? 26 : 22}px 30px 0;font:300 ${vertical ? 28 : 34}px/1.2 Inter,sans-serif;
  opacity:0;transform:translateY(8px);transition:opacity .8s ease .5s,transform 1.2s cubic-bezier(.2,.7,.2,1) .5s}
.card.on h2{opacity:1;transform:none}
.card p{margin:${vertical ? 22 : 16}px 0 0;font:300 ${vertical ? 21 : 24}px/1.3 Inter,sans-serif;opacity:0;transition:opacity .8s ease 1.1s}
.card.on p{opacity:.9}
.card p.url{margin-top:8px;font-weight:400}
</style></head><body>
<div id="win"><div id="scale"><iframe id="app"></iframe><img id="still" src="${WIDGETS}" alt=""><div id="taps"></div></div></div>
<img id="watch" src="${WATCH}" alt="">
<div id="cap"></div>
<div class="card" id="title">${CARD(false)}</div>
<div class="card" id="end">${CARD(true)}</div>
<script>
const $=s=>document.querySelector(s);
const T=window.T={
  win:()=>$('#app').contentWindow,
  doc:()=>$('#app').contentDocument,
  show(id,on){$(id).classList.toggle('on',on);},
  still(on){$('#still').style.display=on?'block':'none';},
  caption(t){const c=$('#cap');if(!t){c.classList.remove('on');return;}c.textContent=t;c.classList.add('on');},
  ring(x,y){const r=document.createElement('div');r.className='ring';r.style.left=x+'px';r.style.top=y+'px';$('#taps').appendChild(r);setTimeout(()=>r.remove(),800);},
  center(el){const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};},
  press(sel){const el=T.doc().querySelector(sel),c=T.center(el);T.ring(c.x,c.y);el.click();},
  // the app's demo weather (main.js WP.demo, without its tour)
  weather(name){T.win().WP.demo(name,false);},
  // a swipe between Today and Tomorrow: a fingertip slides across while the pages scroll, on the app's own (stepped)
  // frame clock, snapping off meanwhile
  swipe(page,ms){const w=T.win(),p=T.doc().getElementById('pages'),x0=p.scrollLeft,x1=page*p.clientWidth,t0=w.performance.now();
    const f=document.createElement('div');f.className='finger';$('#taps').appendChild(f);p.style.scrollSnapType='none';
    const fx0=page?300:90,fx1=page?90:300;
    const step=()=>{const u=Math.min(1,(w.performance.now()-t0)/ms),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;p.scrollLeft=x0+(x1-x0)*e;
      f.style.left=(fx0+(fx1-fx0)*e)+'px';f.style.top='520px';f.style.opacity=String(Math.min(1,4*(1-u)));
      if(u<1)w.requestAnimationFrame(step);else{p.style.scrollSnapType='';f.remove();}};w.requestAnimationFrame(step);},
  // the slider's handle for an edge, moved to a value (in the units shown) as a drag would
  handle(i){return T.doc().querySelectorAll('#scale .range-input')[i];},
  slide(i,v){const h=T.handle(i);h.value=v;h.dispatchEvent(new Event('input',{bubbles:true}));
    const th=T.doc().querySelectorAll('#scale .range-thumb')[i];return T.center(th);},
};
</script></body></html>`;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const webRoot = path.join(ROOT, 'web');
const server = http.createServer((req, res) => {
  let file = path.join(webRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(webRoot)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, d) => (err ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(d)));
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: F.w, height: F.h }, deviceScaleFactor: F.dpr, hasTouch: true, isMobile: vertical,
    colorScheme: 'light', reducedMotion: 'no-preference', locale: 'en-US' });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/goatcounter|zgo\.at/, (r) => r.abort());
  await p.route('**/__trailer.html', (r) => r.fulfill({ contentType: 'text/html', body: STAGE }));
  await ctx.addInitScript(CLOCK);
  await p.goto(base + '__trailer.html');
  await p.evaluate(() => document.fonts.ready);
  const E = (f, a) => p.evaluate(f, a);
  const cdp = await ctx.newCDPSession(p);

  // while filming, time passes one frame at a time and each frame is kept
  let filming = null, owed = 0;
  const shoot = async () => {
    await E((ms) => __vt.tick(ms), 1000 / FPS);
    const { data: jpg } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    fs.writeFileSync(path.join(filming.dir, `f${String(filming.n++).padStart(5, '0')}.jpg`), Buffer.from(jpg, 'base64'));
  };
  const wait = async (ms) => { owed += ms; while (owed >= 1000 / FPS) { owed -= 1000 / FPS; await shoot(); } };

  const segs = [];
  const rec = async () => { const dir = path.join(TMP, 's' + segs.length); fs.mkdirSync(dir); await E(() => __vt.enter()); filming = { dir, n: 0 }; owed = 0; };
  const stop = async () => {
    const f = filming; filming = null; await E(() => __vt.leave());
    const mp4 = path.join(TMP, `seg${segs.length}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(f.dir, 'f%05d.jpg'), '-vf', `scale=${F.w * F.dpr}:${F.h * F.dpr},format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', mp4]);
    fs.rmSync(f.dir, { recursive: true, force: true });
    console.log(`shot ${segs.length}: ${(f.n / FPS).toFixed(1)}s`);
    segs.push({ mp4, dur: f.n / FPS });
  };
  const end = async () => { await E(() => T.caption('')); await wait(400); await stop(); };

  // the app with a sample forecast, loaded in real time, then shown
  const open = async (sample) => {
    await E(() => T.show('#win', false)); await p.waitForTimeout(300);
    await E((u) => { document.getElementById('app').src = u; }, `${base}app/?sample=${sample}&shots=1`);
    const frame = () => p.frames().find((f) => f.url().includes('/app/'));
    for (let i = 0; !(frame() && await frame().evaluate(() => document.querySelectorAll('#pages .page img').length > 1).catch(() => false)); i++) {
      if (i > 200) throw new Error('the app did not load');
      await p.waitForTimeout(50);
    }
    await frame().evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await E(() => T.show('#win', true));
  };

  // 1. title card
  if (!preview) {
    await rec(); await wait(400);
    await E(() => T.show('#title', true)); await wait(3000);
    await E(() => T.show('#title', false)); await wait(500); await stop();
  }

  // 2. today, with rain on the way: the raincoat, and rain falling behind the penguin
  await open('rainLater');
  await rec(); await E(() => T.caption('What to wear today, at a glance')); await wait(preview ? 3200 : 3600); await end();

  // 3. a swipe to tomorrow, and back
  await rec(); await E(() => T.caption('Swipe to see tomorrow')); await wait(500);
  await E(() => T.swipe(1, 650)); await wait(2000);
  await E(() => T.swipe(0, 650)); await wait(1200); await end();

  // 4. the drawings: the forecast changes, and so do the clothes
  await rec(); await E(() => T.caption('Hand-drawn for every kind of weather')); await wait(500);
  for (const w of ['cold', 'warm', 'hot', 'rainNow']) { await E((n) => T.weather(n), w); await wait(1300); }
  await wait(300); await end();

  // 5. Settings: the jacket handle moves up and back, the penguins over the slider move with it; then Done
  await E((n) => T.weather(n), 'rainLater');
  await rec(); await E(() => T.caption('Choose when the penguin changes clothes')); await wait(400);
  await E(() => T.press('#gear')); await wait(1100);
  const start = Number(await E(() => T.handle(0).value));
  const drag = async (to) => {
    const from = Number(await E(() => T.handle(0).value));
    for (let v = from; v !== to; v += Math.sign(to - from)) await E(([i, n]) => T.slide(i, n), [0, v + Math.sign(to - from)]), await wait(70);
  };
  const c0 = await E(() => { const th = T.doc().querySelectorAll('#scale .range-thumb')[0]; return T.center(th); });
  await E(([x, y]) => T.ring(x, y), [c0.x, c0.y]); await wait(200);
  await drag(start + 12); await wait(700); await drag(start); await wait(600);
  await E(() => T.press('#settings button[value="done"]')); await wait(1200); await end();

  // 6. the widgets (the Store widget screenshots workflow's sheet)
  await rec(); await E(() => { T.still(true); T.caption('On your Home Screen and Lock Screen'); }); await wait(3200); await end();

  // 7. the Apple Watch app (not in the preview, which plays on iPhone pages)
  if (!preview) {
    await rec(); await E(() => { T.show('#win', false); T.show('#watch', true); T.caption('And on your Apple Watch'); }); await wait(3000); await end();
  }

  // 8. end card
  if (!preview) {
    await rec(); await E(() => { T.show('#win', false); T.show('#watch', false); }); await wait(700);
    await E(() => T.show('#end', true)); await wait(4000); await stop();
  }

  if (errs.length) console.log('page errors', errs);
  await b.close(); server.close();

  // join the shots with crossfades, then scale to the output size
  const inputs = segs.flatMap((s) => ['-i', s.mp4]); let fc = '', last = '[0:v]', off = 0;
  for (let i = 1; i < segs.length; i++) { off += segs[i - 1].dur - FADE; fc += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${off.toFixed(3)}[v${i}];`; last = `[v${i}]`; }
  const W = preview ? 886 : vertical ? 1080 : 1920, H = vertical ? 1920 : 1080;
  fc += `${last}scale=${W}:${H}:flags=lanczos,format=yuv420p[out]`;
  const mp4 = path.join(OUT, F.name + '.mp4');
  // quiet music made for the length of the video (tools/music.py), kept well below normal loudness (-24 LUFS)
  const total = segs.reduce((t, s) => t + s.dur, 0) - FADE * (segs.length - 1);
  const wav = path.join(TMP, 'music.wav');
  execFileSync('python3', ['-I', path.join(__dirname, 'music.py'), total.toFixed(2), wav]);
  fc += `;[${segs.length}:a]loudnorm=I=-24:TP=-3:LRA=7,aresample=48000[aud]`;
  // the App Store wants a stereo AAC track and 10-12 Mbps H.264: held at 11 Mbps (constant bitrate)
  const enc = preview ? ['-b:v', '11M', '-minrate', '11M', '-maxrate', '11M', '-bufsize', '22M', '-x264-params', 'nal-hrd=cbr'] : ['-crf', '21'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-i', wav, '-filter_complex', fc, '-map', '[out]', '-map', '[aud]', '-shortest',
    '-c:a', 'aac', '-b:a', '256k', '-ac', '2', ...enc, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart', mp4]);
  const len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
  if (preview) console.log('preview length', len.toFixed(1) + 's', len < 15 || len > 30 ? '(outside the 15-30 seconds the App Store accepts)' : '');
  else {   // poster: the raincoat penguin with its caption
    const at = segs[0].dur - FADE + 2.2;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', at.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(OUT, F.name + '-poster.jpg')]);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('saved', mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + ' MB,', len.toFixed(1) + 's');
})().catch((e) => { console.error(e); process.exit(1); });
