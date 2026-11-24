/**
 * 國家包載入（B1 P5a，2026-11-24）。設計：.gis-agent-system B1-DESIGN.md §3。
 *
 * 外國圖層的完整登記（manifest、params、sourceInfo、Host、popup、圖例…）放在 `src/countries/<cc>/pack.ts`，
 * 只經這裡的動態 import 載入；開站只帶索引（layerIndex.generated.ts）。需要某國圖層的地方一律先
 * `await ensureCountryPack(cc)`：國家選單、釘選、並排右國、分享連結、會員場景、Agent 開圖層…
 * 需要全部國家細節的（MCP 配對、AI 對話、資料來源總覽、搜尋細節、測試）用 `loadAllPacks()`。
 *
 * ⚠️ 本檔只能被靜態 import 的輕量模組：不得靜態 import 任何 `./<cc>/` 底下的執行期模組（lint 擋）。
 */
import { useEffect, useSyncExternalStore } from "react";
import type { CountryCode } from "../constants/countries";
import { countryDef } from "../constants/countries";
import { withLoading } from "../lib/loadingRegistry";
import ZH_COMMON from "../i18n/locales/zh-TW/common.json";
import { extendRecord, fillSlots } from "./slots";
import type { CountryPack, PackListName, PackRecordName } from "./types";

/** 有國家包的國家 → 動態 import。沒列的國家（TW、其他還沒搬的國家）登記一直都在，不用等。 */
const PACK_LOADERS: Partial<Record<CountryCode, () => Promise<{ default: CountryPack }>>> = {
  CN: () => import("./cn/pack"),
  GB: () => import("./gb/pack"),
  // <codemod:pack-loaders>
};

/** 註冊順序：manifest 先（其他登記簿的訂閱者會讀它），有序登記簿最後（Host 掛上時規格都已就緒）。 */
const RECORD_ORDER: readonly PackRecordName[] = [
  "layerManifest", "layerParamsSpec", "layerSourceInfo", "layerNotes", "layerSpecNotes",
  "featurePanels", "featureHeaderLabels", "atlasFamilies",
];
const LIST_ORDER: readonly PackListName[] = ["legends", "gisClickLayers", "layerHosts"];

export type PackStatus = "none" | "idle" | "loading" | "ready" | "error";

const status = new Map<CountryCode, PackStatus>();
const inflight = new Map<CountryCode, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const l of listeners) l();
}

export function packCountries(): CountryCode[] {
  return Object.keys(PACK_LOADERS) as CountryCode[];
}

export function hasCountryPack(cc: CountryCode): boolean {
  return Boolean(PACK_LOADERS[cc]);
}

/** 這國的登記是否可用（沒有國家包的國家一律 true）。 */
export function isCountryPackReady(cc: CountryCode): boolean {
  return !PACK_LOADERS[cc] || status.get(cc) === "ready";
}

export function countryPackStatus(cc: CountryCode): PackStatus {
  if (!PACK_LOADERS[cc]) return "none";
  return status.get(cc) ?? "idle";
}

function registerPack(pack: CountryPack): void {
  for (const name of RECORD_ORDER) {
    const rec = pack.records[name];
    if (rec && Object.keys(rec).length) extendRecord(name, rec);
  }
  for (const name of LIST_ORDER) {
    const slots = pack.slots[name];
    if (slots) fillSlots(name, pack.country, slots);
  }
}

/** 載入標籤：「載入〈國名〉圖層清單」（國名取 zh-TW 字典；loadingRegistry 標籤全站都是中文）。 */
export function packLoadingLabel(cc: CountryCode): string {
  const name = (ZH_COMMON as Record<string, string>)[countryDef(cc).labelKey] ?? cc;
  return `載入${name}圖層清單`;
}

/**
 * 確保某國的登記已載入。同一國並發呼叫共用同一個 Promise；失敗後再呼叫會重試。
 * 沒有國家包的國家立即 resolve。
 */
export function ensureCountryPack(cc: CountryCode): Promise<void> {
  const loader = PACK_LOADERS[cc];
  if (!loader || status.get(cc) === "ready") return Promise.resolve();
  const running = inflight.get(cc);
  if (running) return running;
  status.set(cc, "loading");
  emit();
  // 效能量測（DevTools Performance／performance.getEntriesByName）：國家包從開始抓到登記完成
  globalThis.performance?.mark?.(`country-pack:${cc}:start`);
  const p = withLoading(`country-pack:${cc}`, packLoadingLabel(cc), loader())
    .then((mod) => {
      registerPack(mod.default);
      status.set(cc, "ready");
      globalThis.performance?.mark?.(`country-pack:${cc}:ready`);
    })
    .catch((err: unknown) => {
      status.set(cc, "error");
      console.error(`[countryPack] ${cc} 載入失敗`, err);
      throw err;
    })
    .finally(() => {
      inflight.delete(cc);
      emit();
    });
  inflight.set(cc, p);
  return p;
}

/** 多國一起（平行抓）。 */
export function ensureCountryPacks(codes: Iterable<CountryCode>): Promise<void> {
  return Promise.all([...new Set(codes)].map((cc) => ensureCountryPack(cc))).then(() => undefined);
}

/** 全部國家包（MCP 配對、AI 對話、資料來源總覽、搜尋細節、測試）。 */
export function loadAllPacks(): Promise<void> {
  return ensureCountryPacks(packCountries());
}

/** 開發與測試：不等 Promise，直接看是否全部就緒。 */
export function allPacksReady(): boolean {
  return packCountries().every((cc) => status.get(cc) === "ready");
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function subscribeCountryPacks(l: () => void): () => void {
  return subscribe(l);
}

/** 國家包狀態版本（任何一國開始／完成／失敗都 +1）；React 讀者用它重算登記簿衍生值。 */
export function useCountryPackVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

/**
 * 需要全部國家細節的畫面（搜尋結果、資料來源總覽）：`active` 時載入全部國家包，回傳版本號（載完重新 render）。
 */
export function useAllCountryPacks(active: boolean): number {
  useEffect(() => {
    if (active) void loadAllPacks().catch(() => undefined);
  }, [active]);
  return useCountryPackVersion();
}

export function useCountryPackStatus(cc: CountryCode): PackStatus {
  return useSyncExternalStore(subscribe, () => countryPackStatus(cc), () => countryPackStatus(cc));
}
