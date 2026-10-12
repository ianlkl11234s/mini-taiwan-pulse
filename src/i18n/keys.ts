/**
 * 翻譯 key 的型別。key 打錯字 → `npx tsc -b` 直接紅，不會等到畫面上露出 key 才發現。
 *
 * 靜態 key：來自預設語系（zh-TW）的介面字串檔，由 `npx tsx scripts/i18n/gen-keys.ts`
 * 產生到 keys.generated.ts（改了 zh-TW JSON 就重跑；`localeParity` 測試會擋過期）。
 *
 * 動態 key：key 由資料組出來的命名空間（圖層 key、主題字串、類別代碼…），型別只能檢查前綴。
 * 這些命名空間不會被「沒人用的 key」測試誤判。
 */
import type { GeneratedStaticKey } from "./keys.generated";

/** key 由資料組出的命名空間。新增前先想：能不能改成靜態 key？ */
export const DYNAMIC_NAMESPACES = [
  "layer", // 圖層名，layers.json，key = manifest key
  "theme", // 主題／子群標題，themes.json，key = 原始字串
  "qualifier", // 圖層限定詞，qualifiers.json
  "macro", // 側欄大分類
  "panel", // 側欄面板（panel.<id>.title／short）
  "basemap", // 底圖名稱（basemap.<styleId>）
  "enum", // 資料類別代碼（enum.<domain>.<code>），見 dataText.ts
  "popupHeader", // 說明框標題（popupHeader.<layerType>），popupHeaders.json；多數借用 layer.*，這裡只放對不到圖層的
] as const;

export type DynamicNamespace = (typeof DYNAMIC_NAMESPACES)[number];

export type StaticMessageKey = GeneratedStaticKey;

export type MessageKey = StaticMessageKey | `${DynamicNamespace}.${string}`;

