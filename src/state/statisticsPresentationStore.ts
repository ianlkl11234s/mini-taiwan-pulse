/**
 * 統計圖層呈現方式的執行期規則（設計提案 Q-A「幾個統計圖層同時開時」）。
 *
 * 值本身在 layerParamsStore（`<key>Presentation`，由 `statisticsPresentation.ts` 規格產生），這裡只管：
 *   - **同時最多一層非面量圖（比例圓或點密度）**：任何寫入來源（面板、`pm=` 分享網址、場景還原、Agent）把第二層
 *     切到比例圓／點密度時，其他比例圓／點密度層自動回面量圖；規則放在 store 訂閱，不放在面板 onChange，所有寫入者都一致。
 *     （兩層點密度疊在一起分不出哪個點是哪一層；比例圓疊點密度同理。）
 *   - 被改回的層若正開著，在「新的那一層」控制區顯示一行說明（`statisticsPresentationNote`）。
 * 每層各自選；面量圖可以同時好幾層（照「單一／可重疊」模式）。
 */
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe, type StatisticsRenderKey } from '../data/regionalStatisticsRecipes';
import { presentationParamName, resolvePresentationMode, statisticsPresentationDefault, statisticsPresentationSpec, type StatisticsPresentationMode } from '../data/statisticsPresentation';
import { statisticsTitle } from '../i18n/statisticsText';
import type { LocaleSnapshot } from './localeStore';
import { layerParamsStore } from './layerParamsStore';
import { layerVisibilityStore } from './layerVisibilityStore';
import { regionalStatisticsStore } from './regionalStatisticsStore';

/** 有「呈現方式」控制項的統計 key（可切比例圓／點密度） */
export const PRESENTATION_KEYS: readonly StatisticsRenderKey[] = STATISTICS_RENDER_KEYS.filter((key) => statisticsPresentationSpec(key));
const PRESENTATION_KEY_SET = new Set<string>(PRESENTATION_KEYS);

export function isPresentationKey(key: string): boolean {
  return PRESENTATION_KEY_SET.has(key);
}

/** 目前呈現方式（沒有控制項的層一律面量圖） */
export function statisticsPresentationMode(key: string): StatisticsPresentationMode {
  if (!PRESENTATION_KEY_SET.has(key)) return 'choropleth';
  return resolvePresentationMode(key, layerParamsStore.getParam(key, presentationParamName(key)));
}

/** 用比例圓或點密度（非面量圖）的層 */
const circleKeys = () => PRESENTATION_KEYS.filter((key) => statisticsPresentationMode(key) !== 'choropleth');

/** 新的比例圓／點密度層 → 被改回面量圖、而且當時開著的層 */
const notes = new Map<string, readonly string[]>();
let holder: string | null = circleKeys()[0] ?? null;
let enforcing = false;

function enforceSingleCircle() {
  if (enforcing) return;
  const circles = circleKeys();
  for (const key of [...notes.keys()]) if (!circles.includes(key as StatisticsRenderKey)) notes.delete(key);
  if (circles.length <= 1) { holder = circles[0] ?? null; return; }
  // 剛切成比例圓／點密度的那一層（不是原本的持有者）留下；同時進來好幾層（網址、場景）時留第一個新的
  const winner = circles.find((key) => key !== holder) ?? circles[circles.length - 1]!;
  const losers = circles.filter((key) => key !== winner);
  const visible = losers.filter((key) => layerVisibilityStore.getVisibility(key));
  if (visible.length) notes.set(winner, visible); else notes.delete(winner);
  holder = winner;
  enforcing = true;
  try {
    layerParamsStore.setManyDirect(losers.map((key) => ({ key, name: presentationParamName(key), value: 'choropleth' })));
  } finally { enforcing = false; }
}

layerParamsStore.subscribe(enforceSingleCircle);

/**
 * 控制區說明列：「已把〇〇改回面量圖（比例圓與點密度同時只能有一層）」。只在新那一層的「呈現方式」那一列。
 * 不傳 i18n（Agent、黃金快照）時回中文。
 */
export function statisticsPresentationNote(key: string, name: string, i18n?: Pick<LocaleSnapshot, 'active' | 'lookup' | 't'>): string | undefined {
  if (name !== presentationParamName(key)) return undefined;
  const demoted = notes.get(key);
  if (!demoted?.length) return undefined;
  const names = demoted.map((other) => {
    const zh = statisticsRenderRecipe(other as StatisticsRenderKey).label;
    return i18n ? statisticsTitle(other, zh, i18n) : zh;
  }).join('、');
  return i18n ? i18n.t('paramsPanel.presentationDemoted', { names }) : `已把「${names}」改回面量圖（比例圓與點密度同時只能有一層）`;
}

/**
 * 分享網址 `pm=`：只記開著、而且不是預設呈現方式的層（`<key>:<mode>`，逗號分隔）。
 */
export function presentationUrlEntries(visible: (key: string) => boolean): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const key of PRESENTATION_KEYS) {
    if (!visible(key)) continue;
    const mode = statisticsPresentationMode(key);
    if (mode !== statisticsPresentationDefault(key)) out[key] = mode;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 套用網址的 `pm=`：key 與模式都要在推導出的可選清單內，不合法的略過（urlState 只驗格式）。 */
export function applyPresentationUrlEntries(entries: Readonly<Record<string, string>> | undefined): void {
  if (!entries) return;
  const writes: { key: string; name: string; value: string }[] = [];
  for (const [key, mode] of Object.entries(entries)) {
    const spec = PRESENTATION_KEY_SET.has(key) ? statisticsPresentationSpec(key) : null;
    if (!spec || !spec.options.some((option) => option.value === mode)) continue;
    writes.push({ key, name: spec.name, value: mode });
  }
  if (writes.length) layerParamsStore.setManyDirect(writes);
}

/** 測試用 */
export function resetStatisticsPresentationNotes(): void {
  notes.clear();
  holder = circleKeys()[0] ?? null;
}

/**
 * 比例圓要畫成空心嗎：有其他開著、已載入、用面量圖的統計層（例：65 歲以上占比面量圖＋戶籍人口數比例圓），
 * 空心圓才不會蓋掉底下的顏色。地圖與圖例共用這一支。
 */
export function statisticsCircleHollow(key: string): boolean {
  return STATISTICS_RENDER_KEYS.some((other) => other !== key && layerVisibilityStore.getVisibility(other)
    && regionalStatisticsStore.getSnapshot(other).data && statisticsPresentationMode(other) === 'choropleth');
}
