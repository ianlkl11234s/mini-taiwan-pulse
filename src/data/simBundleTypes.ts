/**
 * 公開模擬資料家族（G28 P5，ADR-0025 sim_bundle）的讀取端型別。
 *
 * 發布端（pulse-data publisher）契約：
 *   `<root><slug>/current.json` → `{ bundle_version, bundle_sha256 }`
 *   `<root><slug>/<bundle_version>/bundle.json` → `SimBundleManifest`
 *   其他檔案 = `<root><slug>/<bundle_version>/<相對路徑>`，相對路徑只能來自 bundle.json 宣告或圖層規則（例：od/{speed}/{mode}/{origin}.u16）
 *
 * 私人實驗（橋梁韌性、公車擁擠）走站主 Range API，不在這個家族。
 */

export const SIM_BUNDLE_SCHEMA = "pulse-sim-bundle-v1";
export const DEFAULT_SIM_BUNDLE_ROOT = "https://data.itsmigu.com/sim/v1/";

export interface SimBundlePointer {
  bundle_version: string;
  /** bundle.json 的 sha256；有給就驗 */
  bundle_sha256?: string;
}

export interface SimBundleFileEntry {
  /** 相對版本根目錄的路徑 */
  name: string;
  bytes: number;
  sha256: string;
}

/** 大量同形檔（例：1,992 個 od 檔）另列一份清單檔，bundle.json 只記清單本身的 sha */
export interface SimBundleFileIndexRef {
  file: string;
  sha256: string;
  count?: number;
  total_bytes?: number;
}

export interface SimBundleManifest {
  schema: string;
  slug: string;
  bundle_version: string;
  title?: string;
  caliber?: Record<string, unknown>;
  layers?: Array<Record<string, unknown> & { id: string }>;
  files?: SimBundleFileEntry[];
  files_od?: SimBundleFileIndexRef;
  privacy?: { owner_only?: boolean };
  [key: string]: unknown;
}

export interface LoadedSimBundle {
  slug: string;
  version: string;
  /** 版本根目錄（結尾 `/`） */
  base: string;
  manifest: SimBundleManifest;
}

/** 錯誤分類：UI 依代碼顯示白話訊息（i18n `common.simBundle.error.<code>`），不靜默 */
export type SimBundleErrorCode = "not_found" | "http" | "timeout" | "network" | "sha_mismatch" | "size_mismatch" | "path" | "schema" | "not_listed";

export class SimBundleError extends Error {
  readonly code: SimBundleErrorCode;
  constructor(code: SimBundleErrorCode, message: string) {
    super(message);
    this.name = "SimBundleError";
    this.code = code;
  }
}

export type SimBundleStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; version: string }
  | { status: "error"; code: SimBundleErrorCode; message: string };
