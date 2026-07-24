#!/usr/bin/env python3
"""
從 S3 抓 GFS GRIB2 / CMEMS NetCDF → 萃取 u/v → 編碼成 RGBA PNG → 上傳回 S3。

PNG 編碼約定（前端 climateParticleCustomLayer.ts 解碼）：
- R 通道：u 分量（東向 m/s）線性映射到 [0, 255]
- G 通道：v 分量（北向 m/s）線性映射到 [0, 255]
- B 通道：0（保留）
- A 通道：255 = valid，0 = NaN（陸地 / 缺值）
- 對應的 u_min/u_max/v_min/v_max 在同名 .json 裡

輸出位置：
- 上傳 s3://migu-gis-data-collector/deploy-assets/climate/{dataset}_{YYYYMMDDHH}.png + .json
- 同時鏡像到 public/climate/ 給本地 dev

用法：
  python3 scripts/preprocess/extract_climate_uv.py --dataset gfs_wind10m
  python3 scripts/preprocess/extract_climate_uv.py --dataset cmems_currents
  python3 scripts/preprocess/extract_climate_uv.py --dataset all
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Tuple

import boto3
import numpy as np
import psycopg2
import xarray as xr
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_CLIMATE = REPO_ROOT / "public" / "climate"
S3_BUCKET = "migu-gis-data-collector"
S3_DEPLOY_PREFIX = "deploy-assets/climate"
DOTENV = REPO_ROOT / ".env"


def load_env() -> dict[str, str]:
    """讀 .env 不展開（避免 = 在 anon key 內爆 shell source）"""
    env: dict[str, str] = {}
    if DOTENV.exists():
        for line in DOTENV.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def s3_client(env: dict[str, str]):
    return boto3.client(
        "s3",
        aws_access_key_id=env.get("S3_ACCESS_KEY") or os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=env.get("S3_SECRET_KEY") or os.environ.get("S3_SECRET_KEY"),
        region_name=env.get("S3_REGION", "ap-southeast-2"),
    )


def latest_s3_uri(env: dict[str, str], dataset_id: str) -> Tuple[str, str]:
    """
    從 Supabase 抓該 dataset 最新一筆 row 的 s3_uri 與 observed_at。
    回傳 (s3_uri, observed_at_iso)。
    """
    dburl = env.get("SUPABASE_DB_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dburl:
        raise RuntimeError("SUPABASE_DB_URL not set")
    with psycopg2.connect(dburl) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT s3_uri, observed_at
              FROM live.global_climate_grids
             WHERE dataset_id = %s
               AND s3_uri IS NOT NULL
             ORDER BY observed_at DESC
             LIMIT 1
            """,
            (dataset_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no s3_uri for dataset_id={dataset_id}")
    return row[0], row[1].isoformat()


def download_s3(s3, s3_uri: str, dest: Path) -> None:
    assert s3_uri.startswith("s3://")
    rest = s3_uri[len("s3://"):]
    bucket, key = rest.split("/", 1)
    print(f"  ↓ s3://{bucket}/{key} → {dest}")
    s3.download_file(bucket, key, str(dest))


def encode_uv_to_png(u: np.ndarray, v: np.ndarray, out_png: Path) -> dict:
    """
    把 u/v 兩個 2D ndarray 編成 RGBA PNG。
    回傳 metadata dict（含 min/max）。

    約定：行 0 = 北邊（高緯度），符合一般地理影像；
    若輸入是 ascending lat（南→北），會 flipud。
    """
    assert u.shape == v.shape, f"u {u.shape} vs v {v.shape}"
    h, w = u.shape

    u_arr = np.asarray(u, dtype=np.float32)
    v_arr = np.asarray(v, dtype=np.float32)
    mask = np.isfinite(u_arr) & np.isfinite(v_arr)

    u_min = float(np.nanmin(u_arr)) if mask.any() else -1.0
    u_max = float(np.nanmax(u_arr)) if mask.any() else 1.0
    v_min = float(np.nanmin(v_arr)) if mask.any() else -1.0
    v_max = float(np.nanmax(v_arr)) if mask.any() else 1.0

    # 線性映射到 0-255；NaN 填中位（128）但 alpha=0 標記無效
    def encode(arr: np.ndarray, lo: float, hi: float) -> np.ndarray:
        if hi - lo < 1e-9:
            return np.full(arr.shape, 128, dtype=np.uint8)
        scaled = (arr - lo) / (hi - lo) * 255.0
        return np.clip(scaled, 0, 255).astype(np.uint8)

    r = encode(np.where(mask, u_arr, 0), u_min, u_max)
    g = encode(np.where(mask, v_arr, 0), v_min, v_max)
    b = np.zeros_like(r)
    a = np.where(mask, 255, 0).astype(np.uint8)

    rgba = np.stack([r, g, b, a], axis=-1)
    Image.fromarray(rgba, "RGBA").save(out_png, format="PNG", optimize=True)
    return {
        "width": w,
        "height": h,
        "u_min": u_min,
        "u_max": u_max,
        "v_min": v_min,
        "v_max": v_max,
        "valid_pct": float(mask.sum()) / mask.size * 100,
    }


def process_gfs_wind10m(env: dict[str, str], s3) -> dict:
    """GFS 10m 風場 GRIB2 → wind10m PNG (R=u10, G=v10)。"""
    s3_uri, observed_at = latest_s3_uri(env, "gfs_wind10m")
    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / "wind10m.grib2"
        download_s3(s3, s3_uri, local)
        # GFS GRIB2 含 multiple messages，cfgrib 用 filter_by_keys
        # 10m wind 對應 typeOfLevel='heightAboveGround', level=10
        ds = xr.open_dataset(
            local,
            engine="cfgrib",
            backend_kwargs={"filter_by_keys": {"typeOfLevel": "heightAboveGround", "level": 10}},
        )
        # u10/v10 為標準 GFS 變數名
        u = ds["u10"].values  # (lat, lon)
        v = ds["v10"].values
        lats = ds["latitude"].values  # GFS 預設 90→-90 (descending) — 不必 flip
        lons = ds["longitude"].values  # 0..360

        # 把 lon 從 0..360 轉成 -180..180（粒子動畫前端慣用）
        if lons.max() > 180:
            # 找 180° 切點重排
            shift = np.searchsorted(lons, 180.0)
            u = np.concatenate([u[:, shift:], u[:, :shift]], axis=1)
            v = np.concatenate([v[:, shift:], v[:, :shift]], axis=1)
            lons = np.concatenate([lons[shift:] - 360, lons[:shift]])
        bbox = [float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max())]

        # 若 lat 是 descending（90→-90），符合「行 0 = 北邊」慣例，不翻轉
        if lats[0] < lats[-1]:
            u = np.flipud(u)
            v = np.flipud(v)

    # 寫到專案 public/climate/
    PUBLIC_CLIMATE.mkdir(parents=True, exist_ok=True)
    png_name = "wind10m_latest.png"
    json_name = "wind10m_latest.json"
    out_png = PUBLIC_CLIMATE / png_name
    meta = encode_uv_to_png(u, v, out_png)
    meta.update({
        "dataset": "gfs_wind10m",
        "valid_at": observed_at,
        "source_s3": s3_uri,
        "bbox": bbox,
    })
    (PUBLIC_CLIMATE / json_name).write_text(json.dumps(meta, indent=2))
    print(f"  ✓ {out_png.relative_to(REPO_ROOT)} ({out_png.stat().st_size//1024} KB, "
          f"u {meta['u_min']:.2f}..{meta['u_max']:.2f} m/s, valid {meta['valid_pct']:.1f}%)")
    upload_png_and_meta(s3, out_png, PUBLIC_CLIMATE / json_name, png_name, json_name)
    return meta


def process_cams_dust(env: dict[str, str], s3) -> dict:
    """CAMS 沙塵濃度 NetCDF → 單通道 RGBA PNG（R=normalized dust, A=valid mask）。
    給前端做 raster overlay（mapbox raster source），不是粒子。"""
    s3_uri, observed_at = latest_s3_uri(env, "cams_dust")
    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / "cams_dust.nc"
        download_s3(s3, s3_uri, local)
        ds = xr.open_dataset(local)
        # CAMS dust 變數：duaod550（Dust Aerosol Optical Depth at 550nm）
        dust_da = ds["duaod550"]
        for extra_dim in ("forecast_reference_time", "forecast_period", "time"):
            if extra_dim in dust_da.dims:
                dust_da = dust_da.isel({extra_dim: 0})
        arr = dust_da.values
        lats = ds["latitude"].values if "latitude" in ds else ds["lat"].values
        lons = ds["longitude"].values if "longitude" in ds else ds["lon"].values

        # CAMS 經度通常 0..360，shift to -180..180
        if lons.max() > 180:
            shift = np.searchsorted(lons, 180.0)
            arr = np.concatenate([arr[:, shift:], arr[:, :shift]], axis=1)
            lons = np.concatenate([lons[shift:] - 360, lons[:shift]])

        bbox = [float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max())]
        if lats[0] < lats[-1]:
            arr = np.flipud(arr)

    PUBLIC_CLIMATE.mkdir(parents=True, exist_ok=True)
    png_name = "dust_latest.png"
    json_name = "dust_latest.json"
    out_png = PUBLIC_CLIMATE / png_name

    # 編碼：對數壓縮（沙塵 AOD 範圍 0..1，常見 0..0.5）
    arr_f = np.asarray(arr, dtype=np.float32)
    mask = np.isfinite(arr_f)
    valid_arr = arr_f[mask]
    dust_min = float(valid_arr.min()) if mask.any() else 0.0
    dust_max = float(valid_arr.max()) if mask.any() else 1.0

    # 線性 normalize 到 [0,1]
    t = np.where(
        mask,
        np.clip((arr_f - dust_min) / max(dust_max - dust_min, 1e-9), 0, 1),
        0,
    )
    # 棕色色階 ramp（仿 nullschool dust／chem 棕系）
    # AOD 0 = 透明，0.1 = 淡棕，0.3 = 中棕，0.7+ = 深棕
    # 用矩陣化的 piecewise 線性算 RGB
    def ramp(t_arr):
        # 控制點：(t, r, g, b)
        stops = [
            (0.00, 218, 197, 168),  # 淡米
            (0.20, 180, 140,  90),  # 淡棕
            (0.45, 132,  86,  46),  # 中棕
            (0.75,  82,  46,  22),  # 深棕
            (1.00,  40,  20,  10),  # 焦棕
        ]
        rgb = np.zeros((*t_arr.shape, 3), dtype=np.uint8)
        for i in range(len(stops) - 1):
            t0, r0, g0, b0 = stops[i]
            t1, r1, g1, b1 = stops[i + 1]
            in_band = (t_arr >= t0) & (t_arr <= t1)
            if not in_band.any():
                continue
            local_t = (t_arr - t0) / max(t1 - t0, 1e-9)
            local_t = np.clip(local_t, 0, 1)
            rgb[..., 0] = np.where(in_band, r0 + (r1 - r0) * local_t, rgb[..., 0])
            rgb[..., 1] = np.where(in_band, g0 + (g1 - g0) * local_t, rgb[..., 1])
            rgb[..., 2] = np.where(in_band, b0 + (b1 - b0) * local_t, rgb[..., 2])
        return rgb
    rgb = ramp(t)
    # alpha = AOD 強度 × valid mask（強度越高越不透明）
    alpha_t = np.where(mask, np.clip(t * 1.4, 0, 1), 0)  # ×1.4 讓中等濃度也清楚可見
    alpha = (alpha_t * 255).astype(np.uint8)
    rgba = np.concatenate([rgb, alpha[..., None]], axis=-1)
    Image.fromarray(rgba, "RGBA").save(out_png, format="PNG", optimize=True)

    meta = {
        "dataset": "cams_dust",
        "valid_at": observed_at,
        "source_s3": s3_uri,
        "bbox": bbox,
        "width": int(arr.shape[1]),
        "height": int(arr.shape[0]),
        "dust_min": dust_min,
        "dust_max": dust_max,
    }
    (PUBLIC_CLIMATE / json_name).write_text(json.dumps(meta, indent=2))
    print(f"  ✓ {out_png.relative_to(REPO_ROOT)} ({out_png.stat().st_size//1024} KB, "
          f"AOD {dust_min:.3f}..{dust_max:.3f}, bbox={bbox})")
    upload_png_and_meta(s3, out_png, PUBLIC_CLIMATE / json_name, png_name, json_name)
    return meta


def process_cmems_currents(env: dict[str, str], s3) -> dict:
    s3_uri, observed_at = latest_s3_uri(env, "cmems_currents")
    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / "currents.nc"
        download_s3(s3, s3_uri, local)
        ds = xr.open_dataset(local)
        # CMEMS Mercator GLO12 surface currents：uo / vo
        # 抓表層第一個 time slice
        uo_da = ds["uo"]
        vo_da = ds["vo"]
        # 處理 depth / time 維度
        for extra_dim in ("depth", "time"):
            if extra_dim in uo_da.dims:
                uo_da = uo_da.isel({extra_dim: 0})
                vo_da = vo_da.isel({extra_dim: 0})
        u = uo_da.values
        v = vo_da.values
        lats = ds["latitude"].values if "latitude" in ds else ds["lat"].values
        lons = ds["longitude"].values if "longitude" in ds else ds["lon"].values
        bbox = [float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max())]
        if lats[0] < lats[-1]:
            u = np.flipud(u)
            v = np.flipud(v)

    PUBLIC_CLIMATE.mkdir(parents=True, exist_ok=True)
    png_name = "currents_latest.png"
    json_name = "currents_latest.json"
    out_png = PUBLIC_CLIMATE / png_name
    meta = encode_uv_to_png(u, v, out_png)
    meta.update({
        "dataset": "cmems_currents",
        "valid_at": observed_at,
        "source_s3": s3_uri,
        "bbox": bbox,
    })
    (PUBLIC_CLIMATE / json_name).write_text(json.dumps(meta, indent=2))
    print(f"  ✓ {out_png.relative_to(REPO_ROOT)} ({out_png.stat().st_size//1024} KB, "
          f"u {meta['u_min']:.2f}..{meta['u_max']:.2f} m/s, valid {meta['valid_pct']:.1f}%)")
    upload_png_and_meta(s3, out_png, PUBLIC_CLIMATE / json_name, png_name, json_name)
    return meta


def upload_png_and_meta(s3, png_path: Path, json_path: Path, png_name: str, json_name: str) -> None:
    """上傳到 s3://migu-gis-data-collector/deploy-assets/climate/{name}"""
    for path, name, ctype in [
        (png_path, png_name, "image/png"),
        (json_path, json_name, "application/json"),
    ]:
        key = f"{S3_DEPLOY_PREFIX}/{name}"
        print(f"  ↑ s3://{S3_BUCKET}/{key}")
        s3.upload_file(
            str(path), S3_BUCKET, key,
            ExtraArgs={"ContentType": ctype, "CacheControl": "public, max-age=3600"},
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="all",
                    choices=["all", "gfs_wind10m", "cmems_currents", "cams_dust"])
    args = ap.parse_args()

    env = load_env()
    s3 = s3_client(env)

    targets = ["gfs_wind10m", "cmems_currents", "cams_dust"] if args.dataset == "all" else [args.dataset]
    for ds_id in targets:
        print(f"\n=== {ds_id} ===")
        try:
            if ds_id == "gfs_wind10m":
                process_gfs_wind10m(env, s3)
            elif ds_id == "cmems_currents":
                process_cmems_currents(env, s3)
            elif ds_id == "cams_dust":
                process_cams_dust(env, s3)
        except Exception as e:
            print(f"  ✗ {ds_id} failed: {e}", file=sys.stderr)
            raise


if __name__ == "__main__":
    main()
