#!/usr/bin/env python3
"""G37（2026-10-31）三份 data.gov.tw 開放資料 → atlas-src 暫存目錄（analytics 尚無對應 pipeline）。

輸出格式比照 taipei-gis-analytics data/processed：`<atlas-src>/<theme>/<dataset>/{<dataset>.geojson,_manifest.json}`，
之後由 `scripts/preprocess/build-atlas-public.py --src <atlas-src> --only <key>` 瘦身產生 public/ 資產。

  1. 國家重要濕地範圍（data.gov.tw 25659 → TGOS「重要濕地範圍圖」SHP，89 面，TWD97 TM2 121°）
  2. 禁止或限制水域遊憩活動區域（data.gov.tw 38872，交通部觀光署 CSV，頂點座標文字）
  3. 電動機車換電站：台灣中油提供換電服務加油站（106247 JSON，400 站）＋台電出租作換電站之租賃據點（165894 CSV，12 筆）

水域遊憩的座標雖都標「TWD97」，實際混用 TM2 121°（EPSG:3826）、TM2 119°（EPSG:3825，澎湖）與經緯度：
每列依數值量級與管理處轄區 bbox 判斷，兩套 TM2 都落不進轄區的列（嵵裡沙灘）不上圖、寫進 _manifest 的 excluded。
頂點依字母前綴分組（A1–A4、B1–B4…各一區；只有 A、B、C… 的整列是一區）；≥3 點連成面，依公告頂點順序，
順序連線自相交時改用凸包並標 shape_basis=convex_hull；2 點畫線（公告的岸際界線）。這些都只是示意，範圍以公告附圖為準。

需要 Python 套件 geopandas、pyproj、shapely（本機用 /opt/homebrew/bin/python3.14）。
用法：python3.14 scripts/fetch/fetch-g37-opendata.py <atlas-src 目錄> [--raw <下載快取目錄>]
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import urllib.parse
import subprocess
import zipfile
from pathlib import Path

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, mapping

UA = {"User-Agent": "Mozilla/5.0 (mini-taiwan-pulse G37 fetch)"}
OGDL = "政府資料開放授權條款"

WETLAND_ZIP = ("https://www.tgos.tw:443/MDE/VirtualDir_TC/Product/c5894f87-68f4-4f88-ab32-12d58cc9fd35/"
               + urllib.parse.quote("重要濕地1150109(更新龍鑾潭).zip"))
WATERREC_CSV = "https://media.taiwan.net.tw/od/04_TD/" + urllib.parse.quote("水域/禁止或限制水域遊憩活動區域.csv")
CPC_JSON = "https://vipmbr.cpc.com.tw/openData/ElectricMotorcycleBatterySwappingStn"
TAIPOWER_CSV = "https://service.taipower.com.tw/data/opendata/apply/file/d010004/001.csv"


def fetch(url: str, cache: Path) -> bytes:
    if cache.exists():
        return cache.read_bytes()
    # TGOS 憑證缺 Subject Key Identifier，Python ssl 驗證會失敗；改用 curl（系統憑證庫可驗過）。
    cache.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "-sSfL", "--max-time", "120", "-A", UA["User-Agent"], "-o", str(cache), url], check=True)
    return cache.read_bytes()


def write(out_root: Path, theme: str, dataset: str, features: list[dict], provenance: dict, extra: dict | None = None) -> None:
    d = out_root / theme / dataset
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{dataset}.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False), encoding="utf-8")
    manifest = {"dataset_id": dataset, "last_updated": provenance["fetched_at"], "provenance": provenance, **(extra or {})}
    (d / "_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{theme}/{dataset}: {len(features)} features")


# ── 1. 國家重要濕地 ───────────────────────────────────────────────────────────

def build_wetlands(out_root: Path, raw: Path, fetched: str) -> None:
    z = zipfile.ZipFile(io.BytesIO(fetch(WETLAND_ZIP, raw / "wetland_range.zip")))
    shp_dir = raw / "wetland_range"
    z.extractall(shp_dir)
    shp = next(shp_dir.rglob("*.shp"))
    g = gpd.read_file(shp)
    if len(g) != 89:
        raise SystemExit(f"濕地範圍筆數 {len(g)} ≠ 89")
    g = g.to_crs(4326)
    feats = []
    for _, r in g.iterrows():
        counties = [c for c in (r.get("CITY_1"), r.get("CITY_2")) if isinstance(c, str) and c]
        feats.append({"type": "Feature", "geometry": mapping(r.geometry), "properties": {
            "serial": str(r["SERIAL_NUM"]), "name": r["TITLE"], "sub_title": r["SUB_TITLE"] if isinstance(r["SUB_TITLE"], str) else None,
            "level": r["LEVEL_1"], "counties": "、".join(counties), "area_ha": float(r["AREA"]) if r["AREA"] == r["AREA"] else None,
        }})
    write(out_root, "environment", "important_wetlands", feats, {
        "source": "內政部國家公園署（國家重要濕地範圍圖，TGOS）", "source_url": "https://data.gov.tw/dataset/25659",
        "license": OGDL, "fetched_at": fetched, "vintage": "2026-01-09（檔名 1150109 更新龍鑾潭）",
    })


# ── 2. 禁止或限制水域遊憩活動區域 ─────────────────────────────────────────────

TM121 = Transformer.from_crs(3826, 4326, always_xy=True)
TM119 = Transformer.from_crs(3825, 4326, always_xy=True)
# 管理處轄區 bbox（lon_min, lat_min, lon_max, lat_max），用來判斷該列採哪一套座標
OFFICE_BBOX = {
    "大鵬灣": (120.3, 22.2, 120.6, 22.6), "馬祖": (119.8, 25.9, 120.6, 26.45), "東部海岸": (121.0, 22.7, 121.7, 23.8),
    "東北角": (121.6, 24.5, 122.1, 25.2), "北海岸": (121.4, 25.0, 121.8, 25.35), "澎湖": (119.2, 23.1, 119.8, 23.9),
    "雲嘉南": (120.0, 22.9, 120.3, 23.6),
}
# 換算後雖落在轄區 bbox、但與公告地名明顯不符的列（2026-10-31 逐列核對）：不上圖，寫進 excluded。
KNOWN_BAD = {
    "嵵裡沙灘": "頂點換算後在 119.34°E 23.31°N（望安西方外海），距嵵裡沙灘約 30 km，兩套 TM2 都對不上",
}
VERTEX = re.compile(r"([A-Z])(\d*)\s*[（(]\s*([\d.]+)\s*[,，]\s*([\d.]+)\s*[)）]")


def office_bbox(org: str) -> tuple[float, float, float, float]:
    for key, box in OFFICE_BBOX.items():
        if key in org:
            return box
    raise SystemExit(f"未知管理處：{org}")


def inside(pts, box) -> bool:
    return all(box[0] <= x <= box[2] and box[1] <= y <= box[3] for x, y in pts)


def to_lonlat(raw_pts, box):
    """回傳 (經緯度點, 採用的座標系)；三種都落不進轄區就回 (None, None)。"""
    if all(x < 360 for x, _ in raw_pts):
        cands = [("WGS84", list(raw_pts))]
    else:
        cands = [("EPSG:3826", [TM121.transform(x, y) for x, y in raw_pts]), ("EPSG:3825", [TM119.transform(x, y) for x, y in raw_pts])]
    for crs, pts in cands:
        if inside(pts, box):
            return pts, crs
    return None, None


def build_waterrec(out_root: Path, raw: Path, fetched: str) -> None:
    rows = list(csv.DictReader(io.StringIO(fetch(WATERREC_CSV, raw / "waterrec.csv").decode("utf-8-sig"))))
    feats, excluded = [], []
    for i, r in enumerate(rows):
        name = re.sub(r"\s+", "", r["名稱"]).strip("「」")
        org = r["主管機關"].strip().replace("交通部觀光局", "交通部觀光署")
        verts = VERTEX.findall(r["限制區域座標"])
        bad = next((why for key, why in KNOWN_BAD.items() if key in name), None)
        if bad:
            excluded.append({"row": i, "name": name, "reason": bad})
            continue
        box = office_bbox(org)
        all_pts, crs = to_lonlat([(float(x), float(y)) for _, _, x, y in verts], box)
        if all_pts is None:
            excluded.append({"row": i, "name": name, "reason": "頂點座標以 TM2 121°／119° 與經緯度換算都不在管理處轄區內"})
            continue
        has_digits = any(d for _, d, _, _ in verts)
        groups: dict[str, list] = {}
        for (letter, digits, _, _), pt in zip(verts, all_pts):
            groups.setdefault(letter if has_digits else "_", []).append(pt)
        kind = "prohibited" if "禁止" in name and "限制" not in name else ("restricted" if "禁止" not in name else "mixed")
        for zone, pts in groups.items():
            basis = "vertex_order"
            if len(pts) >= 3:
                poly = Polygon(pts)
                if not poly.is_valid:
                    poly, basis = Polygon(pts).convex_hull, "convex_hull"
                geom = poly
            elif len(pts) == 2:
                geom, basis = LineString(pts), "line"
            else:
                excluded.append({"row": i, "name": name, "zone": zone, "reason": "單點，無法成區"})
                continue
            feats.append({"type": "Feature", "geometry": mapping(geom), "properties": {
                "id": f"{i}-{zone}", "name": name, "zone": None if zone == "_" else zone, "org": org, "kind": kind,
                "activity": re.sub(r"\s+", " ", r["限制活動"]).strip()[:600], "penalty": re.sub(r"\s+", " ", r["違規罰則"]).strip()[:300],
                "legal_basis": r["法令依據"].strip(), "notice_url": r["公告連結"].strip() or None,
                "source_crs": crs, "shape_basis": basis,
            }})
    write(out_root, "tourism", "water_recreation_restricted_areas", feats, {
        "source": "交通部觀光署（各國家風景區管理處公告）", "source_url": "https://data.gov.tw/dataset/38872",
        "license": OGDL, "fetched_at": fetched, "vintage": "2026-09-15（data.gov.tw 詮釋資料更新日）",
    }, {"source_rows": len(rows), "excluded": excluded})


# ── 3. 電動機車換電站 ─────────────────────────────────────────────────────────

def build_swap(out_root: Path, raw: Path, fetched: str) -> None:
    feats = []
    for s in json.loads(fetch(CPC_JSON, raw / "cpc_swap.json")):
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(s["經度"]), float(s["緯度"])]}, "properties": {
            "id": f"cpc-{s['站代號']}", "operator": "cpc", "name": s["站名"], "address": s["地址"], "phone": s["電話"],
            "hours": s["提供服務時段"],
        }})
    rows = list(csv.DictReader(io.StringIO(fetch(TAIPOWER_CSV, raw / "taipower_swap.csv").decode("utf-8-sig"))))
    for i, r in enumerate(rows):
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(r["經度"]), float(r["緯度"])]}, "properties": {
            "id": f"taipower-{i + 1}", "operator": "taipower", "name": r["土地座落"], "branch": r["經管單位"], "use": r["出租用途"],
            "lessee": r["承租人"], "contract_period": r["契約起迄日期"], "note": r["備註"] or None,
        }})
    write(out_root, "energy", "battery_swap_stations", feats, {
        "source": "台灣中油（106247）、台灣電力公司（165894）", "source_url": "https://data.gov.tw/dataset/106247",
        "license": OGDL, "fetched_at": fetched, "vintage": "中油 2025-08-21、台電 2024-07-22（data.gov.tw 詮釋資料更新日）",
    }, {"counts": {"cpc": sum(1 for f in feats if f["properties"]["operator"] == "cpc"), "taipower": len(rows)}})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path, help="atlas-src 目錄（build-atlas-public.py --src）")
    ap.add_argument("--raw", type=Path, help="下載快取目錄（預設 <out>/_raw）")
    ap.add_argument("--fetched", default="2026-10-31", help="下載日（寫進 provenance.fetched_at）")
    args = ap.parse_args()
    raw = args.raw or args.out / "_raw"
    build_wetlands(args.out, raw, args.fetched)
    build_waterrec(args.out, raw, args.fetched)
    build_swap(args.out, raw, args.fetched)
