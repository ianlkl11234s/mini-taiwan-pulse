/**
 * 雙北國道逐車模擬資料載入（ADR-0025 模擬資料包，slug `freeway_tdcs`）。
 * - 來源：`https://data.itsmigu.com/sim/v1/freeway_tdcs/`（current.json → bundle.json → 各檔，全部驗 sha256，見 simBundle.ts）。
 *   DEV 讀不到 CDN 時退回本機 `public/freeway_tdcs/sim/`（scripts/preprocess/build-freeway-tdcs-sim-bundle.py 的輸出，同結構）。
 * - 開圖層先載共用檔（meta、network、segs、trips，約 3 MB）；trips 依模擬時間切成 5 分鐘一檔，
 *   播到哪載到哪：目前這塊（含拖尾往前的秒數）需要的時段檔＋下一檔預載，合併成一份 FreewayTdcsData。
 * - 每次抓取都經 loadSimFile 掛 loadingRegistry；錯誤寫進 simBundleStatus 並往上拋。
 */
import { withLoading } from "../lib/loadingRegistry";
import { fetchSimBundle, loadSimFile, loadSimJson, reportSimBundleError } from "./simBundle";
import type { LoadedSimBundle } from "./simBundleTypes";
import { FREEWAY_TDCS_SIM_DIR } from "./freewayTdcsSimTypes";
import {
  FREEWAY_TDCS_CHUNK_S, decodeFreewayTdcsBase, decodeFreewayTdcsPart, mergeFreewayTdcsParts,
  type FreewayTdcsBase, type FreewayTdcsData, type FreewayTdcsLayout, type FreewayTdcsMeta, type FreewayTdcsNetwork,
  type FreewayTdcsPart, type FreewayTdcsPartInfo,
} from "./freewayTdcsSimModel";

export const FREEWAY_TDCS_SIM_SLUG = "freeway_tdcs";
const LABEL = "國道逐車模擬";

export interface FreewayTdcsSim {
  bundle: LoadedSimBundle;
  base: FreewayTdcsBase;
  parts: FreewayTdcsPartInfo[];
  /** 資料實際從哪裡來（除錯與驗收用） */
  source: "cdn" | "local";
}

interface BundleExtras { parts?: FreewayTdcsPartInfo[]; segs_layout?: FreewayTdcsLayout; trips_layout?: FreewayTdcsLayout }

/** 本機備援根目錄（DEV）：public/freeway_tdcs/sim/ */
function localRoot(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return new URL(`${base}${FREEWAY_TDCS_SIM_DIR.replace(/^\//, "")}sim/`, window.location.origin).href;
}

async function openBundle(): Promise<{ bundle: LoadedSimBundle; source: "cdn" | "local" }> {
  try {
    return { bundle: await fetchSimBundle(FREEWAY_TDCS_SIM_SLUG), source: "cdn" };
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    console.warn("[freewayTdcsSim] CDN 資料包讀不到，DEV 改讀本機 public/freeway_tdcs/sim/", error);
    return { bundle: await fetchSimBundle(FREEWAY_TDCS_SIM_SLUG, localRoot()), source: "local" };
  }
}

let simPending: Promise<FreewayTdcsSim> | null = null;

/** 開資料包並載共用檔（只做一次；失敗清快取讓下次重試） */
export function loadFreewayTdcsSim(): Promise<FreewayTdcsSim> {
  if (!simPending) {
    const p = (async () => {
      const { bundle, source } = await withLoading(`sim-bundle-${FREEWAY_TDCS_SIM_SLUG}`, LABEL, openBundle());
      const extra = bundle.manifest as unknown as BundleExtras;
      if (!extra.parts?.length || !extra.segs_layout || !extra.trips_layout) throw new Error("bundle.json 缺 parts／segs_layout／trips_layout");
      const [meta, net, segs, trips] = await Promise.all([
        loadSimJson<FreewayTdcsMeta>(bundle, "meta.json", LABEL),
        loadSimJson<FreewayTdcsNetwork>(bundle, "network.json", LABEL),
        loadSimFile(bundle, "segs.bin", LABEL),
        loadSimFile(bundle, "trips.bin", LABEL),
      ]);
      const base = decodeFreewayTdcsBase(meta, net, segs, extra.segs_layout, trips, extra.trips_layout);
      return { bundle, base, parts: [...extra.parts].sort((a, b) => a.t0 - b.t0), source };
    })();
    simPending = p;
    p.catch((error) => { simPending = null; reportSimBundleError(FREEWAY_TDCS_SIM_SLUG, "bundle", error); });
  }
  return simPending;
}

/** 時間 t 落在哪個時段檔（[t0, t1)；超出範圍夾到頭尾） */
export function freewayTdcsPartAt(parts: readonly FreewayTdcsPartInfo[], t: number): number {
  let lo = 0, hi = parts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (parts[mid]!.t0 <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

/**
 * 目前時間需要的時段檔範圍 [lo, hi]：本塊（60 秒）＋往前拖尾秒數，再多一檔預載。
 * 資料時段外回 null（不載）。
 */
export function freewayTdcsNeededParts(sim: FreewayTdcsSim, t: number, trail: number): [number, number] | null {
  const { winStart, winEnd } = { winStart: sim.base.meta.window[0], winEnd: sim.base.meta.window[1] };
  if (!(t >= winStart && t <= winEnd)) return null;
  const c0 = winStart + Math.floor((Math.min(t, winEnd - 1e-6) - winStart) / FREEWAY_TDCS_CHUNK_S) * FREEWAY_TDCS_CHUNK_S;
  const lo = freewayTdcsPartAt(sim.parts, c0 - Math.max(trail, 1));
  const hi = freewayTdcsPartAt(sim.parts, Math.min(c0 + FREEWAY_TDCS_CHUNK_S, winEnd) - 1e-6);
  return [lo, Math.min(hi + 1, sim.parts.length - 1)];
}

// ── 時段檔管理（模組級；圖層只有一個） ──
const decoded = new Map<number, FreewayTdcsPart>();
const inflight = new Set<number>();
let mergedKey = "";
let gen = 0;
let lastRequest: { sim: FreewayTdcsSim; t: number; trail: number; onData: (D: FreewayTdcsData) => void } | null = null;

/**
 * 依目前時間載入／合併時段檔。有新的合併結果才呼叫 onData（換資料、重畫）。
 * 由 hook 的 timeStore 訂閱驅動（不進 React deps）。
 */
export function ensureFreewayTdcsWindow(sim: FreewayTdcsSim, t: number, trail: number, onData: (D: FreewayTdcsData) => void): void {
  lastRequest = { sim, t, trail, onData };
  const need = freewayTdcsNeededParts(sim, t, trail);
  if (!need) return;
  const [lo, hi] = need;
  for (let i = lo; i <= hi; i++) {
    if (decoded.has(i) || inflight.has(i)) continue;
    inflight.add(i);
    const info = sim.parts[i]!;
    loadSimFile(sim.bundle, info.file, LABEL).then((bin) => {
      decoded.set(i, decodeFreewayTdcsPart(info, bin));
    }, (error) => {
      console.warn(`[freewayTdcsSim] 時段檔 ${info.file} 載入失敗`, error);
    }).finally(() => {
      inflight.delete(i);
      const r = lastRequest;
      if (r) ensureFreewayTdcsWindow(r.sim, r.t, r.trail, r.onData);
    });
  }
  // 已解碼但離目前很遠的檔丟掉（原始位元組仍在 simBundle 的檔案快取，跳回來不必重抓）
  for (const i of decoded.keys()) if (i < lo - 1 || i > hi + 1) decoded.delete(i);
  // 合併：含目前時間那一檔、在需要範圍內、連續已載入的一段
  const h = freewayTdcsPartAt(sim.parts, Math.min(t, sim.base.meta.window[1] - 1e-6));
  if (!decoded.has(h)) return;   // 目前這檔還在載：沿用舊資料（圖層會判斷時段沒涵蓋而先不畫）
  let a = h, b = h;
  while (a - 1 >= lo && decoded.has(a - 1)) a--;
  while (b + 1 <= hi && decoded.has(b + 1)) b++;
  const key = `${a}-${b}`;
  if (key === mergedKey) return;
  mergedKey = key;
  const parts: FreewayTdcsPart[] = [];
  for (let i = a; i <= b; i++) parts.push(decoded.get(i)!);
  onData(mergeFreewayTdcsParts(sim.base, parts, ++gen));
}

/** 關圖層：清掉時段檔狀態（共用檔留著） */
export function resetFreewayTdcsWindow(): void {
  decoded.clear(); mergedKey = ""; lastRequest = null;
}
