/**
 * 統計圖層的連動選單規格（圖層面板統一 C 段，P6 A）。
 *
 * 每個統計 render key 依資料家族宣告「指標 → 期別／各維度」幾列 `linkedSelect`，選項與值由
 * `state/statisticsLinkedSelect.ts` 從 `regionalStatisticsStore` 算；一列對多個 key 的統計群組
 * （醫療、住宅、土地…）另有一列「指標／口徑」（`statisticsVariant` provider）。
 *
 * 欄位與順序是**靜態**的（首屏就有的 catalog 宣告），好讓 Agent controlId、場景存檔、manifest 計數在
 * 資料載入前就固定：
 *   - 教育固定入口／勞動顯示切換：`metric` 在最前
 *   - 環境統計：`release`（資料期別）＋ recipe 宣告的單一細項維度
 *   - 人口統計：只有 `release`（資料期別）；每期恰一組 {roc_year, month}，不拆成年／月兩列串連
 *   - 農業／社會：catalog `release_summary.first.dimensions` 的鍵順序（＝完整明細每一列的順序，已驗證一致）
 *   - 勞動／比較：`release_options[0].dimensions` 的鍵順序
 *   - 其他 releaseSelector：selector 宣告的 `dimensionKeys`
 *   - 都沒有：`release`（資料期別）
 * 維度鍵在某些組合不存在時，那一列只是沒有選項（隱藏），不影響其他列。
 */
import type { LayerParamSpec, LinkedSelectParamSpec } from './layerParamsSpec';
import { getAgriRecipe } from './agriStatisticsRecipes';
import { getSocialRecipe } from './socialStatisticsRecipes';
import { getLaborRecipe, getLaborStatisticsPresentationView } from './laborStatisticsRecipes';
import { getEnvironmentRecipe } from './environmentStatisticsRecipes';
import { getAddictionRecipe } from './addictionStatisticsRecipes';
import { getLandslideRecipe } from './landslideStatisticsRecipes';
import { getDemographicsRecipe } from './demographicsStatisticsRecipes';
import { getComparisonRecipe } from './comparisonStatisticsRecipes';
import { getEducationPresentationView } from './statisticsPresentationViews';
import { STATISTICS_RECIPES, isStatisticsLayer } from './regionalStatisticsRecipes';
import { getMedicalStatisticsGroup } from './medicalStatisticsGroups';
import { statisticsDimensionLabel } from './statisticsLabels';

export const STATISTICS_LINKED_PROVIDER = 'statistics';
export const STATISTICS_VARIANT_PROVIDER = 'statisticsVariant';

const pascal = (key: string) => key.split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');

function unionInOrder(lists: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  for (const list of lists) for (const key of list) if (!out.includes(key)) out.push(key);
  return out;
}

/** 單一基礎統計 key 的維度鍵（依 cascade 順序）；沒有 exact tuple 維度回 []。 */
export function statisticsDimensionKeys(key: string): string[] {
  const comparison = getComparisonRecipe(key);
  if (comparison) return Object.keys(comparison.release_options[0]?.dimensions ?? {});
  const agri = getAgriRecipe(key);
  if (agri) return Object.keys(agri.release_summary.first?.dimensions ?? {});
  const social = getSocialRecipe(key);
  if (social) return Object.keys(social.release_summary.first?.dimensions ?? {});
  const labor = getLaborRecipe(key);
  if (labor) return Object.keys(labor.release_options[0]?.dimensions ?? {});
  if (!isStatisticsLayer(key)) return [];
  const recipe = STATISTICS_RECIPES[key];
  return 'releaseSelector' in recipe && recipe.releaseSelector ? [...recipe.releaseSelector.dimensionKeys] : [];
}

type FieldPlan = { field: string; label: string; suffix: string };

function statisticsFieldPlan(key: string): FieldPlan[] {
  const plan: FieldPlan[] = [];
  const dims = (keys: readonly string[]) => keys.map((dim) => ({ field: `dim:${dim}`, label: statisticsDimensionLabel(dim), suffix: `Dim${pascal(dim)}` }));
  const view = getEducationPresentationView(key);
  if (view) {
    plan.push({ field: 'metric', label: '指標', suffix: 'Metric' });
    plan.push(...dims(unionInOrder(view.metrics.map((metric) => statisticsDimensionKeys(metric.layerKey)))));
    return plan;
  }
  const laborView = getLaborStatisticsPresentationView(key);
  if (laborView) {
    plan.push({ field: 'metric', label: '顯示', suffix: 'Metric' });
    plan.push(...dims(unionInOrder(laborView.metrics.map((metric) => statisticsDimensionKeys(metric.sourceLayerKey)))));
    return plan;
  }
  const environment = getEnvironmentRecipe(key);
  if (environment) {
    plan.push({ field: 'release', label: '資料期別', suffix: 'Period' });
    if (environment.dimension?.key) plan.push(...dims([environment.dimension.key]));
    return plan;
  }
  if (getDemographicsRecipe(key) || getAddictionRecipe(key) || getLandslideRecipe(key)) return [{ field: 'release', label: '資料期別', suffix: 'Period' }];
  const keys = statisticsDimensionKeys(key);
  return keys.length ? dims(keys) : [{ field: 'release', label: '資料期別', suffix: 'Period' }];
}

/** 統計 key 的連動選單（群組「指標」在前，接著資料欄位）；非統計 key 回 []。 */
export function statisticsLinkedSelects(key: string): LinkedSelectParamSpec[] {
  if (!isStatisticsLayer(key) && !getEducationPresentationView(key)) return [];
  const out: LinkedSelectParamSpec[] = [];
  const group = getMedicalStatisticsGroup(key);
  if (group) {
    out.push({
      kind: 'linkedSelect', name: `${key}Variant`, label: group.optionLabel ?? '指標',
      provider: STATISTICS_VARIANT_PROVIDER, field: group.key, dependsOn: [], persist: false, default: '', out: null,
    });
  }
  const names: string[] = [];
  statisticsFieldPlan(key).forEach((field, index) => {
    const name = `${key}${field.suffix}`;
    out.push({
      kind: 'linkedSelect', name, label: field.label, provider: STATISTICS_LINKED_PROVIDER, field: field.field,
      dependsOn: [...names], ...(index === 0 ? { primary: true } : {}), default: '', out: null,
    });
    names.push(name);
  });
  return out;
}

/**
 * manifest `params` 宣告（資料未載入時看得到的控件）：統計 provider 只剩保底那一列、
 * 群組「指標」在選項 ≥2 時可見，加上原本的透明度。與 `linkedSelectHiddenFor` 同一套規則。
 */
export function statisticsManifestParams(key: string, rest: readonly LayerParamSpec['kind'][] = ['slider']): { count: number; kinds: LayerParamSpec['kind'][] } {
  const kinds: LayerParamSpec['kind'][] = [];
  const group = getMedicalStatisticsGroup(key);
  if (group && group.options.length > 1) kinds.push('linkedSelect');
  if (statisticsFieldPlan(key).length) kinds.push('linkedSelect');
  kinds.push(...rest);
  return { count: kinds.length, kinds };
}
