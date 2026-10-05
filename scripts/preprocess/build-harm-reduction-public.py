#!/usr/bin/env python3
"""減害服務 5 層：taipei-gis-analytics 成品 → public/harm_reduction/*.geojson。

只做「瘦身 + 補來源欄」，不改任何資料語意：
  - 濾掉 geometry 為 null 的 feature（geocode pending，前端畫不出來）
  - 只留 popup／filter 用得到的欄位；不帶 _provenance、原始 row、庫存快照、aliases
  - 座標四捨五入到 6 位小數（約 0.1 m）
  - 補 SourceFooter 需要的 source_org / source_url / license / source_tier / fetched_at，
    以及 popup「資料日期」用的 vintage（依各 feature 的 source 映射；值抄自上游 _manifest.json）

用法：
  python3 scripts/preprocess/build-harm-reduction-public.py \
      --src ../taipei-gis-analytics/data/processed/poi --date 20261006
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "harm_reduction"

OGDL = "政府資料開放授權條款第1版"
UNSPECIFIED = "來源頁未標示授權"

COMMON = ["name", "county", "town", "address", "phone", "service_hours", "geocode_precision"]

# 清潔針具：source → (機關, 下載頁, 授權, 資料日期)
NEEDLE_SOURCES = {
    "cdc_pdf": ("衛生福利部疾病管制署（清潔針具執行點名冊）",
                "https://www.cdc.gov.tw/Category/MPage/BVGmgum1evkhTprNSeSjNQ", UNSPECIFIED, "2026-07-14"),
}
COUNTY_PREFIX = {"tpe": "臺北市", "khh": "高雄市", "ptt": "屏東縣", "cyi": "嘉義市", "hsz": "新竹市"}

TREATMENT_SOURCES = {
    "mohw_substance_use_designated_115": ("衛生福利部心理健康司（指定藥癮戒治及替代治療機構名單）",
                                          "https://dep.mohw.gov.tw/DOMHAOH/cp-4097-43398-107.html", UNSPECIFIED, "2026-08-31"),
    "datagov_133353": ("地方政府衛生局（data.gov.tw 133353）", "https://data.gov.tw/dataset/133353", OGDL, "2025-12-12"),
}
SELFTEST_SOURCES = {
    "cdc_hiva_physical_outlet": ("衛生福利部疾病管制署（愛滋自我篩檢實體通路）",
                                 "https://hiva.cdc.gov.tw/selftest/Service_place.aspx", UNSPECIFIED, "2026-10-06"),
    "cdc_hiva_vending_machine": ("衛生福利部疾病管制署（愛滋自我篩檢自動服務機）",
                                 "https://hiva.cdc.gov.tw/selftest/vending_machine.aspx", UNSPECIFIED, "2026-10-06"),
}
TESTING_URL_ANON = "https://www.cdc.gov.tw/Category/MPage/gH7NyWhq3ulASakaq5DDIQ"
TESTING_URL_DESIGNATED = "https://www.cdc.gov.tw/Category/Page/t-5dv2y4iBsgbdOBi5CJ1g"
TESTING_SOURCES = {
    "cdc_anon_hospitals_1150922": ("衛生福利部疾病管制署（匿名篩檢醫院）", TESTING_URL_ANON, UNSPECIFIED, "2026-09-22"),
    "cdc_anon_health_bureaus_1150722": ("衛生福利部疾病管制署（匿名篩檢衛生局所）", TESTING_URL_ANON, UNSPECIFIED, "2026-07-22"),
    "cdc_designated_hosp_clinic_115Q3": ("衛生福利部疾病管制署（愛滋指定醫事機構）", TESTING_URL_DESIGNATED, UNSPECIFIED, "2026-07-15"),
    "cdc_designated_pharmacy_115Q3": ("衛生福利部疾病管制署（愛滋指定藥局）", TESTING_URL_DESIGNATED, UNSPECIFIED, "2026-07-15"),
    "mohw_lgbtq_health_centers_1150612": ("衛生福利部（多元性別健康中心）", TESTING_URL_ANON, UNSPECIFIED, "2026-06-12"),
}
PREVENTION_SOURCES = {
    "moj_13717": ("法務部（data.gov.tw 13717 毒品危害防制中心）", "https://data.gov.tw/dataset/13717", OGDL, "2024-02-01"),
    "moj_10091": ("法務部（data.gov.tw 10091 毒品危害防制中心）", "https://data.gov.tw/dataset/10091", OGDL, "2023-07-07"),
}


def needle_source(src: str) -> tuple[str, str, str, str]:
    if src in NEEDLE_SOURCES:
        return NEEDLE_SOURCES[src]
    first = src.split("|")[0]
    prefix, _, num = first.partition("_")
    county = COUNTY_PREFIX.get(prefix, "縣市")
    return (f"{county}衛生局（data.gov.tw {num}）", f"https://data.gov.tw/dataset/{num}", OGDL, "2026-10-06")


LAYERS = {
    "harm_reduction_needle_points": {
        "out": "needle_points.geojson",
        "keep": ["site_type", "has_education_station", "has_vending_machine", "has_return_bin",
                 "education_is_24h", "vending_is_24h", "return_bin_is_24h", "in_cdc_list"],
        "id": "site_id",
        "source": needle_source,
    },
    "drug_treatment_facilities": {
        "out": "drug_treatment_facilities.geojson",
        "keep": ["category", "facility_type", "has_methadone", "has_buprenorphine", "designation_valid_to"],
        "id": "entity_id",
        "source": TREATMENT_SOURCES.__getitem__,
    },
    "hiv_selftest_outlets": {
        "out": "hiv_selftest_outlets.geojson",
        "keep": ["channel", "outlet_type", "machine_type", "voucher_redeem"],
        "id": "entity_id",
        "source": SELFTEST_SOURCES.__getitem__,
    },
    "hiv_testing_sites": {
        "out": "hiv_testing_sites.geojson",
        "keep": ["category", "subtype", "contact_line"],
        "id": "entity_id",
        "source": TESTING_SOURCES.__getitem__,
    },
    "drug_prevention_centers": {
        "out": "drug_prevention_centers.geojson",
        "keep": [],
        "id": "entity_id",
        "source": PREVENTION_SOURCES.__getitem__,
    },
}


def round_coords(coords):
    if isinstance(coords, (int, float)):
        return round(float(coords), 6)
    return [round_coords(c) for c in coords]


def build(src_root: Path, date: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for dataset_id, cfg in LAYERS.items():
        src = src_root / dataset_id / f"{dataset_id}_{date}.geojson"
        data = json.loads(src.read_text(encoding="utf-8"))
        features = []
        dropped = 0
        for feat in data["features"]:
            geom = feat.get("geometry")
            if not geom or not geom.get("coordinates"):
                dropped += 1
                continue
            p = feat["properties"]
            org, url, license_, vintage = cfg["source"](p["source"])
            props = {"id": p[cfg["id"]]}
            for key in COMMON + cfg["keep"]:
                props[key] = p.get(key)
            props.update({
                "source_org": org,
                "source_url": url,
                "license": license_,
                "source_tier": p.get("source_tier"),
                "fetched_at": p.get("fetched_at"),
                "vintage": vintage,
            })
            features.append({
                "type": "Feature",
                "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])},
                "properties": props,
            })
        out = OUT_DIR / cfg["out"]
        out.write_text(
            json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"{dataset_id}: {len(features)} features (dropped null geometry {dropped}) → {out.relative_to(ROOT)} {out.stat().st_size:,} B")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="taipei-gis-analytics data/processed/poi")
    ap.add_argument("--date", default="20261006")
    args = ap.parse_args()
    build(args.src, args.date)
