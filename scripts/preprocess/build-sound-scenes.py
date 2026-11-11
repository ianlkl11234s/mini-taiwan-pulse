#!/usr/bin/env python3
"""City Sound Atlas 場景快照產生器（pulse-sound-scene-v1）。

把「某一天、某個接收點周圍」的三類時變資料（航跡、落雷、雨量）裁切成一個小 JSON，
讓場景在 Supabase 過了保留期之後仍可回放。垃圾車是週期班表，不進快照（前端照常讀既有垃圾車班表靜態快照）。

輸出：public/sound-atlas/scenes/<id>.json
  public/**/*.json 已被 gitignore（CI-4）：檔案不進 git，產出後用
  `python3 scripts/deploy/build-public-assets-lock.py add public/sound-atlas/scenes/<id>.json` 登記 lock，
  發版前由 scripts/deploy/upload-deploy-assets.sh 依 lock 上傳 S3 deploy-assets/ → 同步 R2。

資料來源（全部唯讀）：
  - Supabase（psql "$SUPABASE_DB_URL"，每次查詢都包 BEGIN READ ONLY … ROLLBACK）：
      public.get_flight_trails(date)、public.get_lightning_day(text,text)、public.get_rain_gauge_day(date)
  - S3 正本（aws cli，profile 用環境變數 AWS_PROFILE）：Supabase 已過保留的日期
      trails/flights/<D>.json.gz          live.flight_trails_daily 的逐日鏡像（day＝臺北日，含前後約 1 小時）
      lightning_cwa/archives/<D>.tar.gz   氣象署落雷，每 5 分鐘一個 json；檔名日期＝收集時間的臺北日
      lightning_events/archives/<D>.tar.gz 台電落雷，每 30 分鐘一個 json；同上
    落雷 archive 依「收集時間」歸檔，臺北日 D 的事件會散在 D 與 D+1 兩包 → 兩包都讀，
    以 strike_time 的臺北日期過濾，再以 (source, event_id) 去重。

裁切規則：
  - bbox＝接收點 ±BBOX_HALF_KM；航跡只保留「任一點落在 bbox」的航班，整條保留不截斷，高度單位不改
    （引擎依 flight_id 長度判斷 ft／m）。D±1 的檔案中若有 bbox 內、時間落在臺北日 D、但 D 檔沒有的
    flight_id，會併入並寫進 notes_zh。
  - 落雷只保留 bbox 內事件；health 以「該源該臺北日全台」判定：有事件＝ok、查得到但 0 筆＝empty、
    查詢失敗或 archive 缺檔＝error。
  - aviation／rain 另帶 health（契約外的附加欄位，語意同 thunder.health）：
    航跡以該日全台判定，所以 bbox 內 0 架仍是 ok（＝沒飛經），不是資料缺。
  - 雨量只保留接收點 ±RAIN_HALF_KM（15 km，比 bbox 小）內各站的每小時列（與 get_rain_gauge_day 同形，null 保持 null）。

MVP-B（W4）施工區塊 `roadwork`（只有 S3，不需要 SUPABASE_DB_URL）：
  - 來源：S3 road_event_planned/archives/<D>.tar.gz（TDX 縣市預告事件，collector 每 12 小時一抓；檔名日期＝收集時間的臺北日）。
    讀 D−1 與 D 兩包，以 EventID 去重（同一事件取 LastUpdateTime 最新的版本）。
  - 只留 EventType=2（施工）、許可期間（EffectiveTime～ExpireTime）與臺北日 D 重疊、幾何外框與「接收點 ±5 km」相交者
    （區塊自帶 bbox；接收點移出該範圍時前端回 unknown）；
    幾何取 Geometry，沒有時取 Positions（與 data-collectors supabase_writer._transform_road_event 相同），WKT 轉 GeoJSON。
  - 列形狀＝前端 RoadEvent（src/data/roadEventsLoader.ts），前端與即時 RPC 共用 roadEventsToRecords。
  - health：D 包存在且有資料＝ok、D 包存在但 0 筆＝empty、缺檔／讀取失敗＝error。per_city 取 D 包最後一個檔；
    per_city_roadwork＝該檔各縣市 EventType=2 筆數（前端以此判斷縣市涵蓋；臺北市只發布 EventType 7 挖掘管制區 → 0）。
  - 鐵道（班表類，即時算）與道路車流（只有道路類型 proxy，無流量來源）不進快照。
  --merge-mvp-b：只把 roadwork 區塊併進既有場景檔（其他區塊原樣保留），不需要資料庫。

用法（repo 根目錄）：
  SUPABASE_DB_URL=… AWS_PROFILE=… python3 scripts/preprocess/build-sound-scenes.py [--scene ID ...] [--out DIR]
  python3 scripts/preprocess/build-sound-scenes.py --list
  AWS_PROFILE=… python3 -I scripts/preprocess/build-sound-scenes.py --merge-w5 [--scene ID ...] [--public-dir DIR] [--coast-geojson PATH]
  AWS_PROFILE=… python3 -I scripts/preprocess/build-sound-scenes.py --merge-mvp-b [--scene ID ...]
只用標準函式庫（可用 python3 -I 執行）。
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import io
import json
import math
import os
import struct
import subprocess
import sys
import tarfile
import tempfile
import zlib

SCHEMA = "pulse-sound-scene-v1"
BUCKET = "migu-gis-data-collector"
TPE = dt.timezone(dt.timedelta(hours=8))
BBOX_HALF_KM = 30.0
# 雨量站只取接收點 ±15 km：引擎只用 5 km 內最近站，15 km 留給地圖脈絡；±30 km 會讓臺北場景超過 2 MB
RAIN_HALF_KM = 15.0
MAX_BYTES = 2 * 1024 * 1024
THUNDER_SOURCES = ("cwa", "taipower")
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

SCENES: list[dict] = [
    {
        "id": "taipei-1109",
        "title_zh": "臺北 11/9：細雨日的松山機場進場航線下",
        "date": "2026-11-09",
        "focus_time": "2026-11-09T07:39:30+08:00",
        "receiver": {
            "lon": 121.5830,
            "lat": 25.0860,
            "label_zh": "內湖碧湖（碧湖國小雨量站旁）",
            "reason_zh": "位於松山機場東北方、東側起降航線附近（引擎算出 07:39 有航機在斜距約 1.8 公里處經過）；緊鄰碧湖國小雨量站（A1AA40，約 75 公尺），"
            "11/9 有 5 個小時測到雨（07 時最大 2.5 毫米），比內湖站（只 2 小時）更能同時看到雨與飛機。"
            "focus＝07:39:30，引擎算出當天上午飛機相對潛勢最高的時刻，同時段正在下雨。",
        },
        "sources": {"aviation": "rpc", "thunder": "rpc", "rain": "rpc"},
    },
    {
        "id": "taichung-heping-1108",
        "title_zh": "臺中和平 11/8 10:25：中央山脈上的一記台電落雷",
        "date": "2026-11-08",
        "focus_time": "2026-11-08T10:25:34+08:00",
        "receiver": {
            "lon": 121.4380,
            "lat": 24.3350,
            "label_zh": "南湖大山南側山區",
            "reason_zh": "台電 10:25:26 落雷（121.4399, 24.3149）北方約 2.2 公里，雷聲約 6.5 秒後到達（focus 取到達後 10:25:34）；"
            "往北移一點是為了讓最近的雨量站（南湖圈谷 C0F0E0）落在 5 公里內，雨聲才不會整天 unknown。",
        },
        "sources": {"aviation": "rpc", "thunder": "rpc", "rain": "rpc"},
    },
    {
        "id": "taipei-typhoon-1024",
        "title_zh": "臺北陽明山 10/24：Champi 颱風外圍雨帶",
        "date": "2026-10-24",
        "focus_time": "2026-10-24T14:03:00+08:00",
        "receiver": {
            "lon": 121.5420,
            "lat": 25.1800,
            "label_zh": "陽明山小油坑",
            "reason_zh": "緊鄰小油坑雨量站（A1AD40，約 270 公尺），Champi 颱風 10/24 臺北市 1 小時雨量最大的站（14 時 46.5 毫米）；"
            "14 時小油坑 1 小時雨量是全天最大（相對潛勢 0.99），focus 取 14:03（同時有航機在 20 km 內）。"
            "航跡與落雷已過 Supabase 保留期，改從 S3 正本裁切。",
        },
        "sources": {"aviation": "s3", "thunder": "s3", "rain": "rpc"},
    },
]


# ── 小工具 ──────────────────────────────────────────────────


def bbox_around(lon: float, lat: float, half_km: float) -> list[float]:
    dlat = half_km / 111.32
    dlon = half_km / (111.32 * math.cos(math.radians(lat)))
    return [round(lon - dlon, 5), round(lat - dlat, 5), round(lon + dlon, 5), round(lat + dlat, 5)]


def in_bbox(lon: float, lat: float, b: list[float]) -> bool:
    return b[0] <= lon <= b[2] and b[1] <= lat <= b[3]


def day_window(date: str) -> tuple[int, int]:
    d = dt.date.fromisoformat(date)
    start = int(dt.datetime(d.year, d.month, d.day, tzinfo=TPE).timestamp())
    return start, start + 86_400


def shift(date: str, days: int) -> str:
    return (dt.date.fromisoformat(date) + dt.timedelta(days=days)).isoformat()


def psql_json(sql: str):
    """唯讀查詢，回傳單一 JSON 值。連線字串只從環境變數讀，不印出。"""
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("SUPABASE_DB_URL not set")
    script = (
        "BEGIN READ ONLY;\nSET LOCAL statement_timeout = 120000;\nSET LOCAL timezone = 'Asia/Taipei';\n"
        f"{sql}\nROLLBACK;\n"
    )
    res = subprocess.run(
        ["psql", url, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"],
        input=script.encode(),
        capture_output=True,
        check=False,
    )
    if res.returncode != 0:
        raise RuntimeError(f"psql failed: {res.stderr.decode(errors='replace')[:400]}")
    out = res.stdout.decode().strip()
    return json.loads(out) if out else None


def s3_bytes(key: str) -> bytes:
    res = subprocess.run(
        ["aws", "s3", "cp", "--only-show-errors", f"s3://{BUCKET}/{key}", "-"],
        capture_output=True,
        check=False,
    )
    if res.returncode != 0:
        raise RuntimeError(f"s3 get failed {key}: {res.stderr.decode(errors='replace')[:300]}")
    return res.stdout


def lit(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ── 航跡 ────────────────────────────────────────────────────

FLIGHT_COLS = ("flight_id", "callsign", "aircraft_type", "origin", "destination", "trail")


def flight_rows_rpc(date: str) -> list[dict]:
    rows = psql_json(
        "SELECT coalesce(json_agg(t ORDER BY t.flight_id), '[]'::json) FROM "
        f"(SELECT {', '.join(FLIGHT_COLS)} FROM public.get_flight_trails({lit(date)}::date)) t;"
    )
    return rows or []


def flight_rows_s3(date: str) -> list[dict]:
    return json.loads(gzip.decompress(s3_bytes(f"trails/flights/{date}.json.gz")))


def trail_points(trail: str):
    for p in trail.split(";"):
        parts = p.split(",")
        if len(parts) < 4:
            continue
        yield float(parts[0]), float(parts[1]), float(parts[3])  # lat, lng, ts


def hits(row: dict, bbox: list[float], window: tuple[int, int] | None = None) -> bool:
    for lat, lng, ts in trail_points(row["trail"]):
        if in_bbox(lng, lat, bbox) and (window is None or window[0] <= ts < window[1]):
            return True
    return False


def build_aviation(scene: dict, bbox: list[float], notes: list[str]) -> dict:
    date = scene["date"]
    mode = scene["sources"]["aviation"]
    fetch = flight_rows_rpc if mode == "rpc" else flight_rows_s3
    origin = (
        f"rpc:get_flight_trails({date})"
        if mode == "rpc"
        else f"s3://{BUCKET}/trails/flights/{date}.json.gz"
    )
    try:
        rows = fetch(date)
    except Exception as e:  # noqa: BLE001
        notes.append(f"航跡：{origin} 讀取失敗（{e}），飛機聲源整日 unknown。")
        return {"origin": origin, "health": "error", "rows": []}
    if not rows:
        notes.append(f"航跡：{origin} 回 0 筆（該日無資料或已過保留），飛機聲源整日 unknown。")
        return {"origin": origin, "health": "empty", "rows": []}
    kept = {r["flight_id"]: {k: r.get(k) for k in FLIGHT_COLS} for r in rows if hits(r, bbox)}
    # 跨午夜檢查：D±1 檔裡、時間落在臺北日 D 且在 bbox 內、但 D 檔沒有的 flight_id
    window = day_window(date)
    merged: list[str] = []
    neighbor_errors: list[str] = []
    for nd in (shift(date, -1), shift(date, 1)):
        try:
            nrows = fetch(nd)
        except Exception as e:  # noqa: BLE001 — 鄰日只是補漏檢查，失敗記 note 不中斷
            neighbor_errors.append(f"{nd}: {e}")
            continue
        all_ids = {r["flight_id"] for r in rows}
        for r in nrows:
            if r["flight_id"] in all_ids or r["flight_id"] in kept:
                continue
            if hits(r, bbox, window):
                kept[r["flight_id"]] = {k: r.get(k) for k in FLIGHT_COLS}
                merged.append(f"{nd}:{r['flight_id']}")
    if merged:
        notes.append(f"航跡：從鄰日檔併入 {len(merged)} 個 D 檔缺漏、但在臺北日 {date} 飛經 bbox 的航班。")
    else:
        notes.append(f"航跡：已比對 {shift(date, -1)}／{shift(date, 1)} 鄰日檔，沒有 D 檔缺漏的跨午夜航班。")
    if neighbor_errors:
        notes.append("航跡：鄰日檔讀取失敗（只影響跨午夜補漏）：" + "；".join(neighbor_errors))
    out_rows = [kept[k] for k in sorted(kept)]
    notes.append(f"航跡：該日全台 {len(rows)} 個 flight_id，任一點落在 bbox 的 {len(out_rows)} 個（整條保留）。")
    # health 以「該日全台」判定：bbox 內 0 架＝真的沒飛經（inactive），不是資料缺
    return {"origin": origin, "health": "ok", "rows": out_rows}


# ── 落雷 ────────────────────────────────────────────────────


def strikes_rpc(date: str) -> tuple[dict, dict[str, list[dict]]]:
    health: dict[str, str] = {}
    by: dict[str, list[dict]] = {}
    for src in THUNDER_SOURCES:
        try:
            rows = psql_json(
                "SELECT coalesce(json_agg(t ORDER BY t.strike_ts, t.event_id), '[]'::json) FROM "
                f"public.get_lightning_day({lit(date)}, {lit(src)}) t;"
            ) or []
            health[src] = "ok" if rows else "empty"
            by[src] = [
                {
                    "event_id": r["event_id"],
                    "source": src,
                    "strike_ts": int(r["strike_ts"]),
                    "lon": r["lon"],
                    "lat": r["lat"],
                    "strike_type": r["strike_type"],
                    "intensity_ka": r["intensity_ka"],
                }
                for r in rows
            ]
        except Exception as e:  # noqa: BLE001
            health[src] = "error"
            by[src] = []
            print(f"[warn] lightning {src} {date}: {e}", file=sys.stderr)
    return health, by


ARCHIVE_PREFIX = {"cwa": "lightning_cwa", "taipower": "lightning_events"}


def strikes_s3(date: str) -> tuple[dict, dict[str, list[dict]], list[str]]:
    start, end = day_window(date)
    health: dict[str, str] = {}
    by: dict[str, list[dict]] = {}
    notes: list[str] = []
    for src in THUNDER_SOURCES:
        seen: dict[int, dict] = {}
        failed = []
        files = 0
        for ad in (date, shift(date, 1)):
            key = f"{ARCHIVE_PREFIX[src]}/archives/{ad}.tar.gz"
            try:
                blob = s3_bytes(key)
            except Exception as e:  # noqa: BLE001
                failed.append(f"{key}: {e}")
                continue
            with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tf:
                for m in tf.getmembers():
                    if not m.isfile() or not m.name.endswith(".json"):
                        continue
                    files += 1
                    payload = json.load(tf.extractfile(m))
                    for e in payload.get("data", []):
                        if e.get("source") != src:
                            continue
                        ts = int(dt.datetime.fromisoformat(e["strike_time"]).timestamp())
                        if not (start <= ts < end):
                            continue
                        seen[int(e["event_id"])] = {
                            "event_id": int(e["event_id"]),
                            "source": src,
                            "strike_ts": ts,
                            "lon": e["lon"],
                            "lat": e["lat"],
                            "strike_type": e.get("strike_type"),
                            "intensity_ka": e.get("intensity_ka"),
                        }
        # D 那包缺檔＝無法判定當日 → error；只缺 D+1（收集落後的尾巴）記 note
        if any(f.startswith(f"{ARCHIVE_PREFIX[src]}/archives/{date}.") for f in failed):
            health[src] = "error"
        else:
            health[src] = "ok" if seen else "empty"
        if failed:
            notes.append(f"落雷 {src}：archive 讀取失敗 " + "；".join(failed))
        notes.append(f"落雷 {src}：讀 {files} 個 archive 檔，臺北日 {date} 全台 {len(seen)} 筆。")
        by[src] = sorted(seen.values(), key=lambda r: (r["strike_ts"], r["event_id"]))
    return health, by, notes


def build_thunder(scene: dict, bbox: list[float], notes: list[str]) -> dict:
    date = scene["date"]
    if scene["sources"]["thunder"] == "rpc":
        health, by = strikes_rpc(date)
        origin = f"rpc:get_lightning_day({date}, cwa|taipower)"
    else:
        health, by, n = strikes_s3(date)
        notes.extend(n)
        origin = (
            f"s3://{BUCKET}/lightning_cwa/archives/{{{date},{shift(date, 1)}}}.tar.gz + "
            f"s3://{BUCKET}/lightning_events/archives/{{{date},{shift(date, 1)}}}.tar.gz"
        )
    events = []
    for src in THUNDER_SOURCES:
        nat = len(by[src])
        local = [r for r in by[src] if in_bbox(float(r["lon"]), float(r["lat"]), bbox)]
        notes.append(f"落雷 {src}：health={health[src]}，臺北日全台 {nat} 筆、bbox 內 {len(local)} 筆。")
        events.extend(local)
    events.sort(key=lambda r: (r["strike_ts"], r["source"], r["event_id"]))
    # cwa event_id 可能超過 2^53：檢查 JS 端轉 float64 後是否相撞
    for src in THUNDER_SOURCES:
        ids = [r["event_id"] for r in events if r["source"] == src]
        big = [i for i in ids if abs(i) > 2**53]
        if big:
            collide = len(ids) - len({float(i) for i in ids})
            notes.append(
                f"落雷 {src}：{len(big)} 筆 event_id 超過 2^53，JS 解析會失真；轉 float64 後相撞 {collide} 筆。"
            )
    for r in events:
        r["event_id_str"] = str(r["event_id"])
    return {"origin": origin, "health": health, "events": events}


# ── 雨量 ────────────────────────────────────────────────────

RAIN_COLS = (
    "station_id", "station_name", "county", "town", "lat", "lng", "bucket_at", "observed_at",
    "precipitation_10min", "precipitation_1hr", "precipitation_3hr", "precipitation_24hr",
)


def build_rain(scene: dict, notes: list[str]) -> dict:
    date = scene["date"]
    origin = f"rpc:get_rain_gauge_day({date})"
    w, s, e, n = bbox_around(scene["receiver"]["lon"], scene["receiver"]["lat"], RAIN_HALF_KM)
    try:
        rows = psql_json(
            "SELECT coalesce(json_agg(t ORDER BY t.station_id, t.bucket_at), '[]'::json) FROM "
            f"(SELECT {', '.join(RAIN_COLS)} FROM public.get_rain_gauge_day({lit(date)}::date) "
            f"WHERE lng BETWEEN {w} AND {e} AND lat BETWEEN {s} AND {n}) t;"
        ) or []
    except Exception as ex:  # noqa: BLE001
        notes.append(f"雨量：{origin} 讀取失敗（{ex}），雨聲整日 unknown。")
        return {"origin": origin, "health": "error", "rows": []}
    stations = {r["station_id"] for r in rows}
    nulls = sum(1 for r in rows if r["precipitation_1hr"] is None)
    notes.append(
        f"雨量：接收點 ±{RAIN_HALF_KM:g} km 內 {len(stations)} 站、{len(rows)} 列（每站每小時一筆），precipitation_1hr 為 null 的列 {nulls}。"
    )
    if not rows:
        notes.append(f"雨量：{origin} 回 0 筆（該日已過保留期或無資料），雨聲整日 unknown。")
    return {"origin": origin, "health": "ok" if rows else "empty", "rows": rows}


# ── 主流程 ──────────────────────────────────────────────────


# ── 施工（MVP-B，S3 only）───────────────────────────────────

ROADWORK_EVENT_TYPES = (2,)
# 施工只留接收點 ±5 km（引擎候選半徑 300 m；±30 km 會讓臺北場景超過 2 MB）。
# 區塊自帶 bbox，接收點移出這個範圍時前端回 unknown（不會被當成「沒有施工」）。
ROADWORK_HALF_KM = 5.0
ROADWORK_ARCHIVE = "road_event_planned/archives"
DESC_MAX = 200


def _wkt_tokens(text: str):
    i = 0
    while i < len(text):
        c = text[i]
        if c in "(),":
            yield c
            i += 1
        elif c.isspace():
            i += 1
        else:
            j = i
            while j < len(text) and text[j] not in "(), \t\n":
                j += 1
            yield text[i:j]
            i = j


def wkt_to_geojson(wkt: str | None) -> dict | None:
    """標準函式庫版 WKT → GeoJSON（POINT／LINESTRING／POLYGON 與 MULTI*）；無法解析回 None。"""
    if not wkt or not isinstance(wkt, str):
        return None
    wkt = wkt.strip()
    if wkt.upper().startswith("SRID="):
        wkt = wkt.split(";", 1)[1]
    head = wkt.split("(", 1)[0].strip().upper()
    kinds = {"POINT": "Point", "LINESTRING": "LineString", "POLYGON": "Polygon", "MULTIPOINT": "MultiPoint", "MULTILINESTRING": "MultiLineString", "MULTIPOLYGON": "MultiPolygon"}
    if head not in kinds or "(" not in wkt:
        return None
    toks = list(_wkt_tokens(wkt[len(wkt.split("(", 1)[0]):]))
    pos = 0

    def parse():
        nonlocal pos
        assert toks[pos] == "("
        pos += 1
        items, nums = [], []
        while toks[pos] != ")":
            t = toks[pos]
            if t == "(":
                items.append(parse())
            elif t == ",":
                if nums:
                    items.append(nums)
                    nums = []
                pos += 1
            else:
                nums.append(float(t))
                pos += 1
        if nums:
            items.append(nums)
        pos += 1
        return items

    try:
        body = parse()
    except (AssertionError, IndexError, ValueError):
        return None
    typ = kinds[head]
    if typ == "Point":
        coords = body[0] if body else None
    elif typ == "MultiPoint":  # MULTIPOINT((x y),(x y)) 或 MULTIPOINT(x y, x y)
        coords = [c[0] if isinstance(c[0], list) else c for c in body]
    else:
        coords = body
    if not coords:
        return None

    def r(x):
        return [round(v, 6) for v in x] if x and isinstance(x[0], float) else [r(v) for v in x]

    return {"type": typ, "coordinates": r(coords)}


def _geo_bbox(g: dict) -> list[float] | None:
    xs, ys = [], []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for v in c:
                walk(v)

    walk(g["coordinates"])
    return [min(xs), min(ys), max(xs), max(ys)] if xs else None


def _iso_ts(s: str | None) -> int | None:
    if not s:
        return None
    try:
        t = dt.datetime.fromisoformat(s)
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=TPE)
    return int(t.timestamp())


def _planned_archive(date: str) -> list[dict] | None:
    """road_event_planned 某日歸檔的各檔 JSON（依檔名排序）；缺檔回 None"""
    try:
        raw = s3_bytes(f"{ROADWORK_ARCHIVE}/{date}.tar.gz")
    except RuntimeError:
        return None
    docs = []
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tf:
        for m in sorted(tf.getmembers(), key=lambda m: m.name):
            if m.isfile() and m.name.endswith(".json"):
                docs.append(json.load(tf.extractfile(m)))
    return docs


def tdx_event_to_row(ev: dict) -> dict | None:
    """TDX RoadEvent（歸檔原樣）→ 前端 RoadEvent 同形列；幾何同 supabase_writer：Geometry 優先，否則 Positions"""
    geom = wkt_to_geojson(ev.get("Geometry")) or wkt_to_geojson(ev.get("Positions"))
    loc = ev.get("Location") or {}
    feh = loc.get("FreeExpressHighway") or {}
    enrich = ev.get("_enrich") or {}
    desc = ev.get("Description")
    return {
        "event_id": ev.get("EventID"),
        "source": ev.get("_source"),
        "event_type": ev.get("EventType"),
        "event_subtype": ev.get("EventSubType"),
        "event_step": ev.get("EventStep"),
        "severity": (ev.get("Impact") or {}).get("Severity"),
        "road_name": feh.get("Road"),
        "direction": feh.get("Direction"),
        "start_km": enrich.get("start_km"),
        "end_km": enrich.get("end_km"),
        "title": ev.get("EventTitle"),
        "description": desc[:DESC_MAX] if isinstance(desc, str) else None,
        "location_other": loc.get("Other"),
        "blocked_lanes": (ev.get("Impact") or {}).get("BlockedLanes"),
        "geometry": geom,
        "matched_section_id": enrich.get("matched_section_id"),
        "enrich_status": enrich.get("enrich_status"),
        # 與 roadEventsLoader 相同：缺生效時間 → 0（前端不當進行中）；缺到期 → null
        "start_ts": _iso_ts(ev.get("EffectiveTime")) or 0,
        "end_ts": _iso_ts(ev.get("ExpireTime")),
        "last_updated_ts": _iso_ts(ev.get("LastUpdateTime")) or 0,
        "_city": ev.get("_city"),
    }


def build_roadwork(scene: dict, _scene_bbox: list[float], notes: list[str]) -> dict:
    date = scene["date"]
    bbox = bbox_around(scene["receiver"]["lon"], scene["receiver"]["lat"], ROADWORK_HALF_KM)
    start, end = day_window(date)
    today = _planned_archive(date)
    prev = _planned_archive(shift(date, -1)) or []
    if today is None:
        notes.append(f"施工：S3 {ROADWORK_ARCHIVE}/{date}.tar.gz 缺檔 → health=error（前端回 unknown）。")
        return {"origin": f"s3:{ROADWORK_ARCHIVE}", "health": "error", "bbox": bbox, "per_city": {}, "per_city_roadwork": {}, "events": []}
    per_city = (today[-1].get("per_city") if today else None) or {}
    # 涵蓋判定用「施工事件」筆數，不用 per_city（含 EventType 7 挖掘管制區；臺北市全部是 7）
    per_city_roadwork = {c: 0 for c in per_city}
    for ev in (today[-1].get("data") or []) if today else []:
        if ev.get("EventType") in ROADWORK_EVENT_TYPES and ev.get("_city"):
            per_city_roadwork[ev["_city"]] = per_city_roadwork.get(ev["_city"], 0) + 1
    latest: dict[str, dict] = {}
    total_type2 = 0
    for doc in prev + today:
        for ev in doc.get("data") or []:
            eid = ev.get("EventID")
            if not eid:
                continue
            old = latest.get(eid)
            if old is None or (ev.get("LastUpdateTime") or "") >= (old.get("LastUpdateTime") or ""):
                latest[eid] = ev
    rows = []
    for ev in latest.values():
        if ev.get("EventType") not in ROADWORK_EVENT_TYPES:
            continue
        total_type2 += 1
        row = tdx_event_to_row(ev)
        if not row or not row["geometry"]:
            continue
        s_ts, e_ts = row["start_ts"], row["end_ts"]
        if s_ts and s_ts >= end:
            continue
        if e_ts is not None and e_ts <= start:
            continue
        gb = _geo_bbox(row["geometry"])
        if not gb or gb[2] < bbox[0] or gb[0] > bbox[2] or gb[3] < bbox[1] or gb[1] > bbox[3]:
            continue
        rows.append(row)
    rows.sort(key=lambda r: r["event_id"])
    health = "ok" if total_type2 > 0 else "empty"
    notes.append(
        f"施工：S3 {ROADWORK_ARCHIVE} {shift(date, -1)}＋{date}（{len(today)} 個檔），全台施工事件 {total_type2} 筆，"
        f"接收點 ±{ROADWORK_HALF_KM:g} km 內且許可期間與當日重疊 {len(rows)} 筆（移出此範圍前端回 unknown）；"
        f"各縣市施工筆數＝{json.dumps(per_city_roadwork, ensure_ascii=False)}（0 筆的縣市視為沒發布施工 → unknown；臺北市只發布挖掘管制區）。"
        "許可期間≠機具運轉，沒有每日工時。"
    )
    return {"origin": f"s3:{ROADWORK_ARCHIVE}", "health": health, "bbox": bbox, "per_city": per_city, "per_city_roadwork": per_city_roadwork, "events": rows}


# ── W5 自然聲源區塊 `natural`（風×植被、海浪×海岸、河川水位）──────────────
#
# 全部 S3 正本＋本機靜態檔，不需要 SUPABASE_DB_URL（--merge-w5）。
#   wind   ：s3 weather/archives/<D>.tar.gz（CWA O-A0001-001，每小時一個 json；obs_time＝整點，座標、風速、陣風）
#   wave   ：s3 cwa_marine_observation/archives/<D+1>.tar.gz 的**第一個** json（滾動 48h，涵蓋 D 全天）；
#            用 range GET 只讀檔頭，不下載整包（每包約 40 MB）
#   river  ：s3 river_water_level/archives/<D>,<D+1>.tar.gz（10 分鐘讀數，以 observed_at 的臺北日過濾、每小時取最後一筆）；
#            分位數用 D 之前 RIVER_HISTORY_DAYS 天（不含 D）的每小時水位；座標 join public/geo/water_monitor_stations.geojson
#   canopy ：public/forestry/canopy_height_rgb_taiwan.pmtiles（R＝公尺、A＝遮罩）取樣成格網，-1＝遮罩／缺磚
#   coast  ：analytics coastal_area_extents.geojson 的「近岸海域」面（海岸線 proxy，不是現行海岸線），DP 簡化
#   river_network：public/geo/water_rivers.geojson，裁到接收點 ±RIVER_NET_HALF_KM、DP 簡化
# 參數與前端 soundProfiles 對齊：WIND 8 km、WAVE 40 km、RIVER 5 km、樹冠 100 m（只用來決定要收多大範圍）。

NATURAL_SCHEMA = "pulse-sound-natural-v1"
WIND_STATION_PAD_KM = 8.0
RIVER_STATION_PAD_KM = 5.0
RIVER_HISTORY_DAYS = 60
RIVER_QUANT_PROBS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]
CANOPY_HALF_M = 3000.0
CANOPY_CELL_M = 30.0
CANOPY_ZOOM = (6, 12)
COAST_PAD_KM = 2.0
RIVER_NET_HALF_KM = 10.0
SIMPLIFY_COAST_M = 20.0
SIMPLIFY_RIVER_M = 10.0
GIS_ROOT = os.path.abspath(os.path.join(REPO, "..")) if os.path.basename(os.path.dirname(REPO)) != ".worktrees" else os.path.abspath(os.path.join(REPO, "..", "..", ".."))
# public 大檔（樹冠 PMTiles、河道、水位站）不在 git：worktree 沒有時退回主 checkout
DEFAULT_PUBLIC = os.path.join(REPO, "public") if os.path.exists(os.path.join(REPO, "public", "forestry", "canopy_height_rgb_taiwan.pmtiles")) else os.path.join(GIS_ROOT, "mini-taiwan-pulse", "public")
DEFAULT_COAST = os.path.join(GIS_ROOT, "taipei-gis-analytics", "data", "processed", "marine", "coastal_area_extents", "coastal_area_extents.geojson")
CACHE_DIR = os.path.join(tempfile.gettempdir(), "pulse-sound-scenes-cache")


def expand_bbox(b: list[float], km: float) -> list[float]:
    lat = (b[1] + b[3]) / 2
    dlat = km / 111.32
    dlon = km / (111.32 * math.cos(math.radians(lat)))
    return [round(b[0] - dlon, 5), round(b[1] - dlat, 5), round(b[2] + dlon, 5), round(b[3] + dlat, 5)]


def s3_cached(key: str) -> bytes | None:
    """整包下載（小檔）並快取；缺檔回 None"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    p = os.path.join(CACHE_DIR, key.replace("/", "__"))
    if os.path.exists(p):
        with open(p, "rb") as f:
            b = f.read()
        return b or None
    try:
        b = s3_bytes(key)
    except RuntimeError:
        return None
    with open(p + ".part", "wb") as f:
        f.write(b)
    os.replace(p + ".part", p)
    return b


def s3_prefetch(keys: list[str]) -> None:
    """小檔批次預取（最多 3 路平行，避免壓垮本機與網路）"""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(s3_cached, keys))


def s3_range(key: str, start: int, end: int) -> bytes:
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        path = tmp.name
    try:
        res = subprocess.run(
            ["aws", "s3api", "get-object", "--bucket", BUCKET, "--key", key, "--range", f"bytes={start}-{end}", path],
            capture_output=True,
            check=False,
        )
        if res.returncode != 0:
            raise RuntimeError(f"s3 range failed {key}: {res.stderr.decode(errors='replace')[:200]}")
        with open(path, "rb") as f:
            return f.read()
    finally:
        os.unlink(path)


def first_json_member_from_targz(key: str, max_bytes: int = 64 * 1024 * 1024) -> dict:
    """range GET 檔頭、串流解 gzip，拿到第一個完整的 .json tar member 就停"""
    d = zlib.decompressobj(16 + zlib.MAX_WBITS)
    buf = b""
    pos = 0
    step = 4 * 1024 * 1024
    while pos < max_bytes:
        chunk = s3_range(key, pos, pos + step - 1)
        pos += len(chunk)
        buf += d.decompress(chunk)
        i = 0
        while i + 512 <= len(buf):
            h = buf[i : i + 512]
            if h == b"\0" * 512:
                break
            name = h[:100].rstrip(b"\0").decode(errors="replace")
            size = int(h[124:136].rstrip(b"\0 ") or b"0", 8)
            end = i + 512 + size
            if end > len(buf):
                break
            if name.endswith(".json"):
                return json.loads(buf[i + 512 : end])
            i = end + ((-size) % 512)
        if len(chunk) < step:
            break
    raise RuntimeError(f"no complete json member in first {pos} bytes of {key}")


def _num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def _unix(s: str) -> int:
    return int(dt.datetime.fromisoformat(s).timestamp())


# ── 風 ──


def build_wind(date: str, bbox: list[float], notes: list[str]) -> dict:
    key = f"weather/archives/{date}.tar.gz"
    origin = f"s3://{BUCKET}/{key}"
    sb = expand_bbox(bbox, WIND_STATION_PAD_KM)
    start, end = day_window(date)
    raw = s3_cached(key)
    if raw is None:
        notes.append(f"風：{origin} 缺檔 → health=error（前端 unknown）。")
        return {"origin": origin, "health": "error", "bbox": bbox, "stations": [], "obs": []}
    stations: dict[str, int] = {}
    st_list: list[dict] = []
    obs: dict[tuple[int, int], list] = {}
    total = 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tf:
        for m in tf.getmembers():
            if not m.name.endswith(".json"):
                continue
            for r in json.load(tf.extractfile(m)).get("data", []):
                lon, lat = _num(r.get("longitude")), _num(r.get("latitude"))
                if lon is None or lat is None or not r.get("obs_time"):
                    continue
                t = _unix(r["obs_time"])
                if not (start <= t < end):
                    continue
                total += 1
                if not in_bbox(lon, lat, sb):
                    continue
                sid = r["station_id"]
                if sid not in stations:
                    stations[sid] = len(st_list)
                    st_list.append({"id": sid, "name": r.get("station_name"), "lon": lon, "lat": lat, "alt_m": _num(r.get("altitude"))})
                ws = _num(r.get("wind_speed"))
                gust = _num(r.get("gust_speed"))
                # CWA 缺測代碼（-99 等）為負值 → null，不當 0
                obs[(stations[sid], t)] = [stations[sid], t, ws if ws is None or ws >= 0 else None, gust if gust is None or gust >= 0 else None]
    health = "ok" if total else "empty"
    notes.append(f"風：{origin}，全台 {total} 筆整點觀測；收 bbox 外擴 {WIND_STATION_PAD_KM:g} km 內 {len(st_list)} 站。風速≠聲級；Supabase live.weather_observations 只留 21 天且無 public RPC，所以只有快照有風。")
    return {"origin": origin, "health": health, "bbox": bbox, "stations": st_list, "obs": sorted(obs.values(), key=lambda x: (x[0], x[1]))}


# ── 浪 ──


def build_wave(date: str, bbox: list[float], notes: list[str]) -> dict:
    key = f"cwa_marine_observation/archives/{shift(date, 1)}.tar.gz"
    origin = f"s3://{BUCKET}/{key}#first-member"
    start, end = day_window(date)
    try:
        doc = first_json_member_from_targz(key)
    except RuntimeError as e:
        notes.append(f"浪：{origin} 讀取失敗（{str(e)[:80]}）→ health=error。")
        return {"origin": origin, "health": "error", "bbox": bbox, "stations": [], "obs": []}
    st_meta = {s["source_station_id"]: s for s in doc.get("data", []) if s.get("_type") == "station"}
    vals: dict[tuple[str, int], dict] = {}
    for r in doc.get("data", []):
        if r.get("_type") != "reading" or r.get("metric_code") not in ("wave_height", "wave_period"):
            continue
        t = _unix(r["observed_at"])
        if not (start <= t < end):
            continue
        v = _num(r.get("value_numeric"))
        if r.get("is_missing") or r.get("is_valid") is False or (v is not None and v < 0):
            v = None
        vals.setdefault((r["source_station_id"], t), {})[r["metric_code"]] = v
    idx: dict[str, int] = {}
    st_list: list[dict] = []
    obs = []
    for (sid, t), m in sorted(vals.items()):
        meta = st_meta.get(sid)
        if not meta:
            continue
        if sid not in idx:
            idx[sid] = len(st_list)
            st_list.append({"id": sid, "name": meta.get("name_zh"), "type": meta.get("station_type"), "lon": meta["longitude"], "lat": meta["latitude"]})
        obs.append([idx[sid], t, m.get("wave_height"), m.get("wave_period")])
    health = "ok" if obs else "empty"
    notes.append(f"浪：{origin}（CWA O-B0075 滾動 48h，取 D+1 第一個檔即涵蓋 D 全天），{len(st_list)} 個有浪高的浮標／測站全收（共 {len(obs)} 小時列）；浪高或週期缺值保持 null。")
    return {"origin": origin, "health": health, "bbox": bbox, "stations": st_list, "obs": obs}


# ── 河川水位 ──


def _river_rows(date: str) -> list[dict] | None:
    raw = s3_cached(f"river_water_level/archives/{date}.tar.gz")
    if raw is None:
        return None
    out = []
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tf:
        for m in tf.getmembers():
            if m.name.endswith(".json"):
                out.extend(json.load(tf.extractfile(m)).get("data", []))
    return out


def _hourly_last(rows: list[dict], start: int, end: int) -> dict[tuple[str, int], float | None]:
    best: dict[tuple[str, int], tuple[int, float | None]] = {}
    for r in rows:
        if not r.get("observed_at"):
            continue
        t = _unix(r["observed_at"])
        if not (start <= t < end):
            continue
        k = (r["station_id"], t - (t - start) % 3600)
        if k not in best or best[k][0] < t:
            best[k] = (t, _num(r.get("water_level_m")))
    return {k: v for k, (_, v) in best.items()}


def _quantiles(values: list[float]) -> dict | None:
    if len(values) < 2:
        return None
    v = sorted(values)
    out = []
    for p in RIVER_QUANT_PROBS:
        x = p * (len(v) - 1)
        lo = int(math.floor(x))
        hi = min(lo + 1, len(v) - 1)
        out.append(round(v[lo] + (v[hi] - v[lo]) * (x - lo), 4))
    return {"probs": RIVER_QUANT_PROBS, "values": out, "n": len(v)}


def build_river(date: str, bbox: list[float], public_dir: str, notes: list[str]) -> dict:
    origin = f"s3://{BUCKET}/river_water_level/archives/{{{date},{shift(date, 1)}}}.tar.gz"
    sb = expand_bbox(bbox, RIVER_STATION_PAD_KM)
    with open(os.path.join(public_dir, "geo", "water_monitor_stations.geojson"), encoding="utf-8") as f:
        coords = {ft["id"]: (ft["geometry"]["coordinates"], ft["properties"].get("name")) for ft in json.load(f)["features"] if ft["properties"].get("station_type") == "river_level"}
    start, end = day_window(date)
    s3_prefetch([f"river_water_level/archives/{shift(date, k)}.tar.gz" for k in range(-RIVER_HISTORY_DAYS, 2)])
    day_rows = []
    missing = []
    for d in (date, shift(date, 1)):
        rows = _river_rows(d)
        if rows is None:
            missing.append(d)
        else:
            day_rows.extend(rows)
    if date in missing:
        notes.append(f"河川：{date} 水位 archive 缺檔 → health=error。")
        return {"origin": origin, "health": "error", "bbox": bbox, "stations": [], "obs": []}
    today = _hourly_last(day_rows, start, end)
    ids_all = {sid for sid, _ in today}
    unplaced = sorted(i for i in ids_all if i not in coords)
    ids = sorted(i for i in ids_all if i in coords and in_bbox(coords[i][0][0], coords[i][0][1], sb))
    # 歷史：D 之前 N 天（不含 D）
    hist: dict[str, list[float]] = {i: [] for i in ids}
    hist_days = 0
    h_from = shift(date, -RIVER_HISTORY_DAYS)
    for k in range(RIVER_HISTORY_DAYS, 0, -1):
        d = shift(date, -k)
        rows = _river_rows(d)
        nxt = _river_rows(shift(d, 1)) if k > 1 else None
        if rows is None:
            continue
        hist_days += 1
        s0, e0 = day_window(d)
        hv = _hourly_last(rows + (nxt or []), s0, e0)
        for (sid, _), v in hv.items():
            if sid in hist and v is not None:
                hist[sid].append(v)
    idx = {sid: n for n, sid in enumerate(ids)}
    st_list = [{"id": sid, "name": coords[sid][1], "lon": coords[sid][0][0], "lat": coords[sid][0][1], "q": _quantiles(hist[sid])} for sid in ids]
    obs = sorted([[idx[sid], t, v] for (sid, t), v in today.items() if sid in idx], key=lambda x: (x[0], x[1]))
    basis = f"{h_from}..{shift(date, -1)}（{hist_days}/{RIVER_HISTORY_DAYS} 天有 archive），每小時最後一筆"
    notes.append(
        f"河川：{origin}；收 bbox 外擴 {RIVER_STATION_PAD_KM:g} km 內 {len(ids)} 站（全台 {len(ids_all)} 站中 {len(unplaced)} 站在 water_monitor_stations 找不到座標、不放）。"
        f"分位基準 {basis}。水位≠流量≠聲音；感潮河段反映潮汐。"
    )
    return {"origin": origin, "health": "ok" if obs else "empty", "bbox": bbox, "history_basis": basis, "stations": st_list, "obs": obs}


# ── 樹冠格網（PMTiles PNG，stdlib 解碼）──


def _varint(b: bytes, i: int):
    shift_ = 0
    res = 0
    while True:
        c = b[i]
        i += 1
        res |= (c & 0x7F) << shift_
        if not c & 0x80:
            return res, i
        shift_ += 7


def _pmt_dir(buf: bytes):
    i = 0
    n, i = _varint(buf, i)
    ids, last = [], 0
    for _ in range(n):
        v, i = _varint(buf, i)
        last += v
        ids.append(last)
    rl, ln, off = [], [], []
    for _ in range(n):
        v, i = _varint(buf, i)
        rl.append(v)
    for _ in range(n):
        v, i = _varint(buf, i)
        ln.append(v)
    for k in range(n):
        v, i = _varint(buf, i)
        off.append(off[k - 1] + ln[k - 1] if (v == 0 and k > 0) else v - 1)
    return list(zip(ids, off, ln, rl))


def _zxy_to_id(z: int, x: int, y: int) -> int:
    acc = sum(4**k for k in range(z))
    n = 2**z
    d = 0
    s = n // 2
    while s > 0:
        rx = 1 if (x & s) > 0 else 0
        ry = 1 if (y & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                x = s - 1 - x
                y = s - 1 - y
            x, y = y, x
        s //= 2
    return acc + d


class _PMTiles:
    def __init__(self, path: str):
        self.f = open(path, "rb")
        h = self.f.read(127)
        if h[:7] != b"PMTiles" or h[7] != 3:
            raise RuntimeError(f"{path}: not PMTiles v3")
        (self.root_off, self.root_len, _, _, self.leaf_off, _, self.data_off, _, _, _, _) = struct.unpack("<QQQQQQQQQQQ", h[8:96])
        self.icomp = h[97]
        self.cache: dict = {}

    def get(self, z: int, x: int, y: int) -> bytes | None:
        tid = _zxy_to_id(z, x, y)
        off, ln = self.root_off, self.root_len
        for _ in range(4):
            if (off, ln) not in self.cache:
                self.f.seek(off)
                b = self.f.read(ln)
                self.cache[(off, ln)] = _pmt_dir(gzip.decompress(b) if self.icomp == 2 else b)
            entries = self.cache[(off, ln)]
            lo, hi, hit = 0, len(entries) - 1, None
            while lo <= hi:
                m = (lo + hi) // 2
                if entries[m][0] <= tid:
                    hit = entries[m]
                    lo = m + 1
                else:
                    hi = m - 1
            if hit is None:
                return None
            eid, eoff, eln, erl = hit
            if erl == 0:
                off, ln = self.leaf_off + eoff, eln
                continue
            if tid < eid + erl:
                self.f.seek(self.data_off + eoff)
                return self.f.read(eln)
            return None
        return None


def _png_rgba(data: bytes):
    """回 (w, h, 取像素函式)；只支援 8-bit RGBA（canopy 磚實測為 color type 6）"""
    i, idat, w, h, bd, ct = 8, b"", 0, 0, 0, 0
    while i < len(data):
        ln = struct.unpack(">I", data[i : i + 4])[0]
        typ = data[i + 4 : i + 8]
        body = data[i + 8 : i + 8 + ln]
        i += 12 + ln
        if typ == b"IHDR":
            w, h, bd, ct = struct.unpack(">IIBB", body[:10])
        elif typ == b"IDAT":
            idat += body
        elif typ == b"IEND":
            break
    if bd != 8 or ct != 6:
        raise RuntimeError(f"unsupported PNG bd={bd} ct={ct}")
    ch = 4
    stride = w * ch
    raw = zlib.decompress(idat)
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for r in range(h):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride
        if ft == 1:
            for k in range(ch, stride):
                line[k] = (line[k] + line[k - ch]) & 255
        elif ft == 2:
            for k in range(stride):
                line[k] = (line[k] + prev[k]) & 255
        elif ft == 3:
            for k in range(stride):
                a = line[k - ch] if k >= ch else 0
                line[k] = (line[k] + ((a + prev[k]) >> 1)) & 255
        elif ft == 4:
            for k in range(stride):
                a = line[k - ch] if k >= ch else 0
                b = prev[k]
                c = prev[k - ch] if k >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[k] = (line[k] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        out[r * stride : (r + 1) * stride] = line
        prev = line
    return w, h, lambda x, y: (out[y * stride + x * ch], out[y * stride + x * ch + 3])


def build_canopy(lon: float, lat: float, public_dir: str, notes: list[str]) -> dict | None:
    path = os.path.join(public_dir, "forestry", "canopy_height_rgb_taiwan.pmtiles")
    if not os.path.exists(path):
        notes.append(f"樹冠：{path} 不存在 → 不放 canopy（前端風×植被 unknown）。")
        return None
    pm = _PMTiles(path)
    half_dlat = CANOPY_HALF_M / 111_195
    half_dlon = CANOPY_HALF_M / (111_195 * math.cos(math.radians(lat)))
    n = int(round(2 * CANOPY_HALF_M / CANOPY_CELL_M))
    w, s, e, nn = lon - half_dlon, lat - half_dlat, lon + half_dlon, lat + half_dlat
    dx, dy = (e - w) / n, (nn - s) / n
    tiles: dict = {}

    def tile(z, x, y):
        k = (z, x, y)
        if k not in tiles:
            b = pm.get(z, x, y)
            tiles[k] = _png_rgba(b) if b else None
        return tiles[k]

    heights = []
    for j in range(n):
        clat = nn - (j + 0.5) * dy
        for i in range(n):
            clon = w + (i + 0.5) * dx
            val = -1
            for z in range(CANOPY_ZOOM[1], CANOPY_ZOOM[0] - 1, -1):
                N = 2**z
                fx = (clon + 180) / 360 * N
                lr = math.radians(clat)
                fy = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * N
                t = tile(z, int(fx), int(fy))
                if t is None:
                    continue
                tw, th, px = t
                r, a = px(min(tw - 1, int((fx % 1) * tw)), min(th - 1, int((fy % 1) * th)))
                val = r if a >= 128 else -1
                break
            heights.append(val)
    with_data = sum(1 for v in heights if v >= 0)
    notes.append(
        f"樹冠：Meta/WRI 2020 樹冠高度（canopy_height_rgb_taiwan.pmtiles，z{CANOPY_ZOOM[1]} 約 35 m 像素）取樣成接收點 ±{CANOPY_HALF_M / 1000:g} km、"
        f"{CANOPY_CELL_M:g} m 格網（{n}×{n}，有值 {with_data} 格）；-1＝遮罩（無 ≥1 m 樹冠、海或無資料，分不出來）。"
    )
    return {"origin": "public/forestry/canopy_height_rgb_taiwan.pmtiles (Meta/WRI 2020)", "bbox": [round(w, 6), round(s, 6), round(e, 6), round(nn, 6)], "nx": n, "ny": n, "heights": heights}


# ── 海岸（近岸海域面）與河道（線）──


def _dp(points: list, tol_m: float) -> list:
    if len(points) < 3:
        return points
    lat0 = points[0][1]
    kx = 111_195 * math.cos(math.radians(lat0))
    ky = 111_195
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a][0] * kx, points[a][1] * ky
        bx, by = points[b][0] * kx, points[b][1] * ky
        L = (bx - ax) ** 2 + (by - ay) ** 2
        best, bi = -1.0, -1
        for k in range(a + 1, b):
            px, py = points[k][0] * kx, points[k][1] * ky
            t = 0 if L == 0 else max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L))
            d = math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
            if d > best:
                best, bi = d, k
        if best > tol_m:
            keep[bi] = True
            stack.extend([(a, bi), (bi, b)])
    return [[round(p[0], 6), round(p[1], 6)] for p, k in zip(points, keep) if k]


def _geom_bbox(coords) -> list[float]:
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for cc in c:
                walk(cc)

    walk(coords)
    return [min(xs), min(ys), max(xs), max(ys)]


def _bbox_hit(a: list[float], b: list[float]) -> bool:
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def build_coast(bbox: list[float], coast_path: str, notes: list[str]) -> dict | None:
    if not os.path.exists(coast_path):
        notes.append(f"海岸：{coast_path} 不存在 → 不放 coast（前端海浪 unknown）。")
        return None
    with open(coast_path, encoding="utf-8") as f:
        feats = json.load(f)["features"]
    sb = expand_bbox(bbox, COAST_PAD_KM)
    polys = []
    for ft in feats:
        if ft["properties"].get("area_type") != "近岸海域":
            continue
        g = ft["geometry"]
        for poly in [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]:
            if not _bbox_hit(_geom_bbox(poly), sb):
                continue
            rings = [_dp([[p[0], p[1]] for p in r], SIMPLIFY_COAST_M) for r in poly]
            if len(rings[0]) >= 4:
                polys.append(rings)
    notes.append(
        f"海岸：國家公園署 111 年海岸地區範圍的『近岸海域』面（自平均低潮線起算，**不是現行海岸線**）當海岸線 proxy；"
        f"範圍內 {len(polys)} 個面，DP 簡化 {SIMPLIFY_COAST_M:g} m。政府資料開放授權條款第 1 版，需標示出處。"
    )
    return {"origin": "analytics coastal_area_extents (NLMA 111, data.gov.tw 20821) area_type=近岸海域", "bbox": bbox, "geometry": {"type": "MultiPolygon", "coordinates": polys}}


def build_river_network(lon: float, lat: float, public_dir: str, notes: list[str]) -> dict | None:
    path = os.path.join(public_dir, "geo", "water_rivers.geojson")
    if not os.path.exists(path):
        notes.append(f"河道：{path} 不存在 → 不放 river_network（前端河川 unknown）。")
        return None
    nb = bbox_around(lon, lat, RIVER_NET_HALF_KM)
    sb = expand_bbox(nb, 0.5)
    with open(path, encoding="utf-8") as f:
        feats = json.load(f)["features"]
    lines = []
    for ft in feats:
        g = ft.get("geometry") or {}
        parts = [g.get("coordinates")] if g.get("type") == "LineString" else (g.get("coordinates") or [] if g.get("type") == "MultiLineString" else [])
        for ln in parts:
            if ln and len(ln) >= 2 and _bbox_hit(_geom_bbox(ln), sb):
                s = _dp([[p[0], p[1]] for p in ln], SIMPLIFY_RIVER_M)
                if len(s) >= 2:
                    lines.append(s)
    notes.append(f"河道：public/geo/water_rivers.geojson 裁到接收點 ±{RIVER_NET_HALF_KM:g} km（{len(lines)} 條線，DP {SIMPLIFY_RIVER_M:g} m）；不含野溪、瀑布。")
    return {"origin": "public/geo/water_rivers.geojson", "bbox": nb, "geometry": {"type": "MultiLineString", "coordinates": lines}}


def build_natural(scene: dict, bbox: list[float], public_dir: str, coast_path: str, notes: list[str]) -> dict:
    rc = scene["receiver"]
    date = scene["date"]
    out = {"schema": NATURAL_SCHEMA}
    out["wind"] = build_wind(date, bbox, notes)
    out["wave"] = build_wave(date, bbox, notes)
    out["river"] = build_river(date, bbox, public_dir, notes)
    for k, v in (
        ("canopy", build_canopy(rc["lon"], rc["lat"], public_dir, notes)),
        ("coast", build_coast(bbox, coast_path, notes)),
        ("river_network", build_river_network(rc["lon"], rc["lat"], public_dir, notes)),
    ):
        if v is not None:
            out[k] = v
    return out


def merge_w5(path: str, scene: dict, public_dir: str, coast_path: str) -> dict:
    """既有場景檔只加 natural 區塊（其他區塊原樣）"""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("schema") != SCHEMA or doc.get("id") != scene["id"]:
        raise RuntimeError(f"{path}: schema/id mismatch")
    prefixes = ("風：", "浪：", "河川：", "樹冠：", "海岸：", "河道：", "W5：")
    notes = [n for n in doc.get("notes_zh", []) if not n.startswith(prefixes)]
    nn: list[str] = []
    doc["natural"] = build_natural(scene, doc["bbox"], public_dir, coast_path, nn)
    notes += nn
    notes.append("W5：風×植被、海浪×海岸、河川水位分位都是活動 proxy（風速≠聲級、浪高≠岸邊聲音、水位≠流量≠聲音），不是 dB。")
    doc["notes_zh"] = notes
    doc["generated_at"] = dt.datetime.now(TPE).replace(microsecond=0).isoformat()
    return doc


def merge_mvp_b(path: str, scene: dict) -> dict:
    """既有場景檔只加 roadwork 區塊（其他區塊原樣）；鐵道與車流不進快照"""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("schema") != SCHEMA or doc.get("id") != scene["id"]:
        raise RuntimeError(f"{path}: schema/id mismatch")
    notes = [n for n in doc.get("notes_zh", []) if not n.startswith("施工：") and not n.startswith("MVP-B：")]
    rw_notes: list[str] = []
    doc["roadwork"] = build_roadwork(scene, doc["bbox"], rw_notes)
    notes += rw_notes
    notes.append("MVP-B：鐵道是班表、前端即時算，不進快照；道路車流只有國道道路類型 proxy（無車流量來源），不進快照。")
    doc["notes_zh"] = notes
    doc["generated_at"] = dt.datetime.now(TPE).replace(microsecond=0).isoformat()
    return doc


def build_scene(scene: dict) -> dict:
    rc = scene["receiver"]
    bbox = bbox_around(rc["lon"], rc["lat"], BBOX_HALF_KM)
    notes: list[str] = [
        f"bbox＝接收點 ±{BBOX_HALF_KM:g} km；日期為臺北日 {scene['date']}。",
        "相對潛勢是無單位 0–1 的類別活躍度，不是 dB。",
        "垃圾車是週期班表，不進快照；前端照常讀既有班表靜態快照（get_waste_schedule_day_<dow>_<分組>.json）。",
    ]
    aviation = build_aviation(scene, bbox, notes)
    thunder = build_thunder(scene, bbox, notes)
    rain = build_rain(scene, notes)
    roadwork = build_roadwork(scene, bbox, notes)
    notes.append("MVP-B：鐵道是班表、前端即時算，不進快照；道路車流只有國道道路類型 proxy（無車流量來源），不進快照。")
    return {
        "schema": SCHEMA,
        "id": scene["id"],
        "title_zh": scene["title_zh"],
        "date": scene["date"],
        "focus_time": scene["focus_time"],
        "receiver": {
            "lon": rc["lon"],
            "lat": rc["lat"],
            "height_m": 1.5,
            "label_zh": rc["label_zh"],
            "reason_zh": rc["reason_zh"],
        },
        "bbox": bbox,
        "aviation": aviation,
        "thunder": thunder,
        "rain": rain,
        "roadwork": roadwork,
        "notes_zh": notes,
        "generated_at": dt.datetime.now(TPE).replace(microsecond=0).isoformat(),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scene", action="append", help="只產指定場景（可重複）")
    ap.add_argument("--out", default=os.path.join(REPO, "public", "sound-atlas", "scenes"))
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--merge-mvp-b", action="store_true", help="只把 roadwork 區塊併進 --out 內既有場景檔（不需要資料庫）")
    ap.add_argument("--merge-w5", action="store_true", help="只把 W5 natural 區塊（風、浪、河川、樹冠、海岸、河道）併進 --out 內既有場景檔（S3＋本機檔，不需要資料庫）")
    ap.add_argument("--public-dir", default=DEFAULT_PUBLIC, help="讀樹冠 PMTiles、water_rivers、water_monitor_stations 的 public 目錄")
    ap.add_argument("--coast-geojson", default=DEFAULT_COAST, help="analytics coastal_area_extents.geojson")
    args = ap.parse_args()
    if args.list:
        for s in SCENES:
            print(s["id"], s["date"], s["sources"])
        return 0
    targets = [s for s in SCENES if not args.scene or s["id"] in args.scene]
    if args.scene and len(targets) != len(set(args.scene)):
        print(f"unknown scene id in {args.scene}", file=sys.stderr)
        return 2
    os.makedirs(args.out, exist_ok=True)
    rc = 0
    for s in targets:
        path = os.path.join(args.out, f"{s['id']}.json")
        if args.merge_w5:
            doc = merge_w5(path, s, args.public_dir, args.coast_geojson)
            body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            size = len(body.encode())
            nat = doc["natural"]
            print(
                f"{s['id']}: {size / 1024:.0f} KB  wind={nat['wind']['health']}/{len(nat['wind']['stations'])}st "
                f"wave={nat['wave']['health']}/{len(nat['wave']['stations'])}st river={nat['river']['health']}/{len(nat['river']['stations'])}st "
                f"canopy={'y' if 'canopy' in nat else 'n'} coast={'y' if 'coast' in nat else 'n'} river_net={'y' if 'river_network' in nat else 'n'}"
                f"{'' if size <= MAX_BYTES else '  ⚠ 超過 2 MB'}"
            )
            rc |= 1 if size > MAX_BYTES else 0
            continue
        if args.merge_mvp_b:
            doc = merge_mvp_b(path, s)
            body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            size = len(body.encode())
            rw = doc["roadwork"]
            print(f"{s['id']}: {size / 1024:.0f} KB  roadwork health={rw['health']} events={len(rw['events'])}{'' if size <= MAX_BYTES else '  ⚠ 超過 2 MB'}")
            rc |= 1 if size > MAX_BYTES else 0
            continue
        doc = build_scene(s)
        body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        path = os.path.join(args.out, f"{s['id']}.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        size = len(body.encode())
        flag = "" if size <= MAX_BYTES else "  ⚠ 超過 2 MB"
        print(
            f"{s['id']}: {size / 1024:.0f} KB  flights={len(doc['aviation']['rows'])} "
            f"strikes={len(doc['thunder']['events'])} health={doc['thunder']['health']} "
            f"rain_rows={len(doc['rain']['rows'])}{flag}"
        )
        if size > MAX_BYTES:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
