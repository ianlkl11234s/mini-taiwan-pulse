import { useEffect, useSyncExternalStore } from 'react';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, statisticsReleaseFallback, type StatisticsLayerKey, type StatisticsReleaseOption } from '../../data/regionalStatisticsRecipes';
import type { StatisticsRecipe, StatisticsRelease, StatisticsLevel } from '../../data/regionalStatisticsLoader';
import { FONT_SIZE, SURFACE, COLORS } from '../../styles/designTokens';

const LEVEL_LABELS: Record<StatisticsLevel, string> = {county:'縣市',township:'鄉鎮市區',village:'村里',statistical_min:'最小統計區',statistical_l1:'第一級統計區',statistical_l2:'第二級統計區'};
export function statisticsPeriodLabel(release: StatisticsRelease): string {
  const start = release.period_start, end = release.period_end;
  if (start.endsWith('-01-01') && end === `${start.slice(0,4)}-12-31`) return `${start.slice(0,4)} 年`;
  return `${start} — ${end}`;
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
  const control = { background: SURFACE.strong, color: COLORS.textDefault, border: '1px solid currentColor', borderRadius: 4, padding: 4, maxWidth: '100%' };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: FONT_SIZE.sm, color: COLORS.textDefault, colorScheme: 'dark' }}>
    {state.loading && <span role="status">統計資料載入中…</span>}
    {state.error && <div role="alert">{state.error}<button type="button" style={control} onClick={() => void regionalStatisticsStore.load(layerKey)}>重試</button></div>}
    {selectorDimensions && <div style={{ display: 'grid', gap: 5 }} aria-label={`${STATISTICS_RECIPES[layerKey].label} 篩選器`}>
      <label>年度 <select aria-label={`${STATISTICS_RECIPES[layerKey].label} 年度`} style={control} value={selectorDimensions.roc_year} onChange={event => chooseDimensions({ ...selectorDimensions, roc_year: event.target.value })}>{selectorValues('roc_year').map(value => <option key={value} value={value}>民國 {value} 年</option>)}</select></label>
      <label>月份 <select aria-label={`${STATISTICS_RECIPES[layerKey].label} 月份`} style={control} value={selectorDimensions.month} onChange={event => chooseDimensions({ ...selectorDimensions, month: event.target.value })}>{selectorValues('month', { roc_year: selectorDimensions.roc_year }).map(value => <option key={value} value={value}>{value} 月</option>)}</select></label>
      <label>機關／基金 <select aria-label={`${STATISTICS_RECIPES[layerKey].label} 機關或基金`} style={control} value={selectorDimensions.agency_fund} onChange={event => chooseDimensions({ ...selectorDimensions, agency_fund: event.target.value })}>{selectorValues('agency_fund', { roc_year: selectorDimensions.roc_year, month: selectorDimensions.month }).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>}
    {state.releases.length > 0 && !selectorDimensions && <label>資料期別 <select aria-label={`${STATISTICS_RECIPES[layerKey].label} 資料期別`} style={control} value={String(selected)} onChange={event => {
      regionalStatisticsStore.setSelection(layerKey, { ...(state.selection ?? statisticsRecipe(layerKey)), releaseId: event.target.value, allowReleaseFallback: false });
      void regionalStatisticsStore.load(layerKey);
    }}>{state.releases.map(release => <option key={release.release_id} value={release.release_id}>{statisticsPeriodLabel(release)}</option>)}</select></label>}
    <span>地理層級：{LEVEL_LABELS[STATISTICS_RECIPES[layerKey].level]} · 單位：{STATISTICS_RECIPES[layerKey].unit}</span>
    {state.data && <span>已載入 {state.data.features.filter(f => f.properties?.status === 'observed').length} ／{state.data.features.length} 個區域統計值；灰色區域為缺資料，不等於 0</span>}
    {'interpretationNote' in STATISTICS_RECIPES[layerKey] && <span>{String(STATISTICS_RECIPES[layerKey].interpretationNote)}</span>}
    {unparseableCount > 0 && <span role="alert">有 {unparseableCount} 個公開期別無法安全解析成年／月／機關或基金，未提供選擇，請查看來源紀錄。</span>}
    {state.health?.coverage_status === 'PARTIAL' && <span role="status">覆蓋狀態：PARTIAL（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} 縣市）；未分配 {Number(state.health.unallocated_total ?? 0).toLocaleString()} {state.health.currency ?? ''}</span>}
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
    {state.health?.coverage_status === 'PARTIAL' && <span>PARTIAL：{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} 縣市；未分配 {Number(state.health.unallocated_total ?? 0).toLocaleString()} {state.health.currency ?? ''}</span>}
    {state.loading && <span>載入中…</span>}{state.error && <span role="alert">{state.error}</span>}
    {recipe.colors.map((color, index) => <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: color, width: 14, height: 8 }} />{index === 0 ? `低於 ${recipe.breaks[0]}` : index === recipe.breaks.length ? `${recipe.breaks[index - 1]} 以上` : `${recipe.breaks[index - 1]} 至未滿 ${recipe.breaks[index]}`}</div>)}
    <span>灰色：缺資料／未發布數值</span>
  </div>;
}
