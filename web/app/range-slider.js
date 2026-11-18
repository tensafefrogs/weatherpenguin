// v1's range slider (WPRangeSlider): a rounded grey track, a blue fill for
// the band, and white round handles. Any number of handles, in order.
//
// Each handle is a real <input type="range"> kept out of sight, so VoiceOver
// and keyboards adjust it natively. Touch and mouse drags go through pointer
// events on the whole slider and move the nearest handle.

export class RangeSlider {
  /**
   * @param {object} opts
   * @param {{key: string, label: string}[]} opts.handles  one or two, in order
   * @param {'min'|'handle'|null} opts.fillFrom  where the blue band starts (null: no band)
   * @param {'max'|'handle'|null} opts.fillTo    where it ends
   * @param {(key: string, value: number) => void} opts.onInput  value in display units
   */
  constructor({ handles, fillFrom, fillTo, onInput }) {
    this.handles = handles;
    this.fillFrom = fillFrom;
    this.fillTo = fillTo;
    this.onInput = onInput;
    this.range = { min: 0, max: 100, step: 1 };
    this.values = {};
    this.active = null;

    this.el = document.createElement('div');
    this.el.className = 'range';
    this.el.innerHTML = '<div class="range-track"><div class="range-fill"></div></div>';
    this.fill = this.el.querySelector('.range-fill');

    this.inputs = {};
    this.thumbs = {};
    for (const h of handles) {
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'range-input';
      input.setAttribute('aria-label', h.label);
      input.addEventListener('input', () => this.onInput(h.key, Number(input.value)));
      const thumb = document.createElement('div');
      thumb.className = 'range-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      input.addEventListener('focus', () => thumb.classList.add('focus'));
      input.addEventListener('blur', () => thumb.classList.remove('focus'));
      this.el.append(input, thumb);
      this.inputs[h.key] = input;
      this.thumbs[h.key] = thumb;
    }

    this.el.addEventListener('pointerdown', (e) => this.#start(e));
    this.el.addEventListener('pointermove', (e) => this.#move(e));
    this.el.addEventListener('pointerup', (e) => this.#end(e));
    this.el.addEventListener('pointercancel', (e) => this.#end(e));
  }

  /** Redraws with new limits, values (display units) and text for each value. */
  update({ min, max, step, values, format }) {
    this.range = { min, max, step };
    this.values = values;
    for (const h of this.handles) {
      const input = this.inputs[h.key];
      Object.assign(input, { min, max, step });
      input.value = values[h.key];
      input.setAttribute('aria-valuetext', format(values[h.key]));
      this.thumbs[h.key].style.setProperty('--at', this.#fraction(values[h.key]));
    }
    this.fill.hidden = this.fillFrom == null;
    if (this.fillFrom == null) return;
    const keys = this.handles.map((h) => h.key);
    const from = this.fillFrom === 'min' ? 0 : this.#fraction(values[keys[0]]);
    const to = this.fillTo === 'max' ? 1 : this.#fraction(values[keys.at(-1)]);
    this.fill.style.setProperty('--from', from);
    this.fill.style.setProperty('--to', to);
  }

  /** Where a value sits along the track, 0 to 1. */
  fraction(v) {
    return this.#fraction(v);
  }

  #fraction(v) {
    const { min, max } = this.range;
    return Math.min(1, Math.max(0, (v - min) / (max - min)));
  }

  /** The value under a pointer, snapped to the step. */
  #valueAt(clientX) {
    const thumb = 28;
    const box = this.el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - box.left - thumb / 2) / (box.width - thumb)));
    const { min, max, step } = this.range;
    return Math.round((min + f * (max - min)) / step) * step;
  }

  #start(e) {
    if (e.button > 0) return;
    const v = this.#valueAt(e.clientX);
    // The nearest handle; on a tie (handles together), the one on the side being dragged toward.
    let best = null;
    for (const h of this.handles) {
      const d = Math.abs(this.values[h.key] - v);
      if (!best || d < best.d || (d === best.d && v > this.values[h.key])) best = { key: h.key, d };
    }
    this.active = best.key;
    this.thumbs[this.active].classList.add('active');
    this.el.setPointerCapture(e.pointerId);
    e.preventDefault();
    this.onInput(this.active, v);
  }

  #move(e) {
    if (this.active) this.onInput(this.active, this.#valueAt(e.clientX));
  }

  #end(e) {
    if (!this.active) return;
    this.thumbs[this.active].classList.remove('active');
    this.active = null;
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
  }
}
