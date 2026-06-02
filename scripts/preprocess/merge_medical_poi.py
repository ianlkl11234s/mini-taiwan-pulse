#!/usr/bin/env python3
"""
合併醫療基礎點位 3 個資料源 → 統一 med_cat 的 medical_poi.geojson。

來源（../taipei-gis-analytics/data/processed/）：
  - poi/medical/nhi_institutions_geocoded.geojson          健保特約院所 31603
  - emergency_response/aed/aed_20260524.geojson            AED 15490
  - poi/long_term_care/long_term_care_20260524.geojson     長照機構 30764

med_cat 分類（前端 5 個獨立 layer）：
  hospital       NHI category in {medical_center, regional, district}（451）
  clinic         NHI clinic（21765）  ← 前端 clinic layer 同時顯示 other_medical
  pharmacy       NHI pharmacy（7680）
  other_medical  NHI 其餘（home_nursing/health_center/rehab/lab/各療法… ≈1707）
  aed            AED（15490）
  ltc            長照（30764）

輸出 properties（最小化以控制 PMTiles 體積；popup 依 med_cat 取用）：
  med_cat, name, county, district, address, phone,
  category_label（NHI 機構類型中文）, specialties（NHI 醫院/診所）,
  abc_type, open_beds, service_items（長照）,
  aed_location, place_type（AED）

用法： python3 scripts/preprocess/merge_medical_poi.py [out.geojson]
預設輸出 scripts/preprocess/medical_poi.geojson（中繼檔，餵 tippecanoe，不入庫）。
"""
import json
import sys
import os

SRC = "../../taipei-gis-analytics/data/processed/"
NHI = SRC + "poi/medical/nhi_institutions_geocoded.geojson"
AED = SRC + "emergency_response/aed/aed_20260524.geojson"
LTC = SRC + "poi/long_term_care/long_term_care_20260524.geojson"

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(__file__), "medical_poi.geojson")

# NHI category → med_cat
HOSPITAL_CATS = {"hospital_medical_center", "hospital_regional", "hospital_district"}
# NHI category → 中文機構類型（popup 顯示用）
NHI_LABEL = {
    "hospital_medical_center": "醫學中心",
    "hospital_regional": "區域醫院",
    "hospital_district": "地區醫院",
    "clinic": "診所",
    "pharmacy": "藥局",
    "home_nursing": "居家護理所",
    "health_center": "衛生所",
    "rehab_home": "精神復健機構",
    "lab": "醫事檢驗所",
    "speech_therapy": "語言治療所",
    "physical_therapy": "物理治療所",
    "midwifery": "助產所",
    "medical_radiology": "醫事放射所",
    "occupational_therapy": "職能治療所",
    "other_nhi": "其他特約",
}


def clean(v):
    """去掉 None / 空字串，數字保留。"""
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def feat(lng, lat, props):
    out = {k: v for k, v in props.items() if v is not None and v != ""}
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": out,
    }


def coords(ft):
    g = ft.get("geometry") or {}
    c = g.get("coordinates")
    if not c or len(c) < 2:
        return None
    return float(c[0]), float(c[1])


def load(path):
    with open(path) as f:
        return json.load(f)["features"]


def main():
    out_features = []
    counts = {}

    # ── NHI ──
    for ft in load(NHI):
        c = coords(ft)
        if not c:
            continue
        p = ft["properties"]
        cat = p.get("category")
        if cat in HOSPITAL_CATS:
            med_cat = "hospital"
        elif cat == "clinic":
            med_cat = "clinic"
        elif cat == "pharmacy":
            med_cat = "pharmacy"
        else:
            med_cat = "other_medical"
        props = {
            "med_cat": med_cat,
            "name": clean(p.get("name")),
            "county": clean(p.get("county")),
            "address": clean(p.get("address")),
            "phone": clean(p.get("phone")),
            "category_label": NHI_LABEL.get(cat, cat),
        }
        # specialties 僅醫院 / 診所有意義（藥局多為空）
        if med_cat in ("hospital", "clinic"):
            props["specialties"] = clean(p.get("specialties"))
        out_features.append(feat(c[0], c[1], props))
        counts[med_cat] = counts.get(med_cat, 0) + 1

    # ── AED ──
    for ft in load(AED):
        c = coords(ft)
        if not c:
            continue
        p = ft["properties"]
        props = {
            "med_cat": "aed",
            "name": clean(p.get("PlaceName")),
            "county": clean(p.get("County")),
            "district": clean(p.get("District")),
            "address": clean(p.get("Address")),
            "phone": clean(p.get("EmergencyPhone")),
            "aed_location": clean(p.get("AEDLocation")),
            "place_type": clean(p.get("PlaceType")),
        }
        out_features.append(feat(c[0], c[1], props))
        counts["aed"] = counts.get("aed", 0) + 1

    # ── 長照 ──
    for ft in load(LTC):
        c = coords(ft)
        if not c:
            continue
        p = ft["properties"]
        addr = clean(p.get("Address")) or ""
        # County 欄為代碼（67000…）→ 從地址前 3 字取縣市名
        county = addr[:3] if len(addr) >= 3 else clean(p.get("County"))
        beds = p.get("OpenBeds")
        props = {
            "med_cat": "ltc",
            "name": clean(p.get("Name")),
            "county": county,
            "address": addr or None,
            "phone": clean(p.get("Phone")),
            "abc_type": clean(p.get("ABCType")),
            "service_items": clean(p.get("ServiceItems")),
        }
        if isinstance(beds, (int, float)) and beds > 0:
            props["open_beds"] = int(beds)
        out_features.append(feat(c[0], c[1], props))
        counts["ltc"] = counts.get("ltc", 0) + 1

    fc = {"type": "FeatureCollection", "features": out_features}
    with open(OUT, "w") as f:
        json.dump(fc, f, ensure_ascii=False)

    print(f"輸出 {OUT}")
    print(f"總點數 {len(out_features)}")
    for k in ("hospital", "clinic", "other_medical", "pharmacy", "aed", "ltc"):
        print(f"  {k}: {counts.get(k, 0)}")
    size = os.path.getsize(OUT) / 1e6
    print(f"檔案大小 {size:.1f} MB")


if __name__ == "__main__":
    main()
