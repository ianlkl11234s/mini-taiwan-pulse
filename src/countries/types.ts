/**
 * 國家包的形狀（B1 P5a）。每國 `src/countries/<cc>/pack.ts` 預設匯出一個 `CountryPack`，
 * 由 codemod（scripts/layers/move-country-pack.ts）產生；只有 `packs.ts` 用動態 import 載入它。
 *
 * 有序登記簿（hosts／clicks／legends）以「插槽序號 → 條目」提供，序號對應靜態陣列裡的 `countrySlot(<cc>, n)`。
 * 以 key 為索引的登記簿（manifest、params…）整包併入。
 */
import type { CountryCode } from "../constants/countries";

type Rec = Readonly<Record<string, unknown>>;
type Slots = Readonly<Record<number, readonly unknown[]>>;

export interface CountryPack {
  country: CountryCode;
  /** 登記簿名稱 → 這國的條目（名稱見 slots.ts 的 extensibleRecord 呼叫處） */
  records: Readonly<Partial<Record<PackRecordName, Rec>>>;
  /** 有序登記簿名稱 → 插槽內容 */
  slots: Readonly<Partial<Record<PackListName, Slots>>>;
}

export type PackRecordName =
  | "layerManifest"
  | "layerParamsSpec"
  | "layerSourceInfo"
  | "layerNotes"
  | "layerSpecNotes"
  | "featurePanels"
  | "featureHeaderLabels"
  | "atlasFamilies";

export type PackListName = "layerHosts" | "gisClickLayers" | "legends" | "overlays";
