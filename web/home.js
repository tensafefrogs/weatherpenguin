// The home pages (made by tools/make_site.py): swap the demo's weather without leaving the page, and a few drops
// of rain on the umbrella (none with Reduce Motion: site.css).
const demo = document.getElementById('demo');
for (const a of document.querySelectorAll('[data-demo]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    demo.src = a.getAttribute('href');
    for (const b of document.querySelectorAll('[data-demo]')) b.toggleAttribute('aria-current', b === a);
  });
}
const rain = document.querySelector('.rain');
for (let i = 0; i < 24; i++) {
  const drop = document.createElement('i');
  drop.style.left = `${Math.random() * 100}%`;
  drop.style.animationDelay = `${Math.random() * 1.2}s`;
  drop.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
  rain.append(drop);
}
