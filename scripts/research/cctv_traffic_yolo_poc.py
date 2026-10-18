"""Bounded, single-camera MJPEG traffic-count feasibility probe.

Reads one camera from the checked-in TDX point snapshot. Reports aggregate
detections and line crossings only; does not save frames or vehicle IDs.
Example:
  python3 scripts/research/cctv_traffic_yolo_poc.py \
    --camera-id C010020 --model /path/to/yolo26n.pt --seconds 30 \
    --line-axis y --line-at 0.42 --roi-x-min 0.05 --roi-x-max 0.55
"""

import argparse
import hashlib
import json
import time
from collections import Counter
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import requests
from ultralytics import YOLO, __version__ as ultralytics_version


ROOT = Path(__file__).resolve().parents[2]
GEOJSON = ROOT / "public/geo/cctv.geojson"
VEHICLE_CLASSES = (2, 3, 5, 7)  # COCO: car, motorcycle, bus, truck


def camera_properties(camera_id: str) -> dict:
    features = json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]
    for feature in features:
        props = feature["properties"]
        if props.get("CCTVID") == camera_id:
            return props
    raise ValueError(f"CCTVID not found: {camera_id}")


def mjpeg_frames(response: requests.Response):
    """Extract JPEG frames from a multipart stream without persisting bytes."""
    buffer = bytearray()
    for chunk in response.iter_content(chunk_size=16_384):
        if not chunk:
            continue
        buffer.extend(chunk)
        while True:
            start = buffer.find(b"\xff\xd8")
            if start < 0:
                buffer[:] = buffer[-1:] if buffer.endswith(b"\xff") else b""
                break
            end = buffer.find(b"\xff\xd9", start + 2)
            if end < 0:
                if start:
                    del buffer[:start]
                if len(buffer) > 4_000_000:
                    buffer.clear()
                break
            frame = cv2.imdecode(np.frombuffer(bytes(buffer[start:end + 2]), np.uint8), cv2.IMREAD_COLOR)
            del buffer[:end + 2]
            if frame is not None:
                yield frame


def video_frames(path: Path):
    """Replay a short local validation clip; release the decoder on exit."""
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError(f"Cannot open video: {path}")
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            yield frame
    finally:
        capture.release()


def sha256_file(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera-id", required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--seconds", type=int, default=30)
    parser.add_argument("--sample-fps", type=float, default=2.0)
    parser.add_argument("--video-file", type=Path,
                        help="Replay a bounded local clip instead of opening the live stream")
    parser.add_argument("--max-video-frames", type=int, default=600,
                        help="Stop local replay after this many frames (default: 600)")
    parser.add_argument("--line-axis", choices=("x", "y"), default="y",
                        help="x is a vertical line; y is a horizontal line")
    parser.add_argument("--line-at", type=float, default=0.5,
                        help="Count line position as a fraction of image width or height")
    parser.add_argument("--confidence", type=float, default=0.2)
    parser.add_argument("--roi-x-min", type=float, default=0.0)
    parser.add_argument("--roi-x-max", type=float, default=1.0)
    parser.add_argument("--insecure-tls", action="store_true",
                        help="POC only: allow official source with an invalid certificate")
    args = parser.parse_args()
    if not 1 <= args.seconds <= 120 or not 0 < args.sample_fps <= 5:
        parser.error("seconds must be 1..120 and sample-fps must be 0..5")
    if not 1 <= args.max_video_frames <= 3600:
        parser.error("max-video-frames must be 1..3600")
    if not 0 < args.line_at < 1:
        parser.error("line-at must be between 0 and 1")
    if not 0 <= args.roi_x_min < args.roi_x_max <= 1:
        parser.error("ROI x bounds must satisfy 0 <= min < max <= 1")
    if args.line_axis == "x" and (args.roi_x_min != 0 or args.roi_x_max != 1):
        parser.error("ROI x bounds are only supported for a horizontal (y-axis) count line")

    props = camera_properties(args.camera_id)
    url = str(props.get("VideoStreamURL") or "")
    if not args.video_file and not url.startswith("https://"):
        parser.error("POC requires an HTTPS MJPEG stream from the point snapshot")
    model = YOLO(str(args.model))
    model_sha256 = sha256_file(args.model)
    if args.insecure_tls:
        requests.packages.urllib3.disable_warnings(category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

    started_at_utc = datetime.now(timezone.utc).isoformat()
    started = time.monotonic()
    next_sample = started
    frames = 0
    peak_visible = Counter()
    crossings = Counter()
    previous_side = {}
    crossed = set()
    frame_hashes = set()
    track_samples = Counter()
    with ExitStack() as stack:
        if args.video_file:
            frame_source = video_frames(args.video_file)
            stack.callback(frame_source.close)
            input_media = "local_video_replay"
        else:
            response = stack.enter_context(requests.get(
                url, stream=True, timeout=(5, 8), verify=not args.insecure_tls,
                headers={"User-Agent": "Mozilla/5.0"}))
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "multipart/" not in content_type.lower():
                raise ValueError(f"Expected MJPEG multipart; got {content_type}")
            frame_source = mjpeg_frames(response)
            stack.callback(frame_source.close)
            input_media = "live_mjpeg"
        for frame in frame_source:
            now = time.monotonic()
            if args.video_file:
                if frames >= args.max_video_frames:
                    break
            else:
                if now - started >= args.seconds:
                    break
                if now < next_sample:
                    continue
                next_sample = now + 1 / args.sample_fps
            frames += 1
            frame_hashes.add(hashlib.blake2s(frame.tobytes(), digest_size=8).digest())
            result = model.track(frame, persist=True, tracker="bytetrack.yaml",
                                 classes=list(VEHICLE_CLASSES), conf=args.confidence,
                                 verbose=False)[0]
            boxes = result.boxes
            visible = Counter(int(cls) for cls in boxes.cls.cpu().tolist())
            for cls, count in visible.items():
                peak_visible[cls] = max(peak_visible[cls], count)
            if boxes.id is None:
                continue
            for track_id, cls, xywh in zip(boxes.id.int().cpu().tolist(),
                                           boxes.cls.int().cpu().tolist(),
                                           boxes.xywh.cpu().tolist()):
                track_samples[track_id] += 1
                axis_index = 0 if args.line_axis == "x" else 1
                axis_size = frame.shape[1] if args.line_axis == "x" else frame.shape[0]
                side = xywh[axis_index] / axis_size >= args.line_at
                prior = previous_side.get(track_id)
                within_roi = args.roi_x_min <= xywh[0] / frame.shape[1] <= args.roi_x_max
                if prior is not None and prior != side and track_id not in crossed and within_roi:
                    direction = ("right" if side else "left") if args.line_axis == "x" else ("down" if side else "up")
                    crossings[(cls, direction)] += 1
                    crossed.add(track_id)
                previous_side[track_id] = side

    names = model.names
    print(json.dumps({
        "camera_id": args.camera_id,
        "input_media": input_media,
        "video_frame_limit": args.max_video_frames if args.video_file else None,
        "source": props.get("source"),
        "road_name": props.get("RoadName"),
        "started_at_utc": started_at_utc,
        "ended_at_utc": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(time.monotonic() - started, 1) if not args.video_file else None,
        "processing_seconds": round(time.monotonic() - started, 1),
        "sampled_frames": frames,
        "distinct_frame_contents": len(frame_hashes),
        "tracks_seen_with_multiple_samples": sum(n > 1 for n in track_samples.values()),
        "line_axis": args.line_axis,
        "line_at_fraction": args.line_at,
        "roi_x_fraction": [args.roi_x_min, args.roi_x_max],
        "confidence_threshold": args.confidence,
        "peak_visible_by_class": {names[cls]: count for cls, count in sorted(peak_visible.items())},
        "line_crossings_by_class_direction": {
            f"{names[cls]}_{direction}": count for (cls, direction), count in sorted(crossings.items())
        },
        "model_sha256": model_sha256,
        "video_sha256": sha256_file(args.video_file) if args.video_file else None,
        "ultralytics_version": ultralytics_version,
        "tls_verification": not args.insecure_tls if not args.video_file else None,
        "interpretation": "Preliminary detector output; not validated traffic volume.",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
