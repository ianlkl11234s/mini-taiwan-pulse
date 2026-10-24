#!/usr/bin/env python3
"""atlas 批次 2026-10 靜態圖層：taipei-gis-analytics 成品 → public/<domain>/。

26 個點／線／面圖層（另 7 個 dataset 是非空間表或維度表，不上圖）。只做「瘦身 + 補來源欄」，
不改資料語意：
  - 只留 popup／篩選／分色用得到的欄位；座標四捨五入到 6 位小數。
  - 每筆補 SourceFooter 需要的 source_org／source_url／license／fetched_at，與 popup「資料日期」用的
    vintage（值抄自上游 _manifest.json provenance）。
  - geometry 為 null 的 feature 濾掉（擱淺、海污的事件檔含無座標事件；上圖只畫有座標者，
    無座標筆數寫進 popup／圖例說明）；海污 coord_status=zero（(0,0)）也濾掉並記數。
  - 精度與座標旗標（coord_status、coord_flag、coord_precision、quality_flags…）原值保留，
    另補 `precision_note` 中文說明給 popup 顯示；上游已有 `<欄>_label` 的類別欄直接沿用。
  - 大檔（> 約 5MB GeoJSON）用 tippecanoe 切 PMTiles：點 `-r1 -pf -pk`（不抽稀、不丟點），
    線／面 `-r1 -pf -pk -pt`（不丟小面；線層 z8 起），**不用 --drop-densest**；切完逐 zoom 解碼數 id，
    與輸入筆數（或該 zoom 應出現的筆數）不符就中止。

用法：
  python3 scripts/preprocess/build-atlas-public.py \
      --src ../taipei-gis-analytics/.worktrees/atlas-batch-20261012/data/processed
  （--only <layer_key> … 只重產指定圖層）
"""
from __future__ import annotations

import argparse
import ast
import json
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
OGDL = "政府資料開放授權條款第1版"

# ── 共用小工具 ──────────────────────────────────────────────────────────────


def round_coords(coords):
    if isinstance(coords, (int, float)):
        return round(float(coords), 6)
    return [round_coords(c) for c in coords]


def to_bool(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    if v in (None, ""):
        return None
    return str(v).strip().lower() in ("true", "1", "t", "yes")


def to_num(v: Any) -> float | int | None:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        return v
    try:
        f = float(v)
    except ValueError:
        return None
    return int(f) if f.is_integer() and "." not in str(v) else f


def to_int(v: Any) -> int | None:
    n = to_num(v)
    return None if n is None else int(round(n))


def to_list(v: Any) -> list:
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return v
    try:
        parsed = ast.literal_eval(str(v))
        return list(parsed) if isinstance(parsed, (list, tuple)) else [parsed]
    except (ValueError, SyntaxError):
        return [v]


def joined(v: Any, sep: str = "、") -> str | None:
    items = [str(x) for x in to_list(v) if x not in (None, "")]
    return sep.join(items) or None


def s(v: Any) -> str | None:
    return None if v is None or v == "" else str(v)


def license_of(m: dict) -> str:
    lic = str(m["provenance"].get("license") or "")
    return OGDL if "政府資料開放授權條款" in lic else (lic or "來源頁未標示授權")


def vintage_of(m: dict) -> str:
    p = m["provenance"]
    v = p.get("vintage") or p.get("source_vintage") or m.get("last_updated")
    if isinstance(v, dict):
        return "；".join(f"{k}：{val}" for k, val in v.items())
    return str(v)


def source_props(m: dict) -> dict:
    p = m["provenance"]
    return {
        "source_org": p.get("source") or p.get("publisher"),
        "source_url": p.get("source_url"),
        "license": license_of(m),
        "fetched_at": p.get("fetched_at"),
        "vintage": vintage_of(m),
    }


def write_collection(path: Path, features: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")


def feature(geom: dict, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}, "properties": props}


# ── 精度說明（popup 顯示用；原值欄位一併保留）──────────────────────────────────

COORD_STATUS_NOTE = {
    "ok": "來源座標",
    "ok_outlying": "來源座標（離島或外海，已確認）",
    "out_of_bbox": "來源座標落在臺灣本島周邊範圍外，未修正",
    "suspect_county_mismatch": "座標與通報縣市不一致（疑誤），未修正",
}
QUALITY_FLAG_NOTE = {
    "township_mismatch": "點位落在其他鄉鎮（與來源鄉鎮不符）",
    "lonlat_xy_disagree_gt500m": "經緯度與 TWD97 座標相差 >500 m",
    "coastal_offshore_le300m": "點位在海岸線外 300 m 內",
    "lonlat_outside_declared_township": "經緯度在來源鄉鎮外",
    "twd97_in_lonlat_fields_swapped": "來源經緯度欄誤填 TWD97，已改用 TWD97",
    "lonlat_invalid": "來源經緯度無效",
    "precision_village": "來源無座標，以村里代表點代替",
    "source_coord_invalid": "來源座標無效",
    "population_non_integer_suspect": "人口數非整數（疑誤）",
}


def quality_note(flags: Any) -> str | None:
    parts = []
    for raw in str(flags or "").split(";"):
        raw = raw.strip()
        if not raw:
            continue
        key = raw.split(":")[0]
        parts.append(QUALITY_FLAG_NOTE.get(key, raw))
    return "；".join(dict.fromkeys(parts)) or None


COORD_FLAG_NOTE = {"ok": "來源座標", "tm2_conflict": "來源經緯度與 TWD97 座標相差 >10 m（以經緯度為準）"}

# ── tippecanoe ───────────────────────────────────────────────────────────────


def tile(features: list[dict], out: Path, layer: str, zmin: int, zmax: int, kind: str, extra_flags: tuple[str, ...] = ()) -> None:
    """kind: point → -r1 -pf -pk；line／polygon 另加 -pt（不縮小面）。不用 --drop-densest。
    線的 drop-rate 也要 -r1，否則低 zoom 依比例丟線；極短路段在 z5–7 會退化成點被丟，所以線層從 z8 起切。
    extra_flags：個別圖層追加（例：大面 `--no-tile-size-limit`，避免 500KB 上限隱性丟面）。"""
    flags = ["-r1", "-pf", "-pk"] + ([] if kind == "point" else ["-pt"]) + list(extra_flags)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / f"{layer}.geojson"
        write_collection(mid, features)
        subprocess.run(["tippecanoe", "-o", str(out), "--force", "-l", layer, "-Z", str(zmin), "-z", str(zmax), *flags,
                        "--quiet", str(mid)], check=True)


def audit_zoom_counts(pmtiles: Path, expected: Callable[[int], int], zmin: int, zmax: int) -> dict[int, int]:
    """逐 zoom 解碼數不重複 id；每層都要等於該 zoom 應出現的筆數，否則中止（不靜默丟資料）。"""
    if not shutil.which("tippecanoe-decode"):
        raise SystemExit("缺 tippecanoe-decode，無法逐 zoom 稽核")
    counts: dict[int, int] = {}
    for z in range(zmin, zmax + 1):
        res = subprocess.run(["tippecanoe-decode", "-Z", str(z), "-z", str(z), str(pmtiles)], check=True, capture_output=True, text=True)
        ids = {feat["properties"]["id"] for t in json.loads(res.stdout)["features"] for lyr in t["features"] for feat in lyr["features"]}
        want = expected(z)
        counts[z] = len(ids)
        if len(ids) != want:
            raise SystemExit(f"{pmtiles.name} z{z}: 解碼 {len(ids)} ≠ 應有 {want}（丟資料）")
        print(f"  z{z}: {len(ids):,} ✓")
    return counts


# ── 圖層定義 ────────────────────────────────────────────────────────────────

LAYERS: dict[str, dict] = {}
AUDIT: dict[str, dict] = {}


def layer(key: str, theme: str, dataset: str, out: str, **opts):
    def deco(fn):
        LAYERS[key] = {"theme": theme, "dataset": dataset, "out": out, "build": fn, **opts}
        return fn
    return deco


def load(src: Path, theme: str, dataset: str, name: str | None = None) -> tuple[dict, list[dict]]:
    d = src / theme / dataset
    m = json.loads((d / "_manifest.json").read_text(encoding="utf-8"))
    files = [name] if name else sorted(p.name for p in d.glob("*.geojson"))
    if len(files) != 1:
        raise SystemExit(f"{theme}/{dataset}: 找不到唯一 GeoJSON（{files}）")
    data = json.loads((d / files[0]).read_text(encoding="utf-8"))
    return m, data["features"]


# 原民與農村 ---------------------------------------------------------------

@layer("indigenousTribes", "demographics", "indigenous_tribes", "indigenous_rural/indigenous_tribes.geojson")
def build_tribes(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        out.append(feature(f["geometry"], {
            "id": p["tribe_id"], "name": p.get("tribe_name"), "tribe_name_roman": s(p.get("tribe_name_roman")),
            "ethnic_group": s(p.get("ethnic_group")), "county": s(p.get("county")), "town": s(p.get("town")),
            "village": s(p.get("village")), "neighborhoods": s(p.get("neighborhoods")),
            "in_current_approved_list": to_bool(p.get("in_current_approved_list")),
            "approved_name": s(p.get("approved_name")), "approved_name_native": s(p.get("approved_name_native")),
            "approved_roc_year": to_int(p.get("approved_roc_year")),
            "coord_source": s(p.get("coord_source")), "quality_flags": s(p.get("quality_flags")),
            "precision_note": quality_note(p.get("quality_flags")) or ("來源 TWD97 座標" if p.get("coord_source") == "twd97_xy" else "來源經緯度"),
            "points_vintage": s(p.get("points_vintage")), "approved_list_vintage": s(p.get("approved_list_vintage")),
            **source_props(m), "vintage": f"點位 {p.get('points_vintage')}；核定名單 {p.get('approved_list_vintage')}",
        }))
    return out


ISOLATION_CAUSES = [("cause_debris_flow", "debris"), ("cause_flood", "flood"), ("cause_road_bridge_break", "road")]


@layer("indigenousIsolationRisk", "demographics", "indigenous_isolation_risk_areas", "indigenous_rural/indigenous_isolation_risk_areas.geojson")
def build_isolation(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        combo = "+".join(code for col, code in ISOLATION_CAUSES if to_bool(p.get(col))) or "none"
        out.append(feature(f["geometry"], {
            "id": p["area_id"], "name": s(p.get("area_name")), "roc_year": to_int(p.get("roc_year")),
            "county": s(p.get("county")), "town": s(p.get("town")),
            "cause_debris_flow": to_bool(p.get("cause_debris_flow")), "cause_flood": to_bool(p.get("cause_flood")),
            "cause_road_bridge_break": to_bool(p.get("cause_road_bridge_break")), "cause_combo": combo,
            "has_past_incident": to_bool(p.get("has_past_incident")), "walk_hours_to_office": to_num(p.get("walk_hours_to_office")),
            "households": to_int(p.get("households")), "population": to_num(p.get("population")),
            "elderly_65plus": to_int(p.get("elderly_65plus")), "infants": to_int(p.get("infants")),
            "critical_patients": to_int(p.get("critical_patients")),
            "protected_households": to_int(p.get("protected_households")), "protected_persons": to_int(p.get("protected_persons")),
            "coord_source": s(p.get("coord_source")), "quality_flags": s(p.get("quality_flags")),
            "precision_note": quality_note(p.get("quality_flags")) or ("村里代表點" if p.get("coord_source") == "village_representative_point" else "來源經緯度（地區代表中心點，非範圍）"),
            **source_props(m), "vintage": f"{to_int(p.get('roc_year'))} 年度清冊（{p.get('source_vintage')}）",
        }))
    return out


@layer("agriRuralCommunityVillages", "agriculture", "rural_community_villages", "indigenous_rural/rural_community_villages.pmtiles",
       pmtiles={"layer": "rural_community_villages", "zmin": 7, "zmax": 12, "kind": "polygon"})
def build_rural(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        g = f["geometry"]
        if g["type"] == "GeometryCollection":  # 63 筆面＋線碎片：只留面（同 Supabase ST_CollectionExtract(…,3)）
            polys = [gg["coordinates"] for gg in g["geometries"] if gg["type"] == "Polygon"]
            polys += [c for gg in g["geometries"] if gg["type"] == "MultiPolygon" for c in gg["coordinates"]]
            g = {"type": "MultiPolygon", "coordinates": polys}
        out.append(feature(g, {
            "id": p["villcode"], "county": s(p.get("county")), "town": s(p.get("town")), "village": s(p.get("village")),
            "community_type": s(p.get("community_type")), "community_type_code": s(p.get("community_type_code")),
            "area_ha": to_num(p.get("area_ha")), "villcode_in_current_boundary": to_bool(p.get("villcode_in_current_boundary")),
            **source_props(m), "vintage": s(p.get("source_vintage")),
        }))
    return out


# 道路設施 ---------------------------------------------------------------

def road_sign_props(p: dict, m: dict) -> dict:
    return {
        "id": p["feature_id"], "sign_series": s(p.get("sign_series")), "sign_series_label": s(p.get("sign_series_label")),
        "sign_code": s(p.get("sign_code")), "sign_code_label": s(p.get("sign_code_label")),
        "face_value": s(p.get("face_value")), "face_value_num": to_num(p.get("face_value_num")), "face_value_unit": s(p.get("face_value_unit")),
        "route_no": s(p.get("route_no")), "stake": s(p.get("stake")), "county": s(p.get("county")), "town": s(p.get("town")),
        "maint_section": " ".join(x for x in (s(p.get("maint_unit")), s(p.get("maint_section"))) if x) or None,
        "survey_date": s(p.get("survey_date")), "facing": s(p.get("facing")), "mount_position": s(p.get("mount_position")),
        "condition": s(p.get("condition")), "coord_flag": s(p.get("coord_flag")),
        "precision_note": COORD_FLAG_NOTE.get(str(p.get("coord_flag")), s(p.get("coord_flag"))),
        **source_props(m), "vintage": f"現場調查 {p.get('survey_date')}" if p.get("survey_date") else vintage_of(m),
    }


@layer("provincialRoadSigns", "transportation", "provincial_road_signs", "geo/provincial_road_signs.pmtiles",
       pmtiles={"layer": "provincial_road_signs", "zmin": 9, "zmax": 14, "kind": "point"})
def build_road_signs(m, feats):
    return [feature(f["geometry"], road_sign_props(f["properties"], m)) for f in feats]


@layer("provincialRoadMileposts", "transportation", "provincial_road_mileposts", "geo/provincial_road_mileposts.pmtiles",
       pmtiles={"layer": "provincial_road_mileposts", "zmin": 11, "zmax": 14, "kind": "point"})
def build_mileposts(m, feats):
    out = []
    for f in feats:
        props = road_sign_props(f["properties"], m)
        for k in ("sign_series", "sign_series_label", "sign_code", "face_value_num", "face_value_unit"):
            props.pop(k, None)
        out.append(feature(f["geometry"], props))
    return out


@layer("freewayTrafficSigns", "transportation", "freeway_traffic_signs", "geo/freeway_traffic_signs.pmtiles",
       pmtiles={"layer": "freeway_traffic_signs", "zmin": 10, "zmax": 14, "kind": "point"})
def build_freeway_signs(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        label = s(p.get("sign_code_label"))
        out.append(feature(f["geometry"], {
            "id": p["feature_id"], "route_name": s(p.get("route_name")), "sign_code": s(p.get("sign_code")),
            "sign_code_label": label, "sign_group": "milepost" if label in ("里程牌", "匝道里程") else ("unlabeled" if label is None else "other"),
            "face_value": s(p.get("face_value")), "stake_km": to_num(p.get("stake_km")), "direction_note": s(p.get("direction_note")),
            "county": s(p.get("county")), "coord_flag": s(p.get("coord_flag")),
            "precision_note": COORD_FLAG_NOTE.get(str(p.get("coord_flag")), s(p.get("coord_flag"))),
            **source_props(m),
        }))
    return out


@layer("freewayInterchanges", "transportation", "freeway_interchanges", "geo/freeway_interchanges.geojson")
def build_interchanges(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": s(f["properties"].get("name")), "route_name": s(f["properties"].get("route_name")),
        "facility_type": s(f["properties"].get("facility_type")), "facility_type_label": s(f["properties"].get("facility_type_label")),
        "mileage_km": to_num(f["properties"].get("mileage_km")), "precision_note": "來源經緯度",
        **source_props(m),
    }) for f in feats]


@layer("freewayEcoSensitive", "transportation", "freeway_eco_sensitive_sections", "geo/freeway_eco_sensitive_sections.geojson")
def build_eco(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "sensi_level": to_int(f["properties"].get("sensi_level")),
        "area_m2": to_num(f["properties"].get("area_m2")), **source_props(m),
    }) for f in feats]


@layer("provincialRoadMonitored", "transportation", "provincial_road_monitored_sections", "geo/provincial_road_monitored_sections.pmtiles",
       pmtiles={"layer": "provincial_road_monitored_sections", "zmin": 8, "zmax": 12, "kind": "line"})
def build_monitored(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        out.append(feature(f["geometry"], {
            "id": p["feature_id"], "monitor_series": s(p.get("monitor_series")), "monitor_series_label": s(p.get("monitor_series_label")),
            "route_text": s(p.get("route_text")), "route_no": s(p.get("route_no")), "county": s(p.get("county")), "town": s(p.get("town")),
            "maint_unit": s(p.get("maint_unit")), "rainfall_station_id": s(p.get("rainfall_station_id")),
            "rule_earlywarning": s(p.get("rule_earlywarning1")), "rule_warning": s(p.get("rule_warning1")), "rule_action": s(p.get("rule_action1")),
            "geometry_source": s(p.get("geometry_source")),
            "precision_note": "只有起點座標（無路段線形）" if p.get("geometry_source") == "start_coordinate" else "來源 KML 路段線形",
            "source_updated_at": s(p.get("source_updated_at")), **source_props(m),
        }))
    return out


@layer("provincialRoadEmergencyBays", "transportation", "provincial_road_emergency_bays", "geo/provincial_road_emergency_bays.geojson")
def build_bays(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "route_text": s(f["properties"].get("route_text")), "route_no": s(f["properties"].get("route_no")),
        "county": s(f["properties"].get("county")), "town": s(f["properties"].get("town")), "maint_unit": s(f["properties"].get("maint_unit")),
        "roc_years": joined(f["properties"].get("roc_years")), "last_roc_year": to_int(f["properties"].get("last_roc_year")),
        "in_latest_list": to_bool(f["properties"].get("in_latest_list")), "precision_note": "來源 KML",
        **source_props(m),
    }) for f in feats]


# 災害紀錄 ---------------------------------------------------------------

@layer("floodDisasterPointsNcdr", "hazards", "flood_disaster_points_ncdr", "hazards/flood_disaster_points_ncdr.pmtiles",
       pmtiles={"layer": "flood_disaster_points_ncdr", "zmin": 5, "zmax": 12, "kind": "point"})
def build_flood(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "event_year": to_int(f["properties"].get("event_year")),
        "info_source": s(f["properties"].get("info_source")), "info_source_label": s(f["properties"].get("info_source_label")),
        "county": s(f["properties"].get("county")), "same_point_rows": to_int(f["properties"].get("same_point_rows")),
        "coord_precision": s(f["properties"].get("coord_precision")), "precision_note": "來源點位（定位方式未說明；只到年）",
        **source_props(m),
    }) for f in feats]


@layer("taipeiWaterloggingHistory", "hazards", "taipei_waterlogging_history", "hazards/taipei_waterlogging_history.geojson")
def build_waterlogging(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "event_date": s(f["properties"].get("event_date")), "event_year": to_int(f["properties"].get("event_year")),
        "town": s(f["properties"].get("town")), "location_text": s(f["properties"].get("location_text")),
        "depth_cm": to_num(f["properties"].get("depth_cm")), "depth_unit_note": s(f["properties"].get("depth_unit_note")),
        "area_m2": to_num(f["properties"].get("area_m2")), "attribute_status": s(f["properties"].get("attribute_status")),
        "attribute_status_label": s(f["properties"].get("attribute_status_label")), "precision_note": "來源 KML 範圍",
        **source_props(m),
    }) for f in feats]


@layer("swcbDisasterPhotoPoints", "hazards", "swcb_disaster_photo_points", "hazards/swcb_disaster_photo_points.pmtiles",
       pmtiles={"layer": "swcb_disaster_photo_points", "zmin": 5, "zmax": 12, "kind": "point"})
def build_swcb(m, feats):
    out = []
    for f in feats:
        p = f["properties"]
        out.append(feature(f["geometry"], {
            "id": p["feature_id"], "photo_category": s(p.get("photo_category")), "photo_category_label": s(p.get("photo_category_label")),
            "photo_date": s(p.get("photo_date")), "disaster_year": to_int(p.get("disaster_year")), "disaster_name": s(p.get("disaster_name")),
            "description": s(p.get("description")), "landmark": s(p.get("landmark")), "photo_credit": s(p.get("photo_credit")),
            "photo_url": s(p.get("photo_url")), "news_url": s(p.get("news_url")),
            "county": s(p.get("county")), "town": s(p.get("town_raw")), "village": s(p.get("village_raw")),
            "photo_year_mismatch": to_bool(p.get("photo_year_mismatch")), "coord_precision": s(p.get("coord_precision")),
            "precision_note": "拍攝點位（來源未說明定位方式）", **source_props(m),
        }))
    return out


# 海洋 -------------------------------------------------------------------

def marine_coord(p: dict) -> dict:
    status = s(p.get("coord_status"))
    return {"coord_status": status, "precision_note": COORD_STATUS_NOTE.get(str(status), status)}


def drop_unmapped(key: str, feats: list[dict], zero_ok: bool = True) -> list[dict]:
    kept = [f for f in feats if f.get("geometry") and (zero_ok or f["properties"].get("coord_status") != "zero")]
    zero = sum(1 for f in feats if f.get("geometry") and f["properties"].get("coord_status") == "zero")
    AUDIT.setdefault(key, {})["filtered"] = {"input": len(feats), "null_geometry": sum(1 for f in feats if not f.get("geometry")),
                                             "zero_coordinate": 0 if zero_ok else zero, "kept": len(kept)}
    return kept


@layer("cetaceanStrandings", "marine", "cetacean_strandings", "marine/cetacean_strandings.geojson")
def build_cetacean(m, feats):
    feats = drop_unmapped("cetaceanStrandings", feats)
    return [feature(f["geometry"], {
        "id": f["properties"]["event_id"], "event_date": s(f["properties"].get("event_date")), "event_year": to_int(f["properties"].get("event_year")),
        "county": s(f["properties"].get("county_name")), "species_zh": s(f["properties"].get("species_zh")),
        "scientific_name": s(f["properties"].get("scientific_name")), "animal_status": s(f["properties"].get("animal_status")),
        "group_flag": s(f["properties"].get("group_flag")), "body_length_m": to_num(f["properties"].get("body_length_m")),
        "handling": s(f["properties"].get("handling")), "reporter_category": s(f["properties"].get("reporter_category")),
        **marine_coord(f["properties"]), **source_props(m),
    }) for f in feats]


@layer("seaTurtleStrandings", "marine", "sea_turtle_strandings", "marine/sea_turtle_strandings.geojson")
def build_turtle(m, feats):
    feats = drop_unmapped("seaTurtleStrandings", feats)
    return [feature(f["geometry"], {
        "id": f["properties"]["event_id"], "event_date": s(f["properties"].get("event_date")), "event_year": to_int(f["properties"].get("event_year")),
        "county": s(f["properties"].get("county_name")), "species_zh": s(f["properties"].get("species_zh")),
        "scientific_name": s(f["properties"].get("scientific_name")), "animal_status": s(f["properties"].get("animal_status")),
        "stranding_cause": s(f["properties"].get("stranding_cause")), "carapace_length_cm": to_num(f["properties"].get("carapace_length_cm")),
        "handling": s(f["properties"].get("handling")), **marine_coord(f["properties"]), **source_props(m),
    }) for f in feats]


@layer("beachWaterQuality", "marine", "beach_water_quality", "marine/beach_water_quality.geojson", file="beach_water_quality_20250721.geojson")
def build_beach(m, feats):
    def censored(v, c):
        n = to_num(v)
        return None if n is None else (f"<{n:g}" if c == "lt" else (f">{n:g}" if c == "gt" else f"{n:g}"))
    return [feature(f["geometry"], {
        "id": s(f["properties"]["station_id"]), "name": s(f["properties"].get("station_name")),
        "latest_water_level": s(f["properties"].get("latest_water_level")), "latest_water_level_code": s(f["properties"].get("latest_water_level_code")),
        "last_sample_date": s(f["properties"].get("last_sample_date")), "first_sample_date": s(f["properties"].get("first_sample_date")),
        "sample_count": to_int(f["properties"].get("sample_count")), "unsuitable_count": to_int(f["properties"].get("unsuitable_count")),
        "latest_e_coli": censored(f["properties"].get("latest_e_coli"), f["properties"].get("latest_e_coli_censor")),
        "latest_enterococcus": censored(f["properties"].get("latest_enterococcus"), f["properties"].get("latest_enterococcus_censor")),
        "years_sampled": s(f["properties"].get("years_sampled")), **marine_coord(f["properties"]), **source_props(m),
    }) for f in feats]


@layer("marineMicroplastics", "marine", "marine_microplastics_survey", "marine/marine_microplastics_stations.geojson",
       file="marine_microplastics_survey_stations_202311.geojson")
def build_microplastics(m, feats):
    return [feature(f["geometry"], {
        "id": s(f["properties"]["station_name"]), "name": s(f["properties"].get("station_name")),
        "sea_area_label": s(f["properties"].get("sea_area_label")), "sample_count": to_int(f["properties"].get("sample_count")),
        "cruise_count": to_int(f["properties"].get("cruise_count")), "first_survey_month": s(f["properties"].get("first_survey_month")),
        "last_survey_month": s(f["properties"].get("last_survey_month")),
        "surface_mean_total_per_m3": to_num(f["properties"].get("surface_mean_total_per_m3")),
        "surface_max_total_per_m3": to_num(f["properties"].get("surface_max_total_per_m3")),
        "max_offset_km": to_num(f["properties"].get("max_offset_km")), "coord_quality": s(f["properties"].get("coord_quality")),
        "precision_note": ("各航次座標平均；航次間位置差 >1 km，需複核" if f["properties"].get("coord_quality") == "inconsistent_positions_review"
                           else "各航次座標平均"),
        **source_props(m),
    }) for f in feats]


@layer("marinePollutionIncidents", "marine", "marine_pollution_incidents", "marine/marine_pollution_incidents.geojson")
def build_pollution(m, feats):
    feats = drop_unmapped("marinePollutionIncidents", feats, zero_ok=False)
    return [feature(f["geometry"], {
        "id": s(f["properties"]["case_no"]), "name": s(f["properties"].get("case_name")), "occurred_at": s(f["properties"].get("occurred_at")),
        "occurred_year": to_int(f["properties"].get("occurred_year")), "ended_at": s(f["properties"].get("ended_at")),
        "site_description": s(f["properties"].get("site_description")), "case_level": s(f["properties"].get("case_level")),
        "case_level_label": s(f["properties"].get("case_level_label")), "reporting_agency": s(f["properties"].get("reporting_agency")),
        "outside_tw_responsibility": to_bool(f["properties"].get("outside_tw_responsibility")),
        **marine_coord(f["properties"]), **source_props(m),
    }) for f in feats]


@layer("namrEdnaSurveySites", "marine", "namr_edna_survey_sites", "marine/namr_edna_survey_sites.geojson")
def build_edna(m, feats):
    return [feature(f["geometry"], {
        "id": s(f["properties"]["site_key"]), "name": s(f["properties"].get("site_name")), "region_code": s(f["properties"].get("region_code")),
        "region_major": s(f["properties"].get("region_major")), "region_minor": s(f["properties"].get("region_minor")),
        **marine_coord(f["properties"]), "precision_note": COORD_STATUS_NOTE.get(str(f["properties"].get("coord_status"))) and
        f"{COORD_STATUS_NOTE[str(f['properties'].get('coord_status'))]}（度分秒換算）",
        **source_props(m),
    }) for f in feats]


# 海域保護與漁業（G08，2026-10-17）-----------------------------------------
# 7 層：自然保留區／野生動物保護區（全國含陸域）、開放捕魚點、海岸地區範圍（111 年版）、
# 人工魚礁區／保護礁區（只畫中心點，「中心位置，非範圍」；range_text 只當文字說明，不畫範圍）、
# 定置漁業權區（來源 EPSG:3857 已於上游轉 4326；授權為漁業署網站著作權聲明，照實揭露）。

def first_date(m: dict) -> str:
    """manifest vintage 句子裡的第一個 YYYY-MM-DD（popup「資料日期」只放日期；上游句子含欄名與內部註記，不上前端）。"""
    import re
    hit = re.search(r"\d{4}-\d{2}-\d{2}", vintage_of(m))
    if not hit:
        raise SystemExit(f"vintage 找不到日期：{vintage_of(m)}")
    return hit.group(0)


def edition(v: Any) -> str | None:
    """來源版本欄：'-' 或空字串視為未標。"""
    v = s(v)
    return None if v in (None, "-", "None") else v


def protected_area_props(p: dict, m: dict) -> dict:
    return {
        "id": p["feature_id"], "name": s(p.get("name")), "subarea_name": edition(p.get("subarea_name")),
        "manager": s(p.get("manager")), "legal_established_date": s(p.get("legal_established_date")),
        "legal_announced_date": s(p.get("legal_announced_date")), "source_area_ha": to_num(p.get("source_area_ha")),
        "source_edition": edition(p.get("source_edition")), **source_props(m), "vintage": first_date(m),
    }


@layer("natureReserves", "marine", "nature_reserves", "marine/nature_reserves.geojson")
def build_nature_reserves(m, feats):
    return [feature(f["geometry"], protected_area_props(f["properties"], m)) for f in drop_unmapped("natureReserves", feats)]


@layer("wildlifeProtectedAreas", "marine", "wildlife_protected_areas", "marine/wildlife_protected_areas.geojson")
def build_wildlife_protected(m, feats):
    return [feature(f["geometry"], protected_area_props(f["properties"], m)) for f in drop_unmapped("wildlifeProtectedAreas", feats)]


@layer("openFishingLocations", "marine", "open_fishing_locations", "marine/open_fishing_locations.geojson")
def build_open_fishing(m, feats):
    return [feature(f["geometry"], {
        "id": s(f["properties"]["source_idx"]), "county": s(f["properties"].get("county")),
        "source_xpos": to_num(f["properties"].get("source_xpos")), "source_ypos": to_num(f["properties"].get("source_ypos")),
        **source_props(m), "vintage": first_date(m),
    }) for f in drop_unmapped("openFishingLocations", feats)]


COASTAL_ZMIN, COASTAL_ZMAX = 5, 12
COASTAL_DEGENERATE_M2 = 1.0  # 來源 5 筆左右面積 < 1 m² 的退化面（金門），任何 zoom 都畫不出，不上圖並記數


def ring_area_m2(ring: list) -> float:
    """經緯度環的近似面積（等距矩形投影＋鞋帶公式；只用來決定出現 zoom，不顯示）。"""
    import math
    if len(ring) < 4:
        return 0.0
    lat0 = math.radians(sum(pt[1] for pt in ring) / len(ring))
    kx, ky = 111_320.0 * math.cos(lat0), 110_540.0
    pts = [(pt[0] * kx, pt[1] * ky) for pt in ring]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:]))) / 2


def polygon_area_m2(geom: dict) -> float:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return sum(ring_area_m2(poly[0]) - sum(ring_area_m2(hole) for hole in poly[1:]) for poly in polys)


def area_minzoom(area_m2: float, zmin: int, zmax: int) -> int:
    """面積至少約 4 個 tile 單位（4096／tile）才從該 zoom 出現；更小的小島礁從 zmax 出現。"""
    for z in range(zmin, zmax + 1):
        unit = 36_600_000 / (2 ** z) / 4096  # 北緯 24° 附近每單位邊長（m）
        if area_m2 >= 4 * unit * unit:
            return z
    return zmax


@layer("coastalAreaExtents", "marine", "coastal_area_extents", "marine/coastal_area_extents.pmtiles",
       pmtiles={"layer": "coastal_area_extents", "zmin": COASTAL_ZMIN, "zmax": COASTAL_ZMAX, "kind": "polygon",
                "extra_flags": ("--no-tile-size-limit",), "feature_minzoom": True})
def build_coastal(m, feats):
    # source_area 單位來源未記載，不帶進前端；來源座標帶 Z=0（三維），只留經緯度
    def xy(c):
        return [xy(x) for x in c] if isinstance(c[0], list) else c[:2]
    feats = drop_unmapped("coastalAreaExtents", feats)
    out, degenerate = [], []
    for f in feats:
        geom = {"type": f["geometry"]["type"], "coordinates": xy(f["geometry"]["coordinates"])}
        area = polygon_area_m2(geom)
        if area < COASTAL_DEGENERATE_M2:
            degenerate.append(s(f["properties"]["source_row"]))
            continue
        feat = feature(geom, {
            "id": s(f["properties"]["source_row"]), "county": s(f["properties"].get("county")), "area_type": s(f["properties"].get("area_type")),
            **source_props(m),
        })
        feat["tippecanoe"] = {"minzoom": area_minzoom(area, COASTAL_ZMIN, COASTAL_ZMAX)}
        out.append(feat)
    AUDIT.setdefault("coastalAreaExtents", {})["degenerate_lt_1m2"] = degenerate
    print(f"  退化面（< {COASTAL_DEGENERATE_M2} m²）不上圖：{len(degenerate)} 筆 {degenerate}")
    return out


def reef_props(p: dict, m: dict) -> dict:
    return {
        "id": p["feature_id"], "name": s(p.get("name")), "county": s(p.get("county")),
        "announce_date": s(p.get("announce_date")), "depth_text": s(p.get("depth_text")),
        "range_text": s(p.get("range_text")), "coordinate_text": s(p.get("coordinate_text")),
        "point_basis": s(p.get("point_basis")), "point_basis_label": s(p.get("point_basis_label")),
        "geometry_kind": s(p.get("geometry_kind")), **source_props(m), "vintage": first_date(m),
    }


@layer("artificialReefCenters", "marine", "artificial_reef_areas", "marine/artificial_reef_areas.geojson")
def build_artificial_reef(m, feats):
    return [feature(f["geometry"], reef_props(f["properties"], m)) for f in drop_unmapped("artificialReefCenters", feats)]


@layer("protectedReefCenters", "marine", "protected_reef_areas", "marine/protected_reef_areas.geojson")
def build_protected_reef(m, feats):
    # 1 筆（宜蘭保護礁禁漁區）來源只有地名描述、無座標 → 不上圖，筆數寫進圖例說明
    return [feature(f["geometry"], reef_props(f["properties"], m)) for f in drop_unmapped("protectedReefCenters", feats)]


@layer("setNetFishingAreas", "marine", "set_net_fishing_areas", "marine/set_net_fishing_areas.geojson")
def build_set_net(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "county": s(f["properties"].get("county")),
        "fishery_name": s(f["properties"].get("fishery_name")), "area_name": s(f["properties"].get("area_name")),
        "license_no": s(f["properties"].get("license_no")), **source_props(m), "vintage": first_date(m),
    }) for f in drop_unmapped("setNetFishingAreas", feats)]


# 文化幣藝文消費點（G23，2026-10-24）---------------------------------------
# analytics culture/culture_coin_venues_moc：店家 4,264（街頭藝人不在成品內；tel 不入成品）。
# 來源檔無日期欄 → 資料日期＝下載日（provenance.downloaded_at）；(0,0) 已在上游以地址回補並標 coord_status／precision。

CULTURE_COIN_SOURCE = "文化部 文化幣"


@layer("cultureCoinVenues", "culture", "culture_coin_venues_moc", "culture/culture_coin_venues.geojson")
def build_culture_coin(m, feats):
    day = str(m["provenance"]["downloaded_at"])[:10]
    out = []
    for f in drop_unmapped("cultureCoinVenues", feats):
        p = f["properties"]
        out.append(feature(f["geometry"], {
            "id": s(p["source_id"]), "name": s(p.get("name")), "address": s(p.get("address")),
            "city": s(p.get("city")), "area": s(p.get("area")),
            "category": s(p["category"]), "sub_category": s(p["sub_category"]), "sub_category_label": s(p.get("sub_category_label")),
            "coord_status": s(p.get("coord_status")), "precision": s(p.get("precision")), "county_check": s(p.get("county_check")),
            "source_org": CULTURE_COIN_SOURCE, "source_url": m["provenance"].get("source_url"), "license": OGDL,
            "fetched_at": day, "vintage": day,
        }))
    return out


# 原民會文化健康站（G20，2026-10-24）-------------------------------------
# analytics welfare/cultural_health_stations_cip：525 站。成品本身不帶電話（手機、市話都不入成品）。
# 191 站離線 geocode 落在來源鄉鎮內（precision exact／interpolated／cached）→ 一站一點（kind=site）；
# 334 站只到鄉鎮（precision township_centroid，鄉鎮質心）→ 依 town_code 併成一點（kind=township_group，
# station_count／station_names），不另造偏移座標，popup 列站名並註明「僅到鄉鎮，非實際位置」。
# 資料日期＝檔內 DateListed（date_listed，全部同一日）；下載日另列。

CULTURAL_HEALTH_SOURCE = "原住民族委員會 原住民族文化健康站通訊錄"


@layer("culturalHealthStations", "welfare", "cultural_health_stations_cip", "welfare/cultural_health_stations.geojson")
def build_cultural_health(m, feats):
    feats = drop_unmapped("culturalHealthStations", feats)
    base = {"source_org": CULTURAL_HEALTH_SOURCE, "source_url": m["provenance"].get("source_url"), "license": OGDL,
            "fetched_at": str(m["provenance"]["downloaded_at"])[:10]}
    dates = {f["properties"].get("date_listed") for f in feats}
    if len(dates) != 1:
        raise SystemExit(f"culturalHealthStations: date_listed 不唯一 {dates}")
    base["vintage"] = dates.pop()
    out, groups = [], {}
    for f in feats:
        p = f["properties"]
        if any(k in p for k in ("tel", "tel_ext", "mobile", "phone")):
            raise SystemExit("culturalHealthStations: 成品不應帶電話欄")
        if p["precision"] == "township_centroid":
            groups.setdefault(p["town_code"], []).append(f)
            continue
        out.append(feature(f["geometry"], {
            "id": s(p["station_id"]), "kind": "site", "name": s(p.get("name")), "address": s(p.get("address")),
            "county": s(p.get("county")), "town": s(p.get("town")),
            "precision": s(p["precision"]), "precision_label": s(p.get("precision_label")), **base,
        }))
    for town_code, members in sorted(groups.items()):
        coords = {tuple(f["geometry"]["coordinates"]) for f in members}
        if len(coords) != 1:
            raise SystemExit(f"culturalHealthStations: {town_code} 質心不唯一")
        members.sort(key=lambda f: f["properties"]["station_id"])
        p0 = members[0]["properties"]
        reasons = sorted({f["properties"].get("fallback_reason_label") for f in members if f["properties"].get("fallback_reason_label")})
        out.append(feature(members[0]["geometry"], {
            "id": f"town-{town_code}", "kind": "township_group", "name": f"{p0['county']}{p0['town']}（{len(members)} 站）",
            "county": s(p0.get("county")), "town": s(p0.get("town")), "station_count": len(members),
            "station_names": "、".join(str(f["properties"]["name"]) for f in members),
            "precision": "township_centroid", "precision_label": s(p0.get("precision_label")),
            "fallback_reasons": "；".join(reasons) or None, **base,
        }))
    sites = sum(1 for f in out if f["properties"]["kind"] == "site")
    stations = sites + sum(f["properties"].get("station_count", 0) for f in out)
    if stations != len(feats):
        raise SystemExit(f"culturalHealthStations: 站數 {stations} ≠ 輸入 {len(feats)}")
    AUDIT["culturalHealthStations"]["grouping"] = {"stations": len(feats), "sites": sites, "township_groups": len(groups),
                                                   "grouped_stations": len(feats) - sites}
    return out


# 地名 -------------------------------------------------------------------

PLACE_PRIORITY = {"admin": 0, "natural": 1, "settlement": 2, "landmark": 3}
PLACE_MINZOOM = {"natural": 9, "admin": 12, "settlement": 12, "landmark": 14}
PLACE_MAX_PRECISION_M = 1200


@layer("placeNames", "base_map", "place_names_moi", "geo/place_names_moi.pmtiles",
       pmtiles={"layer": "place_names_moi", "zmin": 9, "zmax": 14, "kind": "point", "feature_minzoom": True})
def build_place_names(m, feats):
    """同 entity_group 只取一筆（admin > natural > settlement > landmark；同類取小數位多者）；
    只烘 coord_precision_m ≤ 1,200 的點（1 位小數約 11 km 的 105 點不上圖）。每筆依類別寫 tippecanoe minzoom。"""
    precise = [f for f in feats if (to_int(f["properties"].get("coord_precision_m")) or 0) <= PLACE_MAX_PRECISION_M]
    best: dict[str, dict] = {}
    for f in precise:
        p = f["properties"]
        rank = (PLACE_PRIORITY.get(p["category"], 9), -(to_int(p.get("coord_decimals")) or 0), p["place_id"])
        g = p["entity_group_id"]
        if g not in best or rank < best[g][0]:
            best[g] = (rank, f)
    AUDIT["placeNames"] = {"filtered": {"input": len(feats), "dropped_precision_gt_1200m": len(feats) - len(precise),
                                        "dropped_same_entity_group": len(precise) - len(best), "kept": len(best)}}
    out = []
    for _, f in sorted(best.values(), key=lambda x: x[1]["properties"]["place_id"]):
        p = f["properties"]
        feat = feature(f["geometry"], {
            "id": p["place_id"], "name": p["name"], "category": p["category"], "category_label": p.get("category_label"),
            "name_hanyu_pinyin": s(p.get("name_hanyu_pinyin")), "aliases": joined(p.get("aliases")),
            "county": s(p.get("county")), "town": s(p.get("town")), "village": s(p.get("village")),
            "place_meaning": s(p.get("place_meaning")), "extent_type_label": s(p.get("extent_type_label")),
            "coord_precision_m": to_int(p.get("coord_precision_m")), "coord_status_label": s(p.get("coord_status_label")),
            "precision_note": f"約 ±{to_int(p.get('coord_precision_m')):,} m（來源座標小數 {to_int(p.get('coord_decimals'))} 位）",
            "data_source_labels": joined(p.get("data_source_labels")), **source_props(m),
        })
        feat["tippecanoe"] = {"minzoom": PLACE_MINZOOM[p["category"]]}
        out.append(feat)
    return out


@layer("triangulationPoints", "base_map", "triangulation_points_moi", "geo/triangulation_points_moi.geojson")
def build_triangulation(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["point_id"], "name": s(f["properties"].get("name")), "grade": to_int(f["properties"].get("grade")),
        "grade_label": s(f["properties"].get("grade_label")), "map_sheet": s(f["properties"].get("map_sheet")),
        "mark_no": s(f["properties"].get("mark_no")), "mark_material": s(f["properties"].get("mark_material")),
        "elevation_m": to_num(f["properties"].get("elevation_m")), "coord_precision_m": to_int(f["properties"].get("coord_precision_m")),
        "tm2_dms_flag": s(f["properties"].get("tm2_dms_flag")),
        "precision_note": f"約 ±{to_int(f['properties'].get('coord_precision_m'))} m（TWD67 度分秒 → WGS84 七參數）"
                          + ("；來源 TM2 座標與度分秒不一致，已不採用" if f["properties"].get("tm2_dms_flag") == "inconsistent_tm2_ignored" else ""),
        **source_props(m),
    }) for f in feats]


# 水利 -------------------------------------------------------------------

@layer("wraFloodgatesCentral", "water_resources", "wra_floodgates_central", "geo/wra_floodgates_central.geojson")
def build_floodgates(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": s(f["properties"].get("name")), "gate_kind": s(f["properties"].get("gate_kind")) or "other",
        "gate_kind_label": s(f["properties"].get("gate_kind_label")), "river_name": s(f["properties"].get("river_name")),
        "bank": s(f["properties"].get("bank")), "operation_type_label": s(f["properties"].get("operation_type_label")),
        "gate_spec_raw": s(f["properties"].get("gate_spec_raw")), "material_raw": s(f["properties"].get("material_raw")),
        "mileage_desc": s(f["properties"].get("mileage_desc")), "county": s(f["properties"].get("county")),
        "river_branch_label": s(f["properties"].get("river_branch_label")), "survey_date": s(f["properties"].get("survey_date")),
        "coord_precision": s(f["properties"].get("coord_precision")), "precision_note": "測量點位（TWD97 轉 WGS84）",
        **source_props(m),
    }) for f in feats]


@layer("wraCentralDrainage", "water_resources", "wra_central_drainage", "geo/wra_central_drainage.geojson")
def build_drainage(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": s(f["properties"].get("drainage_name")), "basin_name": s(f["properties"].get("basin_name")),
        "outlet": s(f["properties"].get("outlet")), "main_length_km": to_num(f["properties"].get("main_length_km")),
        "responsible_authority": s(f["properties"].get("responsible_authority")),
        "passing_county_names": joined(f["properties"].get("passing_county_names")),
        "start_desc": s(f["properties"].get("start_desc")), "end_desc": s(f["properties"].get("end_desc")),
        "area_km2": to_num(f["properties"].get("area_km2")), "precision_note": "來源範圍面",
        **source_props(m),
    }) for f in feats]


@layer("iowStructureMonitoring", "water_resources", "iow_structure_monitoring_stations", "geo/wra_iow_structure_monitoring.geojson")
def build_iow(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": s(f["properties"].get("observatory_name")),
        "structure_category": s(f["properties"].get("structure_category")), "structure_category_label": s(f["properties"].get("structure_category_label")),
        "org_name": s(f["properties"].get("org_name")), "sensor_count": to_int(f["properties"].get("sensor_count")),
        "sensor_kinds": joined(f["properties"].get("sensor_kinds")), "county": s(f["properties"].get("county")),
        "town": s(f["properties"].get("town_raw")), "nearest_floodgate_name": s(f["properties"].get("nearest_floodgate_name")),
        "nearest_floodgate_m": to_num(f["properties"].get("nearest_floodgate_m")),
        "precision_note": "來源經緯度" + ("（與來源行政區一致）" if to_bool(f["properties"].get("coord_consistent")) else "（與來源行政區不一致）"),
        **source_props(m),
    }) for f in feats]


DREDGE_PRECISION_NOTE = {"deg_0.01": "來源座標只到小數 2 位（約 ±1 km）", "deg_0.1": "來源座標只到小數 1 位（約 ±10 km）",
                         "deg_1": "來源座標只到整數度（約 ±100 km）"}


@layer("wraDredgingPoints", "water_resources", "wra_dredging_points", "geo/wra_dredging_points.geojson")
def build_dredging(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": s(f["properties"].get("plan_name")), "river_name": s(f["properties"].get("river_name")),
        "executing_unit": s(f["properties"].get("executing_unit")), "status": s(f["properties"].get("status")),
        "status_label": s(f["properties"].get("status_label")), "start_date": s(f["properties"].get("start_date")),
        "end_date": s(f["properties"].get("end_date")), "plan_quantity": to_num(f["properties"].get("plan_quantity")),
        "execute_quantity": to_num(f["properties"].get("execute_quantity")), "quantity_unit": s(f["properties"].get("quantity_unit")),
        "county": s(f["properties"].get("county")), "coord_precision": s(f["properties"].get("coord_precision")),
        "precision_note": DREDGE_PRECISION_NOTE.get(str(f["properties"].get("coord_precision")), s(f["properties"].get("coord_precision"))),
        **source_props(m), "vintage": f"統計日期 {str(f['properties'].get('statistic_date') or '')[:10]}",
    }) for f in feats]


@layer("wraEcologySurveySites", "water_resources", "wra_ecology_survey_sites", "geo/wra_ecology_survey_sites.geojson")
def build_ecology(m, feats):
    return [feature(f["geometry"], {
        "id": f["properties"]["feature_id"], "name": joined(f["properties"].get("site_names")), "river_name": s(f["properties"].get("river_name")),
        "basin_name": s(f["properties"].get("basin_name")), "record_count": to_int(f["properties"].get("record_count")),
        "species_count": to_int(f["properties"].get("species_count")), "taxon_groups_label": joined(f["properties"].get("taxon_groups_label")),
        "first_survey_date": s(f["properties"].get("first_survey_date")), "last_survey_date": s(f["properties"].get("last_survey_date")),
        "county": s(f["properties"].get("county")),
        "precision_note": "來源 TM2 座標" + ("（來源 X／Y 欄對調，已校正）" if "swapped" in to_list(f["properties"].get("coord_flags")) else ""),
        **source_props(m),
    }) for f in feats]


# 國營事業與國有資產（G16，2026-10-24）-------------------------------------
# analytics socioeconomic/state_assets 07_export_points：台水廠所 137、台水淨水設施 487（1 筆缺座標不上圖）、
# 台糖糖廠 14、國產署待標售 955（8 筆無法定位不上圖）。成品不含個資欄（上游無承辦人／聯絡人）。
# 資料日期：台水、台糖用上游 data_vintage 的 data.gov.tw metadata 日期（只留日期）；待標售是下載日快照。

def metadata_date(v: Any) -> str | None:
    """上游 data_vintage 形如「data.gov.tw metadata 2024-11-22（靜態）」→ 只留日期（popup 標「data.gov.tw 更新日」）。"""
    import re
    hit = re.search(r"\d{4}-\d{2}-\d{2}", str(v or ""))
    if not hit:
        raise SystemExit(f"data_vintage 沒有日期：{v!r}")
    return hit.group(0)


def state_asset_base(m: dict, org: str, nid: str, vintage: str | None) -> dict:
    return {"source_org": org, "source_url": f"https://data.gov.tw/dataset/{nid}", "license": OGDL,
            "fetched_at": str(m["provenance"]["fetched_at"])[:10], "vintage": vintage}


def no_pii(key: str, p: dict) -> None:
    bad = [k for k in p if any(t in k for t in ("contact", "phone", "tel", "mobile", "person", "officer", "owner"))]
    if bad:
        raise SystemExit(f"{key}: 成品不應帶個資欄 {bad}")


@layer("twcServiceOffices", "water_resources", "twc_service_offices", "state_assets/twc_service_offices.geojson")
def build_twc_offices(m, feats):
    out = []
    for f in drop_unmapped("twcServiceOffices", feats):
        p = f["properties"]
        no_pii("twcServiceOffices", p)
        out.append(feature(f["geometry"], {
            "id": p["office_id"], "name": s(p.get("unit_name")), "unit_type": s(p["unit_type"]), "unit_type_label": s(p.get("unit_type_label")),
            "region_office": s(p.get("region_office")), "address": s(p.get("address")),
            "county": s(p.get("county_name")), "town": s(p.get("town_name")), "shared_site_count": to_int(p.get("shared_site_count")),
            **state_asset_base(m, "台灣自來水公司", "86110", metadata_date(p.get("data_vintage"))),
        }))
    return out


@layer("twcWaterFacilities", "water_resources", "twc_water_facilities", "state_assets/twc_water_facilities.geojson")
def build_twc_facilities(m, feats):
    out = []
    for f in drop_unmapped("twcWaterFacilities", feats):
        p = f["properties"]
        no_pii("twcWaterFacilities", p)
        out.append(feature(f["geometry"], {
            "id": p["facility_id"], "name": s(p.get("facility_name")), "facility_type": s(p["facility_type"]),
            "facility_type_label": s(p.get("facility_type_label")), "region_no": to_int(p.get("region_no")),
            "supply_area_text": s(p.get("supply_area_text")), "raw_water_source": s(p.get("raw_water_source")),
            "existing_large_plant_name": s(p.get("existing_large_plant_name")), "design_capacity_cmd": to_num(p.get("design_capacity_cmd")),
            "name_encoding_issue": bool(p.get("name_encoding_issue")),
            "coord_status": s(p.get("coord_status")), "coord_status_label": s(p.get("coord_status_label")),
            "county": s(p.get("county_name")), "town": s(p.get("town_name")),
            **state_asset_base(m, "台灣自來水公司", "36602", metadata_date(p.get("data_vintage"))),
        }))
    linked = sum(1 for f in out if f["properties"]["existing_large_plant_name"])
    AUDIT["twcWaterFacilities"]["large_plant_linked_rows"] = linked
    return out


@layer("taisugarSugarMills", "industrial_zone", "taisugar_sugar_mills", "state_assets/taisugar_sugar_mills.geojson")
def build_taisugar_mills(m, feats):
    out = []
    for f in drop_unmapped("taisugarSugarMills", feats):
        p = f["properties"]
        no_pii("taisugarSugarMills", p)
        out.append(feature(f["geometry"], {
            "id": p["mill_id"], "name": s(p.get("mill_name")), "address": s(p.get("address")), "highlights": s(p.get("highlights")),
            "geocode_precision": s(p.get("geocode_precision")), "geocode_precision_label": s(p.get("geocode_precision_label")),
            "coord_status": s(p.get("coord_status")), "coord_status_label": s(p.get("coord_status_label")),
            "county": s(p.get("county_name")), "town": s(p.get("town_name")),
            **state_asset_base(m, "台灣糖業股份有限公司", "41592", metadata_date(p.get("data_vintage"))),
        }))
    return out


@layer("statePropertyTenderListings", "real_estate", "state_property_tender_listings", "state_assets/state_property_tender_listings.geojson")
def build_state_tender(m, feats):
    day = str(m["provenance"]["fetched_at"])[:10]
    out = []
    for f in drop_unmapped("statePropertyTenderListings", feats):
        p = f["properties"]
        no_pii("statePropertyTenderListings", p)
        nid = "9659" if p["property_kind"] == "land" else "13152"
        out.append(feature(f["geometry"], {
            "id": p["listing_id"], "property_kind": s(p["property_kind"]), "property_kind_label": s(p.get("property_kind_label")),
            "branch_office": s(p.get("branch_office")), "bid_no": s(p.get("bid_no")), "bid_date": s(p.get("bid_date")),
            "parcel_text": s(p.get("parcel_text")), "street_address": s(p.get("street_address")),
            "building_numbers": joined(p.get("building_numbers")), "base_land_numbers": joined(p.get("base_land_numbers")),
            "county": s(p.get("county_name")), "town": s(p.get("town_name")), "town_name_basis": s(p.get("town_name_basis")), "town_name_basis_label": s(p.get("town_name_basis_label")),
            "land_area_sqm": to_num(p.get("land_area_sqm")), "share_area_sqm": to_num(p.get("share_area_sqm")),
            "zoning": s(p.get("zoning")), "land_use_class": s(p.get("land_use_class")),
            "announced_land_value_per_sqm": to_num(p.get("announced_land_value_per_sqm")), "announced_land_value_date": s(p.get("announced_land_value_date")),
            "geocode_precision": s(p.get("geocode_precision")), "geocode_precision_label": s(p.get("geocode_precision_label")),
            "geocode_source_label": s(p.get("geocode_source_label")),
            "spatial_check": s(p.get("spatial_check")), "spatial_check_label": s(p.get("spatial_check_label")),
            **state_asset_base(m, "財政部國有財產署", nid, day),
        }))
    return out


# 金融服務據點（G10，2026-10-24）-------------------------------------------
# analytics civic_facilities/{atm_sites_fisc,financial_branches_fisc}：財金公司名冊快照 2026-10-24。
# ATM 27,412 裝設點（22 筆無法定位不上圖；一個裝設點可能有多台機台）；總分支機構 4,989（1 筆無法定位）。
# 座標來源混合（數位部 175482、中華郵政 6121、地址定位、Google），popup 一律標定位精度；成品無個資欄。

def finance_base(m: dict, nid: str, p: dict) -> dict:
    return {"source_org": "財金資訊股份有限公司", "source_url": f"https://data.gov.tw/dataset/{nid}", "license": OGDL,
            "fetched_at": str(m["provenance"]["fetched_at"])[:10], "vintage": s(p.get("snapshot_date"))}


def finance_location(p: dict) -> dict:
    return {
        "county": s(p.get("county_name")), "town": s(p.get("town_name")), "address": s(p.get("address")),
        "town_basis": s(p.get("town_basis")), "town_basis_label": s(p.get("town_basis_label")),
        "coord_source": s(p.get("coord_source")), "coord_source_label": s(p.get("coord_source_label")),
        "geocode_precision": s(p.get("geocode_precision")), "geocode_precision_label": s(p.get("geocode_precision_label")),
        "spatial_check": s(p.get("spatial_check")), "spatial_check_label": s(p.get("spatial_check_label")),
    }


def flag(v: Any) -> int | None:
    """布林旗標轉 1／0；缺值保持 null（不當成「否」）。"""
    if v is None:
        return None
    return 1 if v is True else 0 if v is False else None


@layer("atmSitesFisc", "civic_facilities", "atm_sites_fisc", "finance/atm_sites_fisc.pmtiles",
       pmtiles={"layer": "atm_sites_fisc", "zmin": 5, "zmax": 12, "kind": "point"})
def build_atm_sites(m, feats):
    out = []
    for f in drop_unmapped("atmSitesFisc", feats):
        p = f["properties"]
        no_pii("atmSitesFisc", p)
        out.append(feature(f["geometry"], {
            "id": p["atm_site_id"], "name": s(p.get("site_name")), "institution_name": s(p.get("institution_name")),
            "institution_category": s(p.get("institution_category")), "institution_category_label": s(p.get("institution_category_label")),
            "wheelchair_accessible": flag(p.get("wheelchair_accessible")), "voice_guidance": flag(p.get("voice_guidance")),
            "intl_card_withdrawal": flag(p.get("intl_card_withdrawal")), "open_to_public": flag(p.get("open_to_public")),
            "access_note": s(p.get("access_note")),
            **finance_location(p), **finance_base(m, "24333", p),
        }))
    AUDIT["atmSitesFisc"]["approximate_rows"] = sum(1 for f in out if f["properties"]["geocode_precision"] == "google_approximate")
    AUDIT["atmSitesFisc"]["not_public_rows"] = sum(1 for f in out if f["properties"]["open_to_public"] == 0)
    return out


@layer("financialBranchesFisc", "civic_facilities", "financial_branches_fisc", "finance/financial_branches_fisc.geojson")
def build_financial_branches(m, feats):
    out = []
    for f in drop_unmapped("financialBranchesFisc", feats):
        p = f["properties"]
        no_pii("financialBranchesFisc", p)
        out.append(feature(f["geometry"], {
            "id": p["branch_id"], "name": " ".join(x for x in (s(p.get("institution_name")), s(p.get("branch_name"))) if x),
            "institution_name": s(p.get("institution_name")), "branch_name": s(p.get("branch_name")),
            "institution_category": s(p.get("institution_category")), "institution_category_label": s(p.get("institution_category_label")),
            **finance_location(p), **finance_base(m, "24323", p),
        }))
    return out


# 金融服務據點延伸（G10 延伸，2026-10-24）-------------------------------------
# analytics civic_facilities/{securities_futures_institutions,insurance_institutions}（gis-platform mig 483 同一份成品）：
# 證券期貨投信投顧 1,071（33 列無營業地址、無幾何不上圖）；保險公司總分公司＋保險代理人公司 655。
# 來源機關每列不同（證交所／期交所／投信投顧公會、保發中心／保代公會），出典逐列帶；成品無個資欄（負責人、簽署人上游已丟）。

FINANCE_SOURCE_DATE = [
    (r"^資料日期 (\d{4}-\d{2}-\d{2})（檔內）$", "file_date"),
    (r"^公告日期 (\d{4}-\d{2}-\d{2})（檔內）$", "announced"),
    (r"^名冊下載日 \d{4}-\d{2}-\d{2}（檔內無日期；data\.gov\.tw metadata 更新日 (\d{4}-\d{2}-\d{2})）$", "metadata"),
    (r"^資料年月 \d{4}-\d{2}，公會更新日 (\d{4}-\d{2}-\d{2})$", "association_update"),
    (r"^名冊下載日 (\d{4}-\d{2}-\d{2})（檔內無資料日期；.+）$", "download"),
]


def finance_source_date(v: Any) -> dict:
    """上游 data_vintage 句子 → {source_date, source_date_kind}（popup 依 kind 套譯文；句型對不上就中止）。"""
    import re
    for pattern, kind in FINANCE_SOURCE_DATE:
        hit = re.match(pattern, str(v or ""))
        if hit:
            return {"source_date": hit.group(1), "source_date_kind": kind}
    raise SystemExit(f"data_vintage 句型未登記：{v!r}")


def finance_ext_base(m: dict, p: dict) -> dict:
    return {"source_org": s(p.get("source_publisher")), "source_url": f"https://data.gov.tw/dataset/{p['source_nid']}", "license": OGDL,
            "fetched_at": str(m["provenance"]["fetched_at"])[:10], "vintage": s(p.get("snapshot_date")), **finance_source_date(p.get("data_vintage"))}


@layer("securitiesFuturesInstitutions", "civic_facilities", "securities_futures_institutions", "finance/securities_futures_institutions.geojson")
def build_securities_futures(m, feats):
    out = []
    for f in drop_unmapped("securitiesFuturesInstitutions", feats):
        p = f["properties"]
        no_pii("securitiesFuturesInstitutions", p)
        out.append(feature(f["geometry"], {
            "id": p["institution_id"], "name": s(p.get("display_name")), "firm_name": s(p.get("firm_name")), "office_name": s(p.get("office_name")),
            "institution_type": s(p["institution_type"]), "institution_type_label": s(p.get("institution_type_label")),
            "futures_operator_kind": s(p.get("futures_operator_kind")), "futures_operator_kind_label": s(p.get("futures_operator_kind_label")),
            "proprietary_desk": flag(p.get("proprietary_desk")), "opened_date": s(p.get("opened_date")),
            **finance_location(p), **finance_ext_base(m, p),
        }))
    AUDIT["securitiesFuturesInstitutions"]["approximate_rows"] = sum(1 for f in out if f["properties"]["geocode_precision"] == "google_approximate")
    return out


@layer("insuranceInstitutions", "civic_facilities", "insurance_institutions", "finance/insurance_institutions.geojson")
def build_insurance_institutions(m, feats):
    out = []
    for f in drop_unmapped("insuranceInstitutions", feats):
        p = f["properties"]
        no_pii("insuranceInstitutions", p)
        out.append(feature(f["geometry"], {
            "id": p["institution_id"], "name": s(p.get("display_name")), "firm_name": s(p.get("firm_name")),
            "institution_type": s(p["institution_type"]), "institution_type_label": s(p.get("institution_type_label")),
            "office_level": s(p.get("office_level")), "office_level_label": s(p.get("office_level_label")),
            "agency_lines": s(p.get("agency_lines")), "agency_lines_label": s(p.get("agency_lines_label")),
            **finance_location(p), **finance_ext_base(m, p),
        }))
    AUDIT["insuranceInstitutions"]["approximate_rows"] = sum(1 for f in out if f["properties"]["geocode_precision"] == "google_approximate")
    return out


# ── main ─────────────────────────────────────────────────────────────────


def build(src: Path, key: str) -> None:
    spec = LAYERS[key]
    m, feats = load(src, spec["theme"], spec["dataset"], spec.get("file"))
    out_feats = spec["build"](m, feats)
    ids = Counter(f["properties"]["id"] for f in out_feats)
    dup = [i for i, c in ids.items() if c > 1]
    if dup:
        raise SystemExit(f"{key}: id 重複 {dup[:5]}")
    out = PUBLIC / spec["out"]
    entry = AUDIT.setdefault(key, {})
    entry.update({"dataset": f"{spec['theme']}/{spec['dataset']}", "out": f"public/{spec['out']}", "features": len(out_feats)})
    pm = spec.get("pmtiles")
    if pm:
        print(f"{key}: {len(out_feats):,} features → {out.relative_to(ROOT)}（z{pm['zmin']}–{pm['zmax']}）")
        tile(out_feats, out, pm["layer"], pm["zmin"], pm["zmax"], pm["kind"], tuple(pm.get("extra_flags", ())))
        if pm.get("feature_minzoom"):
            mins = [f["tippecanoe"]["minzoom"] for f in out_feats]
            expected = lambda z: sum(1 for mz in mins if mz <= z)  # noqa: E731
        else:
            expected = lambda z: len(out_feats)  # noqa: E731
        entry["zoom_counts"] = audit_zoom_counts(out, expected, pm["zmin"], pm["zmax"])
        entry["source_layer"] = pm["layer"]
    else:
        write_collection(out, out_feats)
    entry["bytes"] = out.stat().st_size
    print(f"{key}: {len(out_feats):,} features → {out.relative_to(ROOT)} {entry['bytes']:,} B")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="taipei-gis-analytics data/processed")
    ap.add_argument("--only", nargs="*", help="只重產這些 layer key")
    ap.add_argument("--audit-out", type=Path, help="把筆數／逐 zoom 稽核寫成 JSON")
    args = ap.parse_args()
    keys = args.only or list(LAYERS)
    unknown = sorted(set(keys) - set(LAYERS))
    if unknown:
        raise SystemExit(f"未知 layer key：{unknown}")
    for k in keys:
        build(args.src, k)
    if args.audit_out:
        args.audit_out.write_text(json.dumps(AUDIT, ensure_ascii=False, indent=2), encoding="utf-8")
