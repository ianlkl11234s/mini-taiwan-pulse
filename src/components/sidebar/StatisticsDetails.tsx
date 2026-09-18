import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { getAgriRecipe, agriReleaseOptions, AGRI_EXISTING_LAYER_REFERENCES } from '../../data/agriStatisticsRecipes';
import { getSocialRecipe, socialReleaseOptions, resolveSocialRelease } from '../../data/socialStatisticsRecipes';
import { getComparisonRecipe, comparisonReleaseOptions } from '../../data/comparisonStatisticsRecipes';
import { getEducationPresentationView } from '../../data/statisticsPresentationViews';
import { layerVisibilityStore } from '../../state/layerVisibilityStore';
import { LAYER_MANIFEST, type LayerManifestEntry } from '../../data/layerManifest';
import type { LayerVisibility } from '../../types';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, statisticsBaseKey, statisticsRenderRecipe, statisticsReleaseFallback, type StatisticsLayerKey, type StatisticsRenderKey, type StatisticsReleaseOption } from '../../data/regionalStatisticsRecipes';
import type { StatisticsRecipe, StatisticsRelease, StatisticsLevel } from '../../data/regionalStatisticsLoader';
import { statisticsColorStops } from '../../data/statisticsColorScale';
import { FONT_SIZE, COLORS, RADIUS, SPACING } from '../../styles/designTokens';

const LEVEL_LABELS: Record<StatisticsLevel, string> = {county:'縣市',township:'鄉鎮市區',village:'村里',statistical_min:'最小統計區',statistical_l1:'第一級統計區',statistical_l2:'第二級統計區'};
const LIVESTOCK_TOWNSHIP_STATISTICS_DATASET = 'livestock_township_statistics';

/** Health coverage denominators use the recipe's actual geographic level. */
export function statisticsCoverageAreaLabel(recipe: Pick<StatisticsRecipe, 'level'> & { datasetId?: string; dataset_id?: string }): string {
  if ((recipe.datasetId ?? recipe.dataset_id) === LIVESTOCK_TOWNSHIP_STATISTICS_DATASET) return '鄉鎮×畜種資料筆';
  return LEVEL_LABELS[recipe.level];
}
export function statisticsCoverageStatusLabel(isAgri: boolean): string {
  return isAgri ? '整份資料覆蓋狀態' : '覆蓋狀態';
}
export function statisticsSelectedTupleAreaLabel(recipe: Pick<StatisticsRecipe, 'level'> & { datasetId?: string; dataset_id?: string }): string {
  return (recipe.datasetId ?? recipe.dataset_id) === LIVESTOCK_TOWNSHIP_STATISTICS_DATASET ? '鄉鎮統計值' : '區域統計值';
}
export function statisticsPeriodLabel(release: Pick<StatisticsRelease, 'period_start' | 'period_end'>): string {
  const start = release.period_start, end = release.period_end;
  if (start.endsWith('-01-01') && end === `${start.slice(0,4)}-12-31`) return `${start.slice(0,4)} 年`;
  return `${start} — ${end}`;
}
const DIMENSION_LABELS: Record<string, string> = {
  crop: '作物', season: '期作', year: '年度', animal: '畜種', animal_kind: '畜種', survey_years_roc: '調查年度', area_unit: '面積單位',
  agency_fund: '基金',
  sector: '用電別',
  quarter: '季度',
  budget: '預算',
  budget_type: '預算類型',
  value_basis: '數值基準',
  law_article: '法條',
  geographic_coverage: '地理涵蓋',
  control_zone_class: '管制區類別',
  bus_metric: '統計項目',
  system_id: '系統',
  source_field: '來源欄位',
  accident_class: '事故類別',
  airport_iata: '機場 IATA',
  airport_icao: '機場 ICAO',
  health: '資料新鮮度',
  coverage: '覆蓋狀態',
  refresh: '更新方式',
  geographic_semantics: '地理語意',
  education_stage: '學段',
  source_schema: '來源 schema',
  academic_year_roc: '學年度',
  previous_academic_year_roc: '前一學年度',
  sex: '性別',
  institution_type: '機構類型',
  institution_classification: '機構分類',
  bed_measure: '床位口徑',
  capacity_field: '原始床位欄位',
  registration_scope: '登錄範圍',
  denominator: '分母',
  denominator_roc_year: '分母年度',
};
const DIMENSION_VALUE_LABELS: Record<string, Record<string, string>> = {
  sector: { residential: '住宅' },
  budget_type: { civil_aviation_fund: '民航基金', public_budget: '公務預算', special_budget: '特別預算' },
  value_basis: { year_to_date_cumulative: '年度累計快照' },
  geographic_coverage: { taipei_only: '僅臺北市', taichung_only: '僅臺中市', taipei_township_only: '僅臺北市 12 區', national_county: '全國縣市', county_location: '縣市所在地' },
  bus_metric: { operating_route_length_km: '期末營業里程', approved_route_count: '核定路線數', urban_bus_operator_count: '市區客運業家數', operating_vehicle_count: '期末營業車輛', accessible_vehicle_count: '期末無障礙車輛', electric_vehicle_count: '期末電動車輛', operating_trip_count: '營業行車次數', operating_vehicle_km: '營業行車里程' },
  system_id: { tmrt: '臺中捷運' },
  geographic_semantics: { station_location: '車站所在地', facility_location_activity: '設施所在地活動' },
  health: { CURRENT: 'CURRENT', STALE: 'STALE' }, coverage: { PARTIAL: 'PARTIAL' }, refresh: { manual: '人工更新' },
  education_stage: { preschool: '幼兒園', elementary: '國民小學', junior_high: '國民中學', senior_high: '高級中等學校' },
  source_schema: { legacy_104_110: '104–110 legacy', current_111_114: '111–114 current', v1_104_114: '104–114 v1' },
  sex: { total: '總計', male: '男', female: '女' },
  institution_type: { general_nursing_home: '一般護理之家' },
  institution_classification: { general_nursing_home: '一般護理之家', postpartum_nursing_home: '產後護理之家' },
  bed_measure: { installed_capacity: '設置／開放容量' },
  registration_scope: { long_term_care_2_0_excludes_c_sites: '長照 2.0（不含 C 據點）' },
  denominator: { year_end_population: '年底人口' },
};

function statisticsDimensionLabel(key: string): string {
  if (key === 'roc_year') return '年度';
  if (key === 'month') return '月份';
  return DIMENSION_LABELS[key] ?? key;
}

const BICYCLE_SOURCE_FIELD_LABELS: Record<string, string> = { COLUMN1: '市區租借站數', COLUMN3: '市區年租借次數', COLUMN5: '河濱租借站數', COLUMN6: '河濱自行車數', COLUMN7: '河濱年租借次數' };
const BUS_SOURCE_FIELD_LABELS: Record<string, string> = { COLUMN1: '期末營業里程', COLUMN2: '核定路線數', COLUMN3: '市區客運業家數', COLUMN4: '期末營業車輛', COLUMN5: '期末無障礙車輛', COLUMN6: '期末電動車輛', COLUMN7: '營業行車次數', COLUMN8: '營業行車里程' };

function statisticsDimensionValueLabel(key: string, value: string, datasetId?: string): string {
  if (key === 'roc_year') return `民國 ${value} 年`;
  if (key === 'academic_year_roc' || key === 'previous_academic_year_roc' || key === 'denominator_roc_year') return `民國 ${value} 年`;
  if (key === 'month') return `${value} 月`;
  if (key === 'source_field') {
    const labels = datasetId === 'segis_bus_operation_county_315fh_1d3' ? BUS_SOURCE_FIELD_LABELS
      : datasetId === 'segis_taipei_bicycle_usage_township_110' ? BICYCLE_SOURCE_FIELD_LABELS
      : BICYCLE_SOURCE_FIELD_LABELS;
    return labels[value] ?? value;
  }
  return DIMENSION_VALUE_LABELS[key]?.[value] ?? value;
}

/** Compact, human-readable selection text for the collapsed filter disclosure. */
export function statisticsDimensionSummary(dimensions: Record<string, unknown> | undefined, release?: Pick<StatisticsRelease, 'period_start' | 'period_end'> | null, datasetId?: string): string {
  if (!dimensions && !release) return '';
  const parts: string[] = [];
  const year = typeof dimensions?.roc_year === 'string' ? dimensions.roc_year : '';
  const month = typeof dimensions?.month === 'string' ? dimensions.month : '';
  const quarter = typeof dimensions?.quarter === 'string' ? dimensions.quarter : '';
  if (year) parts.push(`期間：民國 ${year} 年${quarter ? `・${quarter}` : month ? `・${month} 月` : ''}`);
  else if (month) parts.push(`期間：${month} 月`);
  else if (release) parts.push(`期間：${statisticsPeriodLabel(release)}`);
  for (const [key, value] of Object.entries(dimensions ?? {})) {
    if (typeof value !== 'string' || !value || key === 'roc_year' || key === 'month' || key === 'quarter' || key === 'agency_fund') continue;
    parts.push(`${statisticsDimensionLabel(key)}：${statisticsDimensionValueLabel(key, value, datasetId)}`);
  }
  if (typeof dimensions?.agency_fund === 'string' && dimensions.agency_fund) parts.push(`基金：${dimensions.agency_fund}`);
  return parts.join('；');
}
export function statisticsRecipe(key: StatisticsRenderKey, selectedIndicator?: string): StatisticsRecipe {
  const recipe = statisticsRenderRecipe(key, selectedIndicator);
  const fallback = statisticsReleaseFallback(key);
  return { layerKey: key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, ...('releaseId' in recipe ? { releaseId: recipe.releaseId, allowReleaseFallback: true } : {}), ...(fallback ? { releaseFallback: fallback } : {}), ...('includeHealth' in recipe ? { includeHealth: recipe.includeHealth } : {}), label: recipe.label };
}

/** A selector is allowed to expose only public releases that resolve to an exact dimensions tuple. */
export function statisticsReleaseOptions(key: StatisticsRenderKey, releases: StatisticsRelease[], selectedIndicator?: string): StatisticsReleaseOption[] {
  const baseKey = statisticsBaseKey(key, selectedIndicator);
  const view = getEducationPresentationView(key);
  const restrictToViewStage = (options: StatisticsReleaseOption[]) => view ? options.filter(option => option.dimensions.education_stage === view.stage) : options;
  if (getComparisonRecipe(baseKey)) return restrictToViewStage(comparisonReleaseOptions(baseKey, releases));
  if (getAgriRecipe(baseKey)) return restrictToViewStage(agriReleaseOptions(baseKey, releases));
  if (getSocialRecipe(baseKey)) return restrictToViewStage(socialReleaseOptions(baseKey, releases));
  const recipe = STATISTICS_RECIPES[baseKey];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return [];
  return restrictToViewStage(releases.flatMap(release => {
    const option = recipe.releaseSelector.resolve(release);
    return option ? [option] : [];
  }));
}
export function unparseableStatisticsReleaseCount(key: StatisticsRenderKey, releases: StatisticsRelease[], selectedIndicator?: string): number {
  const baseKey = statisticsBaseKey(key, selectedIndicator);
  const view = getEducationPresentationView(key);
  const source = getSocialRecipe(baseKey) ?? getComparisonRecipe(baseKey);
  const scopedReleaseIds = view && source
    ? new Set(source.release_options.filter(option => option.dimensions.education_stage === view.stage).map(option => option.release_id))
    : null;
  const compatible = releases.filter(release => (!release.levels || release.levels.includes(STATISTICS_RECIPES[baseKey].level))
    && (!scopedReleaseIds || scopedReleaseIds.has(release.release_id)));
  if (getComparisonRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  if (getAgriRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  if (getSocialRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  const recipe = STATISTICS_RECIPES[baseKey];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return 0;
  return compatible.filter(release => !recipe.releaseSelector.resolve(release)).length;
}
export function useStatisticsSnapshot(key: StatisticsRenderKey) {
  return useSyncExternalStore(cb => regionalStatisticsStore.subscribe(key, cb), () => regionalStatisticsStore.getSnapshot(key));
}
function publicLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return value; } catch { /* no link */ }
}
export function statisticsValueLabel(value: unknown, unit: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString()}${unit ? ` ${unit}` : ''}` : '未提供';
}

/** Let statistics controls inherit the light or dark sidebar palette. */
export function statisticsDetailControlStyle(): CSSProperties {
  return {
    boxSizing: 'border-box', width: '100%', minWidth: 0, maxWidth: '100%',
    background: 'transparent', color: 'inherit', border: '1px solid currentColor', colorScheme: 'inherit',
    borderRadius: RADIUS.md, padding: '3px 24px 3px 6px', font: 'inherit',
    lineHeight: 1.35, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
  };
}

/** Mirrors the Mapbox `step` expression: one numeric colour per interval. */
type StatisticsDisplayFormat = { locale?: string; maximumFractionDigits?: number };

function statisticsLegendThreshold(value: number, format?: StatisticsDisplayFormat): string {
  if (!format?.maximumFractionDigits && format?.maximumFractionDigits !== 0) return String(value);
  const rounded = Number(value.toFixed(format.maximumFractionDigits));
  const display = new Intl.NumberFormat(format.locale, { maximumFractionDigits: format.maximumFractionDigits }).format(value);
  return rounded === value ? display : `≈${display}`;
}

export function statisticsLegendRows(recipe: Pick<typeof STATISTICS_RECIPES[StatisticsLayerKey], 'breaks' | 'colors'>, format?: StatisticsDisplayFormat) {
  const stops = statisticsColorStops(recipe.breaks, recipe.colors);
  if (stops.length === 0) return [{ color: recipe.colors[0]!, label: '所有數值' }];
  return [{ color: recipe.colors[0]!, label: `低於 ${statisticsLegendThreshold(stops[0]!.value, format)}` }].concat(stops.map((stop, index) => ({
    color: stop.color,
    label: index === stops.length - 1 ? `${statisticsLegendThreshold(stop.value, format)} 以上` : `${statisticsLegendThreshold(stop.value, format)} 至未滿 ${statisticsLegendThreshold(stops[index + 1]!.value, format)}`,
  })));
}
export function StatisticsDetails({ layerKey }: { layerKey: StatisticsRenderKey }) {
  const state = useStatisticsSnapshot(layerKey);
  useEffect(() => {
    regionalStatisticsStore.registerRecipe(layerKey, statisticsRecipe(layerKey));
    void regionalStatisticsStore.load(layerKey);
  }, [layerKey]);
  const source = state.source;
  const freshness = source?.freshness as { last_checked_at?: string; outcome?: string } | undefined;
  const activeBaseKey = statisticsBaseKey(layerKey, state.selection?.indicatorId);
  const selected = state.selection?.releaseId ?? state.release?.release_id ?? '';
  const selectable = statisticsReleaseOptions(layerKey, state.releases, state.selection?.indicatorId);
  const unparseableCount = unparseableStatisticsReleaseCount(layerKey, state.releases, state.selection?.indicatorId);
  const defaultReleaseId = 'releaseId' in STATISTICS_RECIPES[activeBaseKey] ? STATISTICS_RECIPES[activeBaseKey].releaseId : undefined;
  const configured = selectable.find(option => option.releaseId === selected && (!state.selection?.dimensions || JSON.stringify(Object.entries(option.dimensions).sort()) === JSON.stringify(Object.entries(state.selection.dimensions).sort())))
    ?? selectable.find(option => option.releaseId === defaultReleaseId)
    ?? selectable[0];
  const selectorDimensions = configured?.dimensions;
  const selectedDimensions = state.selection?.dimensions ?? selectorDimensions;
  const selectedRelease = state.releases.find(release => release.release_id === selected) ?? state.release;
  const recipe = statisticsRenderRecipe(layerKey, state.selection?.indicatorId);
  const view = getEducationPresentationView(layerKey);
  const agri = getAgriRecipe(activeBaseKey);
  const social = getSocialRecipe(activeBaseKey);
  const selectionSummary = statisticsDimensionSummary(selectedDimensions, selectedRelease, recipe.dataset_id);
  const healthUnit = state.health?.currency ?? recipe.unit;
  const coverageStatusLabel = statisticsCoverageStatusLabel(Boolean(agri));
  const selectorValues = (name: string, filters: Partial<Record<string, string>> = {}) => [...new Set(selectable
    .filter(option => Object.entries(filters).every(([key, value]) => option.dimensions[key] === value))
    .map(option => option.dimensions[name])
    .filter((value): value is string => typeof value === 'string'))];
  const chooseDimensions = (dimensions: Record<string, string>, changedKey: string) => {
    // Cascading controls enumerate existing tuples only. Changing an upstream
    // dimension selects a real tuple and explicitly updates dependent controls.
    const keys = Object.keys(selectorDimensions ?? {});
    const prefix = Object.fromEntries(keys.slice(0, keys.indexOf(changedKey) + 1).map(key => [key, dimensions[key]]));
    const option = (agri || social) ? selectable.find(candidate => Object.entries(prefix).every(([key, value]) => candidate.dimensions[key] === value)) : selectable.find(candidate => Object.entries(dimensions).every(([key, value]) => candidate.dimensions[key] === value))
      ?? selectable.find(candidate => candidate.dimensions.roc_year === dimensions.roc_year)
      ?? selectable[0];
    if (!option) return;
    const release = state.releases.find(candidate => candidate.release_id === option.releaseId);
    const resolved = social && release ? resolveSocialRelease(activeBaseKey, release, option.dimensions) : option;
    if (!resolved) return;
    regionalStatisticsStore.setSelection(layerKey, { ...statisticsRecipe(layerKey, state.selection?.indicatorId), releaseId: resolved.releaseId, dimensions: resolved.dimensions, allowReleaseFallback: false });
    void regionalStatisticsStore.load(layerKey);
  };
  const control = statisticsDetailControlStyle();
  const filterLabel: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center',
    gap: SPACING.xs, minWidth: 0, color: 'inherit', lineHeight: 1.35,
  };
  const factStyle: CSSProperties = { margin: 0, minWidth: 0, lineHeight: 1.45 };
  const hasFilterControls = Boolean(selectorDimensions) || state.releases.length > 0;
  const selectorDimensionKeys = selectorDimensions ? Object.keys(selectorDimensions).filter(key => typeof selectorDimensions[key] === 'string' && selectorDimensions[key]) : [];
  const selectableDimensionKeys = selectorDimensionKeys.filter((key, index) => {
    const filters = Object.fromEntries(selectorDimensionKeys.slice(0, index).map(filterKey => [filterKey, selectorDimensions![filterKey]!])) as Partial<Record<string, string>>;
    return selectorValues(key, filters).length > 1;
  });
  return <div className="statistics-details" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md, minWidth: 0, maxWidth: '100%', fontFamily: 'Inter, system-ui, sans-serif', fontSize: FONT_SIZE.sm, color: 'inherit', colorScheme: 'inherit', lineHeight: 1.45 }}>
    <style>{`.statistics-details summary:focus-visible,.statistics-details .statistics-detail-control:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style>
    {state.loading && <span role="status">統計資料載入中…</span>}
    {state.error && <div role="alert">{state.error}<button type="button" style={control} onClick={() => void regionalStatisticsStore.load(layerKey)}>重試</button></div>}
    {agri && import.meta.env.DEV && import.meta.env.VITE_AGRI_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>本地 Preview · 真實交付資料 · 尚未發布至正式 API</p>}
    {view && import.meta.env.DEV && <a href="/statistics-accessibility-review.html" target="_blank" rel="noreferrer">教育路網可達性：開啟本地試算</a>}
    {view && <label style={filterLabel}>指標
      <select className="statistics-detail-control" aria-label={`${view.label} 指標`} style={control} value={activeBaseKey} onChange={event => {
        const nextBaseKey = event.target.value as StatisticsLayerKey;
        const options = (getSocialRecipe(nextBaseKey) ?? getComparisonRecipe(nextBaseKey))?.release_options.filter(option => option.dimensions.education_stage === view.stage) ?? [];
        const option = options.find(candidate => candidate.period_start === selectedRelease?.period_start && candidate.period_end === selectedRelease?.period_end);
        if (!option) return;
        regionalStatisticsStore.setSelection(layerKey, { ...statisticsRecipe(layerKey, STATISTICS_RECIPES[nextBaseKey].indicator_id), releaseId: option.release_id, dimensions: option.dimensions, allowReleaseFallback: false });
        void regionalStatisticsStore.load(layerKey);
      }}>{view.metrics.map(metric => {
        const enabled = ((getSocialRecipe(metric.layerKey) ?? getComparisonRecipe(metric.layerKey))?.release_options ?? [])
          .some(option => option.dimensions.education_stage === view.stage && option.period_start === selectedRelease?.period_start && option.period_end === selectedRelease?.period_end);
        return <option key={metric.layerKey} value={metric.layerKey} disabled={!enabled}>{metric.label}{enabled ? '' : '（此學年未提供）'}</option>;
      })}</select>
    </label>}
    {hasFilterControls && <details>
      <summary aria-label={`${recipe.label} 資料篩選：${selectionSummary || '選擇資料期別'}`} style={{ cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        資料篩選{selectionSummary && <span title={selectionSummary}>：{selectionSummary}</span>}
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SPACING.xs, minWidth: 0, maxWidth: '100%', paddingTop: SPACING.xs }} aria-label={`${recipe.label} 篩選器`}>
        {selectorDimensions && selectableDimensionKeys.map((key, index) => {
          const value = selectorDimensions[key]!;
          const filters = Object.fromEntries(selectorDimensionKeys.slice(0, selectorDimensionKeys.indexOf(key)).map(filterKey => [filterKey, selectorDimensions[filterKey]!])) as Partial<Record<string, string>>;
          return <label key={key} style={{ ...filterLabel, ...(selectableDimensionKeys.length % 2 === 1 && index === selectableDimensionKeys.length - 1 ? { gridColumn: '1 / -1' } : {}) }}>
            {statisticsDimensionLabel(key)}
            <select className="statistics-detail-control" aria-label={`${recipe.label} ${statisticsDimensionLabel(key)}`} style={control} title={value} value={value} onChange={event => chooseDimensions({ ...selectorDimensions, [key]: event.target.value }, key)}>
              {selectorValues(key, filters).map(option => <option key={option} value={option}>{statisticsDimensionValueLabel(key, option, recipe.dataset_id)}</option>)}
            </select>
          </label>;
        })}
        {state.releases.length > 0 && !selectorDimensions && <label style={{ ...filterLabel, gridColumn: '1 / -1' }}>資料期別 <select className="statistics-detail-control" aria-label={`${recipe.label} 資料期別`} style={control} value={String(selected)} onChange={event => {
          regionalStatisticsStore.setSelection(layerKey, { ...(state.selection ?? statisticsRecipe(layerKey)), releaseId: event.target.value, allowReleaseFallback: false });
          void regionalStatisticsStore.load(layerKey);
        }}>{state.releases.map(release => <option key={release.release_id} value={release.release_id}>{statisticsPeriodLabel(release)}</option>)}</select></label>}
      </div>
    </details>}
    {agri && <p style={factStyle}>{agri.disclosure ?? agri.boundary_semantics}</p>}
    {agri?.source_statistical_boundary_version && <p style={factStyle}>統計參考版：{agri.source_statistical_boundary_version}；實際圖形：{agri.boundary_version}</p>}
    {social?.disclosure && <p style={factStyle}>{social.disclosure}</p>}
    {social && <p style={factStyle}>參考邊界：{social.boundary_version}；{social.boundary_semantics ?? '以交付資料的參考邊界呈現。'}</p>}
    <p style={factStyle}>地理層級：{LEVEL_LABELS[recipe.level]} · 單位：{recipe.unit}</p>
    {'freshness' in recipe && <p style={factStyle} role="status">資料新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</p>}
    {state.health?.availability && <p style={factStyle} role="status">資料可用狀態：{state.health.availability}</p>}
    {state.health?.reason && <p style={factStyle}>資料限制：{state.health.reason}</p>}
    {state.data && <p style={factStyle}>已載入 {state.data.features.filter(f => f.properties?.status === 'observed').length}／{state.data.features.length} 個{statisticsSelectedTupleAreaLabel(recipe)}；灰色區域為缺資料，不等於 0</p>}
    {view && getComparisonRecipe(activeBaseKey)?.indicator_id.endsWith('_per_10000_residents') && <p style={factStyle}>人均指標的分母為全體戶籍人口，並非學齡人口；學年度統計與人口統計之間存在時間差。</p>}
    {'interpretationNote' in recipe && <p style={factStyle}>{String(recipe.interpretationNote)}</p>}
    {agri && state.data && <p style={factStyle}>缺資料 {state.data.features.filter(f => f.properties?.status === 'missing' && f.properties?.source_status !== 'not_reported').length}；遮蔽 suppressed {state.data.features.filter(f => f.properties?.status === 'suppressed').length}；未報告 not_reported {state.data.features.filter(f => f.properties?.source_status === 'not_reported').length}。遮蔽與未報告皆非 0。</p>}
    {unparseableCount > 0 && <p style={factStyle} role="alert">有 {unparseableCount} 個公開期別不符合完整 selector 白名單，未提供選擇，請查看來源紀錄。</p>}
    {state.health?.coverage_status && <p style={factStyle} role="status">{coverageStatusLabel}：{state.health.coverage_status}（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} {statisticsCoverageAreaLabel(recipe)}）；未分配 {statisticsValueLabel(state.health.unallocated_total, healthUnit)}</p>}
    <details><summary>來源與處理紀錄</summary>
      {source ? <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        <span>提供機關：{String(source.publisher ?? '未提供')}</span>
        <span>發布時間：{source.published_at ? String(source.published_at) : '來源未提供'}</span>
        <span>取得時間：{String(source.retrieved_at ?? '未提供')}</span>
        <span>資料期間：{String(source.period_start ?? '')} — {String(source.period_end ?? '')}</span>
        <span>更新頻率：{recipe.frequency}；資料期別不等於取得日期</span>
        <span>最近檢查：{freshness?.last_checked_at ?? '尚未檢查'}{freshness?.outcome === 'failed' ? '（更新失敗，保留上一版）' : freshness?.outcome === 'unchanged' ? '（無新版本）' : ''}</span>
        <span>授權：{String(source.license ?? '未提供')}</span>
        <span>處理方式：{String((source.processing_summary as { processing_description?: string } | undefined)?.processing_description ?? source.method_version ?? '未提供')}</span>
        <span>原始 SHA-256：{String(source.raw_sha256 ?? '未提供')}</span>
        <span>參考邊界：{String(source.boundary_version ?? '未提供')}</span>
        <span>地圖使用已核對代碼的參考邊界；不是歷史邊界變動比較。</span>
        {publicLink(source.source_landing_url) && <a style={{ color: 'inherit', textDecoration: 'underline' }} href={String(source.source_landing_url)} target="_blank" rel="noreferrer">官方資料頁 ↗</a>}
        {publicLink(source.source_download_url) && <a style={{ color: 'inherit', textDecoration: 'underline' }} href={String(source.source_download_url)} target="_blank" rel="noreferrer">來源下載端點 ↗</a>}
      </div> : <span>載入資料後顯示來源紀錄。</span>}
    </details>
    {agri && AGRI_EXISTING_LAYER_REFERENCES.some(ref => ref.group === agri.group) && <details><summary>跨主題統計索引</summary><div style={{ display: 'grid', gap: 4 }}>{AGRI_EXISTING_LAYER_REFERENCES.filter(ref => ref.group === agri.group).map(ref => <button key={ref.layer_key} type="button" onClick={() => layerVisibilityStore.toggle(ref.layer_key as keyof LayerVisibility)}>{ref.group}／{ref.subgroup}：{(LAYER_MANIFEST[ref.layer_key as keyof LayerVisibility] as LayerManifestEntry).label ?? ref.layer_key}</button>)}</div></details>}
    {agri && <details><summary>相關 GIS 圖層</summary><div style={{ display: 'grid', gap: 4 }}>{agri.related_layer_keys.filter(key => key in LAYER_MANIFEST).map(key => <button key={key} type="button" onClick={() => layerVisibilityStore.toggle(key as keyof LayerVisibility)}>{(LAYER_MANIFEST[key as keyof LayerVisibility] as LayerManifestEntry).label ?? key}</button>)}</div></details>}
    {social && social.related_layer_keys.length > 0 && <details><summary>相關 GIS 圖層</summary><div style={{ display: 'grid', gap: 4 }}>{social.related_layer_keys.filter(key => key in LAYER_MANIFEST).map(key => <button key={key} type="button" onClick={() => layerVisibilityStore.toggle(key as keyof LayerVisibility)}>{(LAYER_MANIFEST[key as keyof LayerVisibility] as LayerManifestEntry).label ?? key}</button>)}</div></details>}
  </div>;
}
export function StatisticsLegend({ layerKey }: { layerKey: StatisticsRenderKey }) {
  const state = useStatisticsSnapshot(layerKey);
  const baseKey = statisticsBaseKey(layerKey, state.selection?.indicatorId);
  const recipe = statisticsRenderRecipe(layerKey, state.selection?.indicatorId);
  const agri = getAgriRecipe(baseKey);
  const social = getSocialRecipe(baseKey);
  return <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault, display: 'grid', gap: 4 }}>
    <strong>{recipe.label}</strong>
    <span>{state.release ? statisticsPeriodLabel(state.release) : '尚未載入'} · {recipe.unit}</span>
    {'freshness' in recipe && <span>新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</span>}
    {state.health?.availability && <span>資料可用狀態：{state.health.availability}</span>}
    {state.health?.coverage_status && <span>{statisticsCoverageStatusLabel(Boolean(agri))}：{state.health.coverage_status}（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} {statisticsCoverageAreaLabel(recipe)}）；未分配 {statisticsValueLabel(state.health.unallocated_total, state.health.currency ?? recipe.unit)}</span>}
    {state.loading && <span>載入中…</span>}{state.error && <span role="alert">{state.error}</span>}
    <span>{recipe.breaks.some(value => value < 0) ? '棕色：負值；紫色：非負值；0 為分界，顏色不代表好壞' : '淺 → 深：數值低 → 高；請依本指標的數字區間比較'}</span>
    {statisticsLegendRows(recipe, social?.format).map(({ color, label }) => <div key={`${color}:${label}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: color, width: 14, height: 8 }} />{label}</div>)}
    <span>{social ? '灰色：缺資料（含來源 -），不等於 0；真 0 使用數值色階' : '灰色：缺資料／未發布數值'}</span>
    {agri && <><span><i style={{ display: 'inline-block', width: 16, height: 12, marginRight: 6, background: `repeating-linear-gradient(135deg, #334155 0 2px, ${agri.legend.missing_color} 2px 6px)` }} />斜線：遮蔽 suppressed（*）</span><span>{agri.legend.not_reported_label} not_reported（-）：非 0；真 0 使用數值色階</span></>}
    {social && <span><i style={{ display: 'inline-block', width: 16, height: 12, marginRight: 6, background: `repeating-linear-gradient(135deg, #334155 0 2px, ${social.legend.missing_color} 2px 6px)` }} />斜線：遮蔽 suppressed（*）</span>}
  </div>;
}
