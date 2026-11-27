# Renders every scene of trip.html to parts/s<N>.mp4 (one file per scene, same settings).
# usage: python3 render.py            (all scenes)
#        python3 render.py 2 4        (only scenes 2 and 4)
import asyncio, subprocess, os, sys, pathlib
from playwright.async_api import async_playwright

FPS = 30
HERE = pathlib.Path(__file__).resolve().parent
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")

async def main(only):
    (HERE / "parts").mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        await pg.goto((HERE / "trip.html").as_uri())
        await pg.evaluate("document.fonts.ready")
        for i, (start, dur) in enumerate(await pg.evaluate("SCENES")):
            if only and i not in only:
                continue
            out = HERE / f"parts/s{i}.mp4"; tmp = HERE / f"parts/s{i}.tmp.mp4"
            # frames go straight into ffmpeg as JPEGs; no PNG per frame on disk
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                   "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", str(FPS), str(tmp)], stdin=subprocess.PIPE)
            for f in range(round(dur * FPS)):
                await pg.evaluate(f"render({start + f / FPS + 1e-6})")
                ff.stdin.write(await pg.screenshot(type="jpeg", quality=92))
            ff.stdin.close()
            if ff.wait() == 0:
                os.replace(tmp, out)  # only a finished render replaces the old file
                print("scene", i, "done", flush=True)
        await b.close()

asyncio.run(main([int(x) for x in sys.argv[1:]]))
