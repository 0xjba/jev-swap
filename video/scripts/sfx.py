"""Synthesizes the video's UI sound effects (no samples, no licences) -> public/sfx/*.wav, 48 kHz mono.

Subtle, product-film style: soft clicks, pops, typing ticks, air whooshes, glassy chimes and a low logo sting.
Run: python3 scripts/sfx.py
"""
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack, decay):
    """Linear attack (s), exponential decay (time constant, s)."""
    x = np.arange(n) / SR
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(x - attack, 0) / decay)


def bandpass(x, centers, q=2.0):
    """Biquad band-pass with a per-sample centre frequency (array or scalar)."""
    centers = np.broadcast_to(centers, x.shape)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, (s, fc) in enumerate(zip(x, centers)):
        w = 2 * np.pi * fc / SR
        alpha = np.sin(w) / (2 * q)
        b0, a0, a1, a2 = alpha, 1 + alpha, -2 * np.cos(w), 1 - alpha
        out = (b0 * s - b0 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, s, y1, out
        y[i] = out
    return y


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i, s in enumerate(x):
        acc = (1 - a) * s + a * acc
        y[i] = acc
    return y


def tone(freqs, sec, decay, attack=0.004, detune=0.0):
    x = t(sec)
    s = sum(np.sin(2 * np.pi * f * (1 + detune * k) * x) / (k + 1) for k, f in enumerate(freqs))
    return s * env(len(x), attack, decay)


def save(name, x, peak_db=-3.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    fade = min(len(x), int(0.004 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(os.path.join(OUT, f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def click():
    """Two-stage switch toggle: a crisp tick, then a softer settle, with a faint tonal body."""
    def one(fc, gain, sec=0.02):
        n = rng.standard_normal(int(SR * sec))
        return bandpass(n, fc, q=3.0) * env(len(n), 0.0005, 0.003) * gain
    a = one(3200, 1.0)
    b = one(2400, 0.55)
    body = tone([1250], 0.05, 0.012) * 0.25
    x = np.zeros(int(SR * 0.09))
    x[: len(a)] += a
    x[: len(body)] += body
    x[int(SR * 0.035): int(SR * 0.035) + len(b)] += b
    return x


def pop():
    """Soft bubbly UI pop: a quick upward sine blip."""
    x = t(0.09)
    f = 520 + 380 * (1 - np.exp(-x / 0.012))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.002, 0.022)
    return s + lowpass(rng.standard_normal(len(x)), 2500) * env(len(x), 0.0005, 0.004) * 0.3


def tick(fc):
    """Very short keyboard-like tick."""
    n = rng.standard_normal(int(SR * 0.015))
    return bandpass(n, fc, q=2.5) * env(len(n), 0.0003, 0.0025)


def whoosh(sec=0.55, f0=500, f1=3800):
    """Air whoosh: noise through a rising band-pass, swelling then falling."""
    x = t(sec)
    n = rng.standard_normal(len(x))
    centers = f0 * (f1 / f0) ** (x / sec)
    shape = np.sin(np.pi * np.clip(x / sec, 0, 1)) ** 2
    return lowpass(bandpass(bandpass(n, centers, q=1.4), centers, q=1.4), 7000) * shape


def chime():
    """Glassy two-note confirmation (E6 then B6), bell-like partials."""
    a = tone([1318.5, 2637, 3955], 0.5, 0.16)
    b = tone([1975.5, 3951], 0.55, 0.2)
    x = np.zeros(int(SR * 0.62))
    x[: len(a)] += a * 0.8
    off = int(SR * 0.055)
    x[off: off + len(b)] += b
    return x


def chime_low():
    """Muted, lower tone for a miss or a fallback."""
    return tone([440, 659.3], 0.35, 0.09) + tone([220], 0.35, 0.07) * 0.4


def reveal():
    """Soft arpeggiated shimmer (C6 E6 G6 C7) over a light air swell."""
    x = np.zeros(int(SR * 1.1))
    for i, f in enumerate([1046.5, 1318.5, 1568, 2093]):
        s = tone([f, f * 2], 0.9, 0.3, attack=0.006) * (0.9 - i * 0.12)
        o = int(SR * 0.035 * i)
        x[o: o + len(s)] += s
    air = whoosh(1.1, 2500, 6000) * 0.12
    return x + air[: len(x)]


def sweep():
    """Scanner pass: a thin, rising filtered-noise sweep with a faint tone."""
    x = t(1.8)
    n = rng.standard_normal(len(x))
    centers = 900 * (5200 / 900) ** (x / 1.8)
    shape = np.clip(x / 0.2, 0, 1) * np.clip((1.8 - x) / 0.35, 0, 1)
    tone_ = np.sin(2 * np.pi * np.cumsum(centers * 0.5) / SR) * 0.08
    return (lowpass(bandpass(bandpass(n, centers, q=6.0), centers, q=6.0), 8000) + tone_) * shape


def zip_():
    """Fast upward zip for Jev's dash."""
    x = t(0.22)
    f = 700 * (3200 / 700) ** (x / 0.22)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.005, 0.07)
    return s * 0.7 + bandpass(rng.standard_normal(len(x)), f, q=2) * env(len(x), 0.005, 0.06)


def hit():
    """Logo sting: a round sub thump with a pitch drop, and a soft high shimmer."""
    x = t(1.6)
    f = 48 + 60 * np.exp(-x / 0.05)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.003, 0.35)
    shimmer = sum(np.sin(2 * np.pi * fr * x) for fr in [1568, 2093, 2637]) * env(len(x), 0.02, 0.5) * 0.12
    return sub + shimmer + lowpass(rng.standard_normal(len(x)), 1200) * env(len(x), 0.001, 0.02) * 0.4


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save("click", click())
    save("pop", pop())
    for i, fc in enumerate([3600, 4200, 4800]):
        save(f"tick{i}", tick(fc))
    save("whoosh", whoosh())
    save("chime", chime())
    save("chime_low", chime_low())
    save("reveal", reveal())
    save("sweep", sweep())
    save("zip", zip_())
    save("hit", hit(), peak_db=-1.0)
    print("wrote", sorted(os.listdir(OUT)))
