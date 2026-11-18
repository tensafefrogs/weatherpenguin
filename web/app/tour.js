// The App Review video's tour (WP.demo in main.js, from the app's debug builds only): what a person does in the
// app, played out on the page so a simulator can record it. Today, swipe to Tomorrow and back, open Settings,
// move the jacket handle, switch to °C and back, then Done.
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Scrolled frame by frame, with snapping off meanwhile: WebKit ignores a smooth scrollTo on a snapping scroller.
// TEMPORARY readout (one Review video run, then removed): what the web view does with the scroll
const readout = (() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;right:8px;top:120px;z-index:99;background:#000;color:#0f0;font:14px monospace;padding:6px;white-space:pre';
  document.body.append(d);
  const t0 = performance.now();
  return (msg) => {
    const p = $('pages');
    d.textContent = `${((performance.now() - t0) / 1000).toFixed(2)}s ${msg}\nscrollLeft=${p.scrollLeft} client=${p.clientWidth} scrollW=${p.scrollWidth} pages=${p.children.length}\nsnap=${getComputedStyle(p).scrollSnapType} overflowX=${getComputedStyle(p).overflowX}`;
  };
})();

async function swipeTo(page) {
  const pages = $('pages');
  readout(`swipe to ${page} start`);
  const from = pages.scrollLeft;
  const to = page * pages.clientWidth;
  pages.style.scrollSnapType = 'none';
  const start = performance.now();
  await new Promise((done) => {
    const step = (now) => {
      const t = Math.min(1, (now - start) / 600);
      pages.scrollLeft = from + (to - from) * (1 - (1 - t) ** 3);
      readout(`swipe to ${page} t=${t.toFixed(2)}`);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
  pages.style.scrollSnapType = '';
  await wait(2500);
}

async function slide(input, to) {
  const from = Number(input.value);
  const steps = Math.abs(to - from);
  for (let i = 1; i <= steps; i++) {
    input.value = from + Math.sign(to - from) * i;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(1600 / steps);
  }
}

export async function runTour() {
  readout('tour start');
  await wait(3500);
  readout('after first wait');
  await swipeTo(1);
  await swipeTo(0);
  $('gear').click();
  await wait(2500);
  const handles = document.querySelectorAll('#scale .range-input');
  const jacket = handles[0];
  if (jacket) {
    const start = Number(jacket.value);
    await slide(jacket, start + 10);
    await wait(800);
    await slide(jacket, start);
    await wait(800);
  }
  const unit = (u) => document.querySelector(`input[name="units"][value="${u}"]`);
  unit('c')?.click();
  await wait(2000);
  unit('f')?.click();
  await wait(1500);
  document.querySelector('#settings button[value="done"]').click();
  await wait(3000);
}
