#!/usr/bin/env python3
"""
把 public/rail/ 的 6 系統軌道幾何瘦身，打包成單一 gzip bundle 供 embed 回放使用。

瘦身三步：
  1. 座標量化到 N 位小數（預設 5，≈1.1m 網格）
  2. 相鄰重複點去重（量化後才會出現）
  3. Douglas-Peucker 簡化（預設 tolerance 0.0001°，≈11m）

⚠ 核心約束：簡化後必須重算 station_progress，否則列車位置系統性偏移。
  弧長定義完全比照 src/engines/railUtils.ts 的 calculateTotalLength()：
  **平面歐氏距離、單位是「原始經緯度度數」，不做 cos(lat) 修正**。
  重算方式見 recompute_station_progress() docstring。

用法：
  python3 scripts/preprocess/build-rail-slim-bundle.py
  python3 scripts/preprocess/build-rail-slim-bundle.py --tolerance 0.00005 --decimals 6
  python3 scripts/preprocess/build-rail-slim-bundle.py --output /tmp/test.json.gz

輸出：
  public/embed-rail/rail_slim.json.gz
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
RAIL_DIR = ROOT / "public" / "rail"
DEFAULT_OUTPUT = ROOT / "public" / "embed-rail" / "rail_slim.json.gz"

SYSTEMS = ["tra", "thsr", "trtc", "krtc", "klrt", "tmrt"]

# 度 → 公尺的粗略換算（僅用於把「弧長保護」門檻從公尺換成度，不需要精確）
DEG_TO_M = 111_000.0

# TRA 顯示用精修軌道（比照 src/data/railLoader.ts TRA_GOLDEN_IDS，37 條）
TRA_GOLDEN_IDS = [
    "WL-N-SL-BD-0", "WL-N-SL-BD-1",
    "WL-N-ZN-SL-0", "WL-N-ZN-SL-1",
    "WL-M-ZN-CH-0", "WL-M-ZN-CH-1", "WL-M-CH-ZN-1",
    "WL-C-CH-ZN-0", "WL-C-ZN-CH-1",
    "WL-S-CH-ZY-0", "WL-S-CH-ZY-1",
    "YL-BD-SA-0", "YL-SA-BD-1",
    "KL-BD-KL-0", "KL-KL-BD-1",
    "BH-SX-HL-0", "BH-HL-SX-1",
    "TL-0", "TL-1",
    "SK-0", "SK-1",
    "PT-0", "PT-1",
    "NW-0", "NW-1",
    "LJ-0", "LJ-1",
    "SH-0", "SH-1",
    "JJ-0", "JJ-1",
    "CZ-0", "CZ-1",
    "PX-0", "PX-1",
    "SA-RF-BD-0", "SA-BD-RF-1",
]

# 幾何衍生欄位：簡化後會失真，不進 bundle
DROP_PROPS = {"point_count", "generated_by"}


class BuildError(Exception):
    """壞資料 → fail loudly（帶檔名）"""


# ── I/O ──────────────────────────────────────────────────────────────────


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as e:
        raise BuildError(f"檔案不存在：{path}") from e
    except json.JSONDecodeError as e:
        raise BuildError(f"JSON 解析失敗：{path} — {e}") from e


def extract_feature(data: Any, path: Path) -> dict:
    """支援 FeatureCollection / Feature 兩種頂層格式（比照 railLoader.extractFeature）"""
    if not isinstance(data, dict):
        raise BuildError(f"不是 GeoJSON 物件：{path}")
    if data.get("type") == "FeatureCollection":
        feats = data.get("features") or []
        if not feats:
            raise BuildError(f"FeatureCollection 沒有 features：{path}")
        return feats[0]
    if data.get("type") == "Feature":
        return data
    raise BuildError(f"未知 GeoJSON 頂層 type={data.get('type')!r}：{path}")


def read_linestring(path: Path) -> tuple[list[list[float]], dict]:
    feat = extract_feature(load_json(path), path)
    geom = feat.get("geometry") or {}
    if geom.get("type") != "LineString":
        raise BuildError(f"只支援 LineString，實際為 {geom.get('type')!r}：{path}")
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        raise BuildError(f"折線點數 < 2（{len(coords)}）：{path}")
    props = {k: v for k, v in (feat.get("properties") or {}).items() if k not in DROP_PROPS}
    return [[float(c[0]), float(c[1])] for c in coords], props


# ── 幾何工具（平面度數，與 railUtils.ts 同一套定義）────────────────────────


def cumulative_lengths(coords: list[list[float]]) -> list[float]:
    """回傳長度 len(coords) 的累積弧長陣列（平面歐氏、度數）"""
    cum = [0.0] * len(coords)
    for i in range(len(coords) - 1):
        dx = coords[i + 1][0] - coords[i][0]
        dy = coords[i + 1][1] - coords[i][1]
        cum[i + 1] = cum[i] + math.hypot(dx, dy)
    return cum


def interpolate_on_linestring(coords: list[list[float]], progress: float) -> list[float]:
    """Python 版 railUtils.ts interpolateOnLineString（含 <=0 / >=1 早退，逐字對應）"""
    if not coords:
        return [0.0, 0.0]
    if len(coords) == 1:
        return coords[0]
    if progress <= 0:
        return coords[0]
    if progress >= 1:
        return coords[-1]

    cum = cumulative_lengths(coords)
    total = cum[-1]
    target = total * progress

    for i in range(len(coords) - 1):
        seg = cum[i + 1] - cum[i]
        if cum[i] + seg >= target:
            t = (target - cum[i]) / seg if seg > 0 else 0.0
            return [
                coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
                coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
            ]
    return coords[-1]


def project_on_segment(pt: list[float], a: list[float], b: list[float]) -> tuple[float, float]:
    """把 pt 垂直投影到線段 ab，回傳 (t 夾在 [0,1], 到投影點的距離)。平面度數。"""
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    denom = dx * dx + dy * dy
    if denom == 0.0:
        return 0.0, math.hypot(pt[0] - a[0], pt[1] - a[1])
    t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / denom
    t = max(0.0, min(1.0, t))
    px = a[0] + dx * t
    py = a[1] + dy * t
    return t, math.hypot(pt[0] - px, pt[1] - py)


# ── 瘦身 ─────────────────────────────────────────────────────────────────


def quantize_and_dedup(coords: list[list[float]], decimals: int) -> tuple[list[list[float]], list[int]]:
    """量化 + 去除相鄰重複點。回傳 (量化後座標, 對應的原始索引)。

    去重是必要的：量化後相鄰點可能重合，零長度線段會讓
    interpolateOnLineString 在 targetDistance=0 時算出 NaN。
    頭尾點一律保留（尾點若與前一點重合，改為擠掉前一點而非丟尾點）。
    """
    out: list[list[float]] = []
    src: list[int] = []
    for i, c in enumerate(coords):
        q = [round(c[0], decimals), round(c[1], decimals)]
        if out and q == out[-1]:
            # 與前一點重合：若這是最後一點，用它取代前一點以保住「尾點身分」
            if i == len(coords) - 1:
                src[-1] = i
            continue
        out.append(q)
        src.append(i)
    return out, src


def rdp_indices(coords: list[list[float]], epsilon: float, max_arc_loss: float) -> list[int]:
    """Douglas-Peucker，回傳保留點的索引（升冪）。迭代版（明確 stack），
    避免 9000+ 點折線撞上 Python 遞迴上限。

    額外的「弧長保護」（max_arc_loss，度）：
      純 RDP 只看垂直距離，對「折返」型幾何完全盲目 —— 一段沿著同一條線來回走的
      子路徑，垂直距離接近 0，卻會被壓成長度短很多的弦。本專案的 TRA O-D 軌道是
      merge_tracks.py 串接多條來源軌道產生的，接縫處就有這種折返（實測單一 span
      989m 子路徑 → 683m 弦，弧長少掉 306m）。弧長一縮，沿線的參數化就整段位移，
      站間內插的列車位置會系統性偏移數百公尺。
    因此：若 collapse 會讓子路徑弧長縮掉超過 max_arc_loss，即使垂直距離過關
    也強制從「弧長中點」切開繼續遞迴（每次對半，必定收斂）。
    """
    n = len(coords)
    if n <= 2:
        return list(range(n))

    cum = cumulative_lengths(coords)
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]

    while stack:
        start, end = stack.pop()
        if end - start < 2:
            continue
        a = coords[start]
        b = coords[end]
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        den = math.hypot(dx, dy)

        dmax = -1.0
        index = start
        for i in range(start + 1, end):
            p = coords[i]
            if den == 0.0:
                d = math.hypot(p[0] - a[0], p[1] - a[1])
            else:
                d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / den
            if d > dmax:
                dmax = d
                index = i

        if dmax <= epsilon:
            # 垂直距離過關 → 再檢查弧長是否縮太多
            if cum[end] - cum[start] - den <= max_arc_loss:
                continue
            # 折返段：改從弧長中點切
            half = cum[start] + (cum[end] - cum[start]) / 2
            lo, hi = start + 1, end - 1
            while lo < hi:
                mid = (lo + hi) // 2
                if cum[mid] < half:
                    lo = mid + 1
                else:
                    hi = mid
            index = min(max(lo, start + 1), end - 1)

        keep[index] = True
        stack.append((start, index))
        stack.append((index, end))

    return [i for i, k in enumerate(keep) if k]


def simplify_track(
    raw: list[list[float]], decimals: int, epsilon: float, label: str, max_arc_loss: float
) -> tuple[list[list[float]], list[int]]:
    """回傳 (簡化後座標, 每個簡化點對應的『原始 raw 陣列』索引)"""
    quant, quant_src = quantize_and_dedup(raw, decimals)

    if len(quant) < 2:
        # 整條線量化後塌成一點 → 退回原始頭尾（保住非零長度，避免引擎算出 NaN）
        print(f"  ⚠ {label}: 量化後塌成 1 點，改用原始頭尾座標", file=sys.stderr)
        quant = [raw[0], raw[-1]]
        quant_src = [0, len(raw) - 1]
        if quant[0] == quant[1]:
            raise BuildError(f"{label}: 折線頭尾座標相同且無其他點，無法產生有效幾何")
        return quant, quant_src

    kept = rdp_indices(quant, epsilon, max_arc_loss)
    simp = [quant[i] for i in kept]
    simp_src = [quant_src[i] for i in kept]

    if len(simp) < 2:
        raise BuildError(f"{label}: RDP 後只剩 {len(simp)} 點（不該發生）")
    return simp, simp_src


# ── station_progress 重算（本腳本的核心正確性）─────────────────────────────


def recompute_station_progress(
    raw: list[list[float]],
    simp: list[list[float]],
    simp_src: list[int],
    progress: dict[str, float],
    label: str,
    warnings: list[str],
    progress_decimals: int,
) -> dict[str, float]:
    """把每站在原始折線上的位置，重新投影到簡化折線上，算新的弧長比例。

    做法（monotone bracket projection）：
      1. 依原始 progress 由小到大排序 → 這就是沿軌道的站序
         （station_progress.json 的 key 順序是任意的，不可依賴）
      2. anchor = interpolate_on_linestring(raw, p_orig)
         —— 用「未量化的原始幾何」求錨點，讓量化+RDP 的誤差全部被新 progress 吸收
      3. 因為 RDP 保留的是原始頂點的子集（simp_src 記錄對應原始索引），
         可用原始累積弧長二分出 anchor 落在哪一段簡化線段 j
         → 這個 bracket 對自相交／環狀路線也不會跳段（純最近點搜尋會）
      4. 在 {j-1, j, j+1} 這個小窗內做垂直投影取最近者，並強制新弧長 >= 前一站
      5. new_p = 投影點累積弧長 / 簡化折線總長

    邊界：原本剛好是 0.0 / 1.0 的值強制保留 0.0 / 1.0（頭尾點 RDP 必留）；
    其餘極值不動（例：KLRT 末站本來就是 0.979861，不可硬拉成 1）。
    """
    if not progress:
        return {}

    raw_cum = cumulative_lengths(raw)
    raw_total = raw_cum[-1]
    simp_cum = cumulative_lengths(simp)
    simp_total = simp_cum[-1]

    if simp_total <= 0:
        raise BuildError(f"{label}: 簡化後折線總長為 0，station_progress 無法重算")

    # 簡化折線每個頂點對應的「原始累積弧長」，用來 bracket
    node_raw_cum = [raw_cum[i] for i in simp_src]
    n_seg = len(simp) - 1

    ordered = sorted(progress.items(), key=lambda kv: kv[1])
    result: dict[str, float] = {}
    prev_cum = 0.0
    prev_out = 0.0

    for station_id, p_orig in ordered:
        p = float(p_orig)

        if p <= 0.0:
            result[station_id] = 0.0
            prev_cum = 0.0
            prev_out = 0.0
            continue
        if p >= 1.0:
            result[station_id] = 1.0
            prev_cum = simp_total
            prev_out = 1.0
            continue

        anchor = interpolate_on_linestring(raw, p)
        target_raw = raw_total * p

        # bracket：找 node_raw_cum[j] <= target_raw <= node_raw_cum[j+1]
        lo, hi = 0, n_seg - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if node_raw_cum[mid] <= target_raw:
                lo = mid
            else:
                hi = mid - 1
        j = lo

        best_cum = None
        best_dist = float("inf")
        for k in range(max(0, j - 1), min(n_seg - 1, j + 1) + 1):
            t, dist = project_on_segment(anchor, simp[k], simp[k + 1])
            cand = simp_cum[k] + (simp_cum[k + 1] - simp_cum[k]) * t
            if cand < prev_cum:
                continue  # 會破壞單調性 → 丟棄
            if dist < best_dist:
                best_dist = dist
                best_cum = cand

        if best_cum is None:
            # 小窗內全部落在前一站之前（站距極小時可能發生）→ 退回按弧長比例映射
            span = node_raw_cum[j + 1] - node_raw_cum[j]
            frac = (target_raw - node_raw_cum[j]) / span if span > 0 else 0.0
            frac = max(0.0, min(1.0, frac))
            best_cum = simp_cum[j] + (simp_cum[j + 1] - simp_cum[j]) * frac
            best_cum = max(best_cum, prev_cum)

        new_p = round(best_cum / simp_total, progress_decimals)
        # 四捨五入可能讓相鄰兩站倒退一個 ulp → 夾回去
        if new_p < prev_out:
            new_p = prev_out
        new_p = max(0.0, min(1.0, new_p))

        result[station_id] = new_p
        prev_cum = best_cum
        prev_out = new_p

    # 事後驗證：依原始站序必須單調不遞減
    seq = [result[sid] for sid, _ in ordered]
    for i in range(len(seq) - 1):
        if seq[i + 1] < seq[i]:
            raise BuildError(f"{label}: 重算後 station_progress 非單調（idx {i} {seq[i]} → {seq[i + 1]}）")

    if len(result) != len(progress):
        warnings.append(f"{label}: progress 站數 {len(progress)} → {len(result)}")

    return result


# ── 主流程 ───────────────────────────────────────────────────────────────


def build_track_map(
    tracks_dir: Path,
    track_ids: list[str],
    decimals: int,
    epsilon: float,
    max_arc_loss: float,
    label_prefix: str,
) -> tuple[dict[str, dict], int, int]:
    out: dict[str, dict] = {}
    pts_before = 0
    pts_after = 0
    for tid in track_ids:
        path = tracks_dir / f"{tid}.geojson"
        raw, props = read_linestring(path)
        simp, simp_src = simplify_track(raw, decimals, epsilon, f"{label_prefix}/{tid}", max_arc_loss)
        pts_before += len(raw)
        pts_after += len(simp)
        out[tid] = {"coordinates": simp, "properties": props, "_srcIdx": simp_src, "_raw": raw}
    return out, pts_before, pts_after


def strip_internals(tracks: dict[str, dict]) -> None:
    for entry in tracks.values():
        entry.pop("_srcIdx", None)
        entry.pop("_raw", None)


def build_system(
    system_id: str,
    decimals: int,
    epsilon: float,
    max_arc_loss: float,
    progress_decimals: int,
    warnings: list[str],
) -> tuple[dict, dict]:
    sys_dir = RAIL_DIR / system_id
    if not sys_dir.is_dir():
        raise BuildError(f"系統目錄不存在：{sys_dir}")

    progress_all = load_json(sys_dir / "station_progress.json")
    if not isinstance(progress_all, dict):
        raise BuildError(f"station_progress.json 不是物件：{sys_dir}")

    tracks_dir = sys_dir / "tracks"
    available = {p.stem for p in tracks_dir.glob("*.geojson")}
    track_ids = sorted(available)

    missing_geom = sorted(set(progress_all) - available)
    if missing_geom:
        warnings.append(f"{system_id}: station_progress 有 {len(missing_geom)} 條軌道沒有幾何檔（{missing_geom[:5]}…）")

    tracks, pts_before, pts_after = build_track_map(
        tracks_dir, track_ids, decimals, epsilon, max_arc_loss, system_id
    )

    # station_progress 重算
    new_progress: dict[str, dict[str, float]] = {}
    for tid, entry in tracks.items():
        prog = progress_all.get(tid)
        if prog is None:
            continue
        if not isinstance(prog, dict):
            raise BuildError(f"{system_id}/{tid}: station_progress 不是 dict")
        new_progress[tid] = recompute_station_progress(
            entry["_raw"], entry["coordinates"], entry["_srcIdx"], prog,
            f"{system_id}/{tid}", warnings, progress_decimals,
        )

    strip_internals(tracks)

    system_obj: dict[str, Any] = {"tracks": tracks, "stationProgress": new_progress}
    stats: dict[str, Any] = {
        "tracks": len(tracks),
        "points_before": pts_before,
        "points_after": pts_after,
        "progress_tracks": len(new_progress),
    }

    # TRA 額外的 37 條顯示用精修軌道（純顯示，無 station_progress）
    if system_id == "tra":
        golden_dir = sys_dir / "tracks_golden"
        golden, g_before, g_after = build_track_map(
            golden_dir, TRA_GOLDEN_IDS, decimals, epsilon, max_arc_loss, "tra-golden"
        )
        strip_internals(golden)
        system_obj["goldenTracks"] = golden
        stats["golden_tracks"] = len(golden)
        stats["golden_points_before"] = g_before
        stats["golden_points_after"] = g_after

    return system_obj, stats


def main() -> int:
    ap = argparse.ArgumentParser(description="產生 embed 回放用的鐵路瘦身 bundle")
    ap.add_argument("--decimals", type=int, default=5, help="座標量化小數位（預設 5，≈1.1m）")
    ap.add_argument("--tolerance", type=float, default=0.0001, help="RDP 容差（度，預設 0.0001 ≈11m）")
    ap.add_argument(
        "--max-arc-loss",
        type=float,
        default=5.0,
        help="單一 RDP span 允許縮掉的弧長上限（公尺，預設 5）；防折返段被壓扁造成參數化位移",
    )
    ap.add_argument("--progress-decimals", type=int, default=6, help="station_progress 小數位（預設 6）")
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="輸出 .json.gz 路徑")
    args = ap.parse_args()

    warnings: list[str] = []
    systems: dict[str, Any] = {}
    stats: dict[str, Any] = {}
    max_arc_loss_deg = args.max_arc_loss / DEG_TO_M

    for sid in SYSTEMS:
        print(f"[{sid}] 處理中…", file=sys.stderr)
        systems[sid], stats[sid] = build_system(
            sid, args.decimals, args.tolerance, max_arc_loss_deg, args.progress_decimals, warnings
        )
        s = stats[sid]
        print(
            f"[{sid}] tracks={s['tracks']} points {s['points_before']}→{s['points_after']}"
            f" ({s['points_after'] / max(s['points_before'], 1) * 100:.1f}%)",
            file=sys.stderr,
        )

    bundle = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "public/rail/",
            "params": {
                "quantize_decimals": args.decimals,
                "rdp_tolerance_deg": args.tolerance,
                "max_arc_loss_m": args.max_arc_loss,
                "progress_decimals": args.progress_decimals,
            },
            "arc_length_metric": (
                "planar euclidean in raw degrees (no cos(lat)); "
                "matches src/engines/railUtils.ts calculateTotalLength()"
            ),
            "systems": stats,
            "warnings": warnings,
        },
        "systems": systems,
    }

    payload = json.dumps(bundle, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(payload, 9))

    gz_size = args.output.stat().st_size
    print(f"\n✓ 輸出 {args.output}")
    print(f"  raw  {len(payload) / 1e6:.3f} MB")
    print(f"  gzip {gz_size / 1e6:.3f} MB ({gz_size:,} bytes)")

    # 各系統 gzip 分列（獨立壓縮，加總會略大於整包）
    print("\n各系統（獨立 gzip，僅供比例參考）：")
    for sid in SYSTEMS:
        b = json.dumps(systems[sid], separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        g = len(gzip.compress(b, 9))
        st = stats[sid]
        print(
            f"  {sid:5s} tracks={st['tracks']:3d} pts {st['points_before']:>7,}→{st['points_after']:>6,}"
            f"  raw {len(b) / 1e6:6.3f} MB  gzip {g / 1e6:6.3f} MB"
        )

    if warnings:
        print(f"\n⚠ {len(warnings)} 則警告：")
        for w in warnings:
            print(f"  - {w}")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BuildError as e:
        print(f"\n✗ 失敗：{e}", file=sys.stderr)
        sys.exit(1)
