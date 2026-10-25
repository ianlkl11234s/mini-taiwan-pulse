#!/usr/bin/env python3
"""公車擁擠模擬（模擬面板，站主限定、研究中）→ Pulse 本機靜態資產。

上游（唯讀，taipei-gis-analytics 的 bus_crowding P3 匯出）：
  ../taipei-gis-analytics/output/bus_crowding/p3_viz_am137/data   0.137 版（較寬鬆，YouBike 推估）
  ../taipei-gis-analytics/output/bus_crowding/p3_viz/data         0.180 版（較擁擠，捷運推估）
  兩版 lines.json、stations.json 逐位元相同；meta.json 沒記 am_share，資料夾對應寫死在 VERSIONS。

產出（站主限定私人資料，2026-10-25 使用者拍板乙案：只走私人 Range API，不放 public/、不進公開 CDN）：
  <repo>/bus-crowding-sim.local/（`*.local` 已在 .gitignore／.dockerignore；不在 public/，dev 與 build 都不會公開）
  segments.geojson          路段幾何（只輸出一次；feature id＝陣列順序）
  {v137,v180}/<方案>.json    {"ov": [...], "n": [...]}，依 feature 順序對齊
  meta.json                 版本、方案、涵蓋、bbox、QA 計數（只供人看，不在私人 API 白名單）
  lines.json                時間回放用線形＋路線名、站名（index＝線編號；跳過的線為 null）
  {v137,v180}/trips-base.json        時間回放：基準班次（只含負載分級，不含人數）
  {v137,v180}/trips-<方案>.json      時間回放：情境 diff {removed, changed}
  local_validation.json     {assets:{<filename>:{size,sha256}}}，上傳腳本核對用
資產契約（檔名、大小、sha256；sidecar 白名單與前端 Range 大小共用）：
  加 --write-contract 時重寫 server/coral-private/bus-crowding-assets.mjs 與 src/data/busCrowdingSimAssets.ts。
  資料一變 sha256 就變，兩檔都要一起 commit（測試逐一比對兩邊一致）。

時間回放的人數處理（人數不出瀏覽器）：每班每站只輸出負載分級 0–3（c，字串一字一站），
門檻照原型 p3_viz/index.html:149–150、159：CAP=65、BINS=[0.5,0.8,1.0]，cls(ld/65)。
不輸出 ld、b、a、lb、rr 原始人數。x＝另一版同 trip id（且站序相同）的分級，給 popup 寫範圍。
班次只留時段與 [07:00−20 分, 09:00] 有交集者（原型路段「當下」模式回看 20 分鐘，index.html:324–327）。

重產：
  python3 scripts/preprocess/build-bus-crowding-sim.py --write-contract
  python3 scripts/preprocess/build-bus-crowding-sim.py --analytics <taipei-gis-analytics 路徑>

契約（lines.json）：index 即線編號；st=[StationID, 站名, 沿線公尺]；g=[lng,lat]、gm=沿 g 累積公尺。
segs.json 的 ov[i][j]＝平日 7–9 時離開第 j 站的班次中負載比 ≥1.0 的比例，代表路段 st[j]→st[j+1]；
n[i][j]＝班次數；null＝無班次。末站那格丟掉。
s3（index 1，TPE-SYN-s3-0|0）沒有實際路線幾何（只是站點連線），整條不輸出（使用者決定：不畫線）。
s2（index 0，307 區間車）用真實線形，照常輸出並帶 syn=1。
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ANALYTICS = ROOT.parent / "taipei-gis-analytics"
# 若在 worktree（.claude/worktrees/<name>）執行，往上找 GIS 工作區
for parent in ROOT.parents:
    if (parent / "taipei-gis-analytics" / "output" / "bus_crowding").is_dir():
        DEFAULT_ANALYTICS = parent / "taipei-gis-analytics"
        break
OUT = ROOT / "bus-crowding-sim.local"
SERVER_CONTRACT = ROOT / "server" / "coral-private" / "bus-crowding-assets.mjs"
FRONTEND_CONTRACT = ROOT / "src" / "data" / "busCrowdingSimAssets.ts"

VERSIONS = [
    {"id": "v137", "dir": "p3_viz_am137", "am_share": 0.137, "label": "較寬鬆 13.7%（YouBike 推估）"},
    {"id": "v180", "dir": "p3_viz", "am_share": 0.180, "label": "較擁擠 18.0%（捷運推估）"},
]
SKIP_LINE_KEYS = {"TPE-SYN-s3-0|0"}
# 時間回放：原型 p3_viz/index.html:149（CAP、T0、T1）、150（BINS）
CAP = 65
LOAD_BINS = (0.5, 0.8, 1.0)
T0, T1 = 7 * 3600, 9 * 3600
LOOKBACK = 1200  # s3 新接駁線：無實際路線幾何
COVERAGE_TEXT = "臺北市 307 走廊周邊 257 條路線（559 條路線×方向）；新北市區公車未涵蓋"


def load(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def interp(g, gm, m):
    """沿線公尺 m 在折線上的座標（超出兩端就夾住）。"""
    if m <= gm[0]:
        return g[0]
    if m >= gm[-1]:
        return g[-1]
    k = bisect.bisect_right(gm, m)
    m0, m1 = gm[k - 1], gm[k]
    t = 0.0 if m1 == m0 else (m - m0) / (m1 - m0)
    (x0, y0), (x1, y1) = g[k - 1], g[k]
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]


def cut(g, gm, a, b):
    """截取沿線 a→b 公尺（a<b）的子折線。"""
    pts = [interp(g, gm, a)]
    for (pt, m) in zip(g, gm):
        if a < m < b:
            pts.append(pt)
    pts.append(interp(g, gm, b))
    out = []
    for p in pts:
        q = [round(p[0], 5), round(p[1], 5)]
        if not out or out[-1] != q:
            out.append(q)
    if len(out) == 1:
        out.append(out[0])
    return out


def load_class(ld: float) -> int:
    r = ld / CAP
    return 0 if r < LOAD_BINS[0] else 1 if r < LOAD_BINS[1] else 2 if r < LOAD_BINS[2] else 3


def classes(trip) -> str:
    return "".join(str(load_class(v)) for v in trip["ld"])


def assemble(base_trips, diff):
    """原型 index.html:183–184：基準扣掉 removed 與 changed，再接 changed。"""
    rm = set(diff["removed"])
    ch = {t["id"] for t in diff["changed"]}
    return [t for t in base_trips if t["id"] not in rm and t["id"] not in ch] + list(diff["changed"])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--analytics", type=Path, default=DEFAULT_ANALYTICS)
    ap.add_argument("--write-contract", action="store_true", help="重寫 sidecar 與前端的資產契約（檔名、大小、sha256）")
    args = ap.parse_args()
    base = args.analytics / "output" / "bus_crowding"
    dirs = {v["id"]: base / v["dir"] / "data" for v in VERSIONS}

    lines = load(dirs["v137"] / "lines.json")
    if (dirs["v137"] / "lines.json").read_bytes() != (dirs["v180"] / "lines.json").read_bytes():
        raise SystemExit("兩版 lines.json 不一致：契約已變，先確認上游")
    meta_up = {vid: load(d / "meta.json") for vid, d in dirs.items()}
    index = {vid: load(d / "scenarios" / "index.json") for vid, d in dirs.items()}
    titles = {vid: [(s["id"], s["title"]) for s in idx] for vid, idx in index.items()}
    if titles["v137"] != titles["v180"]:
        raise SystemExit("兩版方案清單或標題不一致")
    scenarios = titles["v137"]

    features = []
    order = []  # (li, sj)
    skipped_nonmono = 0
    nonmono_lines = set()
    clamped = 0
    skipped_syn = 0
    for li, line in enumerate(lines):
        st = line["st"]
        if line["k"] in SKIP_LINE_KEYS:
            skipped_syn += max(0, len(st) - 1)
            continue
        g, gm = line["g"], line["gm"]
        if len(g) != len(gm):
            raise SystemExit(f"line {li} g/gm 長度不符")
        for sj in range(len(st) - 1):
            a, b = st[sj][2], st[sj + 1][2]
            if b <= a:
                skipped_nonmono += 1
                nonmono_lines.add(li)
                continue
            if a < gm[0] or b > gm[-1]:
                clamped += 1
            props = {"li": li, "sj": sj, "n": line["n"], "sn": line["sn"], "a": st[sj][1], "b": st[sj + 1][1]}
            if line.get("new") == 1:
                props["syn"] = 1
            features.append({"type": "Feature", "id": len(order), "properties": props,
                             "geometry": {"type": "LineString", "coordinates": cut(g, gm, a, b)}})
            order.append((li, sj))

    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "segments.geojson").open("w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, ensure_ascii=False, separators=(",", ":"))

    def pack(segs):
        ov, n = [], []
        for li, sj in order:
            o = segs["ov"][li][sj]
            ov.append(None if o is None else round(o, 3))
            n.append(int(segs["n"][li][sj] or 0))
        return {"ov": ov, "n": n}

    n_equal = True
    files = {}
    for v in VERSIONS:
        vid = v["id"]
        (OUT / vid).mkdir(exist_ok=True)
        packs = {"base": pack(load(dirs[vid] / "segs.json"))}
        for sid, _ in scenarios:
            packs[sid] = pack(load(dirs[vid] / "scenarios" / sid / "segs.json"))
        for sid, p in packs.items():
            if len(p["ov"]) != len(order):
                raise SystemExit(f"{vid}/{sid} 長度不符")
            with (OUT / vid / f"{sid}.json").open("w", encoding="utf-8") as fh:
                json.dump(p, fh, separators=(",", ":"))
        files[vid] = packs
    for sid in files["v137"]:
        if files["v137"][sid]["n"] != files["v180"][sid]["n"]:
            n_equal = False

    up = meta_up["v180"]
    meta = {
        "date": up.get("date"),
        "window": "平日 07:00–09:00",
        "capacity_assumed": up.get("capacity_assumed"),
        "bbox": up.get("bbox"),
        "coverage": COVERAGE_TEXT,
        "versions": [{"id": v["id"], "am_share": v["am_share"], "label": v["label"], "upstream_dir": v["dir"]} for v in VERSIONS],
        "scenarios": [{"id": "base", "title": "基準（現況）"}] + [{"id": sid, "title": t} for sid, t in scenarios],
        "qa": {
            "segments_out": len(features),
            "segments_upstream": sum(max(0, len(l["st"]) - 1) for l in lines),
            "segments_skipped_nonmonotone": skipped_nonmono,
            "lines_nonmonotone": len(nonmono_lines),
            "lines_nonmonotone_upstream_meta": up.get("lines_nonmonotone_stop_projection"),
            "segments_clamped_to_shape_end": clamped,
            "s3_skipped_segments": skipped_syn,
            "n_equal_across_versions": n_equal,
            "lines": len(lines),
            "routes": len({l["r"] for l in lines}),
        },
    }
    # ── 時間回放 ──
    replay_lines = []
    skip_lines = set(nonmono_lines)
    for li, line in enumerate(lines):
        if line["k"] in SKIP_LINE_KEYS:
            skip_lines.add(li)
        if li in skip_lines:
            replay_lines.append(None)
            continue
        replay_lines.append({
            "g": [[round(x, 5), round(y, 5)] for x, y in line["g"]],
            "gm": [round(m) for m in line["gm"]],
            "m": [round(st[2]) for st in line["st"]],
            "n": line["n"], "sn": line["sn"],
            "s": [st[1] for st in line["st"]],
        })
    with (OUT / "lines.json").open("w", encoding="utf-8") as fh:
        json.dump(replay_lines, fh, separators=(",", ":"))

    def in_window(t):
        return t["t"][-1] >= T0 - LOOKBACK and t["t"][0] <= T1

    def slim(t, other):
        out = {"id": t["id"], "l": int(t["l"]), "q": t["q"], "t": [int(round(v)) for v in t["t"]], "c": classes(t)}
        o = other.get(t["id"])
        if o is not None and o["q"] == t["q"]:
            out["x"] = classes(o)
        if t.get("syn"):
            out["syn"] = 1
        return out

    up_trips = {v["id"]: load(dirs[v["id"]] / "trips.json") for v in VERSIONS}
    up_diffs = {v["id"]: {sid: load(dirs[v["id"]] / "scenarios" / sid / "trips.json") for sid, _ in scenarios} for v in VERSIONS}
    replay_qa = {}
    for v in VERSIONS:
        vid = v["id"]
        oid = "v180" if vid == "v137" else "v137"
        keep = lambda t: in_window(t) and int(t["l"]) not in skip_lines
        other_base = {t["id"]: t for t in up_trips[oid]}
        base_out = [slim(t, other_base) for t in up_trips[vid] if keep(t)]
        with (OUT / vid / "trips-base.json").open("w", encoding="utf-8") as fh:
            json.dump({"trips": base_out}, fh, separators=(",", ":"))
        skipped_trips = sum(1 for t in up_trips[vid] if in_window(t) and int(t["l"]) in skip_lines)
        matched = sum(1 for t in base_out if "x" in t)
        sc_qa = {}
        for sid, _ in scenarios:
            diff = up_diffs[vid][sid]
            other_sc = {t["id"]: t for t in assemble(up_trips[oid], up_diffs[oid][sid])}
            changed = [slim(t, other_sc) for t in diff["changed"] if keep(t)]
            with (OUT / vid / f"trips-{sid}.json").open("w", encoding="utf-8") as fh:
                json.dump({"removed": diff["removed"], "changed": changed}, fh, separators=(",", ":"))
            sc_qa[sid] = {"changed": len(changed), "changed_matched": sum(1 for t in changed if "x" in t),
                          "removed": len(diff["removed"]),
                          "changed_skipped_line": sum(1 for t in diff["changed"] if in_window(t) and int(t["l"]) in skip_lines)}
        replay_qa[vid] = {"base_trips": len(base_out), "base_matched_other_version": matched,
                          "base_skipped_line": skipped_trips, "scenarios": sc_qa}
    meta["replay"] = {
        "clock": {"t0": T0, "t1": T1, "start": 27900, "source": "p3_viz/index.html:115、149（slider 25200–32400、預設 27900）"},
        "load_bins": list(LOAD_BINS), "load_bins_source": "p3_viz/index.html:150、159",
        "lines_skipped": sorted(skip_lines),
        "qa": replay_qa,
    }

    with (OUT / "meta.json").open("w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(json.dumps(meta["qa"], ensure_ascii=False))
    print(json.dumps(meta["replay"]["qa"], ensure_ascii=False))

    assets = asset_contract(["base"] + [sid for sid, _ in scenarios if sid != "base"])
    with (OUT / "local_validation.json").open("w", encoding="utf-8") as fh:
        json.dump({"assets": {a["filename"]: {"size": a["size"], "sha256": a["sha256"]} for a in assets.values()}}, fh, indent=2)
        fh.write("\n")
    if args.write_contract:
        write_contracts(assets)
        print(f"contract: {len(assets)} assets → {SERVER_CONTRACT.relative_to(ROOT)}, {FRONTEND_CONTRACT.relative_to(ROOT)}")


def asset_contract(scenario_ids) -> dict:
    """私人 API 白名單：key（網址最後一段，無斜線）→ 檔名（相對資料根目錄）、大小、sha256。meta.json 不列入。"""
    names = [("segments", "segments.geojson"), ("lines", "lines.json")]
    for v in VERSIONS:
        vid = v["id"]
        names += [(f"{vid}-{sid}", f"{vid}/{sid}.json") for sid in scenario_ids]
        names += [(f"{vid}-trips-{sid}", f"{vid}/trips-{sid}.json") for sid in scenario_ids]
    out = {}
    for key, filename in names:
        data = (OUT / filename).read_bytes()
        out[key] = {"filename": filename, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return out


def write_contracts(assets: dict) -> None:
    head = "build-bus-crowding-sim.py --write-contract 產生，不要手改；資料重產後兩檔一起 commit。"
    rows = [f'  "{k}": {{ filename: "{a["filename"]}", size: {a["size"]}, sha256: "{a["sha256"]}" }},' for k, a in assets.items()]
    server = "\n".join([
        f"// {head}",
        "// 公車擁擠模擬（模擬面板，研究中）：站主限定私人 Range API 的白名單；只有這些 key 可讀，請求不能指定路徑。",
        "export const BUS_CROWDING_ASSETS = Object.freeze({",
        *[r.replace("{ filename", "Object.freeze({ filename").replace(" },", " }),") for r in rows],
        "});",
        "",
    ])
    frontend = "\n".join([
        f"// {head}",
        "/** 公車擁擠模擬私人資產契約；與 sidecar `BUS_CROWDING_ASSETS`（server/coral-private/bus-crowding-assets.mjs）同一組數字（測試逐一比對）。 */",
        "export const BUS_CROWDING_SIM_ASSETS = {",
        *rows,
        "} as const;",
        "export type BusCrowdingSimAssetName = keyof typeof BUS_CROWDING_SIM_ASSETS;",
        "",
    ])
    SERVER_CONTRACT.write_text(server, encoding="utf-8")
    FRONTEND_CONTRACT.write_text(frontend, encoding="utf-8")


if __name__ == "__main__":
    main()
