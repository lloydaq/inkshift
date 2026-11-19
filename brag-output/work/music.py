# Soundtrack: 120 BPM, A minor, one beat grid from frame 0. Music and ink sounds are mixed together.
import numpy as np, wave
SR = 48000; DUR = 22.0; N = int(SR * DUR); BEAT = 0.5
rng = np.random.default_rng(7)
mus = np.zeros((N, 2)); sfx = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def add(buf, t, sig, pan=0.0, g=1.0):
    i = int(round(t * SR)); s = sig[: max(0, N - i)]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(s), 0] += s * l * g * 1.414; buf[i:i + len(s), 1] += s * r * g * 1.414
def tt(d): return np.arange(int(d * SR)) / SR
def lowpass(x, fc, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / np.sqrt(1 + (f / fc) ** 4)
    if hi: m *= 1 - 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))

def rhodes(m, d=1.9, v=1.0):
    t = tt(d); f = hz(m)
    env = np.exp(-t * 1.6) * (1 - np.exp(-t * 300))
    s = np.sin(2*np.pi*f*t + 0.9*np.exp(-t*5)*np.sin(2*np.pi*f*t)) + 0.25*np.sin(2*np.pi*2*f*t)*np.exp(-t*4)
    trem = 1 + 0.06 * np.sin(2*np.pi*4*t)
    return s * env * trem * v
def bass(m, d=0.9):
    t = tt(d); f = hz(m)
    env = (1 - np.exp(-t * 400)) * np.exp(-t * 2.2)
    return (np.sin(2*np.pi*f*t) + 0.18*np.sin(2*np.pi*2*f*t)) * env
def kick():
    t = tt(0.45); f = 45 + 75 * np.exp(-t * 30)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9) * (1 - np.exp(-t*2000))
def hat(d=0.06):
    t = tt(d); return lowpass(rng.standard_normal(len(t)), 16000, 7000) * np.exp(-t * 70)
def snap():
    t = tt(0.25)
    return (lowpass(rng.standard_normal(len(t)), 5000, 1200) * np.exp(-t * 22) + 0.3*np.sin(2*np.pi*190*t)*np.exp(-t*30))

# Am9 | Fmaj7 | Cmaj7 | G6   (one chord per bar = 2 s)
CH = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 67]]
BS = [45, 41, 48, 43]
bars = int(DUR / 2)
for b in range(bars):
    t0 = b * 2.0; c = CH[b % 4]; last = b == bars - 1
    for k, n in enumerate(c[1:]):
        add(mus, t0 + k * 0.012, rhodes(n + 12 * (n < 60), 2.2 if not last else 3.5, 0.17), pan=(k - 1.5) * 0.25)
    if not last:
        for k, n in enumerate(c[2:]):
            add(mus, t0 + 1.25 + k * 0.01, rhodes(n + 12, 0.7, 0.07), pan=0.3 - k * 0.3)
    add(mus, t0, bass(BS[b % 4], 1.4 if not last else 2.5), g=0.5)
    if not last: add(mus, t0 + 1.25, bass(BS[b % 4] + 7, 0.6), g=0.33)
    drums = 4.0 <= t0 < 21.5
    for beat in range(4):
        tb = t0 + beat * BEAT
        if tb >= 21.5: break
        if drums and beat in (0, 2): add(mus, tb, kick(), g=0.3)
        if drums and t0 >= 6.5 and beat in (1, 3): add(mus, tb, snap(), g=0.16, pan=0.1)
        add(mus, tb + 0.25, hat(), g=0.10 if t0 >= 4 else 0.06, pan=0.35)
        if t0 >= 6.5: add(mus, tb, hat(0.03), g=0.04, pan=-0.35)
# final hit
add(mus, 21.5, kick(), g=0.3)

# Ink sounds: a soft click at each press, then a swell that follows the spread, tuned to A.
def click():
    t = tt(0.05)
    return lowpass(rng.standard_normal(len(t)), 6000, 1500) * np.exp(-t * 160) + 0.4*np.sin(2*np.pi*hz(81)*t)*np.exp(-t*90)
def swell(d, air=False):
    t = tt(d + 1.2)
    n = lowpass(rng.standard_normal(len(t)), 2200 if not air else 5000, 200 if not air else 600)
    env = (1 - np.exp(-t * (25 if not air else 6))) * np.exp(-t * (2.8 / d if not air else 1.4 / d))
    tone = (np.sin(2*np.pi*hz(45)*t) + 0.5*np.sin(2*np.pi*hz(57)*t) + 0.2*np.sin(2*np.pi*hz(64)*t)) * np.exp(-t * 2.2 / d) * (1 - np.exp(-t*60))
    return n * env * (0.35 if not air else 0.45) + tone * (0.5 if not air else 0.25)
for t, d, air in [(0.5, 1.1, False), (7.0, 2.4, False), (11.0, 0.5, False), (15.0, 2.0, True)]:
    add(sfx, t, click(), g=0.22, pan=0.15)
    add(sfx, t + 0.01, swell(d, air), g=0.32)
# Second press at 11.5: the ink pulls back, so the same swell plays reversed into silence.
add(sfx, 11.5, click(), g=0.22, pan=0.15)
r = swell(0.5)[: int(0.5 * SR)][::-1] * np.linspace(1, 0.6, int(0.5 * SR))
add(sfx, 11.5, r, g=0.28)
# Card arrivals: a low tonic bloom under the wordmark.
for t in (4.0, 18.0):
    tb = tt(2.0); add(sfx, t, (np.sin(2*np.pi*hz(45)*tb) + 0.4*np.sin(2*np.pi*hz(57)*tb)) * np.exp(-tb*1.8) * (1-np.exp(-tb*40)), g=0.16)

def reverb(x, rt=1.6, wet=0.18):
    t = tt(rt); ir = rng.standard_normal((len(t), 2)) * np.exp(-t * 6.9 / rt)[:, None]
    ir[:, 0] = lowpass(ir[:, 0], 6000); ir[:, 1] = lowpass(ir[:, 1], 6000)
    L = len(x) + len(t)
    out = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], L) * np.fft.rfft(ir[:, c], L), L)[: len(x)] for c in (0, 1)], 1)
    out /= np.max(np.abs(out)) + 1e-9; out *= np.max(np.abs(x))
    return x + out * wet / 0.18 * 0.18
# Shared space: music and effects through the same room, effects a touch wetter.
mix = reverb(mus, wet=0.18) + reverb(sfx, wet=0.3)
fade = np.ones(N); fl = int(0.5 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 2
mix *= fade[:, None]
mix = np.tanh(mix * 1.1 / np.max(np.abs(mix)) * 1.2) ; mix *= 0.89 / np.max(np.abs(mix))
pcm = (mix * 32767).astype('<i2')
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', N / SR)
