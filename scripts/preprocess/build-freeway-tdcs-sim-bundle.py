#!/usr/bin/env python3
"""雙北國道逐車模擬 → ADR-0025 模擬資料包（pulse-sim-bundle-v1），trips 依模擬時間切檔。

輸入（gitignored）：public/freeway_tdcs/{trips_meta.json, network.json, trips.bin}（v3）
輸出（gitignored）：public/freeway_tdcs/sim/freeway_tdcs/<bundle_version>/ 與同層 current.json
  —— 與 CDN https://data.itsmigu.com/sim/v1/freeway_tdcs/ 同結構，DEV 讀不到 CDN 時直接讀這裡。

資料包內容（全部 ≤ --max-part-bytes）：
  bundle.json   清單（files[] 記 bytes／sha256；parts[] 記每檔時段與欄位位移）
  meta.json     日期、資料時段、交流道名稱、車種代碼等
  network.json  路網（原樣）
  segs.bin      每段（global seg id）：trip u32、start u16、end u16（相對 t_base 秒）
  trips.bin     每趟（global trip id）：vt、spd、flags u8；on、off、first、last u16
  parts/NNN.bin 時段 [t0, t1) 內有出現的段：關鍵影格與換道事件裁到該時段，前後各多留括號點
                （影格前後各 1 點、事件前多 2 點），跨檔的段在前端依 kf_base／ev_base 去重接回。

用法：
  python3 scripts/preprocess/build-freeway-tdcs-sim-bundle.py [--version 20261103-1] [--max-part-bytes 2000000]
"""
import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "freeway_tdcs"
OUT_ROOT = SRC / "sim" / "freeway_tdcs"
SLUG = "freeway_tdcs"
SCHEMA = "pulse-sim-bundle-v1"
TRAIL_MAX_S = 300          # 拖尾滑桿上限（layerParamsSpec freewayTdcsSimTrail.max）：資料時段前要多一段讓 16:00 也有拖尾
CHUNK_S = 60               # 前端拖尾分塊（FREEWAY_TDCS_CHUNK_S）：切檔邊界必須落在塊邊界


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load(src: Path):
    meta = json.loads((src / "trips_meta.json").read_text())
    raw = (src / "trips.bin").read_bytes()

    def g(k):
        L = meta["layout"][k]
        return np.frombuffer(raw, dtype=L["dtype"], count=L["length"], offset=L["offset"])

    return meta, (src / "network.json").read_bytes(), {k: g(k) for k in meta["layout"]}


def pack(arrays):
    """依序排列，每段 4 bytes 對齊；回傳 (bytes, layout)。"""
    buf, layout, off = bytearray(), {}, 0
    for name, a in arrays:
        a = np.ascontiguousarray(a)
        pad = (-off) % 4
        buf += b"\0" * pad
        off += pad
        layout[name] = {"offset": off, "length": int(a.size), "dtype": str(a.dtype)}
        buf += a.tobytes()
        off += a.nbytes
    return bytes(buf), layout


def build_part(A, t0, t1):
    """時段 [t0, t1]（閉區間）有出現的段，影格與事件裁切後打包。"""
    kt, s0, s1, st, en = A["kt"], A["s0"], A["s1"], A["st"], A["en"]
    evS, evT = A["evS"], A["evT"]
    sel = np.where((en >= t0) & (st <= t1))[0]
    n = len(sel)
    kf_base = np.zeros(n, np.uint32); kf_off = np.zeros(n + 1, np.uint32)
    ev_base = np.zeros(n, np.uint32); ev_off = np.zeros(n + 1, np.uint32)
    kn_parts, kt_parts, et_parts, el_parts = [], [], [], []
    for j, i in enumerate(sel):
        t = kt[s0[i]:s1[i]]
        # 同一秒多個影格（門架密集）要整組帶上，前端二分搜尋才與單檔版選到同一點
        lo = max(int(np.searchsorted(t, t0, "left")) - 1, 0)
        hi = min(int(np.searchsorted(t, t1, "right")) + 1, len(t))
        if len(t) >= 2:   # 至少兩點：段剛好在邊界開始／結束時，車速與方向要靠相鄰影格
            lo = min(lo, len(t) - 2)
            hi = max(hi, lo + 2)
        kf_base[j] = lo
        kf_off[j + 1] = kf_off[j] + (hi - lo)
        kn_parts.append(A["kn"][s0[i] + lo:s0[i] + hi]); kt_parts.append(A["kt_raw"][s0[i] + lo:s0[i] + hi])
        e = evT[evS[i]:evS[i + 1]]
        if len(e):
            # 時段起點前（含換道過渡 lane_change_s）的事件再往前 2 筆；同秒的事件整組帶上
            elo = max(int(np.searchsorted(e, t0 - A["lcT"], "left")) - 3, 0)
            ehi = min(int(np.searchsorted(e, t1, "right")) + 1, len(e))
        else:
            elo = ehi = 0
        ev_base[j] = elo
        ev_off[j + 1] = ev_off[j] + (ehi - elo)
        et_parts.append(A["evT_raw"][evS[i] + elo:evS[i] + ehi]); el_parts.append(A["evL"][evS[i] + elo:evS[i] + ehi])
    cat = lambda xs, dt: np.concatenate(xs).astype(dt) if xs else np.zeros(0, dt)
    data, layout = pack([
        ("seg_id", sel.astype(np.uint32)), ("kf_base", kf_base), ("kf_off", kf_off), ("ev_base", ev_base), ("ev_off", ev_off),
        ("kf_node", cat(kn_parts, np.uint16)), ("kf_time", cat(kt_parts, np.uint16)),
        ("ev_time", cat(et_parts, np.uint16)), ("ev_lane", cat(el_parts, np.uint8)),
    ])
    return data, layout, n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", default=f"{date.today():%Y%m%d}-1")
    ap.add_argument("--max-part-bytes", type=int, default=2_000_000)
    ap.add_argument("--src", type=Path, default=SRC)
    ap.add_argument("--out-root", type=Path, default=OUT_ROOT)
    a = ap.parse_args()

    meta, net_bytes, F = load(a.src)
    base = meta["t_base"]
    w0, w1 = meta["window"]
    segs = F["segs"].reshape(-1, 3)
    A = {
        "base": base,
        "kt_raw": F["kf_time"], "kt": F["kf_time"].astype(np.int64) + base, "kn": F["kf_node"],
        "s0": segs[:, 0].astype(np.int64), "s1": segs[:, 1].astype(np.int64),
        "evS": F["ev_start"].astype(np.int64), "evT_raw": F["ev_time"], "evT": F["ev_time"].astype(np.int64) + base, "evL": F["ev_lane"],
    }
    A["lcT"] = float(meta.get("lane_change_s", 2.5))
    A["st"] = A["kt"][A["s0"]]
    A["en"] = A["kt"][A["s1"] - 1]
    n_seg, n_trip = len(segs), meta["n_trips"]

    # 時段切法：資料時段前一段（拖尾用）＋等長時段；取最長（60 秒倍數）且每檔都 ≤ 上限的長度
    best = None
    for P in range(CHUNK_S * 8, CHUNK_S - 1, -CHUNK_S):
        bounds = [w0 - TRAIL_MAX_S] + list(range(w0, w1, P)) + [w1]
        parts = [build_part(A, bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
        mx = max(len(p[0]) for p in parts)
        print(f"  時段 {P} 秒：{len(parts)} 檔，最大 {mx / 1e6:.2f} MB")
        if mx <= a.max_part_bytes:
            best = (P, bounds, parts)
            break
    if best is None:
        raise SystemExit("找不到每檔都在上限內的切法")
    P, bounds, parts = best

    # 每段、每趟的靜態欄位（global id）
    seg_trip = segs[:, 2].astype(np.uint32)
    seg_start = (A["st"] - base).astype(np.uint16)
    seg_end = (A["en"] - base).astype(np.uint16)
    assert int(A["en"].max() - base) < 65536
    first = np.full(n_trip, 65535, np.int64); last = np.zeros(n_trip, np.int64)
    np.minimum.at(first, seg_trip, seg_start.astype(np.int64)); np.maximum.at(last, seg_trip, seg_end.astype(np.int64))
    segs_bin, segs_layout = pack([("trip", seg_trip), ("start", seg_start), ("end", seg_end)])
    trips_bin, trips_layout = pack([
        ("on", F["on"]), ("off", F["off"]), ("first", first.astype(np.uint16)), ("last", last.astype(np.uint16)),
        ("vt", F["vt"]), ("spd", F["spd"]), ("flags", F["flags"]),
    ])
    meta_out = {k: meta[k] for k in ("date", "window", "t_base", "n_trips", "names", "vt_codes", "peak_concurrent", "peak_time", "lane_change_s") if k in meta}
    meta_out["n_segs"] = n_seg
    meta_bytes = json.dumps(meta_out, ensure_ascii=False, separators=(",", ":")).encode()

    files = {"meta.json": meta_bytes, "network.json": net_bytes, "segs.bin": segs_bin, "trips.bin": trips_bin}
    part_entries = []
    for i, (data, layout, n) in enumerate(parts):
        name = f"parts/{i:03d}.bin"
        files[name] = data
        part_entries.append({"file": name, "t0": bounds[i], "t1": bounds[i + 1], "n_segs": n, "layout": layout})
    for name, data in files.items():
        if len(data) > a.max_part_bytes:
            raise SystemExit(f"{name} {len(data)} bytes 超過上限")

    src_sha = {f: sha((a.src / f).read_bytes()) for f in ("trips_meta.json", "network.json", "trips.bin")}
    bundle = {
        "schema": SCHEMA, "slug": SLUG, "bundle_version": a.version,
        "title": "雙北國道逐車模擬（推算）", "theme_group": "交通",
        "caliber": {
            "kind": "依 TDCS 門架通過紀錄推算的逐車軌跡，門架之間等速內插、車道與換道為模擬；非實測 GPS",
            "date": meta["date"], "window_s": meta["window"], "t_base": base,
            "time_unit": "自資料日 00:00（Asia/Taipei）起的秒數；u16 欄位為相對 t_base",
            "coverage": "雙北國道（國 1、國 3、國 5 等）OSM 主線＋匝道；範圍外的路段未涵蓋",
        },
        "scenarios": [{"id": f"{meta['date']}_pm", "name": "2026-09-28 16:00–18:00", "params": {"date": meta["date"], "window": meta["window"]}}],
        "layers": [{"id": "freewayTdcsSim", "geometry": "3d-custom", "files": "parts/{part}.bin", "join_key": "global seg id／trip id（本資料包內唯一）"}],
        "part_s": P, "trail_max_s": TRAIL_MAX_S,
        "segs_layout": segs_layout, "trips_layout": trips_layout,
        "parts": part_entries,
        "files": [{"name": n, "bytes": len(d), "sha256": sha(d)} for n, d in sorted(files.items())],
        "sources": [
            {"name": "交通部高速公路局 TDCS M06A（各旅次路徑原始資料）", "date": meta["date"]},
            {"name": "OpenStreetMap（國道主線＋匝道）", "license": "ODbL"},
            {"name": "內政部 20 m DTM（路面高程）"},
            {"name": "原型輸入", "files": src_sha},
        ],
        "privacy": {"owner_only": False, "omitted": "不含車牌或任何車輛識別碼；趟序號為資料包內流水號"},
    }
    bundle_bytes = json.dumps(bundle, ensure_ascii=False, indent=1).encode()

    out = a.out_root / a.version
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out} 已存在（版本不覆寫，請換 --version）")
    (out / "parts").mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        (out / name).write_bytes(data)
    (out / "bundle.json").write_bytes(bundle_bytes)
    (a.out_root / "current.json").write_text(json.dumps({"slug": SLUG, "bundle_version": a.version, "bundle_sha256": sha(bundle_bytes)}, indent=1))
    sizes = [len(d) for d in files.values()]
    print(f"完成：{out}（時段 {P} 秒，{len(parts)} 個時段檔；共 {len(files) + 1} 檔，{sum(sizes) / 1e6:.1f} MB，"
          f"單檔 {min(sizes) / 1e3:.0f} KB–{max(sizes) / 1e6:.2f} MB）")


if __name__ == "__main__":
    main()
