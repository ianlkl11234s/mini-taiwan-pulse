#!/usr/bin/env python3
"""G36 消防、民防、情勢與交通事故圖層：原始檔 → public/ 靜態資產（2026-10-31）。

子命令（可只跑其中幾個）：
  accidents   analytics environment/traffic_accident/traffic_accident_by_incident.geojson
              → public/geo/traffic_accidents_2025.pmtiles（gitignored，走 S3 deploy-assets geo/ 鏡像）
  hydrants    analytics fire/hydrants/hydrants.csv（臺北自來水事業處＋高雄市消防局，既有 69,839 點）
              ＋台水 data.gov.tw 44642 prot7.zip（19 縣市；種類編碼 0–5 依資料資源說明轉中文型式）→ public/geo/fire_hydrants_national.pmtiles（gitignored）
  tsunami     data.gov.tw 34102 → public/hazards/tsunami_sirens.geojson
  nuclear     data.gov.tw 102114（集結點）＋102434（避難收容處所）→ public/hazards/nuclear_epz_evacuation.geojson
  resources   data.gov.tw 77862 → public/geo/disaster_resource_sites.geojson
  firing      data.gov.tw 136419（海軍）＋143315（海巡署）→ public/marine/firing_notice_areas.geojson

原始檔下載位置（--raw 目錄底下的子目錄名稱 → 下載網址）：
  rb1_44642/prot7.zip   https://www.water.gov.tw/opendata/prot7.zip
  rb1_34102/d.csv       https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/A98A502C-C685-4683-91DB-46BA3029CCEE/resource/6C7AB13F-4B0E-4744-BB56-B33D9C05636A/download
  rb1_102114/d          https://www.nusc.gov.tw/dataopen/index.php?id=104
  rb1_102434/d          https://www.nusc.gov.tw/dataopen/index.php?id=106（cp950）
  rb1_77862/d.json      https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/9753248E-B03F-4F0F-A199-C38667D29836/resource/11B45264-FB54-4B85-925A-5A71F71E5D39/download
  rb1_136419/d.csv      https://www.mnd.gov.tw/NewUpload/202512/海軍實彈射擊公告_584348.csv
  rb1_143315/f2024032600001.csv  https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f2024032600001.zip 內的 CSV
data.gov.tw 系下載要帶瀏覽器 User-Agent。下載日 2026-10-31。

TWD97 換算用 ogr2ogr（本機沒有 pyproj）：台水的澎湖用 TM2 119 度帶（EPSG:3825），其餘用 121 度帶（EPSG:3826）；
海嘯警報臺連澎湖都是 121 度帶 —— 換算後逐點檢查是否落在台灣與離島範圍，超出就中止。

用法：
  python3 scripts/preprocess/build-g36-safety-public.py --raw <下載目錄> \
      --analytics ../taipei-gis-analytics/data/processed accidents hydrants tsunami nuclear resources firing
需要 tippecanoe、tippecanoe-decode、ogr2ogr 在 PATH。
"""
from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import math
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OGDL = "政府資料開放授權條款第1版"


def write_collection(path: Path, features: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"  → {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} {len(features)} features {path.stat().st_size:,} B")


def point(lng: float, lat: float, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}, "properties": props}


def in_taiwan(lng: float, lat: float) -> bool:
    """本島＋澎湖＋金門＋馬祖＋綠島蘭嶼的寬鬆外框。"""
    return 118.0 < lng < 122.2 and 21.7 < lat < 26.5


def twd97_to_wgs84(rows: list[tuple[str, float, float]], epsg: int) -> dict[str, tuple[float, float]]:
    """[(key, x, y)] → {key: (lng, lat)}，用 ogr2ogr 換算。"""
    if not rows:
        return {}
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / "in.csv", Path(tmp) / "out.csv"
        with src.open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["k", "x", "y"])
            w.writerows(rows)
        subprocess.run(["ogr2ogr", "-f", "CSV", str(dst), str(src), "-oo", "X_POSSIBLE_NAMES=x", "-oo", "Y_POSSIBLE_NAMES=y",
                        "-s_srs", f"EPSG:{epsg}", "-t_srs", "EPSG:4326", "-lco", "GEOMETRY=AS_XY"], check=True)
        with dst.open(encoding="utf-8") as fh:
            return {r["k"]: (float(r["X"]), float(r["Y"])) for r in csv.DictReader(fh)}


def tippecanoe_points(features: list[dict], out: Path, layer: str, zmin: int, zmax: int, base_zoom: int) -> None:
    """點 PMTiles：base_zoom 以上保留全部點（之後逐 zoom 稽核），以下只給熱區用、允許抽稀。"""
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / f"{layer}.geojson"
        write_collection(mid, features)
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["tippecanoe", "-o", str(out), "--force", "-l", layer, "-Z", str(zmin), "-z", str(zmax),
                        "-B", str(base_zoom), "-r1", "--drop-densest-as-needed", "--quiet", str(mid)], check=True)
    audit_full_zoom(out, len(features), base_zoom, zmax)
    print(f"  {out.relative_to(ROOT)} {out.stat().st_size:,} B")


def audit_full_zoom(pmtiles: Path, expected: int, zmin: int, zmax: int) -> None:
    for z in range(zmin, zmax + 1):
        res = subprocess.run(["tippecanoe-decode", "-Z", str(z), "-z", str(z), str(pmtiles)], check=True, capture_output=True, text=True)
        ids = set()
        for tile in json.loads(res.stdout)["features"]:
            for lyr in tile["features"]:
                for feat in lyr["features"]:
                    ids.add(feat["properties"]["id"])
        if len(ids) != expected:
            raise SystemExit(f"z{z}: 解碼 {len(ids)} 點 ≠ 輸入 {expected}（丟點）")
        print(f"  z{z}: {len(ids)} 點 ✓")


# ── 1. 2025 A1／A2 交通事故 ─────────────────────────────────────────────
VEHICLES = ["機車", "小客車", "小貨車", "大客車", "大貨車", "曳引車", "半聯結車", "全聯結車", "特種車", "慢車", "人", "軍車", "其他"]


def build_accidents(analytics: Path, _raw: Path) -> None:
    src = analytics / "environment/traffic_accident/traffic_accident_by_incident.geojson"
    data = json.loads(src.read_text(encoding="utf-8"))
    features, dropped = [], []
    counts = collections.Counter()
    for i, feat in enumerate(data["features"]):
        p = feat["properties"]
        lng, lat = feat["geometry"]["coordinates"]
        if not in_taiwan(lng, lat):
            dropped.append((p["timestamp"], p["police_station"], lng, lat))
            continue
        cat = p["accident_category"]
        if cat not in ("A1", "A2"):
            raise SystemExit(f"未知事故類別 {cat}")
        counts[cat] += 1
        ts = p["timestamp"]
        veh = "、".join(f"{v}{p[f'vehicle_{v}']}" for v in VEHICLES if p.get(f"vehicle_{v}"))
        features.append(point(lng, lat, {
            "id": i, "cat": cat, "date": ts[:10], "time": ts[11:16],
            "dead": p["death_count"], "inj": p["injury_count"], "parties": p["party_count"],
            "cause": p["cause_main"], "cause_sub": p["cause_sub"], "unit": p["police_station"], "veh": veh,
        }))
    print(f"[accidents] {counts} 共 {len(features)}；座標在台灣外框外剔除 {len(dropped)}：{dropped}")
    tippecanoe_points(features, ROOT / "public/geo/traffic_accidents_2025.pmtiles", "traffic_accidents_2025", 5, 12, 12)


# ── 2. 消防栓全國（既有臺北水處／高雄消防局＋台水 19 縣市）────────────────
# 規則（每個縣市只取一份來源，避免同一支消防栓畫兩次）：
#   - 既有 hydrants.csv（128639 臺北自來水事業處供水區＝臺北市＋新北部分區；高雄市消防局 5 份）全部保留。
#   - 台水高雄市 24,093 點與高雄市消防局資料大量重疊（16,312 點 15 m 內有既有點）→ 整份不收。
#   - 台水新北市（台水供水區）與臺北水處供水區互補（只有 7 點 15 m 內有既有點）→ 收，但剔除這種 15 m 內的點。
#   - 其餘 17 縣市只有台水來源，全收。
TWC_SKIP_COUNTIES = {"高雄市"}
# 台水「消防栓形態(種類編碼)」對照：data.gov.tw 44642 資料資源說明（台水填寫，2026-10-31 由
# https://data.gov.tw/api/v2/rest/dataset/44642 的 distribution[0].resourceDescription 取得）。
# 0–3 歸「地上式」、4–5 歸「地下式」，與北水處／高市消防局的兩級分類同口徑；空碼歸「其他」。
TWC_TYPE_CODES = {
    "0": ("地上式", "地上式單口式"), "1": ("地上式", "地上打倒安全式（單口）"),
    "2": ("地上式", "地上式雙口式"), "3": ("地上式", "地上打倒安全式（雙口）"),
    "4": ("地下式", "地下式單口式"), "5": ("地下式", "地下式雙口式"),
}
NEAR_M = 15.0
OLD_CATS = {"地上式", "地下式"}


def county_of_points(points: list[tuple[str, float, float]], boundary: Path) -> dict[str, str]:
    """既有 hydrants.csv 的 county_id A 實際含新北市 8,568 點 → 用縣市界重新判定，供 popup 顯示。"""
    with tempfile.TemporaryDirectory() as tmp:
        gpkg = Path(tmp) / "j.gpkg"
        pts = Path(tmp) / "p.csv"
        with pts.open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["k", "lng", "lat"])
            w.writerows(points)
        subprocess.run(["ogr2ogr", "-f", "GPKG", str(gpkg), str(boundary), "-nln", "county"], check=True)
        subprocess.run(["ogr2ogr", "-f", "GPKG", str(gpkg), str(pts), "-nln", "pts", "-update", "-a_srs", "EPSG:4326",
                        "-oo", "X_POSSIBLE_NAMES=lng", "-oo", "Y_POSSIBLE_NAMES=lat"], check=True)
        out = Path(tmp) / "o.csv"
        subprocess.run(["ogr2ogr", "-f", "CSV", str(out), str(gpkg), "-dialect", "SQLite", "-sql",
                        "SELECT p.k AS k, c.\"名稱\" AS county FROM pts p LEFT JOIN county c ON ST_Within(p.geom, c.geom)"], check=True)
        with out.open(encoding="utf-8") as fh:
            return {r["k"]: r["county"] for r in csv.DictReader(fh)}


def build_hydrants(analytics: Path, raw: Path) -> None:
    old_rows = list(csv.DictReader((analytics / "fire/hydrants/hydrants.csv").open(encoding="utf-8-sig")))
    if len(old_rows) != 69_839:
        raise SystemExit(f"既有 hydrants.csv 筆數 {len(old_rows)} ≠ 69,839")
    boundary = analytics.parent / "shared/boundaries/statistics_county_reference.geojson"
    county = county_of_points([(r["hydrant_id"], r["lng"], r["lat"]) for r in old_rows], boundary)
    features: list[dict] = []
    grid: dict[tuple[int, int], list[tuple[float, float]]] = collections.defaultdict(list)
    cell = 0.0002
    per = collections.Counter()
    for r in old_rows:
        lng, lat = float(r["lng"]), float(r["lat"])
        t = (r["type"] or "").strip()
        c = county.get(r["hydrant_id"]) or ""
        per[("old", c or "（縣市界外）")] += 1
        features.append(point(lng, lat, {"id": r["hydrant_id"], "cat": t if t in OLD_CATS else "其他", "type": t or None,
                                         "county": c or None, "src": "taipei_water" if r["data_source"] == "datagov:128639" else "kaohsiung_fire"}))
        grid[(int(lng / cell), int(lat / cell))].append((lng, lat))

    def near_old(lng: float, lat: float) -> bool:
        cx, cy = int(lng / cell), int(lat / cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ox, oy in grid.get((cx + dx, cy + dy), []):
                    if math.hypot((ox - lng) * 101_000, (oy - lat) * 110_800) < NEAR_M:
                        return True
        return False

    by_zone: dict[int, list[tuple[str, float, float]]] = {3826: [], 3825: []}
    meta: dict[str, tuple[str, str, str]] = {}
    seen_rows: set[tuple[str, str, str, str]] = set()
    exact_dup = 0
    with zipfile.ZipFile(raw / "rb1_44642/prot7.zip") as zf:
        for info in zf.infolist():
            # 檔名編碼在 zip 裡不一致（非 UTF-8 旗標），改用表頭辨識縣市檔：第一欄是「所在縣市」
            rd = csv.reader(io.TextIOWrapper(zf.open(info), encoding="utf-8-sig"))
            if next(rd, [""])[0].strip() != "所在縣市":
                continue
            for row in rd:
                cty, hid, x, y, code = (c.strip() for c in row[:5])
                cty = cty.replace("台", "臺")
                # 識別碼不唯一（80 組、249 列，多數座標不同；部分為空字串）→ 以列序當 id；完全相同的列只留一筆
                sig = (cty, hid, x, y)
                if sig in seen_rows:
                    exact_dup += 1
                    continue
                seen_rows.add(sig)
                key = f"TWC_{len(meta) + 1:06d}"
                meta[key] = (cty, hid, code)
                by_zone[3825 if cty == "澎湖縣" else 3826].append((key, float(x), float(y)))
    coords = {**twd97_to_wgs84(by_zone[3826], 3826), **twd97_to_wgs84(by_zone[3825], 3825)}
    skipped = collections.Counter()
    per_code = collections.Counter()
    for key, (cty, hid, code) in meta.items():
        lng, lat = coords[key]
        if not in_taiwan(lng, lat):
            raise SystemExit(f"台水 {cty} {hid} 換算後落在台灣外 {lng},{lat}")
        if cty in TWC_SKIP_COUNTIES:
            skipped[f"{cty}（與高雄市消防局資料重疊，整份不收）"] += 1
            continue
        if near_old(lng, lat):
            skipped[f"{cty}（{NEAR_M:.0f} m 內已有既有點）"] += 1
            continue
        per[("twc", cty)] += 1
        per_code[code or "（空）"] += 1
        cat, type_label = TWC_TYPE_CODES.get(code, ("其他", None))
        if code and code not in TWC_TYPE_CODES:
            raise SystemExit(f"台水 {cty} {hid} 種類編碼 {code!r} 不在對照表")
        features.append(point(lng, lat, {"id": key, "cat": cat, "type": type_label, "type_code": code or None,
                                         "twc_id": hid or None, "county": cty, "src": "twc"}))
    print(f"[hydrants] 共 {len(features)}；台水完全重複列 {exact_dup}；略過 {dict(skipped)}")
    print(f"  台水上圖各種類編碼：{dict(sorted(per_code.items()))}")
    for k, v in sorted(per.items()):
        print(f"  {k}: {v}")
    tippecanoe_points(features, ROOT / "public/geo/fire_hydrants_national.pmtiles", "fire_hydrants", 0, 12, 12)


# ── 3. 海嘯警報臺 ───────────────────────────────────────────────────────
def build_tsunami(_analytics: Path, raw: Path) -> None:
    rows = list(csv.reader((raw / "rb1_34102/d.csv").open(encoding="utf-8-sig")))[1:]
    ok, missing = [], []
    for i, r in enumerate(rows):
        unit, name, addr, voice, mode, x, y = (c.strip() for c in r[:7])
        if not x or not y:
            missing.append(f"{unit} {name}（{addr}）")
            continue
        ok.append((str(i), float(x), float(y)))
    coords = twd97_to_wgs84(ok, 3826)
    feats = []
    for i, r in enumerate(rows):
        if str(i) not in coords:
            continue
        lng, lat = coords[str(i)]
        if not in_taiwan(lng, lat):
            raise SystemExit(f"海嘯警報臺 {r[1]} 換算後落在台灣外 {lng},{lat}")
        unit, name, addr, voice, mode = (c.strip() for c in r[:5])
        feats.append(point(lng, lat, {
            "name": name, "unit": unit, "address": addr, "voice": voice or None, "mode": mode or None,
            "source_org": "內政部警政署", "source_url": "https://data.gov.tw/dataset/34102", "license": OGDL, "fetched_at": "2026-10-31",
        }))
    print(f"[tsunami] {len(feats)} 站；缺座標未畫 {len(missing)}：{missing}")
    write_collection(ROOT / "public/hazards/tsunami_sirens.geojson", feats)


# ── 4. 核電廠緊急應變計畫區：集結點＋避難收容處所 ─────────────────────
LATLNG = re.compile(r"([0-9]+\.[0-9]+)\s*[,，]\s*([0-9]+\.[0-9]+)")


def build_nuclear(_analytics: Path, raw: Path) -> None:
    feats = []
    plant = {"新北市": "核一／核二廠（新北、基隆）", "基隆市": "核一／核二廠（新北、基隆）", "屏東縣": "核三廠（屏東）"}
    for r in csv.reader((raw / "rb1_102114/d").open(encoding="utf-8-sig")):
        if r[0].startswith(("Column", "名稱")):
            continue
        m = LATLNG.search(r[1])
        if not m:
            raise SystemExit(f"集結點座標無法解析 {r}")
        lat, lng = float(m.group(1)), float(m.group(2))
        if not in_taiwan(lng, lat):
            raise SystemExit(f"集結點落在台灣外 {r}")
        feats.append(point(lng, lat, {
            "kind": "assembly", "name": r[0].strip(), "district": r[2].strip(), "village": r[3].strip(),
            "plant": plant.get(r[2].strip()[:3]), "source_org": "核能安全委員會（地方政府規劃之集結點）",
            "source_url": "https://data.gov.tw/dataset/102114", "license": OGDL, "fetched_at": "2026-10-31",
        }))
    n_assembly = len(feats)
    # 收容處所：一列＝一個村里 → 1～2 個收容所（以「/」分隔，名稱與座標同序）；同一收容所合併，列出對應村里
    shelters: dict[str, dict] = {}
    unplaced: list[str] = []
    for r in csv.reader((raw / "rb1_102434/d").open(encoding="cp950")):
        if r[0].startswith(("Column", "區別")):
            continue
        names = [n.strip() for n in r[2].strip().split("/") if n.strip()]
        locs = LATLNG.findall(r[3])
        if len(names) != len(locs):
            # 恆春 17 個里寫的是「屏東市各旅宿」這類泛稱，來源沒給座標（或只給營區那一個）→ 泛稱不畫、列進未定位清單
            generic = [n for n in names if "旅宿" in n or "民宿" in n]
            unplaced.extend(f"{r[0].strip()}{r[1].strip()}→{n}" for n in generic)
            names = [n for n in names if n not in generic]
            if len(names) != len(locs):
                raise SystemExit(f"收容所名稱與座標數不符 {r}")
        for n, (lat, lng) in zip(names, locs):
            s = shelters.setdefault(n, {"lat": float(lat), "lng": float(lng), "villages": []})
            s["villages"].append(f"{r[0].strip()}{r[1].strip()}")
    for n, s in shelters.items():
        if not in_taiwan(s["lng"], s["lat"]):
            raise SystemExit(f"收容所落在台灣外 {n}")
        feats.append(point(s["lng"], s["lat"], {
            "kind": "shelter", "name": n, "villages": "、".join(dict.fromkeys(s["villages"])), "n_villages": len(dict.fromkeys(s["villages"])),
            "source_org": "核能安全委員會（核能電廠緊急應變計畫區避難收容處所）",
            "source_url": "https://data.gov.tw/dataset/102434", "license": OGDL, "fetched_at": "2026-10-31",
        }))
    print(f"[nuclear] 集結點 {n_assembly}、收容處所 {len(shelters)}；泛稱旅宿未定位 {len(unplaced)}：{unplaced}")
    write_collection(ROOT / "public/hazards/nuclear_epz_evacuation.geojson", feats)


# ── 5. 救災資源據點 ─────────────────────────────────────────────────────
def resource_holder(name: str) -> str:
    if "消防" in name:
        return "fire"
    if "公所" in name:
        return "township"
    if "警察" in name or "派出所" in name or "分駐所" in name:
        return "police"
    if "衛生" in name or "醫院" in name:
        return "health"
    return "other"


def build_resources(_analytics: Path, raw: Path) -> None:
    data = json.loads((raw / "rb1_77862/d.json").read_text(encoding="utf-8"))["ResourceLocation"]
    feats, no_coord = [], []
    holders = collections.Counter()
    for loc in data:
        try:
            lat, lng = float(loc.get("lat") or "nan"), float(loc.get("lon") or "nan")
        except ValueError:
            lat = lng = float("nan")
        if math.isnan(lat) or math.isnan(lng) or not in_taiwan(lng, lat):
            no_coord.append(loc.get("LocationName"))
            continue
        details = loc.get("ResourceDetail") or []
        positive = sorted((d for d in details if (d.get("Qty") or 0) > 0), key=lambda d: -d["Qty"])
        updated = max((d.get("LastUpdateTime") or "" for d in details), default="")[:10]
        holder = resource_holder(loc["LocationName"])
        holders[holder] += 1
        top = "、".join(f"{d['resName']} {d['Qty']}" for d in positive[:12])
        if len(positive) > 12:
            top += f"…等 {len(positive)} 項"
        feats.append(point(lng, lat, {
            "name": loc["LocationName"], "holder": holder, "county": loc.get("cityName"), "town": loc.get("townName"),
            "address": loc.get("address"), "n_items": len(details), "n_positive": len(positive), "items": top or None,
            "updated": updated or None,
            "source_org": "內政部消防署（救災資源資料庫）", "source_url": "https://data.gov.tw/dataset/77862", "license": OGDL,
            "fetched_at": "2026-10-31",
        }))
    print(f"[resources] {len(feats)} 處 {dict(holders)}；無座標或座標在台灣外未畫 {len(no_coord)}")
    write_collection(ROOT / "public/geo/disaster_resource_sites.geojson", feats)


# ── 6. 國軍、海巡射擊公告區 ───────────────────────────────────────────
NUM_PAIR = re.compile(r"\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]")


def build_firing(_analytics: Path, raw: Path) -> None:
    feats = []
    # 海軍：Coords 為 MultiPolygon 的 [lng,lat] 巢狀陣列；同一範圍同期間的重複列合併
    seen = set()
    for r in csv.DictReader((raw / "rb1_136419/d.csv").open(encoding="utf-8-sig")):
        coords = json.loads(r["Coords"])
        key = (r["AnnounceNo"], r["Date"], r["Coords"])
        if key in seen:
            continue
        seen.add(key)
        start, _, end = r["Date"].partition("~")
        feats.append({"type": "Feature", "geometry": {"type": "MultiPolygon", "coordinates": coords}, "properties": {
            "agency": "navy", "title": f"{r['Announce']} {r['AnnounceNo']}".strip(), "unit": r["Unit"],
            "start": start[:16].replace("T", " "), "end": end[:16].replace("T", " "), "height": r["Height"] or None,
            "notice_url": r["URL"] or None,
            "source_org": "國防部海軍司令部", "source_url": "https://data.gov.tw/dataset/136419", "license": OGDL, "fetched_at": "2026-10-31",
        }})
    n_navy = len(feats)
    # 海巡署：Area 為 [緯,經] 角點列；日期欄格式不一（多行、斜線），原字串保留；不收電話（部分為個人手機）
    for r in csv.DictReader((raw / "rb1_143315/f2024032600001.csv").open(encoding="utf-8-sig")):
        ring = [[float(lng), float(lat)] for lat, lng in NUM_PAIR.findall(r["Area"])]
        if len(ring) < 3:
            raise SystemExit(f"海巡射擊範圍角點不足 {r['Announce']}")
        # 來源打字錯誤：同一圈其餘角點經度都在 11x～12x，單一角點多了正好 10 度（例 131.33、130.76）→ 減 10 度並標記
        lng_fixed = False
        others = sorted(c[0] for c in ring)
        for c in ring:
            rest = [x for x in others if x != c[0]]
            if rest and c[0] - max(rest) > 9 and any(abs(c[0] - 10 - x) < 0.5 for x in rest):
                c[0] = round(c[0] - 10, 6)
                lng_fixed = True
        ring.append(ring[0])
        clean = lambda s: re.sub(r"\s+", " ", s or "").strip()
        feats.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": {
            "agency": "coast_guard", "title": clean(r["Announce"]), "unit": clean(r["Unit"]),
            "start": clean(r["Date"]), "end": None, "daily_window": f"{clean(r['Start'])}–{clean(r['End'])}",
            "height": clean(r["Height"]) or None, "lng_typo_fixed": lng_fixed or None,
            "source_org": "海洋委員會海巡署", "source_url": "https://data.gov.tw/dataset/143315", "license": OGDL, "fetched_at": "2026-10-31",
        }})
    print(f"[firing] 海軍 {n_navy}（合併重複列後）、海巡署 {len(feats) - n_navy}")
    write_collection(ROOT / "public/marine/firing_notice_areas.geojson", feats)


BUILDERS = {"accidents": build_accidents, "hydrants": build_hydrants, "tsunami": build_tsunami,
            "nuclear": build_nuclear, "resources": build_resources, "firing": build_firing}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, required=True)
    ap.add_argument("--analytics", type=Path, required=True, help="taipei-gis-analytics/data/processed")
    ap.add_argument("targets", nargs="+", choices=sorted(BUILDERS))
    args = ap.parse_args()
    for missing in [t for t in ("tippecanoe", "tippecanoe-decode", "ogr2ogr") if not shutil.which(t)]:
        raise SystemExit(f"缺 {missing}")
    for t in args.targets:
        BUILDERS[t](args.analytics, args.raw)
