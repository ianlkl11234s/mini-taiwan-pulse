#!/usr/bin/env python3
"""City Sound Atlas：臺北市 VD「平日典型車流」小檔（聲景道路族用）。

輸入（taipei-gis-analytics 主 checkout，gitignored 成品）：
  data/processed/analysis/digital_twin/vd_baseline_15min.parquet
      每 VD × 日期類型（weekday／weekend／special）× 15 分鐘箱的速度、佔有率、流量中位數
      口徑與限制：taipei-gis-analytics/docs/topic-research/digital_twin/vd_baseline.md
  data/processed/transportation/vd/vd_devices_latest.geojson
      VD 座標與路名（710 支）

輸出：public/sound-atlas/vd-baseline-taipei.json（不 git add；照 public-assets lock 流程登記）

口徑：
  - 平日流量：weekday 的 4 個 15 分鐘箱 flow_veh_h_median（輛／小時）取平均併成整點；
    該小時有效箱 <2 個 → null（不補 0）。wd_flow_days＝該小時各箱 n_flow_days 的最小值。
  - 速度：weekday／weekend 同樣 4 箱 speed_median 平均（有效箱 <2 → null）。
  - 週末只輸出速度與佔有率，流量一律不輸出（上游 TotalVolume 凍結，週末流量只有 2 天殘缺）。
  - special（2026-01-01）不輸出。
  - 基準表有、設備檔沒有座標的 VD 剔除（不合成座標），數量寫進 meta。

用法（repo 根目錄）：
  python3 scripts/preprocess/build-sound-vd-baseline.py [--analytics <taipei-gis-analytics 路徑>] [--out <路徑>]
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

import pandas as pd

PARQUET_REL = "data/processed/analysis/digital_twin/vd_baseline_15min.parquet"
DEVICES_REL = "data/processed/transportation/vd/vd_devices_latest.geojson"
DOC_REL = "docs/topic-research/digital_twin/vd_baseline.md"
OUT_DEFAULT = Path("public/sound-atlas/vd-baseline-taipei.json")
MIN_BINS_PER_HOUR = 2


def default_analytics_root() -> Path:
    """主 checkout 隔壁的 taipei-gis-analytics（worktree 也適用：git common dir 的上一層是主 checkout）。"""
    common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], capture_output=True, text=True, check=True).stdout.strip()
    return Path(common).parent.parent / "taipei-gis-analytics"


def finite(v) -> bool:
    return v is not None and not (isinstance(v, float) and math.isnan(v))


def hourly(df: pd.DataFrame, col: str, digits: int) -> list[float | None]:
    out: list[float | None] = []
    for h in range(24):
        vals = [v for v in df.loc[df["bin"].between(h * 4, h * 4 + 3), col].tolist() if finite(v)]
        out.append(round(sum(vals) / len(vals), digits) if len(vals) >= MIN_BINS_PER_HOUR else None)
    return out


def hourly_min_int(df: pd.DataFrame, col: str, valid_col: str) -> list[int]:
    out: list[int] = []
    for h in range(24):
        sub = df.loc[df["bin"].between(h * 4, h * 4 + 3)]
        sub = sub[sub[valid_col].map(finite)]
        out.append(int(sub[col].min()) if len(sub) >= MIN_BINS_PER_HOUR else 0)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analytics", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=OUT_DEFAULT)
    args = ap.parse_args()
    root = args.analytics or default_analytics_root()

    base = pd.read_parquet(root / PARQUET_REL)
    devices = json.loads((root / DEVICES_REL).read_text(encoding="utf-8"))
    dev: dict[str, dict] = {}
    for f in devices["features"]:
        g = f.get("geometry")
        p = f.get("properties") or {}
        if not g or g.get("type") != "Point":
            continue
        lon, lat = g["coordinates"][:2]
        if not (finite(lon) and finite(lat)):
            continue
        dev[p["VDID"]] = {"road": p.get("RoadName") or None, "lanes": p.get("LaneCount"), "lon": round(float(lon), 6), "lat": round(float(lat), 6)}

    ids = sorted(base["VDID"].unique())
    missing = [v for v in ids if v not in dev]
    vds = []
    for vid in ids:
        if vid not in dev:
            continue
        d = base[base["VDID"] == vid]
        wd = d[d["dtype"] == "weekday"]
        we = d[d["dtype"] == "weekend"]
        wd_flow = hourly(wd, "flow_veh_h_median", 0)
        vds.append({
            "id": vid,
            **dev[vid],
            "wd_flow": [None if v is None else int(v) for v in wd_flow],
            "wd_flow_days": hourly_min_int(wd, "n_flow_days", "flow_veh_h_median"),
            "wd_speed": hourly(wd, "speed_median", 1),
            "we_speed": hourly(we, "speed_median", 1),
            "we_occ": hourly(we, "occ_median", 1),
        })

    flow_days = [x for v in vds for x, f in zip(v["wd_flow_days"], v["wd_flow"]) if f is not None]
    meta = {
        "schema": "sound-vd-baseline/1",
        "city": "Taipei",
        "source": "臺北市 VD（data-collectors `vd`，S3 vd/YYYY/MM/DD/vd_HHMM.json）→ taipei-gis-analytics digital_twin p1a–p1d 基準表",
        "source_doc": f"taipei-gis-analytics/{DOC_REL}",
        "period": {"start": "2025-12-26", "end": "2026-01-14"},
        "flow_unit": "veh_per_hour",
        "aggregation": "weekday 15 分鐘箱流量中位數（輛/小時）取平均併整點；有效箱 <2 → null；不補 0",
        "weekday_flow_days_max": max(flow_days) if flow_days else 0,
        "weekday_flow_days_median": sorted(flow_days)[len(flow_days) // 2] if flow_days else 0,
        "weekend_flow": "不輸出（上游 TotalVolume 凍結，週末流量只有 2 天殘缺）",
        "special_days_excluded": ["2026-01-01"],
        "vd_in_baseline": len(ids),
        "vd_output": len(vds),
        "vd_excluded_no_coordinates": len(missing),
        "limits": [
            "只有臺北市；新北與國道未涵蓋",
            "平日流量有效約 8 天（12/26、12/29–31、1/6–1/8 全日與 1/2、1/5、1/9 部分時段）",
            "典型值不是當日觀測；不反映季節、天候、事件",
            "一支 VD 是單向斷面，不是路段",
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"meta": meta, "vds": vds}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = args.out.stat().st_size
    print(f"VD 基準 {len(ids)} 支，輸出 {len(vds)} 支，無座標剔除 {len(missing)} 支；{size / 1024:.0f} KB → {args.out}")
    if size > 1_000_000:
        raise SystemExit("輸出超過 1 MB")


if __name__ == "__main__":
    main()
