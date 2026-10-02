"""Collect UNBLURRED Taipei CCTV stills for detector fine-tuning (no inference).

Run once:   ../../../.venv-cctv/bin/python3 collect_training.py
Probe list: ../../../.venv-cctv/bin/python3 collect_training.py --probe
Cameras come from training-cameras.json; each run grabs a few spaced stills per
camera, drops exact duplicates, and appends one JSONL manifest row per image.
Frames are local, gitignored, for training only; delete after training
(user decision 2026-09-29). Exits without work after the configured stopAfter.
"""

import argparse
import hashlib
import json
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from capture import ORIGIN, probe_camera

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "training-cameras.json"
OUT = ROOT / "data" / "training-raw"
LOG_DIR = ROOT / "evidence" / "collect-logs"
TZ = ZoneInfo("Asia/Taipei")
FFMPEG = "/opt/homebrew/bin/ffmpeg"


def grab(url, number, count, spacing, width, height, jpeg_quality):
    """Read `count` frames spaced `spacing` seconds apart from the live HLS."""
    headers = f"Referer: {ORIGIN}/live/index.html?id={number}\r\nOrigin: {ORIGIN}\r\n"
    size = width * height * 3
    command = [FFMPEG, "-hide_banner", "-loglevel", "error", "-nostdin", "-rw_timeout", "8000000",
               "-tls_verify", "1", "-headers", headers, "-re", "-i", url,
               "-t", str(count * spacing + 2), "-vf", f"fps=1/{spacing},scale={width}:{height}",
               "-frames:v", str(count), "-pix_fmt", "bgr24", "-f", "rawvideo", "pipe:1"]
    import cv2
    import numpy as np
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # A stalled stream can block the read forever; kill the decoder after a hard deadline.
    watchdog = threading.Timer(count * spacing + 45, process.kill)
    watchdog.start()
    frames = []
    try:
        for _ in range(count):
            raw = process.stdout.read(size)
            if len(raw) != size:
                break
            image = np.frombuffer(raw, np.uint8).reshape(height, width, 3)
            ok, jpeg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
            if ok:
                frames.append((datetime.now(timezone.utc), jpeg.tobytes()))
    finally:
        watchdog.cancel()
        process.kill()
        process.wait(timeout=5)
    return frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true", help="only check each configured camera's stream")
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    now = datetime.now(TZ)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"{now:%Y%m%d}.jsonl"
    stop_after = datetime.fromisoformat(config["stopAfter"])
    if not args.probe and now > stop_after:
        print(f"stopAfter {stop_after.isoformat()} passed; nothing captured. Unload the launchd job.")
        return
    s = config["sampling"]
    run_id = now.strftime("%Y%m%dT%H%M%S")
    results = []
    lock = threading.Lock()

    def collect(camera):
        row = {"runId": run_id, "cameraId": camera["id"], "number": camera["number"], "startedAt": now.isoformat()}
        try:
            url, _probe = probe_camera(camera["number"])
            if args.probe:
                row["status"] = "ok"
                return row
            frames = grab(url, camera["number"], s["framesPerCamera"], s["spacingSeconds"],
                          s["width"], s["height"], s["jpegQuality"])
            folder = OUT / f"{now:%Y%m%d}" / camera["id"]
            folder.mkdir(parents=True, exist_ok=True)
            manifest = OUT / "manifest.jsonl"
            seen, saved = set(), 0
            for received, jpeg in frames:
                digest = hashlib.sha256(jpeg).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                name = f"{camera['id']}-{received.astimezone(TZ):%Y%m%dT%H%M%S}-{digest[:8]}.jpg"
                (folder / name).write_bytes(jpeg)
                with lock, manifest.open("a") as handle:
                    handle.write(json.dumps({
                        "file": str((folder / name).relative_to(ROOT)), "sha256": digest,
                        "cameraId": camera["id"], "number": camera["number"], "road": camera.get("road"),
                        "lon": camera.get("lon"), "lat": camera.get("lat"), "runId": run_id,
                        "receivedAt": received.isoformat(), "sourceTimeKnown": False,
                        "width": s["width"], "height": s["height"], "blurred": False,
                        "retention": "training only; delete after training",
                    }, ensure_ascii=False) + "\n")
                saved += 1
            row.update(status="ok" if saved else "no-frames", grabbed=len(frames), saved=saved)
        except Exception as exc:  # one camera failing must not stop the run
            row.update(status="error", error=f"{type(exc).__name__}: {exc}"[:300])
        return row

    with ThreadPoolExecutor(max_workers=5) as pool:
        for row in pool.map(collect, config["cameras"]):
            results.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
    with log_path.open("a") as handle:
        handle.write(json.dumps({"runId": run_id, "probe": args.probe, "finishedAt": datetime.now(TZ).isoformat(),
                                 "cameras": results}, ensure_ascii=False) + "\n")
    if not args.probe and not any(r.get("saved") for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
