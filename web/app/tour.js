// The App Review video's tour (WP.demo in main.js, from the app's debug builds only): what a person does in the
// app, played out on the page so a simulator can record it. Today, then Settings: the jacket handle moves (and the
// penguins over the slider with it), °C and back, then Done. (A scripted swipe to Tomorrow never showed in the
// simulator's recordings, so the video doesn't try.)
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await wait(4000);
  $('gear').click();
  await wait(2500);
  const jacket = document.querySelectorAll('#scale .range-input')[0];
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
