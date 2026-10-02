#!/usr/bin/env python3
"""把 analytics 的 bridge-display-bundle 打包成站主限定私人資產（不進 public/、不 commit）。

用法：python3 scripts/preprocess/build-bridge-resilience-private.py <v3 bundle_dir> <out_dir> <decay_bridge_ranking.csv>
- 先用 bundle 的 receipt.json 驗每個輸入檔的 SHA-256 與大小，任何不符即中止。
  decay_bridge_ranking.csv（在 bridge-decay-findings 目錄）依 v3 receipt 的 decay_findings_receipt 鏈驗 SHA。
- bridges／replacement_routes／villages 三份 GeoJSON 打成一個 PMTiles（source-layer 同名）。
  v3：villages 圖層讀 villages_display.geojson（已扣除 OSM 水域），VILLCODE 順序與 villages.geojson 相同。
  villages 以 int(VILLCODE) 當 feature id，前端 feature-state 才能穩定對應（不依賴 promoteId）。
- bridge_summary.json、village_impacts.json、village_destinations.json、decay_village_impacts.json 原檔複製
  （走 sidecar 同家族的私人 Range 路由）。
- decay_summary.json 由 decay_bridge_ranking.csv 產出：τ=20 的指標與名次，加 τ=10／30 的影響名次（敏感度）。
- v2 bundle 的 bridges.geojson 已把 v1 的 77 個裸 NaN（無名匝道的 name）改成 null；這裡仍對 null／NaN 一律
  移除該屬性（無名就是沒有 name 欄位），其餘幾何與欄位不變。上游 SHA 仍以原檔驗證。
- 輸出 local_validation.json（三個資產的 size／sha256），供 sidecar 契約與上傳腳本核對。
需要 tippecanoe（brew install tippecanoe）。

v4（73 座：26 座人工複核＋47 座自動選入）：
  python3 scripts/preprocess/build-bridge-resilience-private.py --v4 <v4 bundle_dir> <out_dir> <decay_bridge_metrics.csv>
- bundle 依 v4 receipt 驗 SHA；decay_bridge_metrics.csv（bridge-decay-impacts-20261002-v2）以釘死的 SHA 驗
  （analytics git 追蹤的 _manifest.json）。PMTiles 作法與 v3 相同（tippecanoe 參數不變）；bridges 多 `validated`。
- decay_summary.json 由 metrics CSV 產出：v2 CSV 沒有名次欄，名次在「同 mode、單橋、在該 mode 路網內、影響 >0」
  的橋之間排（與 decay_rank_compare.json 的 n=64／65 同一母體），影響為 0 或不在路網的橋名次為 null。
  每個 mode 帶 `status`：ok／no_affected_od（模型算出沒有受影響起訖對，影響是真的 0）／
  not_in_mode_graph（該模式路網沒有此橋，數值全為 null，不是 0；CSV 的 0 不採用）。
- bundle 的 fingerprint.json（fingerprint v2）原檔複製為 bridge_fingerprint.json（沿用 sidecar 檔名）。
"""
import csv, hashlib, json, math, shutil, subprocess, sys
from pathlib import Path

PMTILES = "bridge-resilience-20261001-v3.pmtiles"
PMTILES_V4 = "bridge-resilience-20261002-v4.pmtiles"
DECAY_METRICS_V2_SHA256 = "55711751832ebfb8a210a6bfab8bc08524b6796b56babd65b14664361c3fbfd2"
FINGERPRINT = "bridge_fingerprint.json"
JSONS = ("bridge_summary.json", "village_impacts.json", "village_destinations.json", "decay_village_impacts.json")
DECAY_SUMMARY = "decay_summary.json"
MAIN_TAU = 20
SENSITIVITY_TAUS = (10, 30)


def num(text, digits=None):
    """CSV 空字串＝沒有值，回 None（不是 0）。"""
    if text is None or text == "":
        return None
    value = float(text)
    return round(value, digits) if digits is not None else value


def int_or_none(text):
    value = num(text)
    return None if value is None else int(round(value))


def build_decay_summary(csv_path: Path) -> dict:
    """每橋 × mode（含聯合情境）的距離遞減指標。聯合情境沒有名次（欄位為空）→ null。"""
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
    bridges: dict = {}
    for row in rows:
        tau = int(float(row["tau_min"]))
        mode = row["mode"]
        entry = bridges.setdefault(row["bridge_uid"], {"is_joint": row["is_joint"] == "True", "river": row["river"], "modes": {}})
        slot = entry["modes"].setdefault(mode, {})
        if tau == MAIN_TAU:
            slot.update({
                "decay_impact": num(row["decay_impact"], 0),
                "decay_mean_dT_per_trip": num(row["decay_mean_dT_per_trip"], 3),
                "pop_gt30s": int_or_none(row["pop_gt30s"]),
                "pop_gt60s": int_or_none(row["pop_gt60s"]),
                "decay_impact_rank": int_or_none(row["decay_impact_rank"]),
                "uniform_impact_rank": int_or_none(row["uniform_impact_rank"]),
                "top5_villages": [
                    {"VILLCODE": v["VILLCODE"], "county": v["county"], "town": v["town"], "village": v["village"],
                     "pop_hh": int(round(v["pop_hh"])), "decay_mean_dT_s": round(v["decay_mean_dT_s"], 1),
                     "contribution_person_s": round(v["contribution_person_s"])}
                    for v in json.loads(row["top5_villages"])
                ],
            })
        elif tau in SENSITIVITY_TAUS:
            slot[f"rank_tau{tau}"] = int_or_none(row["decay_impact_rank"])
    for entry in bridges.values():
        for slot in entry["modes"].values():
            if "decay_impact" not in slot:
                sys.exit("decay_bridge_ranking.csv 缺 tau=20 的列")
            for tau in SENSITIVITY_TAUS:
                slot.setdefault(f"rank_tau{tau}", None)
    return {
        "meta": {
            "source": "bridge-decay-findings-20261001-v1/decay_bridge_ranking.csv",
            "tau_min": MAIN_TAU,
            "sensitivity_tau_min": list(SENSITIVITY_TAUS),
            "weighting": "project-defined distance-decay w_ij = P_j * exp(-T0_ij / tau); tau 為假設值，非文獻公式",
            "fields": {
                "decay_impact": "影響（人·秒）= 村里人口 × 平均多花秒數 加總；顯示時除以 1e6 為百萬人·秒",
                "decay_mean_dT_per_trip": "每人每次多花（秒）",
                "pop_gt30s／pop_gt60s": "平均多花超過 30／60 秒的起點村里人口",
                "decay_impact_rank／uniform_impact_rank": "影響名次（同 mode 內單橋排名）：距離遞減／不分遠近；聯合情境不列名次 = null",
                "rank_tau10／rank_tau30": "τ=10／30 分鐘的影響名次（敏感度）",
                "top5_villages": "影響最大的 5 個村里（貢獻 人·秒 由大到小）",
            },
            "note": "free-flow 失效後果，不含壅塞；人口不等於出行需求；不是風險",
        },
        "bridges": {k: bridges[k] for k in sorted(bridges)},
    }


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_lenient(path: Path):
    """讀 GeoJSON；null／NaN 屬性一律移除（json 預設接受 NaN 字面值，回傳 float nan）。"""
    def fix(x):
        if isinstance(x, float) and math.isnan(x):
            return None
        return x
    data = json.loads(path.read_text(encoding="utf-8"))
    for f in data["features"]:
        f["properties"] = {k: fix(v) for k, v in f["properties"].items() if fix(v) is not None}
    return data


def verify_bundle(bundle: Path) -> dict:
    receipt = json.loads((bundle / "receipt.json").read_text(encoding="utf-8"))
    for name, meta in receipt["outputs"].items():
        p = bundle / name
        if not p.exists() or p.stat().st_size != meta["size_bytes"] or sha256(p) != meta["sha256"]:
            sys.exit(f"bundle 檔案與 receipt 不符：{name}")
    return receipt


def mode_status(entry: dict) -> str:
    """bridge_summary 的單橋 × mode 狀態：不在路網（全 null、沒有移除邊）／沒有受影響起訖對（損失真的是 0）／ok。"""
    if entry.get("accessibility_loss") is None and not entry.get("n_removed_edges"):
        return "not_in_mode_graph"
    if entry.get("accessibility_loss") == 0 and entry.get("p90_dT_s") is None:
        return "no_affected_od"
    return "ok"


def build_decay_summary_v4(csv_path: Path, summary: dict) -> dict:
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
    by = {(r["bridge_uid"], r["mode"], int(float(r["tau_min"]))): r for r in rows}
    bridges = {}
    for uid, b in summary["bridges"].items():
        entry = bridges.setdefault(uid, {"is_joint": bool(b["is_joint_scenario"]), "river": b["river"], "modes": {}})
        for mode, m in b["modes"].items():
            row = by.get((uid, mode, MAIN_TAU))
            if row is None:
                sys.exit(f"decay_bridge_metrics.csv 缺 {uid}|{mode} τ={MAIN_TAU}")
            status = mode_status(m)
            slot = {"status": status, "decay_impact_rank": None, "uniform_impact_rank": None,
                    **{f"rank_tau{t}": None for t in SENSITIVITY_TAUS}}
            if status == "not_in_mode_graph":
                slot.update({"decay_impact": None, "decay_mean_dT_per_trip": None, "pop_gt30s": None, "pop_gt60s": None, "top5_villages": []})
            else:
                slot.update({
                    "decay_impact": num(row["decay_impact"], 0),
                    "decay_mean_dT_per_trip": num(row["decay_mean_dT_per_trip"], 3),
                    "pop_gt30s": int_or_none(row["pop_gt30s"]),
                    "pop_gt60s": int_or_none(row["pop_gt60s"]),
                    "top5_villages": [
                        {"VILLCODE": v["VILLCODE"], "county": v["county"], "town": v["town"], "village": v["village"],
                         "pop_hh": int(round(v["pop_hh"])), "decay_mean_dT_s": round(v["decay_mean_dT_s"], 1),
                         "contribution_person_s": round(v["contribution_person_s"])}
                        for v in json.loads(row["top5_villages"] or "[]")
                    ],
                })
            entry["modes"][mode] = slot
    # 名次：同 mode、單橋、status=ok 且影響 >0（與 decay_rank_compare.json 同一母體）；由大到小。
    def rank(mode, tau, field):
        pool = []
        for uid, entry in bridges.items():
            slot = entry["modes"].get(mode)
            if entry["is_joint"] or not slot or slot["status"] != "ok":
                continue
            value = num(by[(uid, mode, tau)][field])
            if value is not None and value > 0:
                pool.append((value, uid))
        pool.sort(key=lambda x: (-x[0], x[1]))
        return {uid: i + 1 for i, (_, uid) in enumerate(pool)}
    for mode in ("car", "scooter"):
        main = rank(mode, MAIN_TAU, "decay_impact")
        uni = rank(mode, MAIN_TAU, "uniform_impact_sum")
        sens = {t: rank(mode, t, "decay_impact") for t in SENSITIVITY_TAUS}
        for uid, entry in bridges.items():
            slot = entry["modes"].get(mode)
            if not slot:
                continue
            slot["decay_impact_rank"] = main.get(uid)
            slot["uniform_impact_rank"] = uni.get(uid)
            for t in SENSITIVITY_TAUS:
                slot[f"rank_tau{t}"] = sens[t].get(uid)
    return {
        "meta": {
            "source": "bridge-decay-impacts-20261002-v2/decay_bridge_metrics.csv",
            "tau_min": MAIN_TAU,
            "sensitivity_tau_min": list(SENSITIVITY_TAUS),
            "weighting": "project-defined distance-decay w_ij = P_j * exp(-T0_ij / tau); tau 為假設值，非文獻公式",
            "fields": {
                "status": "ok／no_affected_od（模型算出沒有受影響起訖對，影響是真的 0）／not_in_mode_graph（該模式路網沒有此橋，數值 null，不是 0）",
                "decay_impact": "影響（人·秒）= 村里人口 × 平均多花秒數 加總；顯示時除以 1e6 為百萬人·秒",
                "decay_mean_dT_per_trip": "每人每次多花（秒）",
                "pop_gt30s／pop_gt60s": "平均多花超過 30／60 秒的起點村里人口",
                "decay_impact_rank／uniform_impact_rank": "影響名次（同 mode、單橋、status=ok 且影響 >0 之間排）：距離遞減／不分遠近；聯合情境、影響 0、不在路網 = null",
                "rank_tau10／rank_tau30": "τ=10／30 分鐘的影響名次（敏感度）",
                "top5_villages": "影響最大的 5 個村里（貢獻 人·秒 由大到小）",
            },
            "note": "free-flow 失效後果，不含壅塞；人口不等於出行需求；不是風險；73 座（26 座人工複核＋47 座自動選入、待複核）",
        },
        "bridges": {k: bridges[k] for k in sorted(bridges)},
    }


def main_v4(bundle: Path, out: Path, metrics_csv: Path):
    receipt = verify_bundle(bundle)
    if sha256(metrics_csv) != DECAY_METRICS_V2_SHA256:
        sys.exit("decay_bridge_metrics.csv 與 analytics _manifest 記錄的 SHA 不符")
    summary = json.loads((bundle / "bridge_summary.json").read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    build_pmtiles(bundle, out / PMTILES_V4)
    for name in JSONS:
        shutil.copyfile(bundle / name, out / name)
    shutil.copyfile(bundle / "fingerprint.json", out / FINGERPRINT)
    (out / DECAY_SUMMARY).write_text(
        json.dumps(build_decay_summary_v4(metrics_csv, summary), ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    write_validation(out, receipt, (PMTILES_V4, *JSONS, DECAY_SUMMARY, FINGERPRINT))


def main():
    if len(sys.argv) == 5 and sys.argv[1] == "--v4":
        return main_v4(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    bundle, out, ranking_csv = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    receipt = json.loads((bundle / "receipt.json").read_text(encoding="utf-8"))
    for name, meta in receipt["outputs"].items():
        p = bundle / name
        if not p.exists():
            continue  # README.md 可能只在 analytics 工作樹追蹤
        if p.stat().st_size != meta["size_bytes"] or sha256(p) != meta["sha256"]:
            sys.exit(f"bundle 檔案與 receipt 不符：{name}")
    # decay_bridge_ranking.csv 不在 bundle 內：v3 receipt → findings receipt → CSV 逐層驗 SHA。
    findings_receipt = ranking_csv.parent / "receipt.json"
    if sha256(findings_receipt) != receipt["inputs"]["decay_findings_receipt"]["sha256"]:
        sys.exit("decay findings receipt 與 v3 receipt 記錄不符")
    csv_meta = json.loads(findings_receipt.read_text(encoding="utf-8"))["outputs"][ranking_csv.name]
    if ranking_csv.stat().st_size != csv_meta["size_bytes"] or sha256(ranking_csv) != csv_meta["sha256"]:
        sys.exit("decay_bridge_ranking.csv 與 findings receipt 不符")
    out.mkdir(parents=True, exist_ok=True)
    build_pmtiles(bundle, out / PMTILES)
    for name in JSONS:
        shutil.copyfile(bundle / name, out / name)
    (out / DECAY_SUMMARY).write_text(
        json.dumps(build_decay_summary(ranking_csv), ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    write_validation(out, receipt, (PMTILES, *JSONS, DECAY_SUMMARY))


def build_pmtiles(bundle: Path, target: Path):
    out = target.parent
    tmp = out / "_build"
    tmp.mkdir(exist_ok=True)
    layers = []
    for layer in ("bridges", "replacement_routes", "villages"):
        src = bundle / ("villages_display.geojson" if layer == "villages" else f"{layer}.geojson")
        data = load_lenient(src)
        if layer == "villages":
            for f in data["features"]:
                f["id"] = int(f["properties"]["VILLCODE"])
        dst = tmp / f"{layer}.geojson"
        dst.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        layers += ["-L", f"{layer}:{dst}"]
    target.unlink(missing_ok=True)
    subprocess.run(["tippecanoe", "-o", str(target), "-Z8", "-z14", "--no-feature-limit", "--no-tile-size-limit",
                    "--detect-shared-borders", "-n", "bridge-resilience", "-q", *layers], check=True)
    shutil.rmtree(tmp)


def write_validation(out: Path, receipt: dict, names):
    validation = {
        "source_bundle": receipt["dataset_id"],
        "publication_status": receipt["publication_status"],
        "assets": {n: {"size": (out / n).stat().st_size, "sha256": sha256(out / n)} for n in names},
    }
    (out / "local_validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(validation, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
