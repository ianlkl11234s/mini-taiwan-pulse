#!/usr/bin/env python3
"""City Sound Atlas W6-0／W6-1：氣象署雷達整合回波（O-A0058-005）→ 北北 250 m 網格雨勢每日包。

W6-1 正式包（--publish）：public/sound-atlas/grid/radar-rain-<D>.class.bin（gzip 分級碼 0–4／255）＋ .meta.json
  （schema pulse-sound-radar-rain-v1；含網格定義與雜湊、幀時刻、缺幀、色表版本、Z-R、分級門檻、雜波濾波規則與濾掉格數）。
  雜波濾波與分級的純函式在 scripts/preprocess/sound/radar_rain_lib.py（單元測試 test_radar_rain_lib.py）。
  產出後用 scripts/deploy/build-public-assets-lock.py add 登記；不 git add。
以下是 W6-0 量測 spike 的原說明（不加 --publish 時的行為）。

輸入（公開，免金鑰）：
  https://data.itsmigu.com/imagery/cwa/manifest-<UTC日 YYYY-MM-DD>.json
  https://data.itsmigu.com/imagery/cwa/O-A0058-005/<UTC日 YYYYMMDD>/<HHMMSS>.png
  3600×3600 RGBA、bbox [115.0, 17.75, 126.5, 29.25]（等經緯度）、每 10 分一張。
  色表：scripts/preprocess/sound/cwa-radar-palette.json（氣象署官方色條取樣；66 色 = 0–65 dBZ）。
  網格：src/sound/grid/gridSpec.json（與前端共讀）。

流程：
  1. 臺灣日 D 的 144 個 10 分槽 = UTC (D−1) 16:00 … D 15:50，跨兩個 UTC 資料夾。
     先讀兩天 manifest；manifest 404 時逐 key 試抓。HTTP 404 = 缺幀；逾時／5xx 重試 3 次，仍失敗記為 fetch_error（也算缺幀）。
     **缺幀整幀 255，不內插。** 下載平行度 3；原始 PNG 快取在 --cache-dir（不進 git）。
  2. 每幀只取北北網格：格心最近鄰取雷達像素（雷達像素 ≈ 320×355 m，比網格粗，不做雙線性）。
  3. 顏色 → dBZ（查表）；透明 = 無回波。表外顏色一律報錯列出（不做最近色配對），--allow-unknown-colors 時改記 255。
  4. dBZ → 雨率：Marshall-Palmer Z = 200·R^1.6（**假設**；未以本地雨滴譜校正）。
  5. 雨率 → 分級（門檻是**假設**，見 RAIN_CLASS_EDGES_MM_H）。

輸出（public/sound-atlas/grid-spike/，資料檔不 git add）：
  radar-rain-<D>.meta.json        幀狀態、色表版本、門檻、各封裝大小
  radar-rain-<D>.dbz.u8           (a) 每幀全 bbox 網格的 dBZ 碼串接（0 無回波、1–66 = 0–65 dBZ+1、255 缺幀）
  radar-rain-<D>.class.u8         分級碼串接（0–4、255 缺幀）
  radar-rain-<D>.class-xor.u8     (b) 分級逐幀與前一幀 XOR（差分；缺幀不參與）
  radar-rain-<D>.class-rle.bin    (b) 範圍內格的分級逐幀 RLE（[值, 長度≤255] 位元組對）
  radar-rain-<D>.class-atlas.png  (c) 12×12 圖集，8-bit 調色盤 PNG（像素值 = 分級碼）
  radar-rain-<D>.dbz-atlas.png    (c') 同上，像素值 = dBZ 碼
  radar-rain-<D>.native-dbz.u8    原生雷達像素裁切（不重採樣）的 dBZ 碼串接，對照用
大小比較：gzip -9（Python gzip）與 brotli -q 11（/opt/homebrew/bin/brotli CLI）。

交叉檢查（--crosscheck <scene.json>）：場景快照的雨量站（每站每小時一筆；precipitation_1hr 是 observed_at 前 60 分的累積），
  與站所在格「observed_at 前 60 分內 6 幀」雷達雨率平均比分級（分兩種口徑：6 幀全到才比／≥4 幀即比、以有效幀平均），印混淆表與明顯不合清單。

用法（repo 根目錄）：
  python3 scripts/preprocess/build-sound-radar-rain.py --date 2026-11-09 --cache-dir <scratch>/radar_cache \
      [--out-dir public/sound-atlas/grid-spike] [--crosscheck public/sound-atlas/scenes/taipei-1109.json]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import math
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads((ROOT / "src/sound/grid/gridSpec.json").read_text(encoding="utf-8"))
PALETTE_PATH = ROOT / "scripts/preprocess/sound/cwa-radar-palette.json"
BASE = "https://data.itsmigu.com/imagery/cwa"
PRODUCT = "O-A0058-005"
RADAR_BBOX = (115.0, 17.75, 126.5, 29.25)
RADAR_SIZE = 3600
RADAR_DEG = (RADAR_BBOX[2] - RADAR_BBOX[0]) / RADAR_SIZE  # 0.0031944°（經緯同步長）
TZ_TW = timezone(timedelta(hours=8))
UNKNOWN = 255
BROTLI = "/opt/homebrew/bin/brotli"
USER_AGENT = "pulse-sound-atlas-spike/0.1"

# 假設參數（Z-R、分級門檻）與雜波濾波：scripts/preprocess/sound/radar_rain_lib.py（門檻正本 src/sound/grid/rainClasses.json）
import sys  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent / "sound"))
from radar_rain_lib import (  # noqa: E402
    CLUTTER_JUMP_DB, CLUTTER_MIN_DBZ, CLUTTER_NEIGHBOR_CELLS, CLUTTER_RULE_VERSION, DBZ_BIN_OFFSET, RAIN_CLASSES,
    RAIN_CLASS_EDGES_MM_H, RAIN_CLASS_NAMES, ZR_A, ZR_B, clutter_mask, codes_to_class, dbz_to_rate, rate_to_class,
)

SCHEMA = "pulse-sound-radar-rain-v1"


# ── 下載 ────────────────────────────────────────────────
def http_get(url: str, retries: int = 3, timeout: float = 30.0) -> tuple[str, bytes | None]:
    """回 ('ok', bytes)／('missing', None)（404）／('fetch_error', None)"""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return "ok", r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):  # R2 公開桶對不存在的 key 可能回 403／404
                return "missing", None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1.5 * (attempt + 1))
    return "fetch_error", None


def slots_for_taiwan_day(day: str) -> list[datetime]:
    start = datetime.fromisoformat(f"{day}T00:00:00+08:00").astimezone(timezone.utc)
    return [start + timedelta(minutes=10 * i) for i in range(144)]


def frame_key(t: datetime) -> str:
    return f"{PRODUCT}/{t:%Y%m%d}/{t:%H%M%S}.png"


def manifest_keys(utc_day: str, cache: Path) -> set[str] | None:
    p = cache / f"manifest-{utc_day}.json"
    if not p.exists():
        st, body = http_get(f"{BASE}/manifest-{utc_day}.json")
        if st != "ok":
            return None
        p.write_bytes(body)  # type: ignore[arg-type]
    m = json.loads(p.read_text())
    return {f["key"].removeprefix("imagery/cwa/") for f in m["frames"] if f.get("product") == PRODUCT}


def fetch_frames(day: str, cache: Path) -> list[dict]:
    slots = slots_for_taiwan_day(day)
    manifests = {d: manifest_keys(d, cache) for d in sorted({f"{t:%Y-%m-%d}" for t in slots})}

    def one(t: datetime) -> dict:
        key = frame_key(t)
        local = cache / key
        rec = {"utc": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "key": key}
        if local.exists():
            return {**rec, "status": "ok", "path": str(local)}
        keys = manifests[f"{t:%Y-%m-%d}"]
        if keys is not None and key not in keys:
            return {**rec, "status": "missing", "via": "manifest"}
        st, body = http_get(f"{BASE}/{key}")
        if st == "ok":
            local.parent.mkdir(parents=True, exist_ok=True)
            local.write_bytes(body)  # type: ignore[arg-type]
            return {**rec, "status": "ok", "path": str(local)}
        return {**rec, "status": st, "via": "manifest" if keys is not None else "probe"}

    with ThreadPoolExecutor(max_workers=3) as ex:
        frames = list(ex.map(one, slots))
    for f in frames:
        f["manifest"] = "ok" if manifests[f["utc"][:10]] is not None else "404"
    return frames


# ── 色表與重採樣 ────────────────────────────────────────
def load_palette() -> tuple[dict[int, int], dict]:
    pal = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    lut: dict[int, int] = {}
    for e in pal["entries"]:
        r, g, b = (int(e["rgb"][i:i + 2], 16) for i in (1, 3, 5))
        lut[(r << 16) | (g << 8) | b] = int(e["dbz"]) + 1  # dBZ 碼：dBZ+1（0 保留給無回波）
    return lut, pal


def grid_pixel_index() -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """每格格心的雷達像素 (row, col)，並回裁切窗 (r0, r1, c0, c1)"""
    cols, rows = SPEC["cols"], SPEC["rows"]
    lon = SPEC["west"] + (np.arange(cols) + 0.5) * SPEC["dLon"]
    lat = SPEC["north"] - (np.arange(rows) + 0.5) * SPEC["dLat"]
    pc = np.floor((lon - RADAR_BBOX[0]) / RADAR_DEG).astype(int)
    pr = np.floor((RADAR_BBOX[3] - lat) / RADAR_DEG).astype(int)
    window = (int(pr.min()), int(pr.max()) + 1, int(pc.min()), int(pc.max()) + 1)
    return pr, pc, window


def decode_frame(path: str, lut: dict[int, int], window: tuple[int, int, int, int]) -> tuple[np.ndarray, dict[str, int]]:
    """裁切窗內的 dBZ 碼（uint8）；表外顏色回傳計數"""
    r0, r1, c0, c1 = window
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im.crop((c0, r0, c1, r1)), dtype=np.uint8)
    rgb = (a[..., 0].astype(np.uint32) << 16) | (a[..., 1].astype(np.uint32) << 8) | a[..., 2]
    alpha = a[..., 3]
    out = np.full(rgb.shape, UNKNOWN, dtype=np.uint8)
    out[alpha == 0] = 0
    opaque = alpha == 255
    bad: dict[str, int] = {}
    for val in np.unique(rgb[opaque]):
        code = lut.get(int(val))
        sel = opaque & (rgb == val)
        if code is None:
            bad[f"#{int(val):06x}"] = int(sel.sum())
        else:
            out[sel] = code
    partial = (alpha != 0) & (alpha != 255)
    if partial.any():
        for al in np.unique(alpha[partial]):
            bad[f"alpha={int(al)}"] = int((alpha == al).sum())
    return out, bad


# ── 封裝 ───────────────────────────────────────────────
def gz_size(b: bytes) -> int:
    return len(gzip.compress(b, compresslevel=9, mtime=0))


def br_size(b: bytes) -> int:
    return len(subprocess.run([BROTLI, "-q", "11", "-c"], input=b, capture_output=True, check=True).stdout)


def sizes(b: bytes) -> dict[str, int]:
    return {"raw": len(b), "gz9": gz_size(b), "br11": br_size(b)}


def rle_frames(frames: np.ndarray) -> bytes:
    """frames: (n, cells) uint8 → 逐幀 [值, 長度] 位元組對（長度 ≤255）"""
    out = bytearray()
    for f in frames:
        i, n = 0, len(f)
        while i < n:
            v = f[i]
            j = i + 1
            while j < n and f[j] == v and j - i < 255:
                j += 1
            out += bytes((int(v), j - i))
            i = j
    return bytes(out)


def atlas_png(frames: np.ndarray, palette_rgb: list[tuple[int, int, int]]) -> bytes:
    n = frames.shape[0]
    rows, cols = SPEC["rows"], SPEC["cols"]
    tiles_x = 12
    tiles_y = math.ceil(n / tiles_x)
    canvas = np.full((tiles_y * rows, tiles_x * cols), UNKNOWN, dtype=np.uint8)
    for k in range(n):
        ty, tx = divmod(k, tiles_x)
        canvas[ty * rows:(ty + 1) * rows, tx * cols:(tx + 1) * cols] = frames[k].reshape(rows, cols)
    im = Image.fromarray(canvas, mode="P")
    pal = [0] * 768
    for i, (r, g, b) in enumerate(palette_rgb[:256]):
        pal[i * 3:i * 3 + 3] = [r, g, b]
    im.putpalette(pal)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── 交叉檢查 ───────────────────────────────────────────
def crosscheck(scene_path: Path, day: str, frames_meta: list[dict], dbz_frames: np.ndarray, min_frames: int) -> dict:
    scene = json.loads(scene_path.read_text(encoding="utf-8"))
    rows = scene["rain"]["rows"]
    slots = {f["utc"]: i for i, f in enumerate(frames_meta)}
    ok_frame = np.array([f["status"] == "ok" for f in frames_meta])
    cols_n = SPEC["cols"]
    conf = np.zeros((5, 5), dtype=int)
    skipped = {"outside_grid": 0, "gauge_null": 0, "frames_missing": 0, "outside_day": 0}
    mismatches = []
    pairs = []
    partial_hours = 0
    for r in rows:
        mm = r.get("precipitation_1hr")
        if mm is None:
            skipped["gauge_null"] += 1
            continue
        col = math.floor((r["lng"] - SPEC["west"]) / SPEC["dLon"])
        row = math.floor((SPEC["north"] - r["lat"]) / SPEC["dLat"])
        if not (0 <= col < cols_n and 0 <= row < SPEC["rows"]):
            skipped["outside_grid"] += 1
            continue
        obs = datetime.fromisoformat(r["observed_at"]).astimezone(timezone.utc)
        idx = []
        for k in range(6):  # (obs−60, obs] 內 6 個 10 分槽
            t = obs - timedelta(minutes=10 * k)
            t = t.replace(minute=t.minute - t.minute % 10, second=0)
            idx.append(slots.get(t.strftime("%Y-%m-%dT%H:%M:%SZ")))
        if any(i is None for i in idx):
            skipped["outside_day"] += 1
            continue
        n_ok = int(ok_frame[idx].sum())
        if n_ok < min_frames:
            skipped["frames_missing"] += 1
            continue
        if n_ok < 6:
            partial_hours += 1
        codes = dbz_frames[idx, row * cols_n + col].astype(float)
        codes = codes[ok_frame[idx]]
        rate = np.where(codes == 0, 0.0, dbz_to_rate(codes - 1 + DBZ_BIN_OFFSET))
        radar_mm = float(rate.mean())  # 有效幀平均雨率（mm/h）≈ 該小時累積 mm
        gc = int(rate_to_class(np.array([mm]))[0])
        rc = int(rate_to_class(np.array([radar_mm]))[0])
        conf[gc, rc] += 1
        pairs.append((mm, radar_mm))
        if abs(gc - rc) >= 2:
            mismatches.append({"station": r["station_id"], "name": r.get("station_name"), "observed_at": r["observed_at"],
                               "gauge_mm_1h": mm, "radar_mm_1h": round(radar_mm, 2), "gauge_class": gc, "radar_class": rc})
    g = np.array([p[0] for p in pairs])
    rr = np.array([p[1] for p in pairs])
    wet = (g > 0) | (rr > 0)
    stats = {
        "n_pairs": len(pairs),
        "min_frames_per_hour": min_frames,
        "pairs_with_partial_frames": partial_hours,
        "skipped": skipped,
        "exact_class_agree": float(np.trace(conf) / conf.sum()) if conf.sum() else None,
        "within_one_class": float(sum(conf[i, j] for i in range(5) for j in range(5) if abs(i - j) <= 1) / conf.sum()) if conf.sum() else None,
        "pearson_wet": float(np.corrcoef(g[wet], rr[wet])[0, 1]) if wet.sum() > 2 else None,
        "sum_gauge_mm": float(g.sum()),
        "sum_radar_mm": float(rr.sum()),
        "gauge_dry_radar_wet(>=0.5)": int(((g == 0) & (rr >= 0.5)).sum()),
        "gauge_wet(>=0.5)_radar_dry": int(((g >= 0.5) & (rr == 0)).sum()),
    }
    mismatches.sort(key=lambda m: -abs(m["gauge_mm_1h"] - m["radar_mm_1h"]))
    return {"scene": scene_path.name, "confusion_gauge_rows_radar_cols": conf.tolist(), "stats": stats, "worst_mismatches": mismatches[:15]}


def publish(args, frames_meta: list[dict], dbz: np.ndarray, cls: np.ndarray, in_scope: np.ndarray, pal: dict,
            missing: list[int], seen_codes: set[int]) -> None:
    """W6-1 正式每日包：radar-rain-<D>.class.bin（gzip -9 的分級碼）＋ radar-rain-<D>.meta.json。

    封裝選 gzip uint8（不選 8-bit PNG 圖集）：位元組精確、Node 測試可直接解、瀏覽器用原生 DecompressionStream；
    PNG 經 canvas 讀回有色彩管理／預乘風險，且傳輸大小相近（W6-0：93 K／153 K 對 104 K／153 K）。
    正式站對 .bin（application/octet-stream）不自動壓縮，所以預先 gzip；前端以 1f 8b 魔數判斷要不要解壓。
    """
    n = dbz.shape[0]
    rows, cols = SPEC["rows"], SPEC["cols"]
    frame_ok = np.array([f["status"] == "ok" for f in frames_meta])
    flag = clutter_mask(dbz, frame_ok, rows, cols)
    out_cls = cls.copy()
    out_cls[flag] = UNKNOWN
    per_frame = []
    for i in range(n):
        k_all = int(flag[i].sum())
        if k_all:
            k_in = int((flag[i] & in_scope).sum())
            per_frame.append({"utc": frames_meta[i]["utc"], "cells_bbox": k_all, "cells_in_scope": k_in,
                              "max_dbz": int(dbz[i][flag[i]].max()) - 1})
    payload = gzip.compress(out_cls.tobytes(), compresslevel=9, mtime=0)
    stem = f"radar-rain-{args.date}"
    (args.out_dir / f"{stem}.class.bin").write_bytes(payload)
    spec_bytes = (ROOT / "src/sound/grid/gridSpec.json").read_bytes()
    slot0 = slots_for_taiwan_day(args.date)[0]
    meta = {
        "schema": SCHEMA,
        "date_taiwan": args.date,
        "product": PRODUCT,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "grid": {k: SPEC[k] for k in ("id", "west", "north", "dLon", "dLat", "cols", "rows")} | {"sha256": hashlib.sha256(spec_bytes).hexdigest()},
        "payload": {"file": f"{stem}.class.bin", "encoding": "gzip", "dtype": "uint8", "layout": "frame-major, frame k = cells row·cols+col",
                    "bytes": len(payload), "raw_bytes": int(out_cls.size), "sha256": hashlib.sha256(payload).hexdigest()},
        "frames": {"count": n, "step_s": 600, "first_slot_utc": slot0.strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "slot_rule": "frame k 代表 [first_slot + k·600 s, +600 s)；雷達圖時刻＝該槽起點"},
        "frames_missing": [{"index": i, "utc": frames_meta[i]["utc"], "status": frames_meta[i]["status"]} for i in missing],
        "classes": {"version": RAIN_CLASSES["version"], "edges_mm_h": list(RAIN_CLASS_EDGES_MM_H), "names_zh": list(RAIN_CLASS_NAMES), "unknown": UNKNOWN},
        "zr": {"a": ZR_A, "b": ZR_B, "note": "Marshall-Palmer，假設"},
        "palette": {"path": str(PALETTE_PATH.relative_to(ROOT)), "retrieved": pal["source"]["retrieved"]},
        "transparent_rule": "透明像素＝無回波（假設；官方圖例未說明）",
        "clutter": {"rule": CLUTTER_RULE_VERSION, "min_dbz": CLUTTER_MIN_DBZ, "jump_db": CLUTTER_JUMP_DB, "neighbor_cells": CLUTTER_NEIGHBOR_CELLS,
                    "description": "回波 ≥ min_dbz 且前、後一幀在 ±neighbor_cells 格內最大回波都低 jump_db 以上 → 255；前或後一幀缺（含當日首末幀）不判定",
                    "cells_flagged_bbox": int(flag.sum()), "cells_flagged_in_scope": int((flag & in_scope[None, :]).sum()), "frames": per_frame},
        "dbz_codes_seen_in_window": sorted(seen_codes),
    }
    (args.out_dir / f"{stem}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"date": args.date, "frames_ok": n - len(missing), "missing": len(missing), "bytes": len(payload),
                      "clutter_bbox": meta["clutter"]["cells_flagged_bbox"], "clutter_in_scope": meta["clutter"]["cells_flagged_in_scope"],
                      "clutter_frames": per_frame}, ensure_ascii=False))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="臺灣日 YYYY-MM-DD")
    ap.add_argument("--cache-dir", type=Path, required=True, help="原始 PNG 快取（放 repo 外）")
    ap.add_argument("--out-dir", type=Path, default=ROOT / "public/sound-atlas/grid-spike")
    ap.add_argument("--crosscheck", type=Path, help="場景快照（取雨量站）")
    ap.add_argument("--allow-unknown-colors", action="store_true")
    ap.add_argument("--publish", action="store_true",
                    help="正式每日包（W6-1）：雜波濾波後的分級碼 gzip＋meta，輸出到 public/sound-atlas/grid/（不產 spike 比較檔）")
    args = ap.parse_args()
    if args.publish and args.out_dir == ROOT / "public/sound-atlas/grid-spike":
        args.out_dir = ROOT / "public/sound-atlas/grid"
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    lut, pal = load_palette()
    t0 = time.perf_counter()
    frames_meta = fetch_frames(args.date, args.cache_dir)
    t_fetch = time.perf_counter() - t0
    pr, pc, window = grid_pixel_index()
    r0, r1, c0, c1 = window
    cells = SPEC["rows"] * SPEC["cols"]
    n = len(frames_meta)
    dbz = np.full((n, cells), UNKNOWN, dtype=np.uint8)
    native = np.full((n, (r1 - r0) * (c1 - c0)), UNKNOWN, dtype=np.uint8)
    bad_all: dict[str, int] = {}
    seen_codes: set[int] = set()
    sel_r = (pr - r0)[:, None]
    sel_c = (pc - c0)[None, :]
    t1 = time.perf_counter()
    for i, f in enumerate(frames_meta):
        if f["status"] != "ok":
            continue
        crop, bad = decode_frame(f["path"], lut, window)
        if bad:
            f["unknown_colors"] = bad
            for k, v in bad.items():
                bad_all[k] = bad_all.get(k, 0) + v
            if not args.allow_unknown_colors:
                continue
        native[i] = crop.reshape(-1)
        dbz[i] = crop[sel_r, sel_c].reshape(-1)
        seen_codes.update(int(x) for x in np.unique(crop))
    t_decode = time.perf_counter() - t1
    if bad_all and not args.allow_unknown_colors:
        raise SystemExit(f"表外顏色（未硬配）：{bad_all}")

    rate = np.where((dbz == 0) | (dbz == UNKNOWN), 0.0, dbz_to_rate(dbz.astype(float) - 1 + DBZ_BIN_OFFSET))
    cls = rate_to_class(rate)
    cls[dbz == UNKNOWN] = UNKNOWN
    missing = [i for i, f in enumerate(frames_meta) if f["status"] != "ok"]

    from_grid_mask = ROOT / "src/sound/grid/gridMask.generated.ts"
    spans = json.loads("[" + ",".join(
        line.strip().rstrip(",") for line in from_grid_mask.read_text(encoding="utf-8").splitlines()
        if line.startswith("  [")) + "]")
    in_scope = np.zeros(cells, dtype=bool)
    for row, rs in enumerate(spans):
        for c_a, c_b, _ in rs:
            in_scope[row * SPEC["cols"] + c_a: row * SPEC["cols"] + c_b + 1] = True

    if args.publish:
        publish(args, frames_meta, dbz, cls, in_scope, pal, missing, seen_codes)
        return

    xor = cls.copy()
    prev = None
    for i in range(n):
        if i in missing:
            continue
        if prev is not None:
            xor[i] = cls[i] ^ cls[prev]
        prev = i

    # 調色盤：分級（0–4）＋ 255 灰；dBZ 碼用官方色
    class_rgb = [(0, 0, 0), (160, 200, 255), (60, 120, 255), (255, 200, 0), (255, 0, 0)] + [(0, 0, 0)] * 250 + [(128, 128, 128)]
    dbz_rgb = [(0, 0, 0)] + [tuple(int(e["rgb"][k:k + 2], 16) for k in (1, 3, 5)) for e in pal["entries"]]
    dbz_rgb += [(0, 0, 0)] * (255 - len(dbz_rgb)) + [(128, 128, 128)]

    variants = {
        "a_dbz_u8_fullbbox": dbz.tobytes(),
        "a_dbz_u8_inscope": dbz[:, in_scope].tobytes(),
        "class_u8_fullbbox": cls.tobytes(),
        "class_u8_inscope": cls[:, in_scope].tobytes(),
        "b_class_xor_fullbbox": xor.tobytes(),
        "b_class_rle_inscope": rle_frames(cls[:, in_scope]),
        "c_class_atlas_png": atlas_png(cls, class_rgb),
        "c_dbz_atlas_png": atlas_png(dbz, dbz_rgb),
        "native_dbz_u8_crop": native.tobytes(),
    }
    files = {
        "a_dbz_u8_fullbbox": "dbz.u8", "class_u8_fullbbox": "class.u8", "b_class_xor_fullbbox": "class-xor.u8",
        "b_class_rle_inscope": "class-rle.bin", "c_class_atlas_png": "class-atlas.png", "c_dbz_atlas_png": "dbz-atlas.png",
        "native_dbz_u8_crop": "native-dbz.u8",
    }
    for k, suffix in files.items():
        (args.out_dir / f"radar-rain-{args.date}.{suffix}").write_bytes(variants[k])
    size_table = {k: sizes(v) for k, v in variants.items()}

    ok_frames = n - len(missing)
    wet_cells = {name: int(((cls == c) & in_scope[None, :]).sum()) for c, name in enumerate(RAIN_CLASS_NAMES)}
    # 雜波候選：範圍內、該日 ≥90% 有效幀都有回波（≥ 小雨）的格
    valid = cls != UNKNOWN
    wet_frac = np.where(valid.sum(0) > 0, ((cls >= 1) & valid).sum(0) / np.maximum(valid.sum(0), 1), 0)
    persistent = int(((wet_frac >= 0.9) & in_scope).sum())
    meta = {
        "schema": "pulse-sound-radar-rain-spike-v0",
        "date_taiwan": args.date,
        "grid": SPEC["id"],
        "product": PRODUCT,
        "palette": {"path": str(PALETTE_PATH.relative_to(ROOT)), "retrieved": pal["source"]["retrieved"]},
        "zr": {"a": ZR_A, "b": ZR_B, "note": "Marshall-Palmer，假設"},
        "class_edges_mm_h": RAIN_CLASS_EDGES_MM_H,
        "class_names": RAIN_CLASS_NAMES,
        "frames_total": n,
        "frames_ok": ok_frames,
        "frames_missing": [{"utc": frames_meta[i]["utc"], "status": frames_meta[i]["status"], "via": frames_meta[i].get("via")} for i in missing],
        "manifest": sorted({f["utc"][:10] + ":" + f["manifest"] for f in frames_meta}),
        "radar_window_px": {"rows": r1 - r0, "cols": c1 - c0},
        "dbz_codes_seen_in_window": sorted(seen_codes),
        "max_dbz_in_scope": int(dbz[:, in_scope][dbz[:, in_scope] != UNKNOWN].max()) - 1 if ok_frames else None,
        "cell_frames_by_class_in_scope": wet_cells,
        "persistent_echo_cells_ge90pct": persistent,
        "timing_s": {"fetch": round(t_fetch, 1), "decode_resample": round(t_decode, 1)},
        "sizes_bytes": size_table,
    }
    if args.crosscheck:
        meta["crosscheck"] = {f"min{k}of6": crosscheck(args.crosscheck, args.date, frames_meta, dbz, k) for k in (6, 4)}
    (args.out_dir / f"radar-rain-{args.date}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: meta[k] for k in ("date_taiwan", "frames_ok", "frames_total", "max_dbz_in_scope", "persistent_echo_cells_ge90pct", "timing_s")}, ensure_ascii=False))
    for k, v in size_table.items():
        print(f"{k:24s} raw={v['raw']:>10,d}  gz9={v['gz9']:>9,d}  br11={v['br11']:>9,d}")
    if args.crosscheck:
        for key, c in meta["crosscheck"].items():
            print("crosscheck", key, json.dumps(c["stats"], ensure_ascii=False))
        cc = meta["crosscheck"]["min4of6"]
        print("confusion (gauge rows × radar cols, 0 無雨…4 豪雨級):")
        for row in cc["confusion_gauge_rows_radar_cols"]:
            print("  ", row)
        for m in cc["worst_mismatches"][:8]:
            print("  mismatch", json.dumps(m, ensure_ascii=False))


if __name__ == "__main__":
    main()
