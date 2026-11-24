/**
 * 已搬進國家包（延後載入）的圖層 key 與 popup 類型聯集，只有型別（B1 P5a）。
 * 登記簿（manifest、params、popup 標題…）的靜態物件不含這些 key；型別仍要涵蓋，讓既有的型別護欄（Record<…> 完整）不弱化。
 * ⚠️ 型別有 key 不代表執行期有值：國家包沒載入前讀不到，一律經 `getLayerEntry`／`ensureCountryPack`。
 * codemod（scripts/layers/move-country-pack.ts）搬新國家時會在這裡加一行。
 */

import type { CnLayerKey } from "./cn/keys";
import type { GbLayerKey } from "./gb/keys";
import type { IeLayerKey } from "./ie/keys";
import type { KrLayerKey } from "./kr/keys";
import type { CaLayerKey } from "./ca/keys";
import type { ThLayerKey } from "./th/keys";
import type { PhLayerKey } from "./ph/keys";
import type { VnLayerKey } from "./vn/keys";
export type PackLayerKey =
  | never
  | CnLayerKey
  | GbLayerKey
  | IeLayerKey
  | KrLayerKey
  | CaLayerKey
  | ThLayerKey
  | PhLayerKey
  | VnLayerKey;

import type { CnPopupType } from "./cn/popupTypes";
import type { GbPopupType } from "./gb/popupTypes";
import type { IePopupType } from "./ie/popupTypes";
import type { KrPopupType } from "./kr/popupTypes";
import type { CaPopupType } from "./ca/popupTypes";
import type { ThPopupType } from "./th/popupTypes";
import type { PhPopupType } from "./ph/popupTypes";
import type { VnPopupType } from "./vn/popupTypes";
export type PackPopupType =
  | never
  | CnPopupType
  | GbPopupType
  | IePopupType
  | KrPopupType
  | CaPopupType
  | ThPopupType
  | PhPopupType
  | VnPopupType;
