#!/usr/bin/env python3
"""減害服務圖層：taipei-gis-analytics 成品 → public/harm_reduction/*.geojson（＋酒駕事故 PMTiles）。

第一批 5 層（2026-10-06 #548）＋第二批 8 層 GeoJSON＋酒駕肇事事故 1 層 PMTiles；
另把 drug_treatment_monthly_patients（非空間月報）的最新月／期間平均服藥人數併進
drug_treatment_facilities.geojson（以 entity_id join；無月報的機構留 null，不補 0）。

只做「瘦身 + 補來源欄」，不改任何資料語意：
  - 濾掉 geometry 為 null 的 feature（geocode pending，前端畫不出來）
  - 只留 popup／filter 用得到的欄位；不帶 _provenance、原始 row、庫存快照、aliases
  - 座標四捨五入到 6 位小數（約 0.1 m）
  - 補 SourceFooter 需要的 source_org / source_url / license / source_tier / fetched_at，
    以及 popup「資料日期」用的 vintage（依各 feature 的 source 映射；值抄自上游 _manifest.json）
  - 保留上游中文標籤欄 `<欄>_label`（第三輪起；對照表 SSOT 在 analytics 各 pipeline config.yaml labels），
    popup 直接顯示，不在前端自建英文代碼對照

用法：
  python3 scripts/preprocess/build-harm-reduction-public.py \
      --src ../taipei-gis-analytics/data/processed/poi --date 20261006

酒駕事故 GeoJSON 精簡後仍約 15.7MB，超過 dataClass A 約 5MB 上限 → 中繼 GeoJSON 寫到
暫存目錄，再以 tippecanoe（點資料 -r1 -pf -pk，不抽稀不丟點）切成
public/harm_reduction/dui_crash_points.pmtiles，並逐 zoom 稽核點數。需要 tippecanoe／tile-join 在 PATH。
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import tempfile
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
    # 第三輪：清海醫院（衛福部名單未列，依替代治療月報＋133353 保留；機關名／授權照上游 feature）
    "mohw_maintenance_monthly_115|datagov_133353": ("衛生福利部心理健康司（替代治療月報）＋地方政府衛生局（data.gov.tw 133353 地址）",
                                                    "https://data.gov.tw/dataset/133353", OGDL, "月報 115 年 1–8 月；地址 2025-12-12"),
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


# 第二批：上游 license 字串 → popup 顯示文字（未標示一律「來源頁未標示授權」）
def license_text(raw: str | None) -> str:
    return OGDL if raw == "OGDL-1.0-TW" else UNSPECIFIED


def from_props(org: str, vintage: str):
    """單一來源層：機關名用較完整的寫法，url／license 取 feature 自帶。"""
    return lambda p: (org, p["source_url"], license_text(p.get("license")), vintage)


ANTI_DRUG_SOURCES = {
    "ntpc_125302": ("新北市政府（data.gov.tw 125302 防毒保衛站）", "2026-08-07"),
    "kcg_107877_113": ("高雄市政府（data.gov.tw 107877 社區毒品防制關懷站 113 年清冊）", "113 年清冊（2025-06-30）"),
}
CONDOM_SOURCES = {
    "kcg_143426_vending": ("高雄市政府（data.gov.tw 143426 保險套自動服務機）", "2025-06-30"),
    "kcg_143426_pharmacy": ("高雄市政府（data.gov.tw 143426 平價保險套藥局）", "2025-06-30"),
    "hccg_67649": ("新竹市政府（data.gov.tw 67649）", "2025-11-21"),
    "pthg_90622": ("屏東縣政府（data.gov.tw 90622）", "2023-08-31"),
    "chiayi_52515": ("嘉義市政府（data.gov.tw 52515）", "2026-08-04"),
}


def by_source_ids(table: dict[str, tuple[str, str]]):
    def resolve(p):
        org, vintage = table[p["source_ids"][0]]
        return (org, p["source_url"], license_text(p.get("license")), vintage)
    return resolve


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
        "source": lambda p: needle_source(p["source"]),
    },
    "drug_treatment_facilities": {
        "out": "drug_treatment_facilities.geojson",
        "keep": ["category", "category_label", "facility_type", "facility_type_label", "has_methadone", "has_buprenorphine",
                 "designation_valid_to"],
        "id": "entity_id",
        "source": lambda p, t=TREATMENT_SOURCES: t[p["source"]],
    },
    "hiv_selftest_outlets": {
        "out": "hiv_selftest_outlets.geojson",
        "keep": ["channel", "channel_label", "outlet_type", "outlet_type_label", "machine_type", "machine_type_label",
                 "voucher_redeem"],
        "id": "entity_id",
        "source": lambda p, t=SELFTEST_SOURCES: t[p["source"]],
    },
    "hiv_testing_sites": {
        "out": "hiv_testing_sites.geojson",
        "keep": ["category", "category_label", "subtype", "subtype_label", "contact_line"],
        "id": "entity_id",
        "source": lambda p, t=TESTING_SOURCES: t[p["source"]],
    },
    "drug_prevention_centers": {
        "out": "drug_prevention_centers.geojson",
        "keep": ["category_label"],
        "id": "entity_id",
        "source": lambda p, t=PREVENTION_SOURCES: t[p["source"]],
    },
    # ── 第二批（2026-10-06）──
    "alcohol_treatment_facilities": {
        "out": "alcohol_treatment_facilities.geojson",
        "keep": ["category_label", "facility_type", "facility_type_label", "service_type_label", "is_alcohol_designated",
                 "in_subsidy_program", "is_dui_assessment", "also_drug_treatment"],
        "id": "entity_id",
        "source": from_props("衛生福利部心理健康司（酒癮治療費用補助方案機構及酒駕酒癮評估機構名單）", "2026-08-07"),
    },
    "prep_service_sites": {
        "out": "prep_service_sites.geojson",
        "keep": ["category_label", "facility_type", "facility_type_label", "public_funded", "self_paid"],
        "id": "entity_id",
        "source": from_props("衛生福利部疾病管制署（PrEP 服務醫院名單）", "2026-09-02"),
    },
    "internet_addiction_services": {
        "out": "internet_addiction_services.geojson",
        "keep": ["category_label", "service_type", "dept", "special_clinic"],
        "id": "entity_id",
        "source": from_props("衛生福利部心理健康司（各縣市網路成癮治療服務資源表）", "2026-07-28"),
    },
    "offender_aftercare_offices": {
        "out": "offender_aftercare_offices.geojson",
        "keep": ["category_label", "office_type", "office_type_label"],
        "id": "entity_id",
        "source": from_props("法務部（data.gov.tw 10060 更生保護會）", "2023-06-05"),
    },
    "smoking_cessation_providers": {
        "out": "smoking_cessation_providers.geojson",
        "keep": ["category_label", "facility_type", "facility_type_label", "services_label", "service_clinic",
                 "service_counseling"],
        "id": "entity_id",
        "source": from_props("衛生福利部國民健康署（戒菸服務合約機構查詢）", "2026-10-06 匯出（來源無版本日）"),
    },
    "anti_drug_pharmacies": {
        "out": "anti_drug_pharmacies.geojson",
        "keep": ["category_label", "program"],
        "id": "entity_id",
        "source": by_source_ids(ANTI_DRUG_SOURCES),
    },
    "condom_outlets": {
        "out": "condom_outlets.geojson",
        "keep": ["category_label", "outlet_type", "outlet_type_label", "item_note", "item_confirmed"],
        "id": "entity_id",
        "source": by_source_ids(CONDOM_SOURCES),
    },
    "therapeutic_communities": {
        "out": "therapeutic_communities.geojson",
        "keep": ["category_label", "programs", "service_modes", "is_therapeutic_community"],
        "id": "entity_id",
        "source": from_props("衛生福利部心理健康司（藥癮治療性社區／社區復健方案承辦機構）", "2025-07-29"),
    },
}

# 酒駕肇事事故：只留 popup／filter 欄位；不收當事者逐人欄、警察局、事故鍵 provenance。
# year_roc 轉字串：multiSelectFilter 以字串比對（數字 107 ≠ "107"，篩選會整層空白）。
DUI_KEEP = ["year_roc", "accident_date", "accident_time", "accident_class", "accident_class_label", "deaths", "injuries",
            "county", "town", "location", "cause_main", "dui_cause_basis", "dui_cause_basis_label", "n_dui_parties"]
DUI_SOURCE = ("內政部警政署（A1／A2 道路交通事故資料 107–114 年，data.gov.tw 158862 等 8 筆）",
              "https://data.gov.tw/dataset/177136", OGDL, "107–114 年（2018–2025）")
DUI_LAYER = "dui_crash_points"
# maxzoom 12：點資料 Mapbox 會 overzoom，z13／z14 只徒增體積（實測 z14 18MB → z12 12.5MB）；
# 不用「低 zoom 精簡欄位＋tile-join」再省一半，因為 tile-join 的 tilestats.count 會變成各 tile 加總，
# pmtilesClassificationCoverage 的 feature 數對帳就失去意義。
DUI_ZOOM = (5, 12)


def round_coords(coords):
    if isinstance(coords, (int, float)):
        return round(float(coords), 6)
    return [round_coords(c) for c in coords]


def list_text(value):
    """GeoJSON source 的陣列屬性在 Mapbox 端會變 JSON 字串；先串成「、」分隔文字。"""
    return "、".join(value) if isinstance(value, list) else value


def maintenance_summary(src_root: Path, date: str) -> dict[str, dict]:
    """月報長表（processed 成品，PK entity_id×month×drug_type）→ {entity_id: {...}}。

    最新月／首月／最新月服藥人數／期間平均由長表自行彙總；上游的 summary CSV 屬中繼檔
    （analytics data/intermediate/），跨 repo 消費端只讀 processed 成品。未 join 到機構的列（entity_id 空）略過。
    """
    path = src_root / "drug_treatment_monthly_patients" / f"drug_treatment_monthly_patients_{date}.csv"
    series: dict[tuple[str, str], dict[str, int]] = {}
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not row["entity_id"]:
                continue
            months = series.setdefault((row["entity_id"], row["drug_type"]), {})
            if row["month"] in months:
                raise ValueError(f"{row['entity_id']} {row['drug_type']} {row['month']} 重複")
            months[row["month"]] = int(row["patients"])
    out: dict[str, dict] = {}
    for (entity_id, drug_type), months in sorted(series.items()):
        latest, first = max(months), min(months)
        rec = out.setdefault(entity_id, {"maintenance_month": latest, "maintenance_first_month": first})
        if latest != rec["maintenance_month"]:
            raise ValueError(f"{entity_id} 兩藥別最新月不一致")
        rec["maintenance_first_month"] = min(rec["maintenance_first_month"], first)
        rec[f"{drug_type}_patients"] = months[latest]
        rec[f"{drug_type}_patients_mean"] = round(sum(months.values()) / len(months), 1)
    return out


MAINTENANCE_FIELDS = ["maintenance_month", "maintenance_first_month", "methadone_patients", "methadone_patients_mean",
                      "buprenorphine_patients", "buprenorphine_patients_mean"]


def write_collection(path: Path, features: list[dict]) -> None:
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def build(src_root: Path, date: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    maintenance = maintenance_summary(src_root, date)
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
            org, url, license_, vintage = cfg["source"](p)
            props = {"id": p[cfg["id"]]}
            for key in COMMON + cfg["keep"]:
                props[key] = list_text(p.get(key))
            props.update({
                "source_org": org,
                "source_url": url,
                "license": license_,
                "source_tier": p.get("source_tier"),
                "fetched_at": p.get("fetched_at"),
                "vintage": vintage,
            })
            if dataset_id == "drug_treatment_facilities":
                rec = maintenance.get(props["id"], {})
                props.update({key: rec.get(key) for key in MAINTENANCE_FIELDS})
            features.append({
                "type": "Feature",
                "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])},
                "properties": props,
            })
        out = OUT_DIR / cfg["out"]
        write_collection(out, features)
        extra = ""
        if dataset_id == "drug_treatment_facilities":
            extra = f"; 月報服藥人數併入 {sum(1 for f in features if f['properties']['maintenance_month'])} 點"
        print(f"{dataset_id}: {len(features)} features (dropped null geometry {dropped}{extra}) → {out.relative_to(ROOT)} {out.stat().st_size:,} B")
    build_dui(src_root, date)


def build_dui(src_root: Path, date: str) -> None:
    src = src_root / DUI_LAYER / f"{DUI_LAYER}_{date}.geojson"
    data = json.loads(src.read_text(encoding="utf-8"))
    org, url, license_, vintage = DUI_SOURCE
    features = []
    dropped = 0
    for feat in data["features"]:
        geom = feat.get("geometry")
        if not geom or not geom.get("coordinates"):
            dropped += 1
            continue
        p = feat["properties"]
        props = {"id": p["entity_id"]}
        props.update({key: p.get(key) for key in DUI_KEEP})
        props["year_roc"] = str(props["year_roc"])
        props.update({"source_org": org, "source_url": url, "license": license_,
                      "fetched_at": p.get("fetched_at"), "vintage": vintage})
        features.append({"type": "Feature",
                         "geometry": {"type": "Point", "coordinates": round_coords(geom["coordinates"])},
                         "properties": props})
    out = OUT_DIR / f"{DUI_LAYER}.pmtiles"
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / f"{DUI_LAYER}.geojson"
        write_collection(mid, features)
        zmin, zmax = DUI_ZOOM
        subprocess.run([
            "tippecanoe", "-o", str(out), "--force", "-l", DUI_LAYER, "-Z", str(zmin), "-z", str(zmax),
            "-r1", "-pf", "-pk", "--quiet", str(mid),
        ], check=True)
        audit_zoom_counts(out, len(features), zmin, zmax)
    print(f"{DUI_LAYER}: {len(features)} features (dropped null geometry {dropped}) → {out.relative_to(ROOT)} {out.stat().st_size:,} B")


def audit_zoom_counts(pmtiles: Path, expected: int, zmin: int, zmax: int) -> None:
    """逐 zoom 解碼數點：每一層都要等於輸入點數（-r1 -pf -pk 不應丟點）。"""
    if not shutil.which("tippecanoe-decode"):
        raise SystemExit("缺 tippecanoe-decode，無法逐 zoom 稽核")
    for z in range(zmin, zmax + 1):
        res = subprocess.run(["tippecanoe-decode", "-Z", str(z), "-z", str(z), str(pmtiles)],
                             check=True, capture_output=True, text=True)
        ids = set()
        for tile in json.loads(res.stdout)["features"]:  # 每個 tile 一個 FeatureCollection
            for layer in tile["features"]:
                for feat in layer["features"]:
                    ids.add(feat["properties"]["id"])  # buffer 區重複出現的點以 id 去重
        if len(ids) != expected:
            raise SystemExit(f"z{z}: 解碼 {len(ids)} 點 ≠ 輸入 {expected}（丟點）")
        print(f"  z{z}: {len(ids)} 點 ✓")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="taipei-gis-analytics data/processed/poi")
    ap.add_argument("--date", default="20261006")
    args = ap.parse_args()
    build(args.src, args.date)
