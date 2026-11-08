#!/usr/bin/env python3
"""30 天地圖挑戰 Day 8「烏托邦 Utopia」三層資料（公開，模擬面板）。

輸入（唯讀）：taipei-gis-analytics data/processed/analysis/mapchallenge_2026_day08_utopia/web/
（pipelines/analysis/mapchallenge_2026_day08_utopia/10_export_web.py 產生，口徑見該資料夾 README.md）
- day08_access.geojson：中和＋永和 2,673 個最小統計區，到最近「≥1 ha 公園（含河濱公園，河濱公園只能從穿堤入口進入）」步行分鐘
  （t0／t0s＝現況，t_<S>／ts_<S>＝方案 S 實施後；一般 4.8 km/h／長幼 3.6 km/h；>30 或走不到記為 30）
- day08_sites.geojson：方案 A／B／B2／C 各 5 處新增公園用地
- day08_parks.geojson：現有 ≥1 ha 公園面（研究區＋1 km 緩衝，49 面；is_riverside、area_ha）
- day08_entrances.geojson：河濱公園穿堤入口點（63 點；kind＝bridge／tunnel／steps／gate、way_name、park_name）
  入口由 OpenStreetMap 步行路網推定（新北無開放疏散門清單，臺北用疏散門開放資料 data.gov.tw 143891），
  OSM 沒標的門會漏，屬偏保守的下限；颱風期疏散門關閉未模擬
- day08_hist1955.geojson：1955 中和鄉都市計畫的公園（6 面）、綠地（4 面）、學校（8 面）
- day08_plan1955.jpg：1955 中和鄉都市計畫圖（國家文化記憶庫，永和社區大學，CC BY-NC 3.0 TW）

輸出（public/mapchallenge/）：
- day08_access.geojson：原欄位照搬，座標 6 位小數
- day08_sites.geojson：每個（用地 × 方案）一筆，scenario＝A／B／B2／C／D／Dfull；
  cls＝T1／T2／T3（新增用地）或 park／greenbelt（1955 歷史面；park 同時出現在 D 與 Dfull，greenbelt 只在 Dfull；
  學校不上圖）；總代價換成億元（1 位小數）
- day08_parks.geojson：公園面（cls＝park／riverside）與穿堤入口點（cls＝entrance，另留 kind、park_name、way_name）合併成一檔
- day08_plan1955.jpg：原圖照搬（四角座標寫在 src/data/mapchallengeDay08Types.ts）

用法：python3 scripts/preprocess/build-mapchallenge-day08.py [--web DIR]
"""
import argparse
import json
import os
import shutil

GIS = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS"
ap = argparse.ArgumentParser()
ap.add_argument("--web", default=f"{GIS}/taipei-gis-analytics/data/processed/analysis/mapchallenge_2026_day08_utopia/web")
args = ap.parse_args()

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "mapchallenge")
SCENARIOS = ["A", "B", "B2", "C", "D", "Dfull"]


def rnd(g):
    """座標四捨五入到 6 位小數（約 0.1 m）。"""
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], 6), round(c[1], 6)]
        return [r(x) for x in c]
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def load(name):
    with open(os.path.join(args.web, name), encoding="utf-8") as f:
        return json.load(f)


def write(name, feats):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"{name}: {len(feats)} features, {size / 1024:.0f} KB")
    assert size <= 2 * 1024 * 1024, f"{name} 超過 2 MB"


def yi(v):
    """元 → 億元（1 位小數）；缺值保留 None。"""
    return None if v is None else round(v / 1e8, 1)


def num(v):
    """整數化（人口、面積）；缺值保留 None。"""
    return None if v is None else int(round(v))


# ── 1. 步行可及（統計區）────────────────────────────────────────────
TIME_KEYS = ["t0", "t0s"] + [f"{p}_{s}" for s in SCENARIOS for p in ("t", "ts")]
access = []
for f in load("day08_access.geojson")["features"]:
    p = f["properties"]
    props = {"code": p["code"], "town": p["town"], "pop": num(p["pop"]), "vul": num(p["vul"])}
    for k in TIME_KEYS:
        v = p.get(k)
        props[k] = None if v is None else round(v, 1)
    access.append({"type": "Feature", "geometry": rnd(f["geometry"]), "properties": props})
write("day08_access.geojson", access)

# ── 2. 選址（A／B／B2／C 新增用地＋D／Dfull 1955 歷史面）─────────────────
sites = []
for f in load("day08_sites.geojson")["features"]:
    p = f["properties"]
    assert p["scenario"] in SCENARIOS and p["type"] in ("T1", "T2", "T3"), p
    sites.append({"type": "Feature", "geometry": rnd(f["geometry"]), "properties": {
        "scenario": p["scenario"], "cls": p["type"], "step": p["step"], "zone": p.get("zone_raw"),
        "area_m2": num(p["area_m2"]),
        "new_pop": num(p.get("newly_covered_pop")), "new_vul": num(p.get("newly_covered_vul_slow")),
        "pop_low": num(p.get("pop_low")), "pop_high": num(p.get("pop_high")),
        "cost_low": yi(p.get("total_low")), "cost_base": yi(p.get("total_base")), "cost_high": yi(p.get("total_high")),
    }})
hist_counts = {"park": 0, "greenbelt": 0, "school_dropped": 0}
for f in load("day08_hist1955.geojson")["features"]:
    p = f["properties"]
    kind = p["kind"]
    if kind == "school":
        hist_counts["school_dropped"] += 1
        continue
    hist_counts[kind] += 1
    for scenario in (["D", "Dfull"] if kind == "park" else ["Dfull"]):
        sites.append({"type": "Feature", "geometry": rnd(f["geometry"]), "properties": {
            "scenario": scenario, "cls": kind, "label": p.get("label_1955"),
            "area_m2": num(p["area_m2"]), "plan_area_m2": num(p.get("planned_area_m2_text")),
            "still_park_pct": p.get("still_park_pct"),
            "pop_low": num(p.get("pop_low")), "pop_high": num(p.get("pop_high")),
            "cost_low": yi(p.get("total_low")), "cost_base": yi(p.get("total_base")), "cost_high": yi(p.get("total_high")),
        }})
write("day08_sites.geojson", sites)
print("1955 歷史面：", hist_counts)

# ── 2b. 現有公園面＋河濱穿堤入口 ──────────────────────────────────
parks = []
for f in load("day08_parks.geojson")["features"]:
    p = f["properties"]
    parks.append({"type": "Feature", "geometry": rnd(f["geometry"]), "properties": {
        "cls": "riverside" if p["is_riverside"] else "park", "name": p.get("name"), "area_ha": round(p["area_ha"], 2),
    }})
n_park = len(parks)
for f in load("day08_entrances.geojson")["features"]:
    p = f["properties"]
    assert p["kind"] in ("bridge", "tunnel", "steps", "gate"), p
    parks.append({"type": "Feature", "geometry": rnd(f["geometry"]), "properties": {
        "cls": "entrance", "kind": p["kind"], "park_name": p.get("park_name"), "way_name": p.get("way_name"),
    }})
write("day08_parks.geojson", parks)
print(f"公園面 {n_park}，穿堤入口 {len(parks) - n_park}")

# ── 3. 1955 計畫原圖 ─────────────────────────────────────────────────
shutil.copyfile(os.path.join(args.web, "day08_plan1955.jpg"), os.path.join(OUT, "day08_plan1955.jpg"))
corners = load("day08_summary.json")["plan_image"]["corners_lnglat_TL_TR_BR_BL"]
print("day08_plan1955.jpg 四角（TL,TR,BR,BL）：", corners)
