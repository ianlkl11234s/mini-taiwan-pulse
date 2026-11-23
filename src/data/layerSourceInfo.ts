/**
 * 圖層來源表：layer key → 機關、授權、連結、資料時點（站主 2026-11-23 決定）。
 *
 * 資料來源與資料說明放在圖層的「說明・來源」（LayerInfoLine → DataSourceCard）；popup 與圖例只放使用者需要的資料。
 * - DataSourceCard：資料目錄（metadata.data_catalog）有機關／授權就用目錄，缺欄、沒有條目、載入中或載入失敗時補用本表。
 * - popup：圖層側已有機關＋授權的圖層不再掛來源列；逐筆來源不同的圖層留一行精簡來源（`popupSourceMode`）。
 *
 * 資料在 ./layerSourceInfo.data.ts（`from: "popup"` 搬自 popup 原有常數；`from: "catalog"` 取自資料目錄 md）。
 */
import type { MessageKey } from "../i18n/keys";
import type { Locale } from "../i18n/locales";
import { LAYER_MANIFEST } from "./layerManifest";
import { LAYER_SOURCE_INFO_DATA } from "./layerSourceInfo.data";

/** 原文字串、既有 i18n key（可帶變數），或三語各自的原文。 */
export type SourceText =
  | string
  | { key: MessageKey; vars?: Record<string, SourceText> }
  | { "zh-TW": SourceText; en: SourceText; ja: SourceText };

export interface LayerSourceInfo {
  /** 機關／署名（政府資料必標機關；OSM 為 ODbL 署名） */
  org: SourceText;
  /** 授權；沒有 = 來源未標示授權，顯示「授權未明示」 */
  license?: SourceText;
  /** 原始下載頁 */
  url?: string;
  /** 出處／供應商頁（與下載頁不同時） */
  attributionUrl?: string;
  /** 固定的資料時點／版本（每筆都一樣的那種，逐筆時間留在 popup） */
  asOf?: SourceText;
  /** 每筆都一樣的資料說明（從 popup／圖例搬來的固定備註、方法說明、涵蓋限制） */
  notes?: SourceText[];
  /** 本列出處：popup 原有常數或資料目錄 md */
  from: "popup" | "catalog";
}

interface TextContext {
  active: Locale;
  lookup: (key: MessageKey, vars?: Record<string, string | number>) => string | null;
}

export function resolveSourceText(text: SourceText, ctx: TextContext): string {
  if (typeof text === "string") return text;
  if ("key" in text) {
    const vars: Record<string, string> = {};
    for (const [name, value] of Object.entries(text.vars ?? {})) vars[name] = resolveSourceText(value, ctx);
    return ctx.lookup(text.key, vars) ?? "";
  }
  const own = resolveSourceText(text[ctx.active as "zh-TW" | "en" | "ja"] ?? text["zh-TW"], ctx);
  return own || resolveSourceText(text["zh-TW"], ctx);
}

export const LAYER_SOURCE_INFO: Readonly<Record<string, LayerSourceInfo>> = LAYER_SOURCE_INFO_DATA;

export function getLayerSourceInfo(layerKey: string): LayerSourceInfo | null {
  return LAYER_SOURCE_INFO[layerKey] ?? null;
}

/**
 * 圖層側是否已涵蓋 popup 原本的來源資訊：有機關，且有授權——
 * 或本列搬自 popup 常數而 popup 原本就沒有授權（拿掉 popup 來源列不會少資訊，圖層側顯示「授權未明示」）。
 */
export function layerSourceCovered(layerKey: string): boolean {
  const info = LAYER_SOURCE_INFO[layerKey];
  return Boolean(info && (info.license != null || info.from === "popup"));
}

/**
 * 逐筆來源不同的 popup layerType：每筆的機關、連結或授權跟著 feature 走（依來源欄切換、
 * 多源 provenance、郵遞區號定位的 ONSPD 署名、逐案資料集等），popup 保留一行精簡來源。
 */
export const POPUP_PER_FEATURE_SOURCE = new Set<string>([
  // 台灣：逐筆資料集／機關／授權
  "regionalStatistic", "councilDistricts2026", "tideSwellAlert", "landslideEventCatalog", "countyWelfarePoints",
  "evMotorcycleCharging", "countyStreetlights", "waterQualityStations", "disasterShelters", "nationalParks", "medicalPOI",
  // 多源 provenance／逐筆機關
  "gasStationCanonical", "typhoonTrack", "typhoonAgencyForecast", "lightningStrike", "fireHydrant",
  "religionTemples", "religionChurches", "religionAncestralHalls", "religionFoundations", "religionOtherWorship", "religionTop100",
  // 日本：逐筆年份署名、多源住宿
  "jpDid", "jpAccommodationCanonical", "jpAccommodationJta", "jpAccommodationLocal", "jpAccommodationOsm",
  // 菲律賓 OpenAQ：每站授權不同
  "phOpenaqAir",
  // 英國：依來源欄切換機關／連結，或郵遞區號定位加註 ONSPD
  "gbSmallAreaBoundaries", "gbRivers", "gbHydroStations", "gbFloodDefenceAssets", "gbCoastalErosionRisk", "gbBathingWaters",
  "gbTransportHubs", "gbStationUsage", "gbMajorRoads", "gbRoadFacilities", "gbWoodland", "gbProtectedAreas", "gbMarineProtectedAreas",
  "gbForestRecreation", "gbOpenAccessLand", "gbTreeProtection", "gbTrails", "gbArtsVenues", "gbCulturalFacilities", "gbVisitorExperience",
  "gbCareHomes", "gbCareServices", "gbCourts", "gbFireStations", "gbHealthFacilities", "gbSchools",
  "gbPlanningConstraints", "gbAquaculture", "gbWastePermits", "gbNoise",
]);

const POPUP_TO_LAYER_KEYS: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [key, entry] of Object.entries(LAYER_MANIFEST as Record<string, { popup?: string | string[] | null }>)) {
    const popup = entry.popup;
    for (const layerType of popup == null ? [] : Array.isArray(popup) ? popup : [popup]) {
      const keys = map.get(layerType);
      if (keys) keys.push(key);
      else map.set(layerType, [key]);
    }
  }
  return map;
})();

export function layerKeysForPopup(layerType: string): readonly string[] {
  return POPUP_TO_LAYER_KEYS.get(layerType) ?? [];
}

/**
 * popup 來源列的顯示方式：
 * - `none`：圖層側已涵蓋（用到這個 popup 的每個圖層都有機關＋授權），popup 不放來源。
 * - `compact`：逐筆來源不同，留一行機關（＋連結）；圖層側沒授權時一併帶授權。
 * - `full`：圖層側還補不到（沒有圖層或來源表沒有機關＋授權），沿用一行機關＋連結＋授權。
 */
export type PopupSourceMode = "none" | "compact" | "full";

export function popupSourceMode(layerType: string): PopupSourceMode {
  const keys = layerKeysForPopup(layerType);
  const covered = keys.length > 0 && keys.every(layerSourceCovered);
  if (POPUP_PER_FEATURE_SOURCE.has(layerType)) return covered ? "compact" : "full";
  return covered ? "none" : "full";
}
