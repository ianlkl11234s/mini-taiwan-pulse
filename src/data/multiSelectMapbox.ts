/**
 * 分類多選給 Mapbox 用的共用橋接。
 *
 * overlayParams 只能傳 numeric scalar；options 的穩定順序對應 bit 位元。
 * JavaScript 位元運算是 signed 32-bit，故保守限制在 30 類，避免 bit 31 的符號位
 * 造成全選與最高類別的行為不透明。
 */
export const MULTI_SELECT_BITMASK_MAX_OPTIONS = 30;

export function assertMultiSelectBitmaskCapacity(optionValues: readonly unknown[]): void {
  if (optionValues.length > MULTI_SELECT_BITMASK_MAX_OPTIONS) {
    throw new RangeError(
      `分類多選 bitmask 最多支援 ${MULTI_SELECT_BITMASK_MAX_OPTIONS} 類，目前為 ${optionValues.length} 類`,
    );
  }
}

export function allMultiSelectBitmask(optionValues: readonly unknown[]): number {
  assertMultiSelectBitmaskCapacity(optionValues);
  return (1 << optionValues.length) - 1;
}

export function selectedMultiSelectValues(
  mask: number,
  optionValues: readonly string[],
): string[] {
  assertMultiSelectBitmaskCapacity(optionValues);
  const normalizedMask = Number.isFinite(mask) ? Math.trunc(mask) : 0;
  return optionValues.filter((_, index) => (normalizedMask & (1 << index)) !== 0);
}

/** 選項全開時仍限制在有分類欄位的 feature；全關使用不可能的分類 sentinel。 */
export function multiSelectFilter(
  property: string,
  mask: number,
  optionValues: readonly string[],
): unknown[] {
  const selected = selectedMultiSelectValues(mask, optionValues);
  if (selected.length === 0) return ["==", ["get", property], "__multi_select_none__"];
  if (selected.length === optionValues.length) return ["has", property];
  return ["in", ["get", property], ["literal", selected]];
}

/**
 * 供既有 opacity-filter renderer 使用。全開保留 scalar opacity；部分或全關時
 * 用 case 讓不在選取集合的 feature 完全透明，避免改變既有圖層/source 重建策略。
 */
export function multiSelectOpacityExpression(
  property: string,
  mask: number,
  optionValues: readonly string[],
  opacity: number,
): number | unknown[] {
  const selected = selectedMultiSelectValues(mask, optionValues);
  if (selected.length === optionValues.length) return opacity;
  if (selected.length === 0) return 0;
  return ["case", ["in", ["get", property], ["literal", selected]], opacity, 0];
}
