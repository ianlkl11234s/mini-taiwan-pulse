/**
 * 已搬進國家包（延後載入）的圖層 key 與 popup 類型聯集，只有型別（B1 P5a）。
 * 登記簿（manifest、params、popup 標題…）的靜態物件不含這些 key；型別仍要涵蓋，讓既有的型別護欄（Record<…> 完整）不弱化。
 * ⚠️ 型別有 key 不代表執行期有值：國家包沒載入前讀不到，一律經 `getLayerEntry`／`ensureCountryPack`。
 * codemod（scripts/layers/move-country-pack.ts）搬新國家時會在這裡加一行。
 */

export type PackLayerKey =
  | never;

export type PackPopupType =
  | never;
