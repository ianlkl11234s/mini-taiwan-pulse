import { useSyncExternalStore, type CSSProperties } from 'react';
import { getAgriRecipe, AGRI_EXISTING_LAYER_REFERENCES } from '../../data/agriStatisticsRecipes';
import { getSocialRecipe } from '../../data/socialStatisticsRecipes';
import { getLaborRecipe, getLaborStatisticsPresentationMetric, laborLocationSemantics } from '../../data/laborStatisticsRecipes';
import { environmentLegendRows, getEnvironmentRecipe } from '../../data/environmentStatisticsRecipes';
import { PROSECUTOR_DISTRICT_LEGEND_NOTE, addictionStatusLegendRows, getAddictionRecipe } from '../../data/addictionStatisticsRecipes';
import { getLandslideRecipe } from '../../data/landslideStatisticsRecipes';
import { atlasDimensionNote, atlasScaleNote, atlasStatusLegendRows, getAtlasRecipe } from '../../data/atlasStatisticsRecipes';
import { demographicsDisclosure, demographicsIndicatorNote, demographicsPeriodLabel, demographicsSource, getDemographicsRecipe } from '../../data/demographicsStatisticsRecipes';
import { getComparisonRecipe } from '../../data/comparisonStatisticsRecipes';
import { getEducationPresentationView } from '../../data/statisticsPresentationViews';
import { layerVisibilityStore } from '../../state/layerVisibilityStore';
import { LAYER_MANIFEST, type LayerManifestEntry } from '../../data/layerManifest';
import type { LayerVisibility } from '../../types';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { STATISTICS_RECIPES, statisticsBaseKey, statisticsRenderRecipe, type StatisticsLayerKey, type StatisticsRenderKey } from '../../data/regionalStatisticsRecipes';
import type { StatisticsLevel, StatisticsRecipe } from '../../data/regionalStatisticsLoader';
import { statisticsColorStops } from '../../data/statisticsColorScale';
import { FONT_SIZE, FONT_CJK, SPACING } from '../../styles/designTokens';
import { LegendRow, LegendTitle, SwatchHatch, SwatchSquare, useLegendTheme } from '../legend/legendKit';
import { useStatisticsRecipeDetails } from '../../hooks/useStatisticsRecipeDetails';
import { boundaryVersionLabel, humanizeStatisticsText, statisticsDimensionSummary, statisticsPeriodLabel, statisticsAvailabilityLabel } from '../../data/statisticsLabels';
import { unparseableStatisticsReleaseCount } from '../../data/statisticsSelection';
import { localeStore, useLocale, type LocaleSnapshot } from '../../state/localeStore';
import type { MessageKey } from '../../i18n/keys';
import { statisticsFrequency, statisticsTitle, statisticsUnit } from '../../i18n/statisticsText';
import { statisticsLicense, statisticsPublisher } from '../../i18n/agencyText';

const LIVESTOCK_TOWNSHIP_STATISTICS_DATASET = 'livestock_township_statistics';

/** Health coverage denominators use the recipe's actual geographic level. */
const LEVEL_KEYS: Record<StatisticsLevel, MessageKey> = {
  county: 'statistics.level.county', township: 'statistics.level.township', village: 'statistics.level.village',
  statistical_min: 'statistics.level.statistical_min', statistical_l1: 'statistics.level.statistical_l1',
  statistical_l2: 'statistics.level.statistical_l2', prosecutor_district: 'statistics.level.prosecutor_district',
};
/** 地理層級名稱（不傳 i18n＝目前語系快照；中文介面即原中文） */
export function statisticsLevelLabel(level: StatisticsLevel, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  return i18n.t(LEVEL_KEYS[level]);
}
export function statisticsCoverageAreaLabel(recipe: Pick<StatisticsRecipe, 'level'> & { datasetId?: string; dataset_id?: string }, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  if ((recipe.datasetId ?? recipe.dataset_id) === LIVESTOCK_TOWNSHIP_STATISTICS_DATASET) return i18n.t('statistics.area.livestockTownshipRows');
  return statisticsLevelLabel(recipe.level, i18n);
}
export function statisticsCoverageStatusLabel(isAgri: boolean, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  return isAgri ? i18n.t('statistics.coverageStatusAgri') : i18n.t('statistics.coverageStatus');
}
export function statisticsSelectedTupleAreaLabel(recipe: Pick<StatisticsRecipe, 'level'> & { datasetId?: string; dataset_id?: string }, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  return i18n.t((recipe.datasetId ?? recipe.dataset_id) === LIVESTOCK_TOWNSHIP_STATISTICS_DATASET ? 'statistics.tuple.livestockTownship' : 'statistics.tuple.region');
}
/** 覆蓋狀態整行（圖例與說明框共用） */
function coverageLine(health: NonNullable<ReturnType<typeof useStatisticsSnapshot>['health']>, isAgri: boolean, recipe: Pick<StatisticsRecipe, 'level'> & { unit: string }, i18n: LocaleSnapshot): string {
  return i18n.t('statistics.coverageLine', {
    label: statisticsCoverageStatusLabel(isAgri, i18n), status: String(health.coverage_status),
    numerator: String(health.coverage_numerator ?? '—'), denominator: String(health.coverage_denominator ?? '—'),
    area: statisticsCoverageAreaLabel(recipe, i18n),
    unallocated: statisticsValueLabel(health.unallocated_total, statisticsUnit(String(health.currency ?? recipe.unit), i18n), i18n),
  });
}
export function useStatisticsSnapshot(key: StatisticsRenderKey) {
  return useSyncExternalStore(cb => regionalStatisticsStore.subscribe(key, cb), () => regionalStatisticsStore.getSnapshot(key));
}
function publicLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return value; } catch { /* no link */ }
}
export function statisticsValueLabel(value: unknown, unit: string, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString()}${unit ? ` ${unit}` : ''}` : i18n.t('statistics.notProvided');
}

/** Mirrors the Mapbox `step` expression: one numeric colour per interval. */
type StatisticsDisplayFormat = { locale?: string; maximumFractionDigits?: number };

function statisticsLegendThreshold(value: number, format?: StatisticsDisplayFormat): string {
  if (!format?.maximumFractionDigits && format?.maximumFractionDigits !== 0) return String(value);
  const rounded = Number(value.toFixed(format.maximumFractionDigits));
  const display = new Intl.NumberFormat(format.locale, { maximumFractionDigits: format.maximumFractionDigits }).format(value);
  return rounded === value ? display : `≈${display}`;
}

export function statisticsLegendRows(recipe: Pick<typeof STATISTICS_RECIPES[StatisticsLayerKey], 'breaks' | 'colors'>, format?: StatisticsDisplayFormat, i18n: LocaleSnapshot = localeStore.getSnapshot()) {
  const { t } = i18n;
  const stops = statisticsColorStops(recipe.breaks, recipe.colors);
  if (stops.length === 0) return [{ color: recipe.colors[0]!, label: t('statistics.legend.allValues') }];
  return [{ color: recipe.colors[0]!, label: t('statistics.legend.below', { value: statisticsLegendThreshold(stops[0]!.value, format) }) }].concat(stops.map((stop, index) => ({
    color: stop.color,
    label: index === stops.length - 1 ? t('statistics.legend.atOrAbove', { value: statisticsLegendThreshold(stop.value, format) }) : t('statistics.legend.range', { from: statisticsLegendThreshold(stop.value, format), to: statisticsLegendThreshold(stops[index + 1]!.value, format) }),
  })));
}
/**
 * 統計的「說明・來源」內容（圖層面板統一 C 段）：期別、指標、細項已改由共用連動選單
 * （`state/statisticsLinkedSelect.ts` → `ParamControlList`）渲染；這裡只剩位置口徑、資料限制、
 * 來源與處理紀錄、相關圖層。放在展開區最後的「說明・來源」裡（`LayerInfoLine`）。
 * 參考邊界一律顯示中文來源描述（`boundaryVersionLabel`），原代碼留在資料集欄位。
 */
export function StatisticsDetails({ layerKey, textColor }: { layerKey: StatisticsRenderKey; textColor: string }) {
  const i18n = useLocale();
  const { t } = i18n;
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
  const atlas = getAtlasRecipe(activeBaseKey);
  const atlasNote = atlas ? atlasDimensionNote(activeBaseKey, state.selection?.dimensions) : undefined;
  const demographicsNote = demographics ? demographicsIndicatorNote(demographics) : undefined;
  const selectedLaborMetric = getLaborStatisticsPresentationMetric(layerKey, state.selection?.indicatorId);
  const selectionSummary = statisticsDimensionSummary(state.selection?.dimensions, selectedRelease, recipe.dataset_id, i18n);
    const factStyle: CSSProperties = { margin: 0, minWidth: 0, lineHeight: 1.45 };
  return <div className="statistics-details" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, minWidth: 0, maxWidth: '100%', fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: textColor, lineHeight: 1.45 }}>
    <style>{`.statistics-details summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style>
    {agri && import.meta.env.DEV && import.meta.env.VITE_AGRI_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>{t('statistics.details.previewAgri')}</p>}
    {labor && import.meta.env.DEV && import.meta.env.VITE_LABOR_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>{t('statistics.details.previewLabor')}</p>}
    {demographics && import.meta.env.DEV && import.meta.env.VITE_DEMOGRAPHICS_STATISTICS_PREVIEW === 'true' && <p style={factStyle}>{t('statistics.details.previewDemographics')}</p>}
    {view && import.meta.env.DEV && <a href="/statistics-accessibility-review.html" target="_blank" rel="noreferrer">{t('statistics.details.accessibilityLink')}</a>}
    {selectionSummary && <p style={factStyle}><strong>{t('statistics.details.selection')}</strong>{selectionSummary}</p>}
    {labor && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(laborLocationSemantics(labor))}</p>}
    {environment && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(environment.location_semantics)}</p>}
    {environment && <p style={factStyle}><strong>{t('statistics.details.dataLimits')}</strong>{humanizeStatisticsText(environment.disclosure)}</p>}
    {demographics && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(demographics.location_semantics)}</p>}
    {addiction && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(addiction.location_semantics)}</p>}
    {addiction && <p style={factStyle}><strong>{t('statistics.details.dataLimits')}</strong>{humanizeStatisticsText(addiction.disclosure)}</p>}
    {landslide && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(landslide.location_semantics)}</p>}
    {landslide && <p style={factStyle}><strong>{t('statistics.details.dataLimits')}</strong>{humanizeStatisticsText(landslide.disclosure)}</p>}
    {atlas && <p style={factStyle}><strong>{t('statistics.details.locationBasis')}</strong>{humanizeStatisticsText(atlas.location_semantics)}</p>}
    {atlasNote && <p style={factStyle}><strong>{t('statistics.details.subIndicatorDirection')}</strong>{atlasNote}</p>}
    {atlas && <p style={factStyle}><strong>{t('statistics.details.dataLimits')}</strong>{humanizeStatisticsText(atlas.disclosure)}</p>}
    {demographics && <p style={factStyle}><strong>{t('statistics.details.dataLimits')}</strong>{humanizeStatisticsText(demographicsDisclosure(demographics))}{demographicsNote ? ` ${demographicsNote}` : ''}</p>}
    <details><summary>{t('statistics.details.sourceLog')}</summary>
      <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        {agri && <span>{humanizeStatisticsText(agri.disclosure ?? agri.boundary_semantics)}</span>}
        {agri?.source_statistical_boundary_version && <span>{t('statistics.details.statRefBoundary', { stat: boundaryVersionLabel(agri.source_statistical_boundary_version, i18n), actual: boundaryVersionLabel(agri.boundary_version, i18n) })}</span>}
        {social?.disclosure && <span>{humanizeStatisticsText(social.disclosure)}</span>}
        {social && <span>{t('statistics.details.refBoundary', { boundary: boundaryVersionLabel(social.boundary_version, i18n), semantics: humanizeStatisticsText(social.boundary_semantics) ?? t('statistics.details.refBoundaryDefault') })}</span>}
        {labor && <span>{t('statistics.details.displayBoundary', { boundary: boundaryVersionLabel(labor.boundary_version, i18n), semantics: humanizeStatisticsText(labor.boundary_semantics) ?? '' })}</span>}
        {environment && <span>{t('statistics.details.sourceDatasetBoundary', { title: environment.source_title ?? t('statistics.notProvided'), publisher: statisticsPublisher(environment.publisher, i18n), boundary: boundaryVersionLabel(environment.boundary_version, i18n) })}</span>}
        {environment?.derived && <span>{t('statistics.details.derivedEnvironment')}</span>}
        {addiction && <span>{t('statistics.details.sourceDatasetLicense', { title: addiction.source_title, publisher: statisticsPublisher(addiction.publisher, i18n), license: statisticsLicense(addiction.license, i18n), boundary: boundaryVersionLabel(addiction.boundary_version, i18n) })}</span>}
        {addiction?.derived && <span>{t(addictionDerivedKey(addiction))}</span>}
        {landslide && <span>{t('statistics.details.sourceDatasetLicense', { title: landslide.source_title, publisher: statisticsPublisher(landslide.publisher, i18n), license: statisticsLicense(landslide.license, i18n), boundary: boundaryVersionLabel(landslide.boundary_version, i18n) })}</span>}
        {atlas && <span>{t('statistics.details.sourceDatasetLicense', { title: atlas.source_title, publisher: statisticsPublisher(atlas.publisher, i18n), license: statisticsLicense(atlas.license, i18n), boundary: boundaryVersionLabel(atlas.boundary_version, i18n) })}</span>}
        {atlas?.derived && <span>{t('statistics.details.derivedAddiction')}</span>}
        {demographics && <span>{t('statistics.details.sourceDemographics', { provider: statisticsPublisher(demographicsSource(demographics).provider, i18n), license: statisticsLicense(demographicsSource(demographics).license, i18n), boundary: boundaryVersionLabel(demographics.boundary_version, i18n), semantics: humanizeStatisticsText(demographics.boundary_semantics) ?? '' })}</span>}
        {labor?.layer_key === 'statsLaborCountyEmploymentByIndustry' && <span>{t('statistics.details.laborIndustryNote')}</span>}
        {selectedLaborMetric?.formula && <span>{t('statistics.details.derivationFormula', { formula: selectedLaborMetric.formula })}</span>}
        <span>{t('statistics.details.levelUnit', { level: statisticsLevelLabel(recipe.level, i18n), unit: statisticsUnit(recipe.unit, i18n) })}</span>
        {'freshness' in recipe && <span>{t('statistics.details.freshness', { value: String(recipe.freshness), frequency: statisticsFrequency(recipe.frequency, i18n) })}</span>}
        {state.health?.availability && <span>{t('statistics.legend.availability', { value: statisticsAvailabilityLabel(state.health.availability, i18n) })}</span>}
        {state.health?.reason && <span>{t('statistics.details.reason', { reason: state.health.reason })}</span>}
        {state.data && <span>{t('statistics.details.loaded', { observed: state.data.features.filter(f => f.properties?.status === 'observed').length, total: state.data.features.length, area: statisticsSelectedTupleAreaLabel(recipe, i18n) })}</span>}
        {view && getComparisonRecipe(activeBaseKey)?.indicator_id.endsWith('_per_10000_residents') && <span>{t('statistics.details.perCapitaNote')}</span>}
        {'interpretationNote' in recipe && <span>{String(recipe.interpretationNote)}</span>}
        {agri && state.data && <span>{t('statistics.details.countsAgri', { missing: state.data.features.filter(f => f.properties?.status === 'missing' && f.properties?.source_status !== 'not_reported').length, suppressed: state.data.features.filter(f => f.properties?.status === 'suppressed').length, notReported: state.data.features.filter(f => f.properties?.source_status === 'not_reported').length })}</span>}
        {environment && state.data && <span>{t('statistics.details.countsEnvironment', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, missing: state.data.features.filter(f => f.properties?.status !== 'observed').length })}</span>}
        {addiction && state.data && <span>{t('statistics.details.countsAddiction', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, notApplicable: state.data.features.filter(f => f.properties?.status === 'not_applicable').length, missing: state.data.features.filter(f => f.properties?.status === 'missing').length, suppressed: state.data.features.filter(f => f.properties?.status === 'suppressed').length })}</span>}
        {atlas && state.data && <span>{t('statistics.details.countsAtlas', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, notApplicable: state.data.features.filter(f => f.properties?.status === 'not_applicable').length, missing: state.data.features.filter(f => f.properties?.status === 'missing').length, suppressed: state.data.features.filter(f => f.properties?.status === 'suppressed').length })}</span>}
        {landslide && state.data && <span>{t('statistics.details.countsLandslide', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, missing: state.data.features.filter(f => f.properties?.status !== 'observed').length })}</span>}
        {demographics && state.data && <span>{t('statistics.details.countsDemographics', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, missing: state.data.features.filter(f => f.properties?.status !== 'observed').length })}</span>}
        {labor && state.data && <span>{t('statistics.details.countsLabor', { zero: state.data.features.filter(f => f.properties?.status === 'observed' && f.properties?.value === 0).length, notCovered: state.data.features.filter(f => f.properties?.missing_reason === 'source_not_covered').length, mismatch: state.data.features.filter(f => f.properties?.missing_reason === 'source_join_or_time_mismatch').length })}</span>}
        {unparseableCount > 0 && <span role="alert">{t('statistics.details.unparseable', { count: unparseableCount })}</span>}
        {state.health?.coverage_status && <span>{coverageLine(state.health, Boolean(agri), recipe, i18n)}</span>}
      </div>
      {source ? <div style={{ display: 'grid', gap: 5, paddingTop: 6, overflowWrap: 'anywhere' }}>
        <span>{t('statistics.details.publisher', { value: source.publisher == null ? t('statistics.notProvided') : statisticsPublisher(String(source.publisher), i18n) })}</span>
        <span>{t('statistics.details.publishedAt', { value: source.published_at ? String(source.published_at) : t('statistics.details.noPublishedAt') })}</span>
        <span>{t('statistics.details.retrievedAt', { value: String(source.retrieved_at ?? t('statistics.notProvided')) })}</span>
        <span>{t('statistics.details.period', { start: String(source.period_start ?? ''), end: String(source.period_end ?? '') })}</span>
        <span>{t('statistics.details.updateFrequency', { value: statisticsFrequency(recipe.frequency, i18n) })}</span>
        <span>{t('statistics.details.lastChecked', { value: freshness?.last_checked_at ?? t('statistics.details.notChecked'), note: freshness?.outcome === 'failed' ? t('statistics.details.checkFailed') : freshness?.outcome === 'unchanged' ? t('statistics.details.checkUnchanged') : '' })}</span>
        <span>{t('statistics.details.license', { value: source.license == null ? t('statistics.notProvided') : statisticsLicense(String(source.license), i18n) })}</span>
        <span>{t('statistics.details.processing', { value: humanizeStatisticsText(String((source.processing_summary as { processing_description?: string } | undefined)?.processing_description ?? source.method_version ?? t('statistics.notProvided'))) })}</span>
        <span>{t('statistics.details.rawSha', { value: String(source.raw_sha256 ?? t('statistics.notProvided')) })}</span>
        <span>{t('statistics.details.boundary', { value: boundaryVersionLabel(source.boundary_version, i18n) })}</span>
        <span>{t('statistics.details.boundaryNote')}</span>
        {publicLink(source.source_landing_url) && <a style={{ color: textColor, textDecoration: 'underline' }} href={String(source.source_landing_url)} target="_blank" rel="noreferrer">{t('statistics.details.landing')}</a>}
        {publicLink(source.source_download_url) && <a style={{ color: textColor, textDecoration: 'underline' }} href={String(source.source_download_url)} target="_blank" rel="noreferrer">{t('statistics.details.download')}</a>}
      </div> : <span>{t('statistics.details.loadForSource')}</span>}
    </details>
    {agri && AGRI_EXISTING_LAYER_REFERENCES.some(ref => ref.group === agri.group) && <details><summary>{t('statistics.details.crossTopicIndex')}</summary><div style={{ display: 'grid', gap: 4 }}>{AGRI_EXISTING_LAYER_REFERENCES.filter(ref => ref.group === agri.group).map(ref => <button key={ref.layer_key} type="button" onClick={() => layerVisibilityStore.toggle(ref.layer_key as keyof LayerVisibility)}>{t('statistics.details.indexEntry', { group: ref.group, subgroup: ref.subgroup, name: manifestLayerName(ref.layer_key, i18n) })}</button>)}</div></details>}
    {agri && <details><summary>{t('statistics.details.relatedLayers')}</summary><div style={{ display: 'grid', gap: 4 }}>{agri.related_layer_keys.filter(key => key in LAYER_MANIFEST).map(key => <button key={key} type="button" onClick={() => layerVisibilityStore.toggle(key as keyof LayerVisibility)}>{manifestLayerName(key, i18n)}</button>)}</div></details>}
    {social && social.related_layer_keys.length > 0 && <details><summary>{t('statistics.details.relatedLayers')}</summary><div style={{ display: 'grid', gap: 4 }}>{social.related_layer_keys.filter(key => key in LAYER_MANIFEST).map(key => <button key={key} type="button" onClick={() => layerVisibilityStore.toggle(key as keyof LayerVisibility)}>{manifestLayerName(key, i18n)}</button>)}</div></details>}
  </div>;
}
/** manifest label 是識別字不翻；畫面上優先借 layers.json 的圖層譯名 */
function manifestLayerName(key: string, i18n: LocaleSnapshot): string {
  const label = (LAYER_MANIFEST[key as keyof LayerVisibility] as LayerManifestEntry).label ?? key;
  return i18n.active === 'zh-TW' ? label : i18n.lookup(`layer.${key}`) ?? label;
}
export function StatisticsLegend({ layerKey }: { layerKey: StatisticsRenderKey }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const state = useStatisticsSnapshot(layerKey);
  const baseKey = statisticsBaseKey(layerKey, state.selection?.indicatorId);
  const recipe = statisticsRenderRecipe(layerKey, state.selection?.indicatorId, state.selection?.dimensions);
  const agri = getAgriRecipe(baseKey);
  const social = getSocialRecipe(baseKey);
  const labor = getLaborRecipe(baseKey);
  const environment = getEnvironmentRecipe(baseKey);
  const demographics = getDemographicsRecipe(baseKey);
  const addiction = getAddictionRecipe(baseKey);
  const landslide = getLandslideRecipe(baseKey);
  const atlas = getAtlasRecipe(baseKey);
  const atlasScale = atlas ? atlasScaleNote(baseKey, state.selection?.dimensions) : undefined;
  const t = useLegendTheme();
  // 二元圖例（自來水不合格：有／無）不是連續色階，不顯示「淺 → 深」通用說明。
  const environmentBinaryRows = environment ? environmentLegendRows(environment, recipe.colors) : null;
  // LG-12：文字色走圖例主題（淡色底圖不再是暗色主題的淺字）；F-3 A：缺值細斜線、遮蔽交叉斜線，同地圖
  return <div style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, display: 'grid', gap: 4 }}>
    <LegendTitle zh={statisticsTitle(layerKey, recipe.label, i18n)} style={{ marginBottom: 0 }} />
    <span>{state.release ? (demographics ? demographicsPeriodLabel(baseKey, state.release, i18n) : undefined) ?? statisticsPeriodLabel(state.release, i18n) : tr('statistics.legend.notLoaded')} · {statisticsUnit(recipe.unit, i18n)}</span>
    {'freshness' in recipe && <span>{tr('statistics.legend.freshness', { value: String(recipe.freshness), frequency: statisticsFrequency(recipe.frequency, i18n) })}</span>}
    {state.health?.availability && <span>{tr('statistics.legend.availability', { value: statisticsAvailabilityLabel(state.health.availability, i18n) })}</span>}
    {state.health?.coverage_status && <span>{coverageLine(state.health, Boolean(agri), recipe, i18n)}</span>}
    {state.loading && <span>{tr('statistics.legend.loading')}</span>}{state.error && <span role="alert" title={i18n.active === 'zh-TW' ? undefined : state.error}>{i18n.active === 'zh-TW' ? state.error : tr('statistics.loadFailed')}</span>}
    {!environmentBinaryRows && <span>{atlasScale ?? tr(recipe.breaks.some(value => value < 0) ? 'statistics.legend.diverging' : 'statistics.legend.sequential')}</span>}
    {(environmentBinaryRows || statisticsLegendRows(recipe, social?.format ?? labor?.format ?? environment?.format ?? demographics?.format ?? addiction?.format ?? landslide?.format ?? atlas?.format, i18n)).map(({ color, label }) => <LegendRow key={`${color}:${label}`} swatch={<SwatchSquare color={color} opacity={1} />}>{label}</LegendRow>)}
    {addiction?.level === 'prosecutor_district' && <span>{PROSECUTOR_DISTRICT_LEGEND_NOTE}</span>}
    {addiction?.legend.zero_note && <span>{addiction.legend.zero_note}</span>}
    {addiction && addictionStatusLegendRows(addiction).map(({ kind, hatch, label }) => <LegendRow key={kind} swatch={<SwatchHatch kind={hatch} />}>{label}</LegendRow>)}
    {landslide?.legend.zero_note && <span>{landslide.legend.zero_note}</span>}
    {landslide?.legend.display_note && <span>{landslide.legend.display_note}</span>}
    {landslide?.status_labels.missing && <LegendRow swatch={<SwatchHatch kind="missing" />}>{tr('statistics.legend.hatchLabel', { label: landslide.status_labels.missing })}</LegendRow>}
    {atlas?.legend.zero_note && <span>{atlas.legend.zero_note}</span>}
    {atlas?.legend.display_note && <span>{atlas.legend.display_note}</span>}
    {atlas && atlasStatusLegendRows(atlas).map(({ kind, hatch, label }) => <LegendRow key={kind} swatch={<SwatchHatch kind={hatch} />}>{label}</LegendRow>)}
    {!addiction && !landslide && !atlas && <LegendRow swatch={<SwatchHatch kind="missing" />}>{tr(social || labor || environment || demographics ? 'statistics.legend.hatchSocial' : 'statistics.legend.hatchDefault')}</LegendRow>}
    {(agri || social) && <LegendRow swatch={<SwatchHatch kind="suppressed" />}>{tr('statistics.legend.crossHatch')}</LegendRow>}
    {agri && <span>{tr('statistics.legend.notReported', { label: agri.legend.not_reported_label })}</span>}
    {labor && <><span>{tr('statistics.legend.locationBasis', { value: humanizeStatisticsText(laborLocationSemantics(labor)) })}</span><span>{tr('statistics.legend.boundaryDisclosed', { boundary: boundaryVersionLabel(labor.boundary_version, i18n) })}</span></>}
    {demographics && <span>{tr('statistics.legend.fixedDemographics', { provider: demographicsSource(demographics).provider })}</span>}
    {addiction && <span>{tr('statistics.legend.fixedAddiction', { value: humanizeStatisticsText(addiction.location_semantics) })}</span>}
    {landslide && <span>{tr('statistics.legend.fixedLandslide')}</span>}
    {atlas && <span>{tr('statistics.legend.fixedAtlas', { dims: atlas.dimensions.length ? tr('statistics.legend.perDimensionThresholds') : '', value: humanizeStatisticsText(atlas.location_semantics) })}</span>}
  </div>;
}

/** 成癮衍生指標的說明 key（服務據點另有說明） */
function addictionDerivedKey(recipe: { dataset_id: string }) {
  return recipe.dataset_id === 'addiction_service_points' ? 'statistics.details.derivedAddictionPoints' as const : 'statistics.details.derivedAddiction' as const;
}
