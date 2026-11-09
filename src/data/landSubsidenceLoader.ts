import { cachedByKey } from "../lib/loaderCache";
import { staticRpcFile } from "./staticRpc";

/**
 * 地層下陷單站時序（G19 測站 popup 趨勢圖）。
 *
 * 來源：靜態快照 `/static-rpc/get_land_subsidence_timeseries_<站號 UTF-8 hex>.json`（2026-11-09 起，ADR-0026），
 *   內容＝gis-platform migration 474 `public.get_land_subsidence_timeseries(站號, null, null, 'month')` 原樣輸出
 *   （該站最新一筆往回 10 年；month 桶）。站號含 `:`、`(` 等字元，檔名用 hex 編碼；
 *   匯出見 scripts/export/export-static-rpc-snapshots.sh `@land_subsidence`。缺檔明確失敗、不回退 RPC。
 *   value_kind：elevation_m（GNSS 橢球高 m）／ring_compression_mm（磁環，depth_layer_m＝環號）／
 *   pile_compression_unspecified（深層樁，單位上游未註明）。
 * bucket_start 是 date 字串（上游 observed_at 為台灣當地字面時間；月桶不受時區影響），不做 +8 換算。
 */
export interface LandSubsidenceRow {
  bucket_start: string;
  depth_layer_m: number | null;
  value: number;
  n: number;
  value_kind: "elevation_m" | "ring_compression_mm" | "pile_compression_unspecified";
}

/** 站號 → 快照檔名用的 UTF-8 hex（與匯出腳本 `xxd -p` 相同） */
export function landSubsidenceStationFileId(stationId: string): string {
  return Array.from(new TextEncoder().encode(stationId), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchUncached(stationId: string): Promise<LandSubsidenceRow[]> {
  const fileId = landSubsidenceStationFileId(stationId);
  const { data, error } = await staticRpcFile<LandSubsidenceRow[]>(`/static-rpc/get_land_subsidence_timeseries_${fileId}.json`);
  if (error) throw new Error(`get_land_subsidence_timeseries(${stationId}): ${error.message}`);
  return ((data ?? []) as LandSubsidenceRow[]).map((row) => ({
    ...row,
    value: Number(row.value),
    depth_layer_m: row.depth_layer_m == null ? null : Number(row.depth_layer_m),
  })).filter((row) => Number.isFinite(row.value));
}

const cached = cachedByKey(fetchUncached, 30 * 60_000);

/** 單站 10 年月均時序；30 分快取（資料年更）。 */
export function fetchLandSubsidenceTimeseries(stationId: string): Promise<LandSubsidenceRow[]> {
  return cached(stationId);
}
