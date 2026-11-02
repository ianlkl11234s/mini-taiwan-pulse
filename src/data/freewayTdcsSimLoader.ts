/**
 * 雙北國道逐車模擬（本機研究層）資料載入：public/freeway_tdcs/ 的 trips_meta.json、network.json、trips.bin（約 15 MB）。
 * 只抓一次、整包解碼後快取；失敗清快取讓下次重試。
 */
import { withLoading } from "../lib/loadingRegistry";
import { FREEWAY_TDCS_SIM_DIR } from "./freewayTdcsSimTypes";
import { decodeFreewayTdcs, type FreewayTdcsData, type FreewayTdcsMeta, type FreewayTdcsNetwork } from "./freewayTdcsSimModel";

let pending: Promise<FreewayTdcsData> | null = null;

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res;
}

export function loadFreewayTdcsSim(): Promise<FreewayTdcsData> {
  if (!pending) {
    const base = `${import.meta.env.BASE_URL ?? "/"}${FREEWAY_TDCS_SIM_DIR.replace(/^\//, "")}`;
    const p = Promise.all([
      fetchOk(`${base}trips_meta.json`).then((r) => r.json() as Promise<FreewayTdcsMeta>),
      fetchOk(`${base}network.json`).then((r) => r.json() as Promise<FreewayTdcsNetwork>),
      fetchOk(`${base}trips.bin`).then((r) => r.arrayBuffer()),
    ]).then(([meta, net, bin]) => decodeFreewayTdcs(meta, net, bin));
    pending = withLoading("freewayTdcsSim", "國道逐車模擬", p);
    pending.catch(() => { pending = null; });
  }
  return pending;
}
