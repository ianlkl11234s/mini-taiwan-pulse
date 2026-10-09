import { useSyncExternalStore, type CSSProperties } from 'react';
import { getAgriRecipe, AGRI_EXISTING_LAYER_REFERENCES } from '../../data/agriStatisticsRecipes';
import { getSocialRecipe } from '../../data/socialStatisticsRecipes';
import { getLaborRecipe, getLaborStatisticsPresentationMetric, laborLocationSemantics } from '../../data/laborStatisticsRecipes';
import { environmentLegendRows, getEnvironmentRecipe } from '../../data/environmentStatisticsRecipes';
import { PROSECUTOR_DISTRICT_LEGEND_NOTE, addictionStatusLegendRows, getAddictionRecipe } from '../../data/addictionStatisticsRecipes';
import { getLandslideRecipe } from '../../data/landslideStatisticsRecipes';
import { demographicsDisclosure, demographicsIndicatorNote, demographicsPeriodLabel, demographicsSource, getDemographicsRecipe } from '../../data/demographicsStatisticsRecipes';
import { getComparisonRecipe } from '../../data/comparisonStatisticsRecipes';
import { getEducationPresentationView } from '../../data/statisticsPresentationViews';
import { layerVisibilityStore } from '../../state/layerVisibilityStore';
import { LAYER_MANIFEST, type LayerManifestEntry } from '../../data/layerManifest';
import type { LayerVisibility } from '../../types';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, statisticsBaseKey, statisticsRenderRecipe, type StatisticsLayerKey, type StatisticsRenderKey } from '../../data/regionalStatisticsRecipes';
import type { StatisticsRecipe } from '../../data/regionalStatisticsLoader';
import { statisticsColorStops } from '../../data/statisticsColorScale';
import { FONT_SIZE, FONT_CJK, SPACING } from '../../styles/designTokens';
import { LegendRow, LegendTitle, SwatchHatch, SwatchSquare, useLegendTheme } from '../legend/legendKit';
import { useStatisticsRecipeDetails } from '../../hooks/useStatisticsRecipeDetails';
import { LEVEL_LABELS, boundaryVersionLabel, humanizeStatisticsText, statisticsDimensionSummary, statisticsPeriodLabel, statisticsAvailabilityLabel } from '../../data/statisticsLabels';
import { unparseableStatisticsReleaseCount } from '../../data/statisticsSelection';

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
/**
 * 統計的「說明・來源」內容（圖層面板統一 C 段）：期別、指標、細項已改由共用連動選單
 * （`state/statisticsLinkedSelect.ts` → `ParamControlList`）渲染；這裡只剩位置口徑、資料限制、
 * 來源與處理紀錄、相關圖層。放在展開區最後的「說明・來源」裡（`LayerInfoLine`）。
 * 參考邊界一律顯示中文來源描述（`boundaryVersionLabel`），原代碼留在資料集欄位。
 */
export function StatisticsDetails({ layerKey, textColor }: { layerKey: StatisticsRenderKey; textColor: string }) {
  const state = useStatisticsSnapshot(layerKey);
  const source = state.source;
  const freshness = source?.freshness as { last_checked_at?: string; outcome?: string } | undefined;
  const activeBaseKey = statisticsBaseKey(layerKey, state.selection?.indicatorId);
  const recipeDetailsFamily = getAgriRecipe(activeBaseKey) ? 'agri' : getSocialRecipe(activeBaseKey) || getEducationPresentationView(layerKey) ? 'social' : null;
  const selectorsReady = useStatisticsRecipeDetails(recipeDetailsFamily);
  const unparseableCount = selectorsReady ? unparseableStatisticsReleaseCount(layerKey, state.releases, state.selection?.indicatorId) : 0;
  const selected = state.selection?.releaseId ?? state.release?.release_id ?? '';
  const selectedRelease = state.releases.find(release => release.release_id === selected) ?? state.release;
  const recipe = statisticsRenderRecipe(layerKey, state.selection?.indicatorId);
  const view = getEducationPresentationView(layerKey);
  const agri = getAgriRecipe(activeBaseKey);
  const social = getSocialRecipe(activeBaseKey);
  const labor = getLaborRecipe(activeBaseKey);
  const environment = getEnvironmentRecipe(activeBaseKey);
  const demographics = getDemographicsRecipe(activeBaseKey);
  const addiction = getAddictionRecipe(activeBaseKey);
  const landslide = getLandslideRecipe(activeBaseKey);
  const demographicsNote = demographics ? demographicsIndicatorNote(demographics) : undefined;
  const selectedLaborMetric = getLaborStatisticsPresentationMetric(layerKey, state.selection?.indicatorId);
  const selectionSummary = statisticsDimensionSummary(state.selection?.dimensions, selectedRelease, recipe.dataset_id);
  const healthUnit = state.health?.currency ?? recipe.unit;
  const coverageStatusLabel = statisticsCoverageStatusLabel(Boolean(agri));
  const factStyle: CSSProperties = { margin: 0, minWidth: 0, lineHeight: 1.45 };
  return <div className="statistics-details" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, minWidth: 0, maxWidth: '100%', fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: textColor, lineHeight: 1.45 }}>
    <style>{`.statistics-details summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style>
    {agri && import.meta.env.DEV && import.meta.env.VITE_AGRI_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>本地 Preview · 真實交付資料 · 尚未發布至正式 API</p>}
    {labor && import.meta.env.DEV && import.meta.env.VITE_LABOR_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>勞動與所得本地 Preview · 已驗證 incremental snapshot · 尚未發布至正式 CDN</p>}
    {demographics && import.meta.env.DEV && import.meta.env.VITE_DEMOGRAPHICS_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>人口統計本地 Preview · 已驗證 incremental snapshot · 尚未發布至正式 CDN</p>}
    {view && import.meta.env.DEV && <a href="/statistics-accessibility-review.html" target="_blank" rel="noreferrer">教育路網可達性：開啟本地試算</a>}
    {selectionSummary && <p style={factStyle}><strong>目前選擇：</strong>{selectionSummary}</p>}
    {labor && <p style={factStyle}><strong>位置口徑：</strong>{humanizeStatisticsText(laborLocationSemantics(labor))}</p>}
    {environment && <p style={factStyle}><strong>位置口徑：</strong>{humanizeStatisticsText(environment.location_semantics)}</p>}
    {environment && <p style={factStyle}><strong>資料限制：</strong>{humanizeStatisticsText(environment.disclosure)}</p>}
    {demographics && <p style={factStyle}><strong>位置口徑：</strong>{humanizeStatisticsText(demographics.location_semantics)}</p>}
    {addiction && <p style={factStyle}><strong>位置口徑：</strong>{humanizeStatisticsText(addiction.location_semantics)}</p>}
    {addiction && <p style={factStyle}><strong>資料限制：</strong>{humanizeStatisticsText(addiction.disclosure)}</p>}
    {landslide && <p style={factStyle}><strong>位置口徑：</strong>{humanizeStatisticsText(landslide.location_semantics)}</p>}
    {landslide && <p style={factStyle}><strong>資料限制：</strong>{humanizeStatisticsText(landslide.disclosure)}</p>}
    {demographics && <p style={factStyle}><strong>資料限制：</strong>{humanizeStatisticsText(demographicsDisclosure(demographics))}{demographicsNote ? ` ${demographicsNote}` : ''}</p>}
    <details><summary>來源與處理紀錄</summary>
      <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        {agri && <span>{humanizeStatisticsText(agri.disclosure ?? agri.boundary_semantics)}</span>}
        {agri?.source_statistical_boundary_version && <span>統計參考版：{boundaryVersionLabel(agri.source_statistical_boundary_version)}；實際圖形：{boundaryVersionLabel(agri.boundary_version)}</span>}
        {social?.disclosure && <span>{humanizeStatisticsText(social.disclosure)}</span>}
        {social && <span>參考邊界：{boundaryVersionLabel(social.boundary_version)}；{humanizeStatisticsText(social.boundary_semantics) ?? '以交付資料的參考邊界呈現。'}</span>}
        {labor && <span>顯示參考邊界：{boundaryVersionLabel(labor.boundary_version)}；{humanizeStatisticsText(labor.boundary_semantics)}</span>}
        {environment && <span>來源資料集：{environment.source_title ?? '未提供'}（{environment.publisher}）；顯示參考邊界：{boundaryVersionLabel(environment.boundary_version)}</span>}
        {environment?.derived && <span>衍生指標：分子與原始數同一期別、同一細項；分母說明見資料限制。</span>}
        {addiction && <span>來源資料集：{addiction.source_title}（{addiction.publisher}）；授權：{addiction.license}；顯示參考邊界：{boundaryVersionLabel(addiction.boundary_version)}</span>}
        {addiction?.derived && <span>衍生指標：{addiction.dataset_id === 'addiction_service_points' ? '由本專案減害點位圖層計數；' : '分子與原始數同一期別；'}分母說明見資料限制。</span>}
        {landslide && <span>來源資料集：{landslide.source_title}（{landslide.publisher}）；授權：{landslide.license}；顯示參考邊界：{boundaryVersionLabel(landslide.boundary_version)}</span>}
        {demographics && <span>來源：{demographicsSource(demographics).provider}；授權：{demographicsSource(demographics).license}；顯示參考邊界：{boundaryVersionLabel(demographics.boundary_version)}；{humanizeStatisticsText(demographics.boundary_semantics)}</span>}
        {labor?.layer_key === 'statsLaborCountyEmploymentByIndustry' && <span>製造業是工業的子集；不得與工業加總。</span>}
        {selectedLaborMetric?.formula && <span>衍生方式：{selectedLaborMetric.formula}</span>}
        <span>地理層級：{LEVEL_LABELS[recipe.level]} · 單位：{recipe.unit}</span>
        {'freshness' in recipe && <span>資料新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</span>}
        {state.health?.availability && <span>資料可用狀態：{statisticsAvailabilityLabel(state.health.availability)}</span>}
        {state.health?.reason && <span>資料限制：{state.health.reason}</span>}
        {state.data && <span>已載入 {state.data.features.filter(f => f.properties?.status === 'observed').length}／{state.data.features.length} 個{statisticsSelectedTupleAreaLabel(recipe)}；灰色區域為缺資料，不等於 0</span>}
        {view && getComparisonRecipe(activeBaseKey)?.indicator_id.endsWith('_per_10000_residents') && <span>人均指標的分母為全體戶籍人口，並非學齡人口；學年度統計與人口統計之間存在時間差。</span>}
        {'interpretationNote' in recipe && <span>{String(recipe.interpretationNote)}</span>}
        {agri && state.data && <span>缺資料 {state.data.features.filter(f => f.properties?.status === 'missing' && f.properties?.source_status !== 'not_reported').length}；遮蔽 suppressed {state.data.features.filter(f => f.properties?.status === 'suppressed').length}；未報告 not_reported {state.data.features.filter(f => f.properties?.source_status === 'not_reported').length}。遮蔽與未報告皆非 0。</span>}
        {environment && state.data && <span>已觀察真 0：{state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length}；缺值：{state.data.features.filter(f => f.properties?.status !== 'observed').length}。缺值以斜線表示，不等於 0。</span>}
        {addiction && state.data && <span>已觀察真 0：{state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length}；不適用：{state.data.features.filter(f => f.properties?.status === 'not_applicable').length}；無資料：{state.data.features.filter(f => f.properties?.status === 'missing').length}；隱私遮蔽：{state.data.features.filter(f => f.properties?.status === 'suppressed').length}。三者皆不是 0，以斜線表示。</span>}
        {landslide && state.data && <span>已觀察真 0：{state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length}；未列：{state.data.features.filter(f => f.properties?.status !== 'observed').length}。未列以斜線表示，不等於 0。</span>}
        {demographics && state.data && <span>已觀察真 0：{state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length}；缺值：{state.data.features.filter(f => f.properties?.status !== 'observed').length}。缺值以斜線表示，不補 0。</span>}
        {labor && state.data && <span>已觀察真 0：{state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length}；來源未涵蓋 source_not_covered：{state.data.features.filter(f => f.properties?.missing_reason === 'source_not_covered').length}；來源 join／時間不匹配 source_join_or_time_mismatch：{state.data.features.filter(f => f.properties?.missing_reason === 'source_join_or_time_mismatch').length}。三者不互相替代。</span>}
        {unparseableCount > 0 && <span role="alert">有 {unparseableCount} 個公開期別不符合完整 selector 白名單，未提供選擇。</span>}
        {state.health?.coverage_status && <span>{coverageStatusLabel}：{state.health.coverage_status}（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} {statisticsCoverageAreaLabel(recipe)}）；未分配 {statisticsValueLabel(state.health.unallocated_total, healthUnit)}</span>}
      </div>
      {source ? <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        <span>提供機關：{String(source.publisher ?? '未提供')}</span>
        <span>發布時間：{source.published_at ? String(source.published_at) : '來源未提供'}</span>
        <span>取得時間：{String(source.retrieved_at ?? '未提供')}</span>
        <span>資料期間：{String(source.period_start ?? '')} — {String(source.period_end ?? '')}</span>
        <span>更新頻率：{recipe.frequency}；資料期別不等於取得日期</span>
        <span>最近檢查：{freshness?.last_checked_at ?? '尚未檢查'}{freshness?.outcome === 'failed' ? '（更新失敗，保留上一版）' : freshness?.outcome === 'unchanged' ? '（無新版本）' : ''}</span>
        <span>授權：{String(source.license ?? '未提供')}</span>
        <span>處理方式：{humanizeStatisticsText(String((source.processing_summary as { processing_description?: string } | undefined)?.processing_description ?? source.method_version ?? '未提供'))}</span>
        <span>原始 SHA-256：{String(source.raw_sha256 ?? '未提供')}</span>
        <span>參考邊界：{boundaryVersionLabel(source.boundary_version)}</span>
        <span>地圖使用已核對代碼的參考邊界；不是歷史邊界變動比較。</span>
        {publicLink(source.source_landing_url) && <a style={{ color: textColor, textDecoration: 'underline' }} href={String(source.source_landing_url)} target="_blank" rel="noreferrer">官方資料頁 ↗</a>}
        {publicLink(source.source_download_url) && <a style={{ color: textColor, textDecoration: 'underline' }} href={String(source.source_download_url)} target="_blank" rel="noreferrer">來源下載端點 ↗</a>}
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
  const labor = getLaborRecipe(baseKey);
  const environment = getEnvironmentRecipe(baseKey);
  const demographics = getDemographicsRecipe(baseKey);
  const addiction = getAddictionRecipe(baseKey);
  const landslide = getLandslideRecipe(baseKey);
  const t = useLegendTheme();
  // 二元圖例（自來水不合格：有／無）不是連續色階，不顯示「淺 → 深」通用說明。
  const environmentBinaryRows = environment ? environmentLegendRows(environment, recipe.colors) : null;
  // LG-12：文字色走圖例主題（淡色底圖不再是暗色主題的淺字）；F-3 A：缺值細斜線、遮蔽交叉斜線，同地圖
  return <div style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, display: 'grid', gap: 4 }}>
    <LegendTitle zh={recipe.label} style={{ marginBottom: 0 }} />
    <span>{state.release ? (demographics ? demographicsPeriodLabel(baseKey, state.release) : undefined) ?? statisticsPeriodLabel(state.release) : '尚未載入'} · {recipe.unit}</span>
    {'freshness' in recipe && <span>新鮮度：{String(recipe.freshness)}（{recipe.frequency}）</span>}
    {state.health?.availability && <span>資料可用狀態：{statisticsAvailabilityLabel(state.health.availability)}</span>}
    {state.health?.coverage_status && <span>{statisticsCoverageStatusLabel(Boolean(agri))}：{state.health.coverage_status}（{state.health.coverage_numerator ?? '—'}／{state.health.coverage_denominator ?? '—'} {statisticsCoverageAreaLabel(recipe)}）；未分配 {statisticsValueLabel(state.health.unallocated_total, state.health.currency ?? recipe.unit)}</span>}
    {state.loading && <span>載入中…</span>}{state.error && <span role="alert">{state.error}</span>}
    {!environmentBinaryRows && <span>{recipe.breaks.some(value => value < 0) ? '棕色：負值；紫色：非負值；0 為分界，顏色不代表好壞' : '淺 → 深：數值低 → 高；請依本指標的數字區間比較'}</span>}
    {(environmentBinaryRows || statisticsLegendRows(recipe, social?.format ?? labor?.format ?? environment?.format ?? demographics?.format ?? addiction?.format ?? landslide?.format)).map(({ color, label }) => <LegendRow key={`${color}:${label}`} swatch={<SwatchSquare color={color} opacity={1} />}>{label}</LegendRow>)}
    {addiction?.level === 'prosecutor_district' && <span>{PROSECUTOR_DISTRICT_LEGEND_NOTE}</span>}
    {addiction?.legend.zero_note && <span>{addiction.legend.zero_note}</span>}
    {addiction && addictionStatusLegendRows(addiction).map(({ kind, hatch, label }) => <LegendRow key={kind} swatch={<SwatchHatch kind={hatch} />}>{label}</LegendRow>)}
    {landslide?.legend.zero_note && <span>{landslide.legend.zero_note}</span>}
    {landslide?.legend.display_note && <span>{landslide.legend.display_note}</span>}
    {landslide?.status_labels.missing && <LegendRow swatch={<SwatchHatch kind="missing" />}>斜線：{landslide.status_labels.missing}</LegendRow>}
    {!addiction && !landslide && <LegendRow swatch={<SwatchHatch kind="missing" />}>{social || labor || environment || demographics ? '斜線：missing／來源未涵蓋，不等於 0；observed 0 使用數值色階' : '斜線：缺資料／未發布數值'}</LegendRow>}
    {(agri || social) && <LegendRow swatch={<SwatchHatch kind="suppressed" />}>交叉斜線：遮蔽 suppressed（*）</LegendRow>}
    {agri && <span>{agri.legend.not_reported_label} not_reported（-）：非 0；真 0 使用數值色階</span>}
    {labor && <><span>位置口徑：{humanizeStatisticsText(laborLocationSemantics(labor))}</span><span>資料期與顯示邊界（{boundaryVersionLabel(labor.boundary_version)}）分開揭露</span></>}
    {demographics && <span>固定門檻（跨期可比，不依當期重算）；來源：{demographicsSource(demographics).provider}</span>}
    {addiction && <span>固定門檻（跨期可比，不依當期重算）；位置口徑：{humanizeStatisticsText(addiction.location_semantics)}</span>}
    {landslide && <span>固定門檻（跨期可比，不依當期重算）；年度數字不一定反映當年颱風或單一事件</span>}
  </div>;
}
