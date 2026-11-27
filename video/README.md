# Trip video: Mumbai → Dubai → Palm Jumeirah

The narrated video shown under "Why me" on the site (`frontend/public/video/trip-bom-dxb.mp4`) is built from code in this folder.
Every frame is drawn by `trip.html` (SVG + HTML), captured with headless Chrome, and encoded with ffmpeg.

| File | What it does |
|---|---|
| `script.py` | The voiceover script and scene timing. Generates each line with Piper TTS into `vo/`, then writes `timeline.js` (cue times, subtitles, mouth movement) and the voice track. |
| `trip.html` | The animation. `render(t)` draws the frame at time `t` seconds. Open `trip.html#42` in a browser to see second 42. |
| `render.py` | Captures every scene to `parts/s<N>.mp4`. |
| `mix.py` | Music, sound effects and voice, mixed to `mix.wav` (music ducks under the voice and thins out during freezes). |

## Rebuild it

```bash
pip install piper-tts playwright numpy
# voice model: voice-en-us-ryan-high from https://github.com/rhasspy/piper/releases/tag/v0.0.2, unpacked into voices/
python3 script.py            # voice lines + timeline.js
python3 render.py            # all scenes (about 10 minutes)
python3 mix.py               # audio
printf "file 'parts/s%d.mp4'\n" 0 1 2 3 4 5 6 7 8 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy silent.mp4
ffmpeg -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart trip.mp4
```

To change a line: edit it in `script.py`, delete its file in `vo/`, rerun `script.py`, then re-render only the scene it belongs to (`python3 render.py 2`) and rerun `mix.py`.
To use your own voice: record each line as `vo/<id>.wav` (ids are in `script.py`) and run `script.py`; it keeps existing files.
