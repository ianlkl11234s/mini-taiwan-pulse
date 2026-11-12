/**
 * 比較模式的統計圖層：左右可以不同「期別＋細項」，不能換指標（使用者 2026-11-11 Q2 (b)）。
 *
 * 選擇只存在 `regionalStatisticsStore`：
 * - 左側＝`key`（原本那份，會記在 localStorage）；
 * - 右側預設直接讀左側；使用者在右側選了不同的期別或細項才建立 `key::R`（不寫 localStorage）。
 * - 左側換指標（教育／勞動的「指標」、群組「指標／口徑」換圖層）→ 丟掉 `key::R`，右側回到跟左側一樣。
 * - 側別從「兩側（右側不同）」改成「只在右側」→ 先把右側的選擇寫回左側再丟掉 `key::R`，畫面不跳年份。
 *
 * 右側控制項（期別、細項）由左側的連動選單規格**派生**（`rightStatisticsSpecs`），provider 是
 * `statisticsRight`（`statisticsLinkedSelect.ts`）；不進 `LAYER_PARAMS_SPEC`，所以 Agent、場景存檔、黃金快照不受影響。
 */
import type { LinkedSelectParamSpec } from "../data/layerParamsSpec";
import { STATISTICS_RENDER_KEYS, isStatisticsRenderLayer, statisticsRenderRecipe } from "../data/regionalStatisticsRecipes";
import { statisticsCircleData } from "../map/statisticsCircles";
import { regionalStatisticsStore } from "./regionalStatisticsStore";
import { layerVisibilityStore } from "./layerVisibilityStore";
import { compareSideOf, compareStore, type CompareSide, type CompareState } from "./compareStore";
import { STATISTICS_RIGHT_PROVIDER, statisticsRightStoreKey } from "./statisticsLinkedSelect";
import { linkedSelectSnapshot, linkedSelectSpecs, restoreLinkedSelects } from "./linkedSelect";
import { STATISTICS_LINKED_PROVIDER } from "../data/statisticsParamsSpec";

export { statisticsRightStoreKey };

/** 右側有自己的選擇（與左側不同的期別／細項） */
export function hasRightSelection(key: string): boolean {
  return Boolean(regionalStatisticsStore.getSnapshot(statisticsRightStoreKey(key)).selection);
}

/** 右圖讀哪一份：兩側且右側選過＝`key::R`，否則＝左側那份 */
export function rightReadKey(key: string, snapshot: CompareState = compareStore.getSnapshot()): string {
  return compareSideOf(key, snapshot) === "both" && hasRightSelection(key) ? statisticsRightStoreKey(key) : key;
}

/** 比較中、兩側都畫、而且右側選了不同的期別／細項 */
export function compareSplitActive(key: string, snapshot: CompareState = compareStore.getSnapshot()): boolean {
  return snapshot.enabled && isStatisticsRenderLayer(key) && compareSideOf(key, snapshot) === "both" && hasRightSelection(key);
}

function dropRight(key: string) {
  const right = statisticsRightStoreKey(key);
  if (!regionalStatisticsStore.getSnapshot(right).selection) return;
  regionalStatisticsStore.disable(right);
  regionalStatisticsStore.setSelection(right, null);
}

/**
 * 比例圓的參考值：左右期別不同時兩張圖與圖例共用較大者（否則同一個圓大小在左右代表不同數量）。
 * 沒有分左右時回 undefined（＝用本圖自己的）。
 */
export function compareCircleReference(key: string, own: number | null): number | null | undefined {
  if (!compareSplitActive(key)) return undefined;
  const refs = [key, statisticsRightStoreKey(key)].map((storeKey) => {
    const data = regionalStatisticsStore.getSnapshot(storeKey).data;
    return data ? statisticsCircleData(data).reference : null;
  });
  const values = [own, ...refs].filter((value): value is number => typeof value === "number" && value > 0);
  return values.length ? Math.max(...values) : own;
}

/**
 * 圖例要不要拆左右兩段：只在右側細項造成色階門檻（或配色）不同時拆（使用者：「讓圖例單純一點」）。
 * 只差期別時色階由 recipe 固定門檻決定、跟期別無關，維持一份。
 */
export function compareLegendSplit(key: string, isDark: boolean): boolean {
  if (!compareSplitActive(key)) return false;
  const left = regionalStatisticsStore.getSnapshot(key).selection;
  const right = regionalStatisticsStore.getSnapshot(statisticsRightStoreKey(key)).selection;
  if (!left || !right || !isStatisticsRenderLayer(key)) return false;
  return legendScaleDiffers(
    statisticsRenderRecipe(key, left.indicatorId, left.dimensions, { isDark }),
    statisticsRenderRecipe(key, right.indicatorId, right.dimensions, { isDark }),
  );
}

/** 純函式：兩份 recipe 的色階門檻或配色是否不同 */
export function legendScaleDiffers(a: { breaks: readonly number[]; colors: readonly string[] }, b: { breaks: readonly number[]; colors: readonly string[] }): boolean {
  return JSON.stringify(a.breaks) !== JSON.stringify(b.breaks) || JSON.stringify(a.colors) !== JSON.stringify(b.colors);
}

/** 改側別（圖層展開區「顯示在」用；含右側選擇的搬移規則） */
export function setCompareSide(key: string, side: CompareSide): void {
  if (isStatisticsRenderLayer(key) && side === "right" && hasRightSelection(key)) {
    const selection = regionalStatisticsStore.getSnapshot(statisticsRightStoreKey(key)).selection!;
    regionalStatisticsStore.setSelection(key, selection);
    if (layerVisibilityStore.getVisibility(key)) void regionalStatisticsStore.load(key);
    dropRight(key);
  }
  compareStore.setSide(key, side);
}

/**
 * 左側換指標 → 丟掉右側的選擇（右側不能換成不同指標）。比較開著時才訂閱；回傳取消訂閱。
 */
export function startRightSelectionSync(): () => void {
  const check = (key: string) => {
    const right = regionalStatisticsStore.getSnapshot(statisticsRightStoreKey(key)).selection;
    if (!right) return;
    const left = regionalStatisticsStore.getSnapshot(key).selection;
    if (!left || left.datasetId !== right.datasetId || left.indicatorId !== right.indicatorId) dropRight(key);
  };
  const offs = STATISTICS_RENDER_KEYS.map((key) => regionalStatisticsStore.subscribe(key, () => check(key)));
  STATISTICS_RENDER_KEYS.forEach(check);
  return () => offs.forEach((off) => off());
}

// ── 右側控制項規格（派生） ──────────────────────────────────────────

const RIGHT_SUFFIX = "Right";

/**
 * 右側的期別／細項列：從左側統計連動選單派生（同 field、同依賴順序），去掉「指標」列；
 * name 加 `Right` 後綴、provider 換成 `statisticsRight`。標籤沿用左側中文，面板加「右側」前綴。
 */
export function rightStatisticsSpecs(key: string): LinkedSelectParamSpec[] {
  const left = linkedSelectSpecs(key).filter((spec) => spec.provider === STATISTICS_LINKED_PROVIDER && spec.field !== "metric");
  const kept = new Set(left.map((spec) => spec.name));
  return left.map((spec, index) => ({
    ...spec,
    name: `${spec.name}${RIGHT_SUFFIX}`,
    provider: STATISTICS_RIGHT_PROVIDER,
    dependsOn: spec.dependsOn.filter((name) => kept.has(name)).map((name) => `${name}${RIGHT_SUFFIX}`),
    primary: index === 0 ? true : undefined,
  }));
}

/** 左側期別／細項列（不含指標）——網址記錄與「左側」前綴用 */
export function leftStatisticsSpecs(key: string): LinkedSelectParamSpec[] {
  return linkedSelectSpecs(key).filter((spec) => spec.provider === STATISTICS_LINKED_PROVIDER && spec.field !== "metric");
}

// ── 分享網址（cmpdl／cmpdr）──────────────────────────────────────────

/** 控制項 name 去掉 layerKey 前綴（與 `Right` 後綴）＝網址裡的後綴 */
function urlSuffix(key: string, name: string): string {
  const base = name.endsWith(RIGHT_SUFFIX) ? name.slice(0, -RIGHT_SUFFIX.length) : name;
  return base.startsWith(key) ? base.slice(key.length) : base;
}

/** 某側目前的期別／細項值（{ 後綴 → 值 }）；沒有值的列略過 */
export function compareSelectionValues(key: string, side: "left" | "right"): Record<string, string> {
  const specs = side === "left" ? leftStatisticsSpecs(key) : rightStatisticsSpecs(key);
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const value = linkedSelectSnapshot(key, spec).value;
    if (value) out[urlSuffix(key, spec.name)] = value;
  }
  return out;
}

/**
 * 網址要記的比較中統計層：開著、比較中。左側一律記（看網址的人 localStorage 可能記著別的期別），
 * 右側只在選了與左側不同的期別／細項時記（只記非預設）。
 */
export function compareSelectionsForUrl(): { left?: Record<string, Record<string, string>>; right?: Record<string, Record<string, string>> } {
  const snapshot = compareStore.getSnapshot();
  if (!snapshot.enabled) return {};
  const left: Record<string, Record<string, string>> = {};
  const right: Record<string, Record<string, string>> = {};
  const visibility = layerVisibilityStore.getAll() as unknown as Record<string, boolean>;
  for (const key of STATISTICS_RENDER_KEYS) {
    if (!visibility[key]) continue;
    const values = compareSelectionValues(key, "left");
    if (Object.keys(values).length) left[key] = values;
    if (compareSplitActive(key, snapshot)) {
      const rightValues = compareSelectionValues(key, "right");
      if (Object.keys(rightValues).length) right[key] = rightValues;
    }
  }
  return { ...(Object.keys(left).length ? { left } : {}), ...(Object.keys(right).length ? { right } : {}) };
}

function bySpecName(key: string, values: Readonly<Record<string, string>>, specs: LinkedSelectParamSpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const value = values[urlSuffix(key, spec.name)];
    if (value !== undefined) out[spec.name] = value;
  }
  return out;
}

/**
 * 分享網址還原：先左後右；每一列等選項載入、驗證值仍存在才套用（不存在＝保留目前選擇並回報略過）。
 * 不是統計圖層的 key 略過。
 */
export async function restoreCompareSelections(
  left: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
  right: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
): Promise<string[]> {
  const skipped: string[] = [];
  const pick = (input: typeof left, specsOf: (key: string) => LinkedSelectParamSpec[]) => Object.fromEntries(
    Object.entries(input ?? {}).filter(([key]) => isStatisticsRenderLayer(key)).map(([key, values]) => [key, bySpecName(key, values, specsOf(key))]),
  );
  skipped.push(...await restoreLinkedSelects(pick(left, leftStatisticsSpecs)));
  skipped.push(...await restoreLinkedSelects(pick(right, rightStatisticsSpecs), 20_000, rightStatisticsSpecs));
  return skipped;
}
