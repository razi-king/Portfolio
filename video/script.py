# Builds the voiceover and the timeline for the trip video.
# Each scene is a list of steps; voice lines set the timing, so the picture always waits for the voice.
import json, subprocess, wave, os
import numpy as np

VOICE = os.environ.get("PIPER_VOICE", "voices/en-us-ryan-high.onnx")
FPS = 30
GAP = 0.38  # breath between lines

# (kind, ...):  ("w", secs) wait | ("m", name) mark | ("vo", id, shown text, spoken text or None)
SCENES = [
 ("open", [("w", 3.4), ("m", "arrive"),
   ("vo", "hi", "Hey, I'm Razi. I build the Go services that sell trips like this one.", None),
   ("vo", "plan", "Tonight I'm flying to Dubai. When something interesting happens behind the screen, I'll freeze the world and show you.", None),
   ("m", "snap"), ("w", 0.5), ("m", "title"), ("w", 3.2)]),
 ("search", [("m", "chapter"), ("w", 2.0), ("m", "phone"), ("w", 3.0), ("m", "freeze"), ("w", 1.0),
   ("vo", "freeze1", "Wait. Let's freeze right here.", None),
   ("vo", "fan", "That one tap sent the search to every supplier at once, each call in its own goroutine.", None),
   ("vo", "safe", "Each one is wrapped in safeGo(), so if a supplier's code panics, we recover and the other results still come back.", "Each one is wrapped in safe Go, so if a supplier's code panics, we recover, and the other results still come back."),
   ("vo", "wait", "You only wait for the slowest supplier. Then a hashmap matches the offers in one pass.", "You only wait for the slowest supplier. Then a hash map matches the offers in one pass."),
   ("vo", "unf", "Okay. Back to the trip.", None),
   ("m", "unfreeze"), ("w", 1.9)]),
 ("price", [("m", "chapter"), ("w", 2.0), ("m", "pick"), ("w", 1.3), ("m", "check"), ("w", 1.6), ("m", "changed"), ("w", 1.2), ("m", "freeze"), ("w", 0.9),
   ("vo", "seen", "See that? The price changed between search and booking. That happens all the time.", None),
   ("vo", "bug", "We once had a bug where the booking kept the old price anyway. I traced it through the Go code, a SQL query, and a SQL function.", "We once had a bug where the booking kept the old price anyway. I traced it through the Go code, an S Q L query, and an S Q L function."),
   ("vo", "rule", "Now the rule is simple: nothing gets saved until the supplier confirms the price.", None),
   ("m", "unfreeze"), ("w", 0.8), ("m", "accept"), ("w", 1.0), ("m", "ticket"), ("w", 2.7)]),
 ("takeoff", [("m", "roll"), ("w", 3.6), ("m", "lift"), ("w", 0.9),
   ("vo", "off", "And we're off.", None), ("w", 1.6), ("m", "clouds"), ("w", 3.0)]),
 ("cruise", [("m", "chapter"), ("w", 2.0),
   ("vo", "day", "Up here, let me tell you about my day job: airline integrations.", None),
   ("vo", "list", "TripJack is live in production. Akasa Air went through QA to sign-off. And I keep FlyArystan, SalamAir and ASL Airlines running.", "Trip Jack is live in production. Akasa Air went through Q A to sign off. And I keep Fly Arystan, Salam Air, and A S L Airlines running."),
   ("vo", "funnel", "Every airline has its own API. I make them all look like one booking flow.", "Every airline has its own A P I. I make them all look like one booking flow."),
   ("w", 1.2)]),
 ("landing", [("m", "descend"), ("w", 3.3), ("m", "touch"), ("w", 3.2)]),
 ("transfer", [("m", "chapter"), ("w", 2.0), ("m", "phone"), ("w", 3.2), ("m", "freeze"), ("w", 0.9),
   ("vo", "last", "Last freeze. This part I helped build from scratch: a transfer booking engine.", None),
   ("vo", "steps", "Five steps: search, revalidate, pre-book, add-ons, and confirm. Each one is a call to the supplier, Amadeus Transfers.", None),
   ("vo", "comm", "Commission rules set the price you see, and bookings live in normalized PostgreSQL tables.", "Commission rules set the price you see, and bookings live in normalized Postgres tables."),
   ("m", "unfreeze"), ("w", 2.3)]),
 ("drive", [("w", 0.9), ("vo", "szr", "Sheikh Zayed Road, then out to the Palm.", "Sheikh Zayed Road. Then out to the Palm."), ("w", 1.4), ("m", "aerial"), ("w", 5.6)]),
 ("outro", [("w", 1.2),
   ("vo", "hop", "Every hop on this trip was an API call that had to be fast, safe and correct. Especially the price.", "Every hop on this trip was an A P I call that had to be fast, safe, and correct. Especially the price."),
   ("vo", "talk", "That's what I build. Want that on your backend team? Let's talk.", None),
   ("w", 0.6), ("m", "end"), ("w", 4.6)]),
]

os.makedirs("vo", exist_ok=True)

def synth(id_, text):
    path = f"vo/{id_}.wav"
    if not os.path.exists(path):
        subprocess.run(["python3", "-m", "piper", "-m", VOICE, "-f", path, "--length_scale", "1.0", "--sentence_silence", "0.28"],
                       input=text.encode(), check=True, capture_output=True)
    with wave.open(path) as w:
        sr, n = w.getframerate(), w.getnframes()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    # trim leading/trailing silence so cues line up with the first word
    nz = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.08 * sr)]
    hop = sr // FPS
    env = [float(np.sqrt(np.mean(a[i:i + hop] ** 2))) for i in range(0, len(a), hop)]
    m = max(env) or 1
    return a, sr, [round(min(1, e / m * 1.4), 3) for e in env]

timeline, placements, t0 = [], [], 0.0
for name, steps in SCENES:
    t, cues, vos = 0.0, {}, []
    for st in steps:
        if st[0] == "w":
            t += st[1]
        elif st[0] == "m":
            cues[st[1]] = t
        else:
            _, id_, shown, spoken = st
            audio, sr, env = synth(id_, spoken or shown)
            d = len(audio) / sr
            vos.append({"id": id_, "s": round(t, 3), "e": round(t + d, 3), "text": shown, "env": env})
            placements.append((t0 + t, id_, audio, sr))
            t += d + GAP
    timeline.append({"name": name, "start": round(t0, 3), "dur": round(t, 3), "cues": cues, "vo": vos})
    t0 += t

with open("timeline.js", "w") as f:
    f.write("window.TL = " + json.dumps(timeline) + ";\n")

# one voice track at 44.1 kHz for the mix
SR = 44100
track = np.zeros(int(SR * (t0 + 1)))
for at, id_, audio, sr in placements:
    if sr != SR:
        x = np.linspace(0, len(audio) - 1, int(len(audio) * SR / sr))
        audio = np.interp(x, np.arange(len(audio)), audio)
    i = int(at * SR)
    track[i:i + len(audio)] += audio
np.save("voice.npy", track)
print("total", round(t0, 2), "s;", [(s["name"], s["dur"]) for s in timeline])
