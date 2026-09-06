import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, statisticsReleaseFallback, type StatisticsLayerKey, type StatisticsReleaseOption } from '../../data/regionalStatisticsRecipes';
import type { StatisticsRecipe, StatisticsRelease, StatisticsLevel } from '../../data/regionalStatisticsLoader';
import { FONT_SIZE, SURFACE, COLORS, RADIUS, SPACING } from '../../styles/designTokens';

const LEVEL_LABELS: Record<StatisticsLevel, string> = {county:'縣市',township:'鄉鎮市區',village:'村里',statistical_min:'最小統計區',statistical_l1:'第一級統計區',statistical_l2:'第二級統計區'};
export function statisticsPeriodLabel(release: Pick<StatisticsRelease, 'period_start' | 'period_end'>): string {
  const start = release.period_start, end = release.period_end;
  if (start.endsWith('-01-01') && end === `${start.slice(0,4)}-12-31`) return `${start.slice(0,4)} 年`;
  return `${start} — ${end}`;
}
const DIMENSION_LABELS: Record<string, string> = {
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
};
const DIMENSION_VALUE_LABELS: Record<string, Record<string, string>> = {
  sector: { residential: '住宅' },
  budget_type: { civil_aviation_fund: '民航基金', public_budget: '公務預算', special_budget: '特別預算' },
  value_basis: { year_to_date_cumulative: '年度累計快照' },
  geographic_coverage: { taipei_only: '僅臺北市', taichung_only: '僅臺中市', taipei_township_only: '僅臺北市 12 區', county_location: '縣市所在地' },
  bus_metric: { operating_route_length_km: '期末營業里程', approved_route_count: '核定路線數', urban_bus_operator_count: '市區客運業家數', operating_vehicle_count: '期末營業車輛', accessible_vehicle_count: '期末無障礙車輛', electric_vehicle_count: '期末電動車輛', operating_trip_count: '營業行車次數', operating_vehicle_km: '營業行車里程' },
  system_id: { tmrt: '臺中捷運' },
  source_field: { COLUMN1: '市區租借站數', COLUMN3: '市區年租借次數', COLUMN5: '河濱租借站數', COLUMN6: '河濱自行車數', COLUMN7: '河濱年租借次數' },
  geographic_semantics: { station_location: '車站所在地', facility_location_activity: '設施所在地活動' },
  health: { CURRENT: 'CURRENT', STALE: 'STALE' }, coverage: { PARTIAL: 'PARTIAL' }, refresh: { manual: '人工更新' },
};

function statisticsDimensionLabel(key: string): string {
  if (key === 'roc_year') return '年度';
  if (key === 'month') return '月份';
  return DIMENSION_LABELS[key] ?? key;
}

function statisticsDimensionValueLabel(key: string, value: string): string {
  if (key === 'roc_year') return `民國 ${value} 年`;
  if (key === 'month') return `${value} 月`;
  return DIMENSION_VALUE_LABELS[key]?.[value] ?? value;
}

/** Compact, human-readable selection text for the collapsed filter disclosure. */
export function statisticsDimensionSummary(dimensions: Record<string, unknown> | undefined, release?: Pick<StatisticsRelease, 'period_start' | 'period_end'> | null): string {
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
    parts.push(`${statisticsDimensionLabel(key)}：${statisticsDimensionValueLabel(key, value)}`);
  }
  if (typeof dimensions?.agency_fund === 'string' && dimensions.agency_fund) parts.push(`基金：${dimensions.agency_fund}`);
  return parts.join('；');
}
export function statisticsRecipe(key: StatisticsLayerKey): StatisticsRecipe {
  const recipe = STATISTICS_RECIPES[key];
  const fallback = statisticsReleaseFallback(key);
  return { datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, ...('releaseId' in recipe ? { releaseId: recipe.releaseId, allowReleaseFallback: true } : {}), ...(fallback ? { releaseFallback: fallback } : {}), ...('includeHealth' in recipe ? { includeHealth: recipe.includeHealth } : {}), label: recipe.label };
}

/** A selector is allowed to expose only public releases that resolve to an exact dimensions tuple. */
export function statisticsReleaseOptions(key: StatisticsLayerKey, releases: StatisticsRelease[]): StatisticsReleaseOption[] {
  const recipe = STATISTICS_RECIPES[key];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return [];
  return releases.flatMap(release => {
    const option = recipe.releaseSelector.resolve(release);
    return option ? [option] : [];
  });
}
export function unparseableStatisticsReleaseCount(key: StatisticsLayerKey, releases: StatisticsRelease[]): number {
  const recipe = STATISTICS_RECIPES[key];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return 0;
  return releases.filter(release => !recipe.releaseSelector.resolve(release)).length;
}
export function useStatisticsSnapshot(key: StatisticsLayerKey) {
  return useSyncExternalStore(cb => regionalStatisticsStore.subscribe(key, cb), () => regionalStatisticsStore.getSnapshot(key));
}
function publicLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return value; } catch { /* no link */ }
}
export function statisticsValueLabel(value: unknown, unit: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString()}${unit ? ` ${unit}` : ''}` : '未提供';
}
export function StatisticsDetails({ layerKey }: { layerKey: StatisticsLayerKey }) {
  const state = useStatisticsSnapshot(layerKey);
  useEffect(() => {
    regionalStatisticsStore.registerRecipe(layerKey, statisticsRecipe(layerKey));
    void regionalStatisticsStore.load(layerKey);
  }, [layerKey]);
  const source = state.source;
  const freshness = source?.freshness as { last_checked_at?: string; outcome?: string } | undefined;
  const selected = state.selection?.releaseId ?? state.release?.release_id ?? '';
  const selectable = statisticsReleaseOptions(layerKey, state.releases);
  const unparseableCount = unparseableStatisticsReleaseCount(layerKey, state.releases);
  const defaultReleaseId = 'releaseId' in STATISTICS_RECIPES[layerKey] ? STATISTICS_RECIPES[layerKey].releaseId : undefined;
  const configured = selectable.find(option => option.releaseId === selected)
    ?? selectable.find(option => option.releaseId === defaultReleaseId)
    ?? selectable[0];
  const selectorDimensions = configured?.dimensions;
  const selectedDimensions = state.selection?.dimensions ?? selectorDimensions;
  const selectedRelease = state.releases.find(release => release.release_id === selected) ?? state.release;
  const selectionSummary = statisticsDimensionSummary(selectedDimensions, selectedRelease);
  const recipe = STATISTICS_RECIPES[layerKey];
  const healthUnit = state.health?.currency ?? recipe.unit;
  const selectorValues = (name: string, filters: Partial<Record<string, string>> = {}) => [...new Set(selectable
    .filter(option => Object.entries(filters).every(([key, value]) => option.dimensions[key] === value))
    .map(option => option.dimensions[name])
    .filter((value): value is string => typeof value === 'string'))];
  const chooseDimensions = (dimensions: Record<string, string>) => {
    const option = selectable.find(candidate => Object.entries(dimensions).every(([key, value]) => candidate.dimensions[key] === value))
      ?? selectable.find(candidate => candidate.dimensions.roc_year === dimensions.roc_year)
      ?? selectable[0];
    if (!option) return;
    regionalStatisticsStore.setSelection(layerKey, { ...statisticsRecipe(layerKey), releaseId: option.releaseId, dimensions: option.dimensions, allowReleaseFallback: false });
    void regionalStatisticsStore.load(layerKey);
  };
  const control: CSSProperties = {
    boxSizing: 'border-box', width: '100%', minWidth: 0, maxWidth: '100%',
    background: SURFACE.strong, color: COLORS.textDefault, border: '1px solid currentColor',
    borderRadius: RADIUS.md, padding: '3px 24px 3px 6px', font: 'inherit',
    lineHeight: 1.35, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
  };
  const filterLabel: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center',
    gap: SPACING.xs, minWidth: 0, color: COLORS.textMuted, lineHeight: 1.35,
  };
  const factStyle: CSSProperties = { margin: 0, minWidth: 0, lineHeight: 1.45 };
  const hasFilterControls = Boolean(selectorDimensions) || state.releases.length > 0;
  const selectorDimensionKeys = selectorDimensions ? Object.keys(selectorDimensions).filter(key => typeof selectorDimensions[key] === 'string' && selectorDimensions[key]) : [];
  const selectableDimensionKeys = selectorDimensionKeys.filter((key, index) => {
    const filters = Object.fromEntries(selectorDimensionKeys.slice(0, index).map(filterKey => [filterKey, selectorDimensions![filterKey]!])) as Partial<Record<string, string>>;
    return selectorValues(key, filters).length > 1;
  });
  return <div className="statistics-details" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md, minWidth: 0, maxWidth: '100%', fontFamily: 'Inter, system-ui, sans-serif', fontSize: FONT_SIZE.sm, color: COLORS.textDefault, colorScheme: 'dark', lineHeight: 1.45 }}>
    <style>{`.statistics-details summary:focus-visible,.statistics-details .statistics-detail-control:focus-visible{outline:2px solid ${COLORS.textDefault};outline-offset:2px}`}</style>
    {state.loading && <span role="status">統計資料載入中…</span>}
    {state.error && <div role="alert">{state.error}<button type="button" style={control} onClick={() => void regionalStatisticsStore.load(layerKey)}>重試</button></div>}
    {hasFilterControls && <details>
      <summary aria-label={`${STATISTICS_RECIPES[layerKey].label} 資料篩選：${selectionSummary || '選擇資料期別'}`} style={{ cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        資料篩選{selectionSummary && <span title={selectionSummary}>：{selectionSummary}</span>}
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SPACING.xs, minWidth: 0, maxWidth: '100%', paddingTop: SPACING.xs }} aria-label={`${STATISTICS_RECIPES[layerKey].label} 篩選器`}>
        {selectorDimensions && selectableDimensionKeys.map((key, index) => {
          const value = selectorDimensions[key]!;
          const filters = Object.fromEntries(selectorDimensionKeys.slice(0, selectorDimensionKeys.indexOf(key)).map(filterKey => [filterKey, selectorDimensions[filterKey]!])) as Partial<Record<string, string>>;
          return <label key={key} style={{ ...filterLabel, ...(selectableDimensionKeys.length % 2 === 1 && index === selectableDimensionKeys.length - 1 ? { gridColumn: '1 / -1' } : {}) }}>
            {statisticsDimensionLabel(key)}
            <select className="statistics-detail-control" aria-label={`${STATISTICS_RECIPES[layerKey].label} ${statisticsDimensionLabel(key)}`} style={control} title={value} value={value} onChange={event => chooseDimensions({ ...selectorDimensions, [key]: event.target.value })}>
              {selectorValues(key, filters).map(option => <option key={option} value={option}>{statisticsDimensionValueLabel(key, option)}</option>)}
            </select>
          </label>;
        })}
        {state.releases.length > 0 && !selectorDimensions && <label style={{ ...filterLabel, gridColumn: '1 / -1' }}>資料期別 <select className="statistics-detail-control" aria-label={`${STATISTICS_RECIPES[layerKey].label} 資料期別`} style={control} value={String(selected)} onChange={event => {
          regionalStatisticsStore.setSelection(layerKey, { ...(state.selection ?? statisticsRecipe(layerKey)), releaseId: event.target.value, allowReleaseFallback: false });
          void regionalStatisticsStore.load(layerKey);
        }}>{state.releases.map(release => <option key={release.release_id} value={release.release_id}>{statisticsPeriodLabel(release)}</option>)}</select></label>}
      </div>
    </details>}
    <p style={factStyle}>地理層級：{LEVEL_LABELS[recipe.level]} · 單位：{recipe.unit}</p>
    {'freshness' in recipe && <p style={factStyle} role="status">資料新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</p>}
    {state.health?.availability && <p style={factStyle} role="status">資料可用狀態：{state.health.availability}</p>}
    {state.data && <p style={factStyle}>已載入 {state.data.features.filter(f => f.properties?.status === 'observed').length} ／{state.data.features.length} 個區域統計值；灰色區域為缺資料，不等於 0</p>}
    {'interpretationNote' in STATISTICS_RECIPES[layerKey] && <p style={factStyle}>{String(STATISTICS_RECIPES[layerKey].interpretationNote)}</p>}
    {unparseableCount > 0 && <p style={factStyle} role="alert">有 {unparseableCount} 個公開期別無法安全解析成年／月／機關或基金，未提供選擇，請查看來源紀錄。</p>}
    {state.health?.coverage_status && <p style={factStyle} role="status">覆蓋狀態：{state.health.coverage_status}（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} 縣市）；未分配 {statisticsValueLabel(state.health.unallocated_total, healthUnit)}</p>}
    <details><summary>來源與處理紀錄</summary>
      {source ? <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        <span>提供機關：{String(source.publisher ?? '未提供')}</span>
        <span>發布時間：{source.published_at ? String(source.published_at) : '來源未提供'}</span>
        <span>取得時間：{String(source.retrieved_at ?? '未提供')}</span>
        <span>資料期間：{String(source.period_start ?? '')} — {String(source.period_end ?? '')}</span>
        <span>更新頻率：{STATISTICS_RECIPES[layerKey].frequency}；資料期別不等於取得日期</span>
        <span>最近檢查：{freshness?.last_checked_at ?? '尚未檢查'}{freshness?.outcome === 'failed' ? '（更新失敗，保留上一版）' : freshness?.outcome === 'unchanged' ? '（無新版本）' : ''}</span>
        <span>授權：{String(source.license ?? '未提供')}</span>
        <span>處理方式：{String((source.processing_summary as { processing_description?: string } | undefined)?.processing_description ?? source.method_version ?? '未提供')}</span>
        <span>參考邊界：{String(source.boundary_version ?? '未提供')}</span>
        <span>地圖使用已核對代碼的參考邊界；不是歷史邊界變動比較。</span>
        {publicLink(source.source_landing_url) && <a style={{ color: COLORS.textDefault, textDecoration: 'underline' }} href={String(source.source_landing_url)} target="_blank" rel="noreferrer">官方資料頁 ↗</a>}
        {publicLink(source.source_download_url) && <a style={{ color: COLORS.textDefault, textDecoration: 'underline' }} href={String(source.source_download_url)} target="_blank" rel="noreferrer">來源下載端點 ↗</a>}
      </div> : <span>載入資料後顯示來源紀錄。</span>}
    </details>
  </div>;
}
export function StatisticsLegend({ layerKey }: { layerKey: StatisticsLayerKey }) {
  const state = useStatisticsSnapshot(layerKey);
  const recipe = STATISTICS_RECIPES[layerKey];
  return <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault, display: 'grid', gap: 4 }}>
    <strong>{recipe.label}</strong>
    <span>{state.release ? statisticsPeriodLabel(state.release) : '尚未載入'} · {recipe.unit}</span>
    {'freshness' in recipe && <span>新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</span>}
    {state.health?.availability && <span>資料可用狀態：{state.health.availability}</span>}
    {state.health?.coverage_status && <span>{state.health.coverage_status}：{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} {LEVEL_LABELS[recipe.level]}；未分配 {statisticsValueLabel(state.health.unallocated_total, state.health.currency ?? recipe.unit)}</span>}
    {state.loading && <span>載入中…</span>}{state.error && <span role="alert">{state.error}</span>}
    {recipe.colors.map((color, index) => <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: color, width: 14, height: 8 }} />{index === 0 ? `低於 ${recipe.breaks[0]}` : index === recipe.breaks.length ? `${recipe.breaks[index - 1]} 以上` : `${recipe.breaks[index - 1]} 至未滿 ${recipe.breaks[index]}`}</div>)}
    <span>灰色：缺資料／未發布數值</span>
  </div>;
}
