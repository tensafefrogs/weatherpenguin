#!/usr/bin/env python3
"""Quiet music for the trailers and the app preview (tools/trailer.js): an original little piece made here, so there
is nothing to license. Soft marimba-like notes over a slow pad and a low bass, in C major (C, A minor, F, G, a bar
each at 80 beats a minute), with a light room echo, fading in and out. The same every run.

usage: python3 tools/music.py <seconds> <out.wav>        Needs numpy.
"""
import sys, wave
import numpy as np

RATE = 48000
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT

# chords as MIDI notes (pad voicing) and their bass note
CHORDS = [([60, 64, 67, 71], 48), ([57, 60, 64, 67], 45), ([53, 57, 60, 64], 41), ([55, 59, 62, 67], 43)]
# the melody, in eighth notes per bar (None: a rest), over each chord in turn; a second line for the repeats
MELODY = [
    [[72, None, 76, None, 79, None, 76, 74], [72, None, None, 67, 69, None, 72, None]],
    [[72, None, 69, None, 76, None, 72, None], [69, None, 72, 76, None, 74, 72, None]],
    [[69, None, 72, None, 77, None, 76, 72], [72, None, 69, None, 65, None, 69, None]],
    [[71, None, 74, None, 79, None, 76, 74], [74, None, 71, None, 67, None, None, None]],
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(freq, length, attack, decay, partials):
    t = np.arange(int(length * RATE)) / RATE
    wave_ = sum(a * np.sin(2 * np.pi * freq * k * t) for k, a in partials)
    env = np.minimum(1, t / attack) * np.exp(-t / decay)
    return wave_ * env


def add(buf, start, sig, pan):
    i = int(start * RATE)
    if i >= buf.shape[1]: return
    sig = sig[: buf.shape[1] - i]
    buf[0, i:i + len(sig)] += sig * np.cos(pan * np.pi / 2)
    buf[1, i:i + len(sig)] += sig * np.sin(pan * np.pi / 2)


def comb(x, delay, gain):
    """A feedback echo: y[n] = x[n] + gain * y[n - delay], a block of `delay` samples at a time."""
    d = int(delay * RATE); y = x.copy()
    for i in range(d, len(y), d):
        y[i:i + d] += gain * y[i - d:i - d + len(y[i:i + d])]
    return y


def main():
    seconds, out = float(sys.argv[1]), sys.argv[2]
    n = int(seconds * RATE)
    dry = np.zeros((2, n))
    bars = int(np.ceil(seconds / BAR)) + 1
    for b in range(bars):
        chord, bass = CHORDS[b % 4]
        start = b * BAR
        # pad: soft sines with a slow swell, held a little past the bar so chords overlap
        for j, m in enumerate(chord):
            add(dry, start, 0.045 * tone(hz(m), BAR + 1.5, 0.9, 2.6, [(1, 1), (2, 0.18)]), 0.3 + 0.4 * j / 3)
        # bass: one low note per bar, and a softer one on beat 3
        add(dry, start, 0.11 * tone(hz(bass), BAR, 0.02, 1.4, [(1, 1), (2, 0.25)]), 0.5)
        add(dry, start + 2 * BEAT, 0.06 * tone(hz(bass + 7), BAR / 2, 0.02, 0.9, [(1, 1)]), 0.5)
        # melody: mallet notes (a fundamental, a bright fourth partial that dies away fast), not in the first bar
        if b == 0: continue
        line = MELODY[b % 4][(b // 4) % 2]
        for k, m in enumerate(line):
            if m is None: continue
            note = tone(hz(m), 1.6, 0.004, 0.45, [(1, 1), (4, 0.12)])
            tick = tone(hz(m) * 10, 0.2, 0.002, 0.03, [(1, 0.05)])   # the mallet's soft knock
            note[:len(tick)] += tick
            add(dry, start + k * BEAT / 2, 0.13 * note, 0.35 + 0.3 * (k % 2))
    # a small room: a few echoes, mixed in low
    wet = np.stack([sum(comb(dry[c], d, 0.35) for d in (0.0297, 0.0371, 0.0411, 0.0437)) / 4 for c in range(2)])
    mix = dry + 0.35 * np.roll(wet, int(0.02 * RATE), axis=1)
    t = np.arange(n) / RATE
    mix *= np.minimum(1, t / 1.5) * np.minimum(1, (seconds - t) / 2.5).clip(0)
    mix /= np.abs(mix).max() / 0.5
    pcm = (mix.T * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    main()
