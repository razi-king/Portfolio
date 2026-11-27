# Mixes voice, music and sound effects to match the rendered scenes.
import json, wave
import numpy as np

FPS, SR = 30, 44100
TL = json.loads(open("timeline.js").read()[len("window.TL = "):].rstrip().rstrip(";"))
# where each scene really starts in the joined video (frames are whole numbers)
vstart, acc = [], 0
for s in TL:
    vstart.append(acc / FPS)
    acc += round(s["dur"] * FPS)
T = acc / FPS
N = int((T + 8) * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)

def at(i, local):  # scene-local time -> video time
    return vstart[i] + local

def load_voice(id_):
    with wave.open(f"vo/{id_}.wav") as w:
        sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    nz = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.08 * sr)]  # same trim as script.py
    x = np.linspace(0, len(a) - 1, int(len(a) * SR / sr))
    return np.interp(x, np.arange(len(a)), a)

# ---------------------------------------------------------------- voice
voice = np.zeros(N)
for i, s in enumerate(TL):
    for v in s["vo"]:
        a = load_voice(v["id"]); k = int(at(i, v["s"]) * SR)
        voice[k:k + len(a)] += a
# warm it slightly: gentle low shelf via a mix with a smoothed copy
voice = voice * 1.0 + np.convolve(voice, np.ones(6) / 6, mode="same") * .25

# ---------------------------------------------------------------- music (100 bpm, Am F C G)
beat = 60 / 100
def note(m): return 440 * 2 ** ((m - 69) / 12)
prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
pad, arp, bass, drums = (np.zeros(N) for _ in range(4))
bar = beat * 4
for k in range(int(T / bar) + 2):
    s0 = k * bar; ch = prog[k % 4]
    i0, i1 = int(s0 * SR), min(N, int((s0 + bar + 1.2) * SR))
    tt = t[i0:i1] - s0
    env = np.minimum(1, tt / .9) * np.exp(-np.maximum(0, tt - bar) * 3)
    for m in ch:
        f = note(m)
        pad[i0:i1] += env * (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.004 * tt) + .25 * np.sin(2 * np.pi * f * .5 * tt))
    for b in range(4):  # bass on each beat, root note
        a0 = s0 + b * beat; j0, j1 = int(a0 * SR), min(N, int((a0 + beat) * SR)); x = t[j0:j1] - a0
        f = note(ch[0] - 24)
        bass[j0:j1] += np.exp(-x * 3) * (np.sin(2 * np.pi * f * x) + .3 * np.sin(4 * np.pi * f * x))
    for j in range(8):  # eighth-note arpeggio
        a0 = s0 + j * beat / 2; j0, j1 = int(a0 * SR), min(N, int((a0 + .5) * SR)); x = t[j0:j1] - a0
        m = ch[[0, 1, 2, 1, 0, 2, 1, 2][j]] + 12 + (12 if j in (2, 6) else 0)
        arp[j0:j1] += np.exp(-x * 7) * np.sin(2 * np.pi * note(m) * x) * (1 - .5 * (j % 2))
    for b in range(4):
        a0 = s0 + b * beat
        j0 = int(a0 * SR); x = t[j0:j0 + int(.3 * SR)] - a0  # kick on 1 and 3
        if b in (0, 2): drums[j0:j0 + len(x)] += np.exp(-x * 16) * np.sin(2 * np.pi * (48 + 90 * np.exp(-x * 35)) * x) * 1.2
        if b in (1, 3):  # soft clap
            n = rng.standard_normal(int(.18 * SR)); drums[j0:j0 + len(n)] += .35 * n * np.exp(-np.arange(len(n)) / SR * 22)
        for h in (0, .5):  # closed hats
            h0 = int((a0 + h * beat) * SR); n = rng.standard_normal(int(.05 * SR)); n = np.diff(n, prepend=0)
            drums[h0:h0 + len(n)] += .12 * n * np.exp(-np.arange(len(n)) / SR * 80)

# arrangement: intro calm, drums in from the search, everything thins out while the world is frozen
energy = np.zeros(N)
energy[t >= at(1, 2.0)] = 1
frozen = np.zeros(N)
for i, s in enumerate(TL):
    c = s["cues"]
    if "freeze" in c and "unfreeze" in c:
        frozen[(t >= at(i, c["freeze"])) & (t < at(i, c["unfreeze"]))] = 1
def smooth(x, sec):
    k = max(1, int(sec * SR)); return np.convolve(x, np.ones(k) / k, mode="same")
energy, frozen = smooth(energy, .8), smooth(frozen, .4)
music = .09 * pad + .05 * arp * (1 - .7 * frozen) + .10 * bass * (.4 + .6 * energy) * (1 - .6 * frozen) + .10 * drums * energy * (1 - .92 * frozen)
# duck under the voice
venv = smooth(np.abs(voice), .25); venv = venv / (venv.max() or 1)
music *= 1 - .55 * np.minimum(1, venv * 3)
music *= np.minimum(1, t / 1.5) * np.minimum(1, (T - t) / 3)

# ---------------------------------------------------------------- sound effects
sfx = np.zeros(N)
def add(sig, sec, g=1.0):
    k = int(sec * SR); k1 = min(N, k + len(sig)); sfx[k:k1] += g * sig[:k1 - k]
def noise(d): return rng.standard_normal(int(d * SR))
def whoosh(d=.7):
    n = smooth_np(noise(d), 18); x = np.linspace(0, 1, len(n)); return n * np.sin(np.pi * x) ** 2
def smooth_np(n, k): return np.convolve(n, np.ones(k) / k, mode="same")
def sweep(f0, f1, d, decay=3):
    x = np.arange(int(d * SR)) / SR; f = f0 + (f1 - f0) * x / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * decay)
def click(): x = np.arange(int(.04 * SR)) / SR; return np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 120)
def ding(f=1320):
    x = np.arange(int(1.2 * SR)) / SR; return (np.sin(2 * np.pi * f * x) + .5 * np.sin(2 * np.pi * f * 1.5 * x)) * np.exp(-x * 4)
def boom():
    x = np.arange(int(1.2 * SR)) / SR; return np.sin(2 * np.pi * (40 + 40 * np.exp(-x * 6)) * x) * np.exp(-x * 3.5)
def snap():
    n = noise(.06); return n * np.exp(-np.arange(len(n)) / SR * 90)

for i, s in enumerate(TL):
    c = s["cues"]
    if i > 0: add(whoosh(.8), at(i, 0) - .45, .5)            # wipe between scenes
    if "chapter" in c: add(boom(), at(i, .25), .6)
    if "freeze" in c:
        add(sweep(900, 120, .6, 2.5), at(i, c["freeze"]), .35)   # tape-stop as the world freezes
        add(noise(.12) * np.exp(-np.arange(int(.12 * SR)) / SR * 30), at(i, c["freeze"]), .25)
    if "unfreeze" in c:
        add(snap(), at(i, c["unfreeze"]), .9)
        add(sweep(200, 900, .5, 3), at(i, c["unfreeze"] + .05), .25)
name = [s["name"] for s in TL]
i = name.index("open"); add(snap(), at(i, TL[i]["cues"]["snap"]), .9); add(boom(), at(i, TL[i]["cues"]["title"]), .8)
i = name.index("search"); ph = TL[i]["cues"]["phone"]
for k in range(12): add(click(), at(i, ph + .2 + k * .075), .15)
for k in range(11): add(click(), at(i, ph + 1.2 + k * .075), .15)
add(click(), at(i, ph + 2.35), .5); add(ding(1568), at(i, TL[i]["cues"]["unfreeze"] + .4), .18)
i = name.index("price"); c = TL[i]["cues"]
add(click(), at(i, c["pick"] + .7), .5); add(sweep(700, 500, .3, 6), at(i, c["changed"]), .25)
add(click(), at(i, c["accept"]), .5); add(ding(), at(i, c["ticket"]), .3); add(whoosh(.6), at(i, c["ticket"] - .1), .5)
i = name.index("takeoff"); c = TL[i]["cues"]
d = TL[i]["dur"]; n = smooth_np(noise(d), 40); x = np.arange(len(n)) / SR
roar = n * np.minimum(1, x / 3.5) * np.exp(-np.maximum(0, x - c["lift"] - 2.5) * .9) + .3 * np.sin(2 * np.pi * (90 + 60 * np.minimum(1, x / 4)) * x) * np.minimum(1, x / 3.5) * np.exp(-np.maximum(0, x - c["lift"] - 2) * 1.2)
add(roar, at(i, 0), .55)
i = name.index("landing"); c = TL[i]["cues"]
add(boom(), at(i, c["touch"]), .9); add(smooth_np(noise(.8), 4) * np.exp(-np.arange(int(.8 * SR)) / SR * 4), at(i, c["touch"] + .05), .25)
i = name.index("transfer"); c = TL[i]["cues"]; ph = c["phone"]
add(click(), at(i, ph + 1.0), .5); add(click(), at(i, ph + 2.85), .5); add(ding(), at(i, c["unfreeze"] + .6), .3)
i = name.index("drive"); c = TL[i]["cues"]
n = smooth_np(noise(c["aerial"]), 60); add(n * np.minimum(1, np.arange(len(n)) / SR / .5) * np.exp(-np.maximum(0, np.arange(len(n)) / SR - c["aerial"] + .6) * 4), at(i, 0), .35)
add(ding(1760), at(i, c["aerial"] + 4.5), .2)
i = name.index("outro"); add(ding(1046), at(i, TL[i]["cues"]["end"] + .2), .25); add(ding(1568), at(i, TL[i]["cues"]["end"] + .45), .18)

mix = voice * 1.0 + music + sfx * .7
mix = mix[:int(T * SR)]
mix = np.tanh(mix / (np.abs(mix).max() / 1.6)) * .89  # soft limit
st = np.stack([mix + .0, np.roll(mix, 160)], 1)
with wave.open("mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print("audio", round(T, 2), "s")
