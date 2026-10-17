"""Taipei bote CCTV source lookup, kept free of torch/YOLO so the lightweight
collector can import it (see collect_training.py / run_collect.sh)."""

from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests

ORIGIN = "https://hls.bote.gov.taipei"


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


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
