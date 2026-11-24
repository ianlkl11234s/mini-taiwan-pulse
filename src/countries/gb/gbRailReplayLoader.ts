/**
 * 英國列車重播資料載入（站主限定測試圖層）：owner-data 私人檔，同源 `/api/private-research/owner-data/<asset>`，
 * coral-private sidecar 驗站主 JWT（docs/features/owner-gated-layers「owner-data 家族」）；不進公開 CDN、不在 public/。
 * geometry（鐵軌線＋TIPLOC 座標）＋trips（2026-11-21 班次點序），gzip JSON 由 readOwnerJson 解壓；載入後建 5 分鐘桶索引。
 * 首次開啟才載入、包 fetchOwnerJson 的 loadingRegistry（CLAUDE.md §3）；結果快取在模組，popup 也從這裡讀。
 * 撤權（登出、換帳號）時 clearGbRailReplayCache() 清掉快取（由 hook 註冊 registerOwnerGateReset）。
 */
import { fetchOwnerJson } from "../../lib/ownerData";
import { buildGbRailReplayData, type GbRailGeometry, type GbRailReplayData, type GbRailTripsFile } from "./gbRailReplay";

/** 測試圖層只有這一天：不管時間軸日期，一律播這天（英國當地時分秒對應同一時刻）。 */
export const GB_RAIL_REPLAY_DATE = "2026-11-21";

let cache: Promise<GbRailReplayData> | null = null;
let loaded: GbRailReplayData | null = null;
let generation = 0;

export function loadGbRailReplay(): Promise<GbRailReplayData> {
  if (cache) return cache;
  const gen = generation;
  const p = (async () => {
    const [geometry, trips] = await Promise.all([
      fetchOwnerJson<GbRailGeometry>("gb-rail-replay-geometry", "gb-rail-replay:geometry", "英國列車重播：鐵軌"),
      fetchOwnerJson<GbRailTripsFile>("gb-rail-replay-trips-20261121", `gb-rail-replay:${GB_RAIL_REPLAY_DATE}`, "英國列車重播：班次"),
    ]);
    const data = buildGbRailReplayData(geometry, trips);
    if (gen === generation) loaded = data;
    return data;
  })();
  cache = p;
  p.catch(() => { if (cache === p) cache = null; });
  return p;
}

/** 已載入的資料（同步讀；尚未載入回 null）。 */
export function getGbRailReplayData(): GbRailReplayData | null {
  return loaded;
}

/** 撤權時清掉快取；進行中的請求回來也不寫入。 */
export function clearGbRailReplayCache(): void {
  generation += 1;
  cache = null;
  loaded = null;
}
