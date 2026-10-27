/**
 * 統計的連動選單 provider（圖層面板統一 C 段，P6 A）。取代 `StatisticsDetails` 手寫的 6 個 select。
 *
 * 值的唯一來源是 `regionalStatisticsStore` 的 selection（也是它在瀏覽器裡記住上次選擇的地方）；
 * 本檔把「目前可選的 exact tuple」換成連動選單的組合，改值時用 `state/linkedSelect.ts` 的共用規則挑出
 * 一個真實存在的組合，再照原本的 resolve 流程寫回 store 並載入。
 *
 * - `statistics`：指標（教育固定入口／勞動顯示切換）、資料期別、各維度。
 * - `statisticsVariant`：一列對多個 key 的統計群組（醫療、住宅、土地…）的「指標／口徑」；
 *   切換＝換一個可見圖層，沿用 `medicalStatisticsSelection` 的同期別切換與預載。
 *
 * 載入狀態：配方明細（`ensureStatisticsRecipeDetails`）與數值（`regionalStatisticsStore.load`）
 * 都已經走 loadingRegistry；這裡只把 store 的 loading／error 轉成控件狀態。
 */
import type { LinkedSelectParamSpec } from '../data/layerParamsSpec';
import type { LayerVisibility } from '../types';
import { getAgriRecipe } from '../data/agriStatisticsRecipes';
import { getSocialRecipe, getSocialRecipeDetails, resolveSocialRelease } from '../data/socialStatisticsRecipes';
import { getLaborRecipe, getLaborStatisticsPresentationMetric, getLaborStatisticsPresentationView, resolveLaborRelease } from '../data/laborStatisticsRecipes';
import { getEnvironmentRecipe, resolveEnvironmentRelease } from '../data/environmentStatisticsRecipes';
import { getAddictionRecipe, resolveAddictionRelease } from '../data/addictionStatisticsRecipes';
import { getLandslideRecipe, resolveLandslideRelease } from '../data/landslideStatisticsRecipes';
import { atlasLazyFamily, getAtlasRecipe, resolveAtlasRelease } from '../data/atlasStatisticsRecipes';
import { demographicsPeriodLabel, getDemographicsRecipe, resolveDemographicsRelease } from '../data/demographicsStatisticsRecipes';
import { getComparisonRecipe } from '../data/comparisonStatisticsRecipes';
import { getEducationPresentationView } from '../data/statisticsPresentationViews';
import { STATISTICS_RECIPES, isStatisticsRenderLayer, statisticsBaseKey, statisticsRenderRecipe, type StatisticsLayerKey, type StatisticsReleaseOption, type StatisticsRenderKey } from '../data/regionalStatisticsRecipes';
import { ensureStatisticsRecipeDetails, statisticsRecipeDetailsLoaded, subscribeStatisticsRecipeDetails, type StatisticsRecipeFamily } from '../data/statisticsRecipeDetails';
import { statisticsRecipe, statisticsReleaseOptions } from '../data/statisticsSelection';
import { statisticsDimensionValueLabel, statisticsPeriodLabel } from '../data/statisticsLabels';
import { enumLabel } from '../i18n/dataText';
import type { MessageKey } from '../i18n/keys';
import type { I18nContext } from '../i18n/layerText';
import { statisticsTitle, statisticsVariantLabel } from '../i18n/statisticsText';
import { STATISTICS_LINKED_PROVIDER, STATISTICS_VARIANT_PROVIDER } from '../data/statisticsParamsSpec';
import { getMedicalStatisticsGroup } from '../data/medicalStatisticsGroups';
import { isStatisticsChoropleth } from '../data/statisticsLayerRegistry';
import { regionalStatisticsStore } from './regionalStatisticsStore';
import { layerVisibilityStore } from './layerVisibilityStore';
import { statisticsDisplayModeStore } from './statisticsDisplayModeStore';
import zhStatisticsSelect from '../i18n/locales/zh-TW/statisticsSelect.json';
import { canSelectMedicalStatisticsVariant, prepareMedicalStatisticsVariant, selectMedicalStatisticsVariant } from './medicalStatisticsSelection';
import {
  LINKED_SELECT_NOT_READY, LINKED_SELECT_VALUE_INVALID, linkedSelectSpecs, linkedSelectValues, registerLinkedSelectProvider,
  resolveLinkedSelectChange, type LinkedSelectField, type LinkedSelectSnapshot, type LinkedSelectStatus, type LinkedSelectTuple,
} from './linkedSelect';

// ══════════════════════════════════════════════════════════════════
//  statistics：指標／期別／維度
// ══════════════════════════════════════════════════════════════════

interface StatisticsTuple extends LinkedSelectTuple {
  /** 寫回 store；回 false＝這個組合無法完整解析（不寫） */
  apply: () => boolean;
  /** 資料期間（`start|end`）；教育固定入口換指標時用來判斷「同一學年有沒有這個指標」 */
  period?: string;
}

interface StatisticsModel {
  status: LinkedSelectStatus;
  error?: string;
  tuples: StatisticsTuple[];
  current: Record<string, string>;
  label: (spec: LinkedSelectParamSpec, value: string, i18n?: I18nContext) => string;
  /**
   * 教育固定入口的「指標」：目前學年沒有該指標就停用（統計規則 §3：換口徑要維持同一期別，
   * 沒有就說明不可用，不靜默跳到別的年份）。其他列沒有這條限制。
   */
  metricUnavailable?: (value: string) => boolean;
}

function detailsFamily(layerKey: StatisticsRenderKey, baseKey: StatisticsLayerKey): StatisticsRecipeFamily | null {
  return getAgriRecipe(baseKey) ? 'agri' : getSocialRecipe(baseKey) || getEducationPresentationView(layerKey) ? 'social'
    : atlasLazyFamily(baseKey);
}

function statisticsSpecs(layerKey: string): LinkedSelectParamSpec[] {
  return linkedSelectSpecs(layerKey).filter((spec) => spec.provider === STATISTICS_LINKED_PROVIDER);
}

/** 一個 tuple 在每一列的值（列 name → 值）；不適用的列不放 */
function tupleValues(specs: readonly LinkedSelectParamSpec[], option: StatisticsReleaseOption, metric?: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const spec of specs) {
    if (spec.field === 'metric') { if (metric !== undefined) values[spec.name] = metric; }
    else if (spec.field === 'release') values[spec.name] = option.releaseId;
    else if (spec.field.startsWith('dim:')) {
      const v = option.dimensions[spec.field.slice(4)];
      if (typeof v === 'string' && v) values[spec.name] = v;
    }
  }
  return values;
}

function buildModel(key: string): StatisticsModel {
  const specs = statisticsSpecs(key);
  const empty: StatisticsModel = { status: 'idle', tuples: [], current: {}, label: (_spec, value) => value };
  if (!specs.length || !isStatisticsRenderLayer(key)) return empty;
  const layerKey = key as StatisticsRenderKey;
  const state = regionalStatisticsStore.getSnapshot(layerKey);
  const indicator = state.selection?.indicatorId;
  const activeBaseKey = statisticsBaseKey(layerKey, indicator);
  const family = detailsFamily(layerKey, activeBaseKey);
  const detailsReady = family === null || statisticsRecipeDetailsLoaded(family);
  // atlas 共用接點的家族（含按需載入明細的臺北市局處統計）尚未開啟時維持「尚未載入」，開啟後明細未到才算載入中；
  // agri／social 維持 PF-7 原行為（明細未載入即顯示載入中）。
  const awaitingDetails = !detailsReady && !(getAtlasRecipe(activeBaseKey) && !state.selection && !state.loading);
  const status: LinkedSelectStatus = state.error ? 'error'
    : awaitingDetails || state.loading ? 'loading'
      : !state.selection ? 'idle' : 'ready';
  const recipe = statisticsRenderRecipe(layerKey, indicator);
  const view = getEducationPresentationView(layerKey);
  const laborView = getLaborStatisticsPresentationView(layerKey);
  const environment = getEnvironmentRecipe(activeBaseKey);
  const social = getSocialRecipe(activeBaseKey);
  const labor = getLaborRecipe(activeBaseKey);
  const demographics = getDemographicsRecipe(activeBaseKey);
  const addiction = getAddictionRecipe(activeBaseKey);
  const landslide = getLandslideRecipe(activeBaseKey);
  const atlas = getAtlasRecipe(activeBaseKey);
  const hasRelease = specs.some((spec) => spec.field === 'release');
  const hasDims = specs.some((spec) => spec.field.startsWith('dim:'));

  // 與舊 StatisticsDetails 相同的來源：只列已公開、能完整解析的 exact tuple。
  const selectable = detailsReady ? statisticsReleaseOptions(layerKey, state.releases, indicator) : [];
  const selected = state.selection?.releaseId ?? state.release?.release_id ?? '';
  const defaultReleaseId = 'releaseId' in STATISTICS_RECIPES[activeBaseKey] ? (STATISTICS_RECIPES[activeBaseKey] as { releaseId?: string }).releaseId : undefined;
  const sameDims = (a: Record<string, string>, b: Record<string, unknown> | undefined) => !b || JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

  const writeOption = (option: StatisticsReleaseOption): boolean => {
    const release = state.releases.find((candidate) => candidate.release_id === option.releaseId);
    const resolved = environment ? (release ? resolveEnvironmentRelease(activeBaseKey, release, option.dimensions) : null)
      : social && release ? resolveSocialRelease(activeBaseKey, release, option.dimensions)
        : labor && release ? resolveLaborRelease(activeBaseKey, release, option.dimensions)
          : demographics ? (release ? resolveDemographicsRelease(activeBaseKey, release, option.dimensions) : null)
            : addiction ? (release ? resolveAddictionRelease(activeBaseKey, release, option.dimensions) : null)
              : landslide ? (release ? resolveLandslideRelease(activeBaseKey, release, option.dimensions) : null)
                : atlas ? (release ? resolveAtlasRelease(activeBaseKey, release, option.dimensions) : null)
                  : option;
    if (!resolved) return false;
    regionalStatisticsStore.setSelection(layerKey, { ...statisticsRecipe(layerKey, indicator), releaseId: resolved.releaseId, dimensions: resolved.dimensions, allowReleaseFallback: false });
    void regionalStatisticsStore.load(layerKey);
    return true;
  };

  const periodOf = (releaseId: string) => {
    const release = state.releases.find((candidate) => candidate.release_id === releaseId);
    return release ? `${release.period_start}|${release.period_end}` : undefined;
  };
  let tuples: StatisticsTuple[] = [];
  let configured: StatisticsReleaseOption | undefined;
  let currentMetric: string | undefined;
  const metricLabels = new Map<string, string>();

  // 環境／人口／成癮與減害／崩塌／atlas 統計的期別即 exact tuple（含 dimensions），必須走白名單分支，不可列原始 releases。
  if (!hasDims && hasRelease && !environment && !demographics && !addiction && !landslide && !atlas) {
    // 沒有 exact tuple 維度的 recipe：直接列公開期別（舊版「資料期別」單選）。
    tuples = state.releases.map((release) => ({
      values: tupleValues(specs, { releaseId: release.release_id, dimensions: {} }),
      apply: () => {
        regionalStatisticsStore.setSelection(layerKey, { ...(state.selection ?? statisticsRecipe(layerKey)), releaseId: release.release_id, allowReleaseFallback: false });
        void regionalStatisticsStore.load(layerKey);
        return true;
      },
    }));
    configured = { releaseId: selected, dimensions: {} };
  } else {
    configured = selectable.find((option) => option.releaseId === selected && sameDims(option.dimensions, state.selection?.dimensions))
      ?? selectable.find((option) => option.releaseId === defaultReleaseId)
      ?? selectable[0];
    if (view) {
      currentMetric = activeBaseKey;
      for (const metric of view.metrics) metricLabels.set(metric.layerKey, metric.label);
    } else if (laborView) {
      currentMetric = getLaborStatisticsPresentationMetric(layerKey, indicator)?.sourceLayerKey;
      for (const metric of laborView.metrics) metricLabels.set(metric.sourceLayerKey, metric.optionLabel);
    }
    tuples = selectable.map((option) => ({ values: tupleValues(specs, option, currentMetric), apply: () => writeOption(option), period: periodOf(option.releaseId) }));
    // 其他指標：只有目前指標已有組合時才列（否則資料未載入時就會冒出半套選單）。
    if (tuples.length && view) {
      for (const metric of view.metrics) {
        if (metric.layerKey === currentMetric) continue;
        const source = (getSocialRecipeDetails(metric.layerKey) ?? getComparisonRecipe(metric.layerKey))?.release_options ?? [];
        for (const option of source) {
          if (option.dimensions.education_stage !== view.stage) continue;
          const target = { releaseId: option.release_id, dimensions: option.dimensions };
          tuples.push({
            values: tupleValues(specs, target, metric.layerKey),
            period: `${option.period_start}|${option.period_end}`,
            apply: () => {
              regionalStatisticsStore.setSelection(layerKey, { ...statisticsRecipe(layerKey, STATISTICS_RECIPES[metric.layerKey].indicator_id), releaseId: target.releaseId, dimensions: target.dimensions, allowReleaseFallback: false });
              void regionalStatisticsStore.load(layerKey);
              return true;
            },
          });
        }
      }
    } else if (tuples.length && laborView) {
      for (const metric of laborView.metrics) {
        if (metric.sourceLayerKey === currentMetric) continue;
        const sourceRecipe = getLaborRecipe(metric.sourceLayerKey);
        if (!sourceRecipe) continue;
        // 切換顯示方式＝改用該指標的預設期別（與舊版相同）；細項待載入後再選。
        tuples.push({
          values: tupleValues(specs.filter((spec) => spec.field === 'metric'), { releaseId: '', dimensions: {} }, metric.sourceLayerKey),
          apply: () => {
            regionalStatisticsStore.setSelection(layerKey, statisticsRecipe(layerKey, sourceRecipe.indicator_id));
            void regionalStatisticsStore.load(layerKey);
            return true;
          },
        });
      }
    }
  }

  const current = configured ? tupleValues(specs, configured, currentMetric) : {};
  const currentPeriod = view && configured ? periodOf(configured.releaseId) : undefined;
  return {
    status,
    error: state.error ?? undefined,
    tuples,
    current,
    ...(currentPeriod ? {
      metricUnavailable: (value: string) => value !== currentMetric
        && !tuples.some((tuple) => tuple.period === currentPeriod && Object.entries(tuple.values).some(([name, v]) => v === value && specs.find((spec) => spec.name === name)?.field === 'metric')),
    } : {}),
    label: (spec, value, i18n) => {
      if (spec.field === 'metric') return metricText(metricLabels.get(value) ?? value, i18n);
      if (spec.field === 'release') {
        const release = state.releases.find((candidate) => candidate.release_id === value);
        // 人口統計的年初累計期別用配方的結構化期別依語系組句；其餘走共用期別格式
        return release ? (demographics ? demographicsPeriodLabel(activeBaseKey, release, i18n) : undefined) ?? statisticsPeriodLabel(release, i18n) : uiText(i18n, 'statisticsSelect.publishedPeriod', '已公開期別');
      }
      return statisticsDimensionValueLabel(spec.field.slice(4), value, recipe.dataset_id, i18n);
    },
  };
}

const ZH_UNAVAILABLE_FOR_PERIOD = zhStatisticsSelect['statisticsSelect.unavailableForPeriod'];

/** 介面短句：中文（或沒傳 i18n）用原文，外文查 statisticsSelect.json */
function uiText(i18n: I18nContext | undefined, key: MessageKey, zh: string): string {
  return !i18n || i18n.active === 'zh-TW' ? zh : i18n.lookup(key) ?? zh;
}

/** 指標名（教育固定入口、勞動顯示切換）：「…（每萬名居民）」「…（每平方公里）」拆出尾巴再翻主體 */
function metricText(zh: string, i18n?: I18nContext): string {
  if (!i18n || i18n.active === 'zh-TW') return zh;
  const m = /^(.*)（(每萬名居民|每平方公里)）$/u.exec(zh);
  if (!m) return enumLabel('statMetric', zh, zh, i18n);
  const base = enumLabel('statMetric', m[1]!, m[1]!, i18n);
  const template = i18n.lookup(m[2] === '每萬名居民' ? 'statisticsSelect.metricPerResidents' : 'statisticsSelect.metricPerKm2');
  return template ? template.replace('{base}', base) : zh;
}

function fieldsOf(specs: readonly LinkedSelectParamSpec[]): LinkedSelectField[] {
  return specs.map((spec) => ({ name: spec.name, dependsOn: spec.dependsOn }));
}

function statisticsSnapshot(layerKey: string, spec: LinkedSelectParamSpec): LinkedSelectSnapshot {
  const model = buildModel(layerKey);
  const values = linkedSelectValues({ name: spec.name, dependsOn: spec.dependsOn }, model.tuples, model.current);
  return {
    status: model.status,
    ...(model.error ? { error: model.error } : {}),
    options: values.map((value) => {
      const unavailable = spec.field === 'metric' && model.metricUnavailable?.(value);
      const localize = (i18n: I18nContext) => unavailable
        ? uiText(i18n, 'statisticsSelect.unavailableForYear', '{label}（此學年未提供）').replace('{label}', model.label(spec, value, i18n))
        : model.label(spec, value, i18n);
      return unavailable ? { label: `${model.label(spec, value)}（此學年未提供）`, value, disabled: true, localize } : { label: model.label(spec, value), value, localize };
    }),
    value: model.current[spec.name] ?? '',
  };
}

function ensureStatistics(layerKey: string): void {
  if (!isStatisticsRenderLayer(layerKey)) return;
  const state = regionalStatisticsStore.getSnapshot(layerKey);
  const family = detailsFamily(layerKey, statisticsBaseKey(layerKey, state.selection?.indicatorId));
  if (family && !statisticsRecipeDetailsLoaded(family)) ensureStatisticsRecipeDetails(family).catch(() => { /* 由 store 的錯誤＋重試呈現 */ });
  regionalStatisticsStore.registerRecipe(layerKey, statisticsRecipe(layerKey));
  void regionalStatisticsStore.load(layerKey);
}

registerLinkedSelectProvider(STATISTICS_LINKED_PROVIDER, {
  snapshot: statisticsSnapshot,
  set(layerKey, spec, value) {
    const model = buildModel(layerKey);
    if (!model.tuples.length) throw new Error(LINKED_SELECT_NOT_READY);
    if (model.current[spec.name] === value) return;
    if (spec.field === 'metric' && model.metricUnavailable?.(value)) throw new Error(LINKED_SELECT_VALUE_INVALID);
    const tuple = resolveLinkedSelectChange(fieldsOf(statisticsSpecs(layerKey)), model.tuples, model.current, spec.name, value);
    if (!tuple || !tuple.apply()) throw new Error(LINKED_SELECT_VALUE_INVALID);
    // 等新組合的資料載入完再回：換指標會清空期別清單，載入後選項與讀回值才完整（Agent 讀回、場景還原靠這個）。
    return regionalStatisticsStore.load(layerKey);
  },
  subscribe(layerKey, callback) {
    const offStore = regionalStatisticsStore.subscribe(layerKey, callback);
    const offDetails = subscribeStatisticsRecipeDetails(callback);
    return () => { offStore(); offDetails(); };
  },
  ensure: ensureStatistics,
  retry: ensureStatistics,
});

// ══════════════════════════════════════════════════════════════════
//  statisticsVariant：一列對多個 key 的群組「指標／口徑」
// ══════════════════════════════════════════════════════════════════

const variantPending = new Map<string, number>();
const variantErrors = new Map<string, string>();
const variantListeners = new Map<string, Set<() => void>>();

function notifyVariant(groupKey: string) {
  variantListeners.get(groupKey)?.forEach((callback) => callback());
}

/** 群組目前顯示的成員：自己可見就是自己，否則第一個可見成員，都沒開就是自己。 */
export function statisticsVariantValue(layerKey: string, visibility: Partial<LayerVisibility> = layerVisibilityStore.getAll()): string {
  const group = getMedicalStatisticsGroup(layerKey);
  if (!group) return layerKey;
  if (visibility[layerKey as keyof LayerVisibility]) return layerKey;
  return group.options.find((option) => visibility[option.key])?.key ?? layerKey;
}

registerLinkedSelectProvider(STATISTICS_VARIANT_PROVIDER, {
  snapshot(layerKey) {
    const group = getMedicalStatisticsGroup(layerKey);
    if (!group) return { status: 'idle', options: [], value: '' };
    const error = variantErrors.get(group.key);
    const current = statisticsVariantValue(layerKey) as keyof LayerVisibility;
    return {
      status: variantPending.has(group.key) ? 'loading' : error ? 'error' : 'ready',
      ...(error ? { error } : {}),
      options: group.options.map((option) => {
        const localize = (i18n: I18nContext) => statisticsVariantLabel(option.label, i18n) ?? statisticsTitle(option.key, option.label, i18n);
        // 目前期別在目標口徑沒有對應期別（例：部分期間的件數切到只含完整年度的每十萬人率）→ 停用並說明，不靜默失敗。
        if (!canSelectMedicalStatisticsVariant(current, option.key)) {
          const text = (i18n?: I18nContext) => uiText(i18n, 'statisticsSelect.unavailableForPeriod', ZH_UNAVAILABLE_FOR_PERIOD).replace('{label}', i18n ? localize(i18n) : option.label);
          return { label: text(), value: option.key, disabled: true, localize: text };
        }
        return { label: option.label, value: option.key, localize };
      }),
      value: statisticsVariantValue(layerKey),
    };
  },
  async set(layerKey, _spec, value) {
    const group = getMedicalStatisticsGroup(layerKey);
    if (!group || !group.options.some((option) => option.key === value)) throw new Error(LINKED_SELECT_VALUE_INVALID);
    const members = group.options.map((option) => option.key);
    const from = statisticsVariantValue(layerKey) as keyof LayerVisibility;
    const to = value as keyof LayerVisibility;
    const visible = layerVisibilityStore.getAll();
    const active = members.filter((key) => visible[key]);
    if (to === from && active.length <= 1) return;
    variantErrors.delete(group.key);
    // 群組都沒開：直接開目標（與點列開啟同一條 statistics 單一／重疊規則）。
    if (!active.length) {
      layerVisibilityStore.setAll(isStatisticsChoropleth(to) ? statisticsDisplayModeStore.enable(to, visible) : { ...visible, [to]: true });
      notifyVariant(group.key);
      return;
    }
    if (selectMedicalStatisticsVariant(from, to, members)) { notifyVariant(group.key); return; }
    const request = (variantPending.get(group.key) ?? 0) + 1;
    variantPending.set(group.key, request);
    notifyVariant(group.key);
    let switched = false;
    let stillCurrent = false;
    try {
      switched = await prepareMedicalStatisticsVariant(from, to, members, () => variantPending.get(group.key) === request && Boolean(layerVisibilityStore.getVisibility(from)));
      // 在 finally 清掉 pending 之前判斷：被取代或群組已關閉＝取消，不是缺期別錯誤。
      stillCurrent = variantPending.get(group.key) === request && Boolean(layerVisibilityStore.getVisibility(from));
    } finally {
      if (variantPending.get(group.key) === request) variantPending.delete(group.key);
    }
    if (!switched) {
      if (!stillCurrent) { notifyVariant(group.key); return; }
      variantErrors.set(group.key, regionalStatisticsStore.getSnapshot(to).error ?? '此類型沒有相同期別的資料，請先調整年份。');
      notifyVariant(group.key);
      throw new Error(LINKED_SELECT_VALUE_INVALID);
    }
    notifyVariant(group.key);
  },
  subscribe(layerKey, callback) {
    const group = getMedicalStatisticsGroup(layerKey);
    if (!group) return () => {};
    const set = variantListeners.get(group.key) ?? new Set();
    set.add(callback);
    variantListeners.set(group.key, set);
    const offVisibility = layerVisibilityStore.subscribe(callback);
    return () => { set.delete(callback); offVisibility(); };
  },
});
