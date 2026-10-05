#!/usr/bin/env python3
"""Generate per-layer ingestion decisions from actual manifests/catalog, no remote IO."""
import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

LIVE_DATASETS = {
    "pla_activity", "ncdr_alerts", "lightning_taipower", "lightning_cwa",
    "nuclear_radiation_taipower", "celestrak_satellites", "water.uswg_measurements",
    "waste_positions_realtime", "opensky_flights", "bus_realtime", "road_event",
    "power_generation", "usgs_earthquakes_global", "jma_typhoon_positions",
    "noaa_gfs_wind_forecast", "cmems_ocean_forecast", "cams_atmosphere_forecast",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analytics-dir", required=True)
    parser.add_argument("--warehouse-dir", required=True)
    parser.add_argument("--baseline", required=True)
    args = parser.parse_args()
    docs = Path(__file__).resolve().parents[2] / "docs/features/general-analysis"
    root = Path(args.analytics_dir)
    manifests = defaultdict(list)
    for path in sorted((root / "data/processed").rglob("_manifest.json")):
        data = json.loads(path.read_text())
        files = [{"name": item.get("name"), "exists": (path.parent / item.get("name", "")).is_file(), "rows": item.get("rows"), "crs": item.get("crs"), "geometry_type": item.get("geometry_type")} for item in data.get("files", [])]
        manifests[data.get("dataset_id", path.parent.name)].append({"path": str(path.relative_to(root)), "files": files, "provenance": data.get("provenance"), "notes": data.get("notes"), "last_updated": data.get("last_updated")})
    catalog = defaultdict(list)
    for entry in json.loads((Path(args.warehouse_dir) / "catalog.json").read_text()):
        catalog[entry["dataset_id"]].append(entry)
    overrides = json.loads((docs / "layer-status-overrides.json").read_text())
    rows = list(csv.DictReader((docs / "layer-status.csv").open()))
    baseline = {row["layer_key"]: row for row in csv.DictReader(Path(args.baseline).open())}
    decisions = {}
    for row in rows:
        key, status = row["layer_key"], row["l2_analysis"]
        if status not in ("none", "browser_reader", "display_only") and baseline.get(key, {}).get("l2_analysis") not in ("none", "browser_reader", "display_only"):
            continue
        ids = row["dataset_ids"].split()
        source_manifests = [manifest for dataset_id in ids for manifest in manifests.get(dataset_id, [])]
        warehouse_entries = [entry for dataset_id in ids for entry in catalog.get(dataset_id, [])]
        override = overrides.get(key, {})
        reason = row["blocker"] or "本機倉庫已建表；逐表來源／store 驗證另見 receipts。"
        unlock = "核對來源 SHA、逐檔與合併筆數、CRS／geometry、抽三筆原座標並重建，通過本機 pulse_sql 後才認列 L2。"
        category = "C"
        if status in ("spatial", "statistics", "attribute"):
            category, unlock = "A", "本機已解鎖；发布仍需審閱來源授權、upload plan 並由使用者執行 execute。"
        elif override.get("class") == "live_only" or set(ids) & LIVE_DATASETS or key in ("rail", "aqiStations", "aqiMicroSensors"):
            category = "D"
            reason += "；此層時間變動的觀測／位置或軌道推算尚無對應倉庫時間窗。衛星需保留 TLE epoch、傳播模型與推算時間，推算位置不可標 actual。"
            unlock = "以 UTC [start,end) 時間窗匯出事件／觀測原列（建議先 24 小時，日資料先 30 日），保留 event time、fetched_at、freshness、NULL／0、來源與位置精度；固定站位置可另做設施快照，但不得取代即時數值。"
        elif row["blocker"] == "derived_layer":
            category = "D"
            reason += f'；輸入 datasets={row.get("source_datasets") or "未宣告"}，layers={row.get("source_layers") or "未宣告"}；輸入可查不等於衍生結果已物化。'
            unlock = "將輸入來源版本、filter、演算法參數與時間窗一併記入 lineage，重現並物化衍生輸出，保留精度／coverage 後建 manifest；或以既有倉庫來源查詢重算。"
        elif override.get("class") in ("display_only", "unclear") or row["source_kind"] in ("raster", "raster-dem") or key in ("canopyHeight", "urbanHeat", "hillshade", "slopeVector", "aspectVector", "cwaCloudImagery", "cwaRadarImagery", "precipRaster", "aqiImagery", "jpCanopyHeight"):
            category = "D"
            unlock = "純視覺／影像不認列向量分析；若需分析，取得具授權、原始數值、像元 CRS／nodata 的獨立資料，定義區域聚合與時間窗並保留來源粒度後入倉。無 consumer 的 toggle 需先補實際來源／loader。"
        elif any(entry["status"] in ("FAILED", "SKIPPED_FORMAT") for entry in warehouse_entries):
            category = "B"
            issues = [{"dataset_id": entry["dataset_id"], "status": entry["status"], "issues": entry.get("issues", [])} for entry in warehouse_entries]
            reason += "；具體建置原因見 warehouse_evidence.issues。"
            if any(issue.get("code") == "SOURCE_MISSING" for entry in warehouse_entries for issue in entry.get("issues", [])):
                unlock = "恢復 warehouse_evidence 指定的真實來源檔（fixture 不得代替正式資料），或經來源對照修 manifest 路徑；驗 SHA／筆數／CRS後重建。不從其他來源猜測或造座標。"
        elif override.get("class") == "snapshot_candidate":
            reason += "；來源現況與檔案可達性見 manifest_evidence。"
            unlock += " 僅 owner 本機分析保留既有 NON_COMMERCIAL_ONLY／HOLD_LICENSE／LICENSE_UNVERIFIED／HOLD_GEOMETRY；公開發布另審。"
        if not source_manifests and category == "C":
            reason += f'；analytics 沒有對應 manifest：{" ".join(ids) or "未宣告 dataset"}。'
            unlock = "先核對現有 dataset 是否為同一來源／粒度／幾何；同源才補 alias。否則取得本機可達的原始向量／表格並建立 manifest，保留授權與版次；新授權狀態不明維持 HOLD。"
        decisions[key] = {"category": category, "baseline_status": baseline.get(key, {}).get("l2_analysis"), "current_status": status, "reason": reason, "unlock": unlock, "source_datasets": row.get("source_datasets", ""), "source_layers": row.get("source_layers", ""), "manifest_evidence": source_manifests, "warehouse_evidence": [{"dataset_id": entry["dataset_id"], "table": entry["table"], "rows": entry["rows"], "status": entry["status"], "issues": entry.get("issues", [])} for entry in warehouse_entries], "manifest_layer_evidence": f"src/data/layerManifest.ts key={key}", "override": override or None}
    target = docs / "warehouse-coverage-decisions-20261005.json"
    target.write_text(json.dumps({"generated_at": "2026-10-05", "analytics_dir": str(root), "warehouse_dir": args.warehouse_dir, "category_rules": {"A": "本機已解鎖／可直接入倉", "B": "修建置器或來源缺檔", "C": "補 analytics manifest／同源別名", "D": "DISPLAY_ONLY／live_only／未物化 derived"}, "counts": dict(Counter(value["category"] for value in decisions.values())), "layers": decisions}, ensure_ascii=False, indent=2) + "\n")
    remaining = [row for row in rows if row["l2_analysis"] in ("none", "browser_reader", "display_only")]
    assert all(decisions[row["layer_key"]]["reason"] and decisions[row["layer_key"]]["unlock"] for row in remaining)
    print(f"decisions={len(decisions)} remaining={len(remaining)} reason_and_unlock={len(remaining)} {dict(Counter(value['category'] for value in decisions.values()))}")


if __name__ == "__main__":
    main()
