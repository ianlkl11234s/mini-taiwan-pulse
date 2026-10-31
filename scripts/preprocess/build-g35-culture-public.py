#!/usr/bin/env python3
"""台灣圖層第二輪 G35（文化、觀光、原民補強）：taipei-gis-analytics 成品 → public/。

只做「瘦身＋幾何 join＋補來源欄」，不改資料語意：
  - tourism/heritage_national_v2.geojson：文資局七類（原三類＋考古遺址、聚落建築群、紀念建築、史蹟），沿用既有欄位。
  - tourism/tourism_service_sites.geojson：觀光署旅遊服務站點 797 處（44055）。
  - tourism/visitor_spot_stats.geojson：遊客人數月別統計（8116）配到景點點位的 270 個據點（年合計＋最新年月值）。
  - indigenous_rural/indigenous_regions_55.geojson：55 個原住民族地區（163124）join 鄉鎮界。
  - indigenous_rural/indigenous_language_dialects.geojson：16 族 42 方言分布（164237）彙整到 59 鄉鎮 join 鄉鎮界。
  - indigenous_rural/hakka_cultural_zones.geojson：客家文化重點發展區 70 鄉鎮（162466）join 鄉鎮界。

鄉鎮界＝analytics 統計參考界線 TOWN_MOI_1140318（WGS84，sha256 80749d60…），shapely simplify 0.0004°（約 40 m，保拓樸），
座標 5 位小數；只給鄉鎮級範圍示意，不作邊界判定。缺值一律 null，不補 0。

需要 shapely（用 analytics venv 跑）：
  ../taipei-gis-analytics/venv/bin/python3 scripts/preprocess/build-g35-culture-public.py \
      --analytics ../taipei-gis-analytics/.worktrees/tw-g35-culture-tourism
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import OrderedDict
from pathlib import Path

from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
OGDL = "政府資料開放授權條款第1版"
TOWN_REF_SHA = "80749d605be86044650d6d73e0cf36fe48feb9f71ef4192702ced39a29432afd"
SIMPLIFY_DEG = 0.0004


def latest(directory: Path, pattern: str) -> Path:
    files = sorted(directory.glob(pattern))
    if not files:
        raise SystemExit(f"missing input: {directory}/{pattern}")
    return files[-1]


def round_coords(coords, digits: int):
    if isinstance(coords, (int, float)):
        return round(float(coords), digits)
    return [round_coords(c, digits) for c in coords]


def write_fc(path: Path, features: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
    print(f"  {path.relative_to(ROOT)}: {len(features)} features, {path.stat().st_size / 1024:.0f} KB")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def manifest_fetched(path: Path) -> str | None:
    m = json.loads((path.parent / "_manifest.json").read_text())
    return ((m.get("provenance") or {}).get("fetched_at") or m.get("last_updated") or "")[:10] or None


class Towns:
    def __init__(self, analytics_main: Path):
        path = analytics_main / "data/raw/demographics/statistics_reference_geometry" / f"{TOWN_REF_SHA}.geojson"
        self.features = {f["properties"]["area_code"]: f for f in json.loads(path.read_text())["features"]}
        self.cache: dict[str, dict] = {}

    def geometry(self, code: str) -> dict:
        if code not in self.cache:
            geom = shape(self.features[code]["geometry"]).simplify(SIMPLIFY_DEG, preserve_topology=True)
            g = mapping(geom)
            self.cache[code] = {"type": g["type"], "coordinates": round_coords(json.loads(json.dumps(g["coordinates"])), 5)}
        return self.cache[code]


# ── 1. 文化資產七類 ─────────────────────────────────────────────────────────
HERITAGE_FIELDS = ["name", "category", "grade", "types", "address", "city", "gov", "case_url", "image"]


def build_heritage(src: Path) -> None:
    path = latest(src / "tourism/heritage", "heritage_*.geojson")
    feats = []
    for f in json.loads(path.read_text())["features"]:
        p = f["properties"]
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": round_coords(f["geometry"]["coordinates"], 6)},
                      "properties": {k: p.get(k, "") for k in HERITAGE_FIELDS}})
    # 舊檔 heritage_national.geojson 是研究固定快照（tourHeritageFixedDataset 驗 SHA-256），不可覆寫；七類寫新檔。
    write_fc(PUBLIC / "tourism/heritage_national_v2.geojson", feats)


# ── 2. 旅遊服務站點 ─────────────────────────────────────────────────────────
def build_service_sites(src: Path) -> None:
    path = latest(src / "tourism/service_sites", "service_sites_*.geojson")
    fetched = manifest_fetched(path)
    feats = []
    for f in json.loads(path.read_text())["features"]:
        p = f["properties"]
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "name": p["name"], "site_class": str(p["site_class"]) if p["site_class"] is not None else None,
            "county": p["county"], "town": p["town"], "address": p["address"], "authority": p["authority"],
            "service_status": p["service_status"], "source_updated": p["source_updated"],
            "source_org": "交通部觀光署", "source_url": "https://data.gov.tw/dataset/44055", "license": OGDL, "fetched_at": fetched}})
    write_fc(PUBLIC / "tourism/tourism_service_sites.geojson", feats)


# ── 3. 遊客人數據點 ─────────────────────────────────────────────────────────
def build_visitor_spots(src: Path, main_src: Path) -> None:
    path = latest(src / "tourism/visitor_stats", "visitor_spot_points_*.geojson")
    # 月別統計本體（visitor_stats_*.parquet）在 analytics 主 checkout，fetched_at 取那份 manifest 的 last_updated。
    fetched = manifest_fetched(main_src / "tourism/visitor_stats/visitor_stats.parquet")
    feats = []
    for f in json.loads(path.read_text())["features"]:
        p = f["properties"]
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "name": p["spot_name"], "spot_type": p["spot_type"], "county": p["county"],
            "matched_name": p["matched_name"], "match_method": p["match_method"], "coord_basis": p["coord_basis"],
            "first_year": p["years"][0], "annual_visitors": json.dumps(p["annual_visitors"]),
            "latest_year": p["latest_year"], "latest_annual": p["latest_annual"], "latest_monthly": json.dumps(p["latest_monthly"]),
            "yoy_pct": p["yoy_pct"],
            "source_org": "交通部觀光署", "source_url": "https://data.gov.tw/dataset/8116", "license": OGDL, "fetched_at": fetched}})
    feats.sort(key=lambda f: -(f["properties"]["latest_annual"] or 0))
    write_fc(PUBLIC / "tourism/visitor_spot_stats.geojson", feats)


# ── 4. 原住民族地區 55 鄉鎮 ─────────────────────────────────────────────────
def build_indigenous_regions(src: Path, towns: Towns, main_src: Path) -> None:
    # 163124 已在 analytics 主 checkout 處理（2026-10-12），本批未重跑；worktree 沒有就讀主 checkout。
    sub = "demographics/indigenous_townships_55"
    path = latest(src / sub if any((src / sub).glob("*.csv")) else main_src / sub, "indigenous_townships_55_*.csv")
    feats = []
    for r in read_csv(path):
        feats.append({"type": "Feature", "geometry": towns.geometry(r["town_code"]), "properties": {
            "town_code": r["town_code"], "county": r["county"], "town": r["town"],
            "office_website": r["office_website"] or None, "source_vintage": r["source_vintage"],
            "source_org": "原住民族委員會", "source_url": "https://data.gov.tw/dataset/163124", "license": OGDL,
            "fetched_at": r["fetched_at"][:10]}})
    write_fc(PUBLIC / "indigenous_rural/indigenous_regions_55.geojson", feats)


# ── 5. 族語方言分布（鄉鎮彙整） ─────────────────────────────────────────────
def build_dialects(src: Path, towns: Towns) -> None:
    path = latest(src / "demographics/indigenous_language_dialects", "indigenous_language_dialects_*.csv")
    by_town: "OrderedDict[str, list[dict]]" = OrderedDict()
    for r in read_csv(path):
        by_town.setdefault(r["town_code"], []).append(r)
    feats = []
    for code, rows in by_town.items():
        groups = list(dict.fromkeys(r["ethnic_group"] for r in rows))
        feats.append({"type": "Feature", "geometry": towns.geometry(code), "properties": {
            "town_code": code, "county": rows[0]["county"], "town": rows[0]["town"],
            "ethnic_group": groups[0] if len(groups) == 1 else "multiple", "ethnic_groups": "、".join(groups),
            "group_count": len(groups), "dialect_count": len(rows),
            "dialects": json.dumps([{"dialect": r["dialect"], "group": r["ethnic_group"], "villages": r["villages"]} for r in rows], ensure_ascii=False),
            "source_vintage": rows[0]["source_vintage"],
            "source_org": "原住民族委員會", "source_url": "https://data.gov.tw/dataset/164237", "license": OGDL,
            "fetched_at": rows[0]["fetched_at"][:10]}})
    write_fc(PUBLIC / "indigenous_rural/indigenous_language_dialects.geojson", feats)


# ── 6. 客家文化重點發展區 ───────────────────────────────────────────────────
def build_hakka(src: Path, towns: Towns) -> None:
    path = latest(src / "demographics/hakka_cultural_zones", "hakka_cultural_zones_*.csv")
    feats = []
    for r in read_csv(path):
        feats.append({"type": "Feature", "geometry": towns.geometry(r["town_code"]), "properties": {
            "town_code": r["town_code"], "county": r["county"], "town": r["town"],
            "hakka_ratio": float(r["hakka_population_ratio"]) if r["hakka_population_ratio"] else None,
            "hakka_accent": r["hakka_accent"] or None, "major_festivals": r["major_festivals"] or None,
            "office_website": r["office_website"] or None,
            "source_org": "客家委員會", "source_url": "https://data.gov.tw/dataset/162466", "license": OGDL,
            "fetched_at": r["fetched_at"][:10]}})
    write_fc(PUBLIC / "indigenous_rural/hakka_cultural_zones.geojson", feats)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analytics", type=Path, required=True, help="taipei-gis-analytics worktree（讀 data/processed）")
    ap.add_argument("--analytics-main", type=Path, default=ROOT.parent.parent.parent / "taipei-gis-analytics"
                    if ROOT.parent.name == ".worktrees" else ROOT.parent / "taipei-gis-analytics",
                    help="analytics 主 checkout（讀統計參考鄉鎮界）")
    ap.add_argument("--only", nargs="*", default=None)
    args = ap.parse_args()
    src = args.analytics / "data/processed"
    towns = Towns(args.analytics_main)
    steps = {
        "heritage": lambda: build_heritage(src), "service_sites": lambda: build_service_sites(src),
        "visitor_spots": lambda: build_visitor_spots(src, args.analytics_main / "data/processed"), "indigenous_regions": lambda: build_indigenous_regions(src, towns, args.analytics_main / "data/processed"),
        "dialects": lambda: build_dialects(src, towns), "hakka": lambda: build_hakka(src, towns),
    }
    for name, step in steps.items():
        if args.only is None or name in args.only:
            print(name)
            step()


if __name__ == "__main__":
    main()
