/**
 * 英日文翻譯檔的分批載入規則（B1 P6，2026-11-25；設計：.gis-agent-system B1-DESIGN.md §4）。
 *
 * zh-TW 不受影響：整包同步打包（站主決定中文開站行為不變）。
 * 英日文改成：
 * - 開站只載 `BOOT_FILES`（面板、時間軸、台灣圖層名…畫面一打開就要的字）；
 * - 外國圖層名 `layers.<cc>.json` 跟著國家包一起載（packs.ts 的 `ensureCountryPack`）；
 * - 其餘（統計說明、設定面板、說明框、圖例…）第一次查不到字時才載，由 `filesForKey` 找出 key 在哪個檔。
 *
 * 查字規則：key 的第一段是命名空間（`enum` 對到 `enums` 檔族）。先找 `<檔族>.<第二段>.json`，
 * 沒有就找 `<檔族>.json`；對不到檔名的（多數 `enum.*`）查 `localeFileIndex.generated.ts`。
 * `localeFiles.test.ts` 逐 key 驗證每個英日文 key 都找得到自己的檔，新檔或新 key 對不到時紅燈。
 */
import { LOCALE_FILE_INDEX } from "./localeFileIndex.generated";

/**
 * 英日文開站就載的檔（不含副檔名）。挑選依據：`?lang=en` 開台灣面板時實際查過的檔
 * （開發模式 `window.__localeFilesLoaded` 可看）。外國圖層名不在這裡，跟著國家包走。
 */
export const BOOT_FILES: readonly string[] = [
  "common",
  "layers",
  "themes",
  "qualifiers",
  "timeline",
  "longTerm",
  "compare",
  "alerts",
  "intel",
  "smallMultiples",
  "statisticsSelect",
];

/** 命名空間 → 檔族（檔名前綴）。沒列的命名空間＝同名檔族。 */
const FAMILY: Readonly<Record<string, string>> = {
  enum: "enums",
  layer: "layers",
  param: "params",
  theme: "themes",
  qualifier: "qualifiers",
  popupHeader: "popupHeaders",
};

/** 外國圖層名檔：`layers.<cc>`（cc 小寫）。 */
export function countryLayerFile(cc: string): string {
  return `layers.${cc.toLowerCase()}`;
}

/**
 * 依 key 找出它所在的翻譯檔（不含副檔名）。`exists` 判斷某語系有沒有這個檔。
 * `layer.<key>` 不在這裡處理（外國圖層名依國家，由國家包載入；台灣的在開站檔），回空陣列。
 */
export function filesForKey(key: string, exists: (file: string) => boolean): readonly string[] {
  if (key.startsWith("layer.")) return [];
  return LOCALE_FILE_INDEX[keyPrefix(key)] ?? ruleFilesForKey(key, exists);
}

/** key 的前兩段（`enum.jpWelfareCategory.x` → `enum.jpWelfareCategory`）；索引以此為 key。 */
export function keyPrefix(key: string): string {
  const dot = key.indexOf(".");
  const second = dot > 0 ? key.indexOf(".", dot + 1) : -1;
  return second > 0 ? key.slice(0, second) : key;
}

/** 只用檔名規則找檔（不查索引）；產生索引的腳本用它判斷哪些前綴需要登記。 */
export function ruleFilesForKey(key: string, exists: (file: string) => boolean): readonly string[] {
  const dot = key.indexOf(".");
  if (dot <= 0) return [];
  const ns = key.slice(0, dot);
  const family = FAMILY[ns] ?? ns;
  const second = key.indexOf(".", dot + 1);
  const sub = second > 0 ? `${family}.${key.slice(dot + 1, second)}` : null;
  if (sub && exists(sub)) return [sub];
  return exists(family) ? [family] : [];
}
