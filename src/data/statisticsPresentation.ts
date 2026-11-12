/**
 * 統計圖層「呈現方式」（設計提案 Q-A 方案 2、Q-B 方案 1、Q-C 照表；2026-11-11 使用者拍板）。
 *
 * 每個統計 render key 由 recipe 的 `unit`／`aggregation`／名稱**自動推導**可選的呈現方式，預設一律面量圖；
 * 站主逐層覆寫寫在 `presentationOverrides.ts`（recipe JSON 由 analytics 交付產生，不在那裡改）。
 *
 * 適用規則（docs/statistics-layer-guidelines.md §7、map-layers.md §3.10 K-6）：
 *   - 面量圖：全部。
 *   - 比例圓：總量（人、件、處、公頃、元…），而且不會有負值；比率、每十萬人、密度、中位數、平均、
 *     有正負號（自然增加、淨遷徙、變動）、類別碼一律不給。
 *   - 點密度：比例圓可用、而且是「一個一個數得出來」的人／件／戶，只在鄉鎮與村里層（縣市太大）；
 *     據點數（處、所、站…）已有真實點位圖層，不給。撒點規則見 `map/statisticsDots.ts`。
 *
 * 規則故意保守：判斷不了的一律只給面量圖（用錯呈現方式會讓地圖說錯話）。
 */
import { STATISTICS_RECIPES, isStatisticsLayer, statisticsBaseKey, type StatisticsRenderKey } from './regionalStatisticsRecipes';
import { getAtlasRecipe } from './atlasStatisticsRecipes';
import { getEnvironmentRecipe } from './environmentStatisticsRecipes';
import { getAddictionRecipe } from './addictionStatisticsRecipes';
import { getLandslideRecipe } from './landslideStatisticsRecipes';
import { getLaborStatisticsPresentationView } from './laborStatisticsRecipes';
import { getEducationPresentationView } from './statisticsPresentationViews';
import { PRESENTATION_OVERRIDES } from './presentationOverrides';
import type { SelectNoOverlayParamSpec } from './layerParamsSpec';

export type StatisticsPresentationMode = 'choropleth' | 'circle' | 'dots';

/** 選項順序（＝控制項順序）。 */
export const PRESENTATION_MODES: readonly StatisticsPresentationMode[] = ['choropleth', 'circle', 'dots'];
/** 已實作、可以露出的呈現方式（點密度 2026-11-12 階段 3 露出）。 */
export const IMPLEMENTED_PRESENTATION_MODES: ReadonlySet<StatisticsPresentationMode> = new Set(['choropleth', 'circle', 'dots']);
export const PRESENTATION_LABEL: Readonly<Record<StatisticsPresentationMode, string>> = { choropleth: '面量圖', circle: '比例圓', dots: '點密度' };
export const DEFAULT_PRESENTATION: StatisticsPresentationMode = 'choropleth';

/** 推導用的指標屬性（都從 recipe 讀，不另外手填）。 */
export interface PresentationTraits {
  unit: string;
  /** recipe 的 aggregation（sum／ratio／median／source_defined）；demographics、農業、比較等家族沒有此欄。 */
  aggregation?: string;
  label: string;
  level: string;
  breaks: readonly number[];
  /** 類別型（最高黨）或二元（有／無）圖例 */
  categorical?: boolean;
  /** 色階宣告為雙向（以 0 為中心） */
  diverging?: boolean;
  /** 同一個 key 可切換的維度選項名稱（例：癌別、性別）；任一個像比率就不給比例圓 */
  dimensionLabels?: readonly string[];
}

/** 總量單位白名單（比例圓）：數得出來的件數、人數，加上面積、金額、重量等可加總量。 */
const TOTAL_UNITS = new Set([
  '人', '件', '處', '家', '宅', '戶', '輛', '筆', '人次', '床', '所', '隻', '次', '站', '個', '點', '場', '條', '班次', '對', '票',
  '筆戶', '筆次', '溪流次', '頭(隻)', '千人',
  '公頃', '平方公尺', '公噸', '公斤', '公里', '車公里', '度', '千立方公尺',
  '元', '千元', '百萬元', 'TWD',
]);
/** 點密度只給「一個一個數得出來」的計數（據點類單位已不在這裡）。 */
const DOT_UNITS = new Set(['人', '件', '戶']);
const DOT_LEVELS = new Set(['township', 'village']);
/** 比例圓限台灣三層行政區（外國層與統計區另行評估）。 */
const CIRCLE_LEVELS = new Set(['county', 'township', 'village']);

/** 名稱像比率、平均、密度、指數 → 只給面量圖（單位已帶斜線的會先被單位規則擋下）。 */
const RATIO_LABEL = /率|占比|佔比|比例|比重|密度|平均|中位|指數|係數|分數|每十萬|每萬|每千|每百|每人|每戶|每公頃|每平方|相對集中度|LQ/u;
/** 有正負號的量 → 只給面量圖（雙向色階）。 */
const SIGNED_LABEL = /增加|淨|增減|變動|差距|差額|成長|餘絀|盈虧/u;
/** 單位帶「每／斜線／百分號」＝比率 */
const RATIO_UNIT = /[%‰／/]|每|倍|歲|分數|百分點|指數|km²|類別碼/u;

/** 依 Q-C 規則推導可選的呈現方式；順序固定 `PRESENTATION_MODES`。 */
export function derivePresentationModes(traits: PresentationTraits): StatisticsPresentationMode[] {
  const out: StatisticsPresentationMode[] = ['choropleth'];
  if (traits.categorical || traits.diverging) return out;
  if (traits.aggregation && traits.aggregation !== 'sum') return out;
  if (RATIO_UNIT.test(traits.unit) || !TOTAL_UNITS.has(traits.unit.trim())) return out;
  if (RATIO_LABEL.test(traits.label) || SIGNED_LABEL.test(traits.label)) return out;
  if (traits.breaks.some((value) => value < 0)) return out;
  if (traits.dimensionLabels?.some((label) => RATIO_LABEL.test(label) || SIGNED_LABEL.test(label))) return out;
  if (!CIRCLE_LEVELS.has(traits.level)) return out;
  out.push('circle');
  if (DOT_UNITS.has(traits.unit.trim()) && DOT_LEVELS.has(traits.level) && !/據點/u.test(traits.label)) out.push('dots');
  return out;
}

/** 單一基礎統計 key 的推導屬性。 */
function baseTraits(baseKey: string): PresentationTraits | null {
  if (!isStatisticsLayer(baseKey)) return null;
  const recipe = STATISTICS_RECIPES[baseKey] as { unit: string; label: string; level: string; breaks: readonly number[] };
  const atlas = getAtlasRecipe(baseKey);
  const aggregation = (atlas ?? getEnvironmentRecipe(baseKey) ?? getAddictionRecipe(baseKey) ?? getLandslideRecipe(baseKey))?.aggregation;
  const byDimension = atlas?.legend.by_dimension ? Object.values(atlas.legend.by_dimension) : [];
  return {
    unit: recipe.unit, label: recipe.label, level: recipe.level, breaks: recipe.breaks,
    ...(aggregation ? { aggregation } : {}),
    categorical: atlas ? atlas.legend.method !== 'fixed_breaks' : false,
    diverging: atlas ? [atlas.legend, ...byDimension].some((scale) => scale.direction === 'diverging' || scale.breaks.some((v) => v < 0)) : false,
    ...(atlas?.dimensions.length ? { dimensionLabels: atlas.dimensions.flatMap((dimension) => dimension.options.map((option) => option.label)) } : {}),
  };
}

/**
 * render key 的推導結果（含點密度）。一個 key 可切多個指標的固定入口（教育、勞動顯示切換）：
 * 每個指標都是總量才開，否則只給面量圖（不隨所選指標變動，控制項與網址才穩定）。
 */
export function derivedPresentationModes(key: string): StatisticsPresentationMode[] {
  const education = getEducationPresentationView(key);
  const labor = getLaborStatisticsPresentationView(key);
  const bases = education ? education.metrics.map((metric) => metric.layerKey)
    : labor ? labor.metrics.map((metric) => metric.valueTransform ? '' : metric.sourceLayerKey)
      : [statisticsBaseKey(key as StatisticsRenderKey)];
  const lists = bases.map((base) => { const traits = baseTraits(base); return traits ? derivePresentationModes(traits) : ['choropleth' as const]; });
  return PRESENTATION_MODES.filter((mode) => lists.every((list) => list.includes(mode)));
}

/** 覆寫後、已實作的可選清單（第一個一定是面量圖）。 */
export function statisticsPresentationOptions(key: string): StatisticsPresentationMode[] {
  const hide = new Set(PRESENTATION_OVERRIDES[key]?.hide ?? []);
  return derivedPresentationModes(key).filter((mode) => IMPLEMENTED_PRESENTATION_MODES.has(mode) && (mode === 'choropleth' || !hide.has(mode)));
}

/** 預設呈現方式：一律面量圖，除非覆寫指定（且在可選清單內）。 */
export function statisticsPresentationDefault(key: string): StatisticsPresentationMode {
  const wanted = PRESENTATION_OVERRIDES[key]?.default;
  return wanted && statisticsPresentationOptions(key).includes(wanted) ? wanted : DEFAULT_PRESENTATION;
}

export const presentationParamName = (key: string) => `${key}Presentation`;

/**
 * 「呈現方式」控制項規格（≥2 個選項才有；≤3 個自動畫成分段鈕）。值在 layerParamsStore，
 * 不進 overlayParams（`out: null`；由 `map/regionalStatisticsMap.ts` 直接讀）。
 * 類別寫死「顏色」：排在資料篩選之後、透明度之前（spec §5.11，同「立體效果」）。
 */
export function statisticsPresentationSpec(key: string): SelectNoOverlayParamSpec | null {
  const options = statisticsPresentationOptions(key);
  if (options.length < 2) return null;
  return {
    kind: 'select', category: 'color', name: presentationParamName(key), label: '呈現方式',
    default: statisticsPresentationDefault(key),
    options: options.map((mode) => ({ label: PRESENTATION_LABEL[mode], value: mode })),
    out: null,
  };
}

/** 目前值（不在可選清單內＝回預設）。 */
export function resolvePresentationMode(key: string, value: unknown): StatisticsPresentationMode {
  const options = statisticsPresentationOptions(key);
  return typeof value === 'string' && (options as string[]).includes(value) ? value as StatisticsPresentationMode : statisticsPresentationDefault(key);
}
