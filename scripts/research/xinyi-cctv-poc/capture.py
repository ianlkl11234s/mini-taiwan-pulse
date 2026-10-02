"""Bounded local HLS/YOLO probe for three public Taipei traffic cameras.

Example: /private/tmp/cctv-traffic-venv/bin/python3 capture.py --seconds 90 --fps 5
Only short-lived decoded frames are held in memory. Local full-scene blurred
JPEGs contain no drawn boxes; track IDs are camera-local to this sample.
"""

import argparse
import hashlib
import json
import os
import platform
import statistics
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import cv2
import numpy as np
import requests
import torch
from ultralytics import YOLO, __version__ as ultralytics_version
from ultralytics.utils import torch_utils as ultralytics_torch_utils


ROOT = Path(__file__).resolve().parent
ORIGIN = "https://hls.bote.gov.taipei"
CAMERAS = (
    ("T000354", "354", 121.54833, 25.03318, "W"),
    ("T000330", "330", 121.55281, 25.03316, "E"),
    ("T000283", "283", 121.55724, 25.03316, "E"),
)
VEHICLE_CLASSES = (2, 3, 5, 7)  # COCO car, motorcycle, bus, truck
DEFAULT_WIDTH, DEFAULT_HEIGHT = 640, 360
CONFIDENCE = 0.2


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def percentile(values, p):
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower = int(position)
    return ordered[lower] + (ordered[min(lower + 1, len(ordered) - 1)] - ordered[lower]) * (position - lower)


def probe_camera(number):
    """Follow the public player's getCameraInfo -> longTermPath branch."""
    page = f"{ORIGIN}/live/index.html?id={number}"
    response = requests.get(f"{ORIGIN}/live/_api/camera/by-ccd/{number}", timeout=(5, 8))
    response.raise_for_status()
    info = response.json()
    if info.get("state") != "Responding":
        raise RuntimeError(f"official state: {info.get('state', 'unknown')}")
    if not info.get("isLongTerm") or not info.get("longTermPath"):
        raise RuntimeError("official player has no long-term stream path")
    url = urljoin(page, info["longTermPath"])
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != urlparse(ORIGIN).netloc or not parsed.path.endswith(".m3u8"):
        raise RuntimeError("official stream path is outside the expected HTTPS origin")
    headers = {"Referer": page, "Origin": ORIGIN}
    playlist = requests.get(url, headers=headers, timeout=(5, 8))
    playlist.raise_for_status()
    if not playlist.text.startswith("#EXTM3U"):
        raise RuntimeError("official stream did not return an HLS playlist")
    return url, {
        "cameraId": number,
        "pageUrl": page,
        "state": info["state"],
        "streamKind": "long_term_hls",
        "playlistUrl": url,
        "playlistHttpStatus": playlist.status_code,
        "playlistContentType": playlist.headers.get("Content-Type"),
        "playlistCheckedAt": utc_now(),
    }


@dataclass
class Sample:
    id: str
    number: str
    url: str
    camera: dict
    error: str = ""
    started_at: str = ""
    ended_at: str = ""
    started_mono: float = 0.0
    process: subprocess.Popen | None = None
    thread: threading.Thread | None = None
    device: str | None = None
    decoded_frames: int = 0


def read_exact(stream, size):
    buffer = bytearray()
    while len(buffer) < size:
        chunk = stream.read(size - len(buffer))
        if not chunk:
            return None
        buffer.extend(chunk)
    return bytes(buffer)


def normalized_bbox(xyxy, width, height):
    x1, y1, x2, y2 = xyxy
    return [round(max(0.0, min(1.0, coordinate / dimension)), 5)
            for coordinate, dimension in zip((x1, y1, x2, y2), (width, height, width, height))]


def capture_frames(sample, model_path, max_frames, frame_dir, run_id, fps, width, height, imgsz, blur_kernel):
    """Infer as each frame arrives; no raw-frame collection or unbounded queue."""
    camera = sample.camera
    seen_hashes = set()
    timings = []
    detector_timings = []
    tracker_timings = []
    track_motion = {}
    preview_score = -1
    previous_hash = None
    try:
        detector = YOLO(str(model_path))
        model = YOLO(str(model_path))  # independent camera-local ByteTrack state
        frame_bytes = width * height * 3
        first_arrival = None
        for index in range(max_frames):
            raw = read_exact(sample.process.stdout, frame_bytes)
            if raw is None:
                break
            sample.decoded_frames += 1
            received_at = utc_now()
            arrival = time.monotonic()
            if first_arrival is None:
                first_arrival = arrival
                camera["captureStartedAt"] = received_at
            arrival_elapsed = round(arrival - first_arrival, 3)
            t = round(index / fps, 3)
            image = np.frombuffer(raw, np.uint8).reshape(height, width, 3)
            content_hash = hashlib.blake2s(raw, digest_size=8).digest()
            unique_content = content_hash not in seen_hashes
            duplicate_of_previous = content_hash == previous_hash
            seen_hashes.add(content_hash)
            previous_hash = content_hash
            image_name = f"{sample.id}-{index:04d}.jpg"
            image_path = frame_dir / image_name
            # blur_kernel 0 = unblurred local-temporary annotation batch (see --blur-kernel).
            blurred = cv2.GaussianBlur(image, (blur_kernel, blur_kernel), 0) if blur_kernel else image
            if not cv2.imwrite(str(image_path), blurred, [cv2.IMWRITE_JPEG_QUALITY, 65]):
                raise RuntimeError(f"cannot save blurred frame: {image_path}")
            image_url = f"data/{frame_dir.name}/{image_name}"
            if index == 0:
                camera["firstFrameImageUrl"] = image_url
            detector_start = time.monotonic()
            detector_result = detector.predict(
                image, classes=list(VEHICLE_CLASSES), conf=CONFIDENCE,
                imgsz=imgsz, verbose=False,
            )[0]
            detector_ms = round((time.monotonic() - detector_start) * 1000, 1)
            detector_timings.append(detector_ms)
            detector_boxes = detector_result.boxes
            detector_detections = [
                {"className": detector.names[cls], "confidence": round(float(conf), 4),
                 "bbox": normalized_bbox(xyxy, width, height)}
                for cls, conf, xyxy in zip(
                    detector_boxes.cls.int().cpu().tolist(),
                    detector_boxes.conf.cpu().tolist(),
                    detector_boxes.xyxy.cpu().tolist(),
                )
            ]
            tracker_start = time.monotonic()
            result = model.track(
                image, persist=True, tracker="bytetrack.yaml", classes=list(VEHICLE_CLASSES),
                conf=CONFIDENCE, imgsz=imgsz, verbose=False,
            )[0]
            tracker_ms = round((time.monotonic() - tracker_start) * 1000, 1)
            tracker_timings.append(tracker_ms)
            elapsed_ms = round(detector_ms + tracker_ms, 1)
            timings.append(elapsed_ms)
            boxes = result.boxes
            ids = boxes.id.int().cpu().tolist() if boxes.id is not None else []
            detections = []
            moving_in_frame = 0
            for box_index, (cls, conf, xyxy) in enumerate(zip(
                boxes.cls.int().cpu().tolist(), boxes.conf.cpu().tolist(), boxes.xyxy.cpu().tolist()
            )):
                bbox = normalized_bbox(xyxy, width, height)
                track_id = f"track-{ids[box_index]}" if box_index < len(ids) else f"untracked-{index}-{box_index}"
                detections.append({
                    "id": track_id, "className": model.names[cls],
                    "confidence": round(float(conf), 4), "bbox": bbox,
                })
                if box_index < len(ids):
                    center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
                    motion = track_motion.setdefault(track_id, {
                        "count": 0, "first": center, "last": center,
                        "minX": center[0], "maxX": center[0], "minY": center[1], "maxY": center[1],
                        "path": 0.0,
                    })
                    if motion["count"]:
                        step = ((center[0] - motion["last"][0]) ** 2 +
                                (center[1] - motion["last"][1]) ** 2) ** 0.5
                        motion["path"] += step
                        if step >= 0.005:
                            moving_in_frame += 1
                    motion["count"] += 1
                    motion["last"] = center
                    motion["minX"] = min(motion["minX"], center[0])
                    motion["maxX"] = max(motion["maxX"], center[0])
                    motion["minY"] = min(motion["minY"], center[1])
                    motion["maxY"] = max(motion["maxY"], center[1])
            camera["frames"].append({
                "t": t, "receivedAt": received_at,
                "arrivalElapsedSeconds": arrival_elapsed,
                "imageUrl": image_url,
                "uniqueContent": unique_content,
                "duplicateOfPrevious": duplicate_of_previous,
                "inferenceMs": elapsed_ms,
                "detectorInferenceMs": detector_ms,
                "trackerInferenceMs": tracker_ms,
                "detectorDetections": detector_detections,
                "detections": detections,
            })
            camera["captureEndedAt"] = received_at
            # Prefer a frame with visible vehicles and observed image-plane motion.
            score = len(detections) + moving_in_frame * 3
            if score > preview_score:
                preview_score = score
                camera["previewUrl"] = image_url
                camera["previewTime"] = t
        sample.device = str(model.predictor.device) if camera["frames"] else None
    except Exception as exc:
        sample.error = f"capture/inference failed: {type(exc).__name__}: {exc}"
    finally:
        sample.ended_at = utc_now()
        camera["metrics"] = {
            "frames": len(camera["frames"]), "decodedFrames": sample.decoded_frames,
            "droppedFrames": 0, "uniqueFrames": len(seen_hashes),
            "inferenceMedianMs": round(statistics.median(timings), 1) if timings else None,
            "inferenceP95Ms": round(percentile(timings, 0.95), 1) if timings else None,
            "detectorMedianMs": round(statistics.median(detector_timings), 1) if detector_timings else None,
            "detectorP95Ms": round(percentile(detector_timings, 0.95), 1) if detector_timings else None,
            "trackerMedianMs": round(statistics.median(tracker_timings), 1) if tracker_timings else None,
            "trackerP95Ms": round(percentile(tracker_timings, 0.95), 1) if tracker_timings else None,
        }
        eligible = [m for m in track_motion.values() if m["count"] >= 2]
        ranges = [((m["maxX"] - m["minX"]) ** 2 +
                   (m["maxY"] - m["minY"]) ** 2) ** 0.5 for m in eligible]
        camera["motion"] = {
            "coordinateSystem": "normalized-image-plane",
            "tracksWithAtLeast2Samples": len(eligible),
            "movingTracks": sum(value >= 0.02 for value in ranges),
            "stationaryTracks": sum(value < 0.02 for value in ranges),
            "motionThresholdNormalized": 0.02,
            "medianTrackRangeNormalized": round(statistics.median(ranges), 4) if ranges else None,
            "medianTrackPathNormalized": round(statistics.median(m["path"] for m in eligible), 4) if eligible else None,
        }
        if camera["frames"]:
            camera["captureWallSeconds"] = round(
                (datetime.fromisoformat(camera["captureEndedAt"]) -
                 datetime.fromisoformat(camera["captureStartedAt"])).total_seconds(), 3
            )
            camera["wallMinusMediaSeconds"] = round(
                camera["captureWallSeconds"] - camera["frames"][-1]["t"], 3
            )


def start_sample(sample, seconds, fps, max_frames, model_path, frame_dir, run_id, width, height, imgsz, blur_kernel):
    headers = f"Referer: {ORIGIN}/live/index.html?id={sample.number}\r\nOrigin: {ORIGIN}\r\n"
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
        "-rw_timeout", "8000000", "-tls_verify", "1", "-headers", headers,
        "-re", "-i", sample.url,
        "-t", str(seconds), "-vf", f"fps={fps},scale={width}:{height}",
        "-frames:v", str(max_frames), "-pix_fmt", "bgr24", "-f", "rawvideo", "pipe:1",
    ]
    sample.started_at = utc_now()
    sample.started_mono = time.monotonic()
    sample.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    sample.thread = threading.Thread(
        target=capture_frames,
        args=(sample, model_path, max_frames, frame_dir, run_id, fps, width, height, imgsz, blur_kernel), daemon=True,
    )
    sample.thread.start()


def finish_sample(sample, deadline):
    sample.thread.join(timeout=max(0, deadline - time.monotonic()))
    if sample.thread.is_alive():
        sample.error = "capture wall-time limit reached"
        sample.process.terminate()
        try:
            sample.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            sample.process.kill()
        sample.thread.join(timeout=3)
    else:
        sample.process.wait(timeout=3)
    if sample.process.returncode != 0 and not sample.error:
        sample.error = f"decoder exited with code {sample.process.returncode}"
    stderr = sample.process.stderr.read(4000).decode("utf-8", errors="replace").strip()
    if stderr and not sample.camera["frames"]:
        sample.error = stderr.splitlines()[-1][:300]
    if not sample.ended_at:
        sample.ended_at = utc_now()


def main():
    # Bound CPU parallelism across independent detector/tracker camera workers.
    ultralytics_torch_utils.NUM_THREADS = 1
    torch.set_num_threads(1)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=int, default=20)
    parser.add_argument("--fps", type=int, default=2)
    parser.add_argument("--camera", choices=["all", *(camera[0] for camera in CAMERAS)], default="all")
    parser.add_argument("--output", type=Path, default=Path("data/observations.json"))
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--model", type=Path, default=ROOT / "models" / "yolo26n.pt")
    parser.add_argument("--blur-kernel", type=int, default=None,
                        help="odd Gaussian kernel for saved JPEGs; default scales 21px@640; 0 saves UNBLURRED frames "
                             "(local temporary annotation only; requires --output; delete frames after scoring)")
    args = parser.parse_args()
    if not 1 <= args.seconds <= 600 or not 1 <= args.fps <= 5:
        parser.error("seconds must be 1..600 and fps 1..5")
    if not 1 <= args.width <= 1920 or not 1 <= args.height <= 1080 or not 32 <= args.imgsz <= 1920:
        parser.error("width/height must fit 1..1920/1080 and imgsz 32..1920")
    if not args.model.is_file():
        parser.error("model file missing")
    blur_kernel = (max(3, 2 * round((21 * args.width / DEFAULT_WIDTH) / 2) + 1)
                   if args.blur_kernel is None else args.blur_kernel)
    if blur_kernel < 0 or (blur_kernel and blur_kernel % 2 == 0):
        parser.error("--blur-kernel must be 0 or a positive odd number")
    destination = (ROOT / args.output).resolve()
    if blur_kernel == 0 and destination.name in ("observations.json", "validation-observations.json"):
        parser.error("unblurred capture must use its own --output; fixed batches stay blurred")
    if destination == (ROOT / "data/observations.json").resolve() and args.camera != "all":
        parser.error("single-camera capture requires --output; preserving data/observations.json")
    if destination == (ROOT / "data/observations.json").resolve() and args.seconds > 180:
        parser.error("long validation capture requires --output; preserving data/observations.json")
    max_frames = args.seconds * args.fps
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    data_dir = ROOT / "data"
    evidence_dir = ROOT / "evidence"
    data_dir.mkdir(exist_ok=True)
    evidence_dir.mkdir(exist_ok=True)
    frame_dir = data_dir / (f"unblurred-{run_id}" if blur_kernel == 0 else run_id)
    frame_dir.mkdir(exist_ok=False)
    model_sha = hashlib.sha256(args.model.read_bytes()).hexdigest()
    output = {
        "schemaVersion": 1, "mode": "captured", "capturedAt": utc_now(),
        "captureRunId": run_id,
        "durationSeconds": 0, "captureRequestedSeconds": args.seconds,
        "sampleFps": args.fps, "timingMode": "media-relative-CFR",
        "captureSettings": {
            "cameraSelection": args.camera, "width": args.width, "height": args.height,
            "imgsz": args.imgsz, "confidence": CONFIDENCE,
            "classes": list(VEHICLE_CLASSES), "detectorStage": "predict-post-NMS",
            "trackerStage": "track-post-NMS-ByteTrack",
            "blurKernel": blur_kernel, "framesBlurred": blur_kernel > 0,
            "frameRetention": "blurred local frames" if blur_kernel else "UNBLURRED local-temporary frames for annotation; not for Git, backups or sharing; delete after scoring",
        },
        "model": {"name": args.model.name, "sha256": model_sha,
                  "ultralyticsVersion": ultralytics_version,
                  "inferenceDevice": None, "cpuThreads": torch.get_num_threads(), "latencyIncludesFirstFrameWarmup": True},
        "hardware": {"platform": platform.system(), "machine": platform.machine(),
                     "processor": platform.processor()},
        "cameras": [],
    }
    probes = {"checkedAt": utc_now(), "officialPlayerJs": f"{ORIGIN}/live/dist/player.js", "cameras": []}
    samples = []
    selected_cameras = [camera for camera in CAMERAS if args.camera in ("all", camera[0])]
    for camera_id, number, lon, lat, direction in selected_cameras:
        page = f"{ORIGIN}/live/index.html?id={number}"
        camera = {
            "id": camera_id, "lon": lon, "lat": lat, "roadDirection": direction,
            "sourceUrl": page, "status": "unavailable", "width": args.width, "height": args.height,
            "sourceTimeKnown": False, "frames": [],
            "metrics": {"frames": 0, "uniqueFrames": 0, "inferenceMedianMs": None, "inferenceP95Ms": None},
        }
        output["cameras"].append(camera)
        try:
            url, probe = probe_camera(number)
            camera["mediaUrl"] = url
            probes["cameras"].append(probe)
            samples.append(Sample(camera_id, number, url, camera))
        except Exception as exc:
            camera["error"] = f"source probe failed: {type(exc).__name__}: {exc}"
            probes["cameras"].append({"cameraId": number, "pageUrl": page, "error": camera["error"]})
    for sample in samples:
        try:
            start_sample(sample, args.seconds, args.fps, max_frames, args.model,
                         frame_dir, run_id, args.width, args.height, args.imgsz, blur_kernel)
        except Exception as exc:
            sample.error = f"decoder start failed: {type(exc).__name__}: {exc}"
    deadline = time.monotonic() + min(900, max(args.seconds + 120, args.seconds * 2))
    next_report = time.monotonic() + 30
    while any(sample.thread is not None and sample.thread.is_alive() for sample in samples) and time.monotonic() < deadline:
        time.sleep(2)
        if time.monotonic() >= next_report:
            print(json.dumps({"progress": [{"id": s.id, "frames": len(s.camera["frames"])} for s in samples]}), flush=True)
            next_report += 30
    for sample in samples:
        if sample.thread is not None:
            finish_sample(sample, deadline)
        camera = next(item for item in output["cameras"] if item["id"] == sample.id)
        if not camera["frames"]:
            camera["error"] = sample.error or "decoder produced no frames"
            continue
        output["model"]["inferenceDevice"] = sample.device
        if sample.error or len(camera["frames"]) != max_frames:
            camera["error"] = sample.error or f"incomplete capture: {len(camera['frames'])}/{max_frames} frames"
        else:
            camera["status"] = "ok"
    output["durationSeconds"] = round(max(
        (c["frames"][-1]["t"] for c in output["cameras"] if c["frames"]), default=0
    ), 3)
    (evidence_dir / f"capture-source-probe-{run_id}.json").write_text(
        json.dumps(probes, ensure_ascii=False, indent=2) + "\n"
    )
    if all(camera["status"] == "ok" for camera in output["cameras"]):
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}-{run_id}.tmp")
        temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
        os.replace(temporary, destination)
    else:
        destination = evidence_dir / f"capture-failed-{run_id}.json"
        destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(destination),
                      "cameras": [{"id": c["id"], "status": c["status"], **c["metrics"],
                                   "error": c.get("error")} for c in output["cameras"]]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
