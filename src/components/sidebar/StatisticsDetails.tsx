import { useEffect, useSyncExternalStore } from 'react';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, type StatisticsLayerKey } from '../../data/regionalStatisticsRecipes';
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
  return { datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, label: recipe.label };
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
  const control = { background: SURFACE.strong, color: COLORS.textDefault, border: '1px solid currentColor', borderRadius: 4, padding: 4, maxWidth: '100%' };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: FONT_SIZE.sm, color: COLORS.textDefault, colorScheme: 'dark' }}>
    {state.loading && <span role="status">統計資料載入中…</span>}
    {state.error && <div role="alert">{state.error}<button type="button" style={control} onClick={() => void regionalStatisticsStore.load(layerKey)}>重試</button></div>}
    {state.releases.length > 0 && <label>資料期別 <select aria-label={`${STATISTICS_RECIPES[layerKey].label} 資料期別`} style={control} value={String(selected)} onChange={event => {
      regionalStatisticsStore.setSelection(layerKey, { ...(state.selection ?? statisticsRecipe(layerKey)), releaseId: event.target.value });
      void regionalStatisticsStore.load(layerKey);
    }}>{state.releases.map(release => <option key={release.release_id} value={release.release_id}>{statisticsPeriodLabel(release)}</option>)}</select></label>}
    <span>地理層級：{LEVEL_LABELS[STATISTICS_RECIPES[layerKey].level]} · 單位：{STATISTICS_RECIPES[layerKey].unit}</span>
    {state.data && <span>已載入 {state.data.features.filter(f => f.properties?.status === 'observed').length} ／{state.data.features.length} 個區域統計值；灰色區域為缺資料</span>}
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
    {state.loading && <span>載入中…</span>}{state.error && <span role="alert">{state.error}</span>}
    {recipe.colors.map((color, index) => <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: color, width: 14, height: 8 }} />{index === 0 ? `低於 ${recipe.breaks[0]}` : index === recipe.breaks.length ? `${recipe.breaks[index - 1]} 以上` : `${recipe.breaks[index - 1]} 至未滿 ${recipe.breaks[index]}`}</div>)}
    <span>灰色：缺資料／未發布數值</span>
  </div>;
}
