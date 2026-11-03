/**
 * 雙北國道逐車模擬資料載入：trips_meta.json、network.json、trips.bin（合計約 31 MB）。
 * - 網址：先查靜態圖層資產索引（ADR-0024 §4，data.itsmigu.com/layers/v1/），key 為舊相對 URL
 *   `./freeway_tdcs/<檔名>`；索引沒有這筆（或載入失敗）就退回同源 `public/freeway_tdcs/`（本機開發）。
 *   走 CDN 時依索引驗 bytes 與 SHA-256。
 * - 只抓一次、整包解碼後快取；失敗清快取讓下次重試。
 */
import { withLoading } from "../lib/loadingRegistry";
import { loadLayerAssetIndex, resolveAssetUrl, sha256Hex } from "./layerAssetIndex";
import { FREEWAY_TDCS_SIM_DIR } from "./freewayTdcsSimTypes";
import { decodeFreewayTdcs, type FreewayTdcsData, type FreewayTdcsMeta, type FreewayTdcsNetwork } from "./freewayTdcsSimModel";

let pending: Promise<FreewayTdcsData> | null = null;

/** 索引 key（舊相對 URL）：`./freeway_tdcs/<檔名>` */
export function freewayTdcsAssetKey(file: string): string {
  return `.${FREEWAY_TDCS_SIM_DIR}${file}`;
}

async function fetchAsset(file: string): Promise<ArrayBuffer> {
  const r = resolveAssetUrl(freewayTdcsAssetKey(file));
  const url = r.source === "cdn"
    ? r.url
    : `${import.meta.env.BASE_URL ?? "/"}${FREEWAY_TDCS_SIM_DIR.replace(/^\//, "")}${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (r.source === "cdn") {
    if (bytes.byteLength !== r.entry.bytes) throw new Error(`${file} 大小與索引不符`);
    if (await sha256Hex(bytes) !== r.entry.sha256) throw new Error(`${file} SHA-256 與索引不符`);
  }
  return bytes;
}

const json = <T>(b: ArrayBuffer): T => JSON.parse(new TextDecoder().decode(b)) as T;

export function loadFreewayTdcsSim(): Promise<FreewayTdcsData> {
  if (!pending) {
    // 索引在開站時就開始載；這裡等它定案（失敗也 resolve），避免太早查表而誤用本機路徑
    const p = loadLayerAssetIndex().then(() => Promise.all([
      fetchAsset("trips_meta.json").then((b) => json<FreewayTdcsMeta>(b)),
      fetchAsset("network.json").then((b) => json<FreewayTdcsNetwork>(b)),
      fetchAsset("trips.bin"),
    ])).then(([meta, net, bin]) => decodeFreewayTdcs(meta, net, bin));
    pending = withLoading("freewayTdcsSim", "國道逐車模擬", p);
    pending.catch(() => { pending = null; });
  }
  return pending;
}
