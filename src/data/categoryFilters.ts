/**
 * V-4 分類篩選（map-layers.md §3.8）的規格表與共用運算：圖例是名目類別（≥2 類）的圖層，
 * 設定面板加「類別」多選。機制沿用既有的分類多選（`multiSelect` ＋ bitmask `out`，同南韓 `${key}CatMask`）：
 *   規格（本表）→ `layerParamsSpec`（產 multiSelect，out＝`${key}${id}Mask`）
 *               → `overlayRegistry` 的 `withCategoryFilter`（把篩選併進該圖層全部子圖層的 filter）。
 * 只有「registry 圖層」靠表自動接線；自建 hook 圖層用 `categoryFilterExpr` 在 hook 內自己套 filter。
 *
 * 選項順序＝bitmask 位元順序，改順序會讓舊的分享網址/儲存值錯位，新增請加在最後。
 */
import { allMultiSelectBitmask, assertMultiSelectBitmaskCapacity } from "./multiSelectMapbox";

export interface CategoryOption {
  /** 圖磚／GeoJSON 屬性的值；多個值合成一個選項（例：圖例把兩種原值畫同色）時給陣列 */
  value: string | readonly string[];
  /** 中文標籤（照圖例）；英日文寫在 `locales/<語系>/params.json` 的 `param.<中文>` */
  zh: string;
}

export interface CategoryFilterDef {
  /** 分類屬性名 */
  property: string;
  /** 控件編號，同一層有第二組篩選時才給（預設 "Cat"，out＝`${key}CatMask`） */
  id?: string;
  /** 控件標題（中文），預設「類別」 */
  label?: string;
  options: readonly CategoryOption[];
  /** 圖例有「其他／未分類」：不在 options 內的值（含缺值）合成最後一個選項，值固定為 `__other__` */
  other?: string;
}

export const CATEGORY_OTHER_VALUE = "__other__";

export function categoryDefs(entry: CategoryFilterDef | readonly CategoryFilterDef[]): readonly CategoryFilterDef[] {
  return Array.isArray(entry) ? entry : [entry as CategoryFilterDef];
}

/** 控件參數名（multiSelect.name）：`${key}${id}`，id 預設 "Cat" */
export function categoryParamName(key: string, def: CategoryFilterDef): string {
  return `${key}${def.id ?? "Cat"}`;
}

/** overlayParams 的 key（bitmask） */
export function categoryMaskKey(key: string, def: CategoryFilterDef): string {
  return `${categoryParamName(key, def)}Mask`;
}

export function categoryOptionId(option: CategoryOption): string {
  return typeof option.value === "string" ? option.value : option.value[0]!;
}

/** multiSelect 的選項（value＝選項代表值；`other` 在最後） */
export function categoryParamOptions(def: CategoryFilterDef): { label: string; value: string }[] {
  const out = def.options.map((o) => ({ label: o.zh, value: categoryOptionId(o) }));
  if (def.other) out.push({ label: def.other, value: CATEGORY_OTHER_VALUE });
  assertMultiSelectBitmaskCapacity(out);
  return out;
}

function valuesOf(option: CategoryOption): string[] {
  return typeof option.value === "string" ? [option.value] : [...option.value];
}

/**
 * 類別篩選運算式。全選回 `null`（不加篩選，連缺值的 feature 也照畫）；全關回恆假；
 * 部分選取：`to-string` 比對，使布林／數字屬性也通用。
 */
export function categoryFilterExpr(def: CategoryFilterDef, mask?: number): unknown[] | null {
  const ids = categoryParamOptions(def).map((o) => o.value);
  const all = allMultiSelectBitmask(ids);
  const m = mask === undefined || !Number.isFinite(mask) ? all : Math.trunc(mask) & all;
  if (m === all) return null;
  const valueExpr = ["to-string", ["get", def.property]];
  if (m === 0) return ["==", ["get", def.property], "__multi_select_none__"];
  const selected: string[] = [];
  def.options.forEach((o, i) => { if (m & (1 << i)) selected.push(...valuesOf(o)); });
  const otherOn = def.other !== undefined && (m & (1 << def.options.length)) !== 0;
  if (!otherOn) return ["in", valueExpr, ["literal", selected]];
  // 「其他」＝不在任何已列選項內（含缺值）；只排除「已列出但未選」的值
  const unselected: string[] = [];
  def.options.forEach((o, i) => { if (!(m & (1 << i))) unselected.push(...valuesOf(o)); });
  return ["!", ["in", valueExpr, ["literal", unselected]]];
}

import { CATEGORY_FILTERS_A } from "./categoryFilters/groupA";
import { CATEGORY_FILTERS_B } from "./categoryFilters/groupB";
import { CATEGORY_FILTERS_C } from "./categoryFilters/groupC";

/** key → 類別篩選規格（registry 圖層自動接線） */
export const CATEGORY_FILTERS: Readonly<Record<string, CategoryFilterDef | readonly CategoryFilterDef[]>> = {
  ...CATEGORY_FILTERS_A,
  ...CATEGORY_FILTERS_B,
  ...CATEGORY_FILTERS_C,
};
