#!/usr/bin/env python3
"""City Sound Atlas 場景快照產生器（pulse-sound-scene-v1）。

把「某一天、某個接收點周圍」的三類時變資料（航跡、落雷、雨量）裁切成一個小 JSON，
讓場景在 Supabase 過了保留期之後仍可回放。垃圾車是週期班表，不進快照（前端照常讀 RPC）。

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

用法（repo 根目錄）：
  SUPABASE_DB_URL=… AWS_PROFILE=… python3 scripts/preprocess/build-sound-scenes.py [--scene ID ...] [--out DIR]
  python3 scripts/preprocess/build-sound-scenes.py --list
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
import subprocess
import sys
import tarfile

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
            "reason_zh": "距松山機場跑道東端約 3 公里、在東側起降航線下方；緊鄰碧湖國小雨量站（A1AA40，約 75 公尺），"
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
            "reason_zh": "緊鄰小油坑雨量站（A1AD40，約 270 公尺），Champi 颱風 10/24 臺北雨量最大的站之一；"
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


def build_scene(scene: dict) -> dict:
    rc = scene["receiver"]
    bbox = bbox_around(rc["lon"], rc["lat"], BBOX_HALF_KM)
    notes: list[str] = [
        f"bbox＝接收點 ±{BBOX_HALF_KM:g} km；日期為臺北日 {scene['date']}。",
        "相對潛勢是無單位 0–1 的類別活躍度，不是 dB。",
        "垃圾車是週期班表，不進快照；前端照常讀 get_waste_schedule_day。",
    ]
    aviation = build_aviation(scene, bbox, notes)
    thunder = build_thunder(scene, bbox, notes)
    rain = build_rain(scene, notes)
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
        "notes_zh": notes,
        "generated_at": dt.datetime.now(TPE).replace(microsecond=0).isoformat(),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scene", action="append", help="只產指定場景（可重複）")
    ap.add_argument("--out", default=os.path.join(REPO, "public", "sound-atlas", "scenes"))
    ap.add_argument("--list", action="store_true")
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
