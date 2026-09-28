import { statisticsColorStops } from '../data/statisticsColorScale';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe, statisticsReleaseFallback, type StatisticsRenderKey } from '../data/regionalStatisticsRecipes';
import { regionalStatisticsStore } from '../state/regionalStatisticsStore';
import { layerVisibilityStore } from '../state/layerVisibilityStore';
import { layerParamsStore } from '../state/layerParamsStore';
import { keepLoadingUntilMapIdle } from '../lib/loadingRegistry';
import { gradedSeamPaint, hatchImageData, hatchImageId, type HatchKind } from './mapStyleScale';

/** 有數值才上色；缺值、未發布、遮蔽一律透明底，由 hatch 子圖層表示（F-3 A）。 */
const NO_FILL = 'rgba(0,0,0,0)';
const HAS_VALUE: unknown[] = ['all', ['==', ['get', 'status'], 'observed'], ['!=', ['get', 'value'], null]];
const IS_MISSING: unknown[] = ['all', ['!', HAS_VALUE], ['!=', ['get', 'status'], 'suppressed']];
const SUFFIXES = ['fill', 'missing', 'suppressed', 'line'] as const;

/**
 * Owns only statistics sources/layers; other GIS visibility is untouched.
 * @param getIsDark 目前底圖是否暗色（細縫與斜線顏色依底圖切換；換底圖會觸發 style.load 重畫）。
 */
export function attachRegionalStatistics(map: mapboxgl.Map, getIsDark: () => boolean = () => true): () => void {
  const shown = new Map<StatisticsRenderKey, boolean>();
  const rendered = new Map<StatisticsRenderKey, GeoJSON.FeatureCollection>();
  for (const key of STATISTICS_RENDER_KEYS) {
    const recipe = statisticsRenderRecipe(key);
    const fallback = statisticsReleaseFallback(key);
    regionalStatisticsStore.registerRecipe(key, { layerKey: key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, label: recipe.label, dimensions: recipe.dimensions, ...('releaseId' in recipe ? { releaseId: recipe.releaseId, allowReleaseFallback: true } : {}), ...(fallback ? { releaseFallback: fallback } : {}), ...('includeHealth' in recipe ? { includeHealth: recipe.includeHealth } : {}) });
  }
  function render() {
    if (!map.isStyleLoaded()) return;
    const isDark = getIsDark();
    for (const kind of ['missing', 'suppressed'] as HatchKind[]) {
      for (const dark of [true, false]) {
        const id = hatchImageId(kind, dark);
        if (!map.hasImage(id)) map.addImage(id, hatchImageData(kind, dark));
      }
    }
    const seam = gradedSeamPaint(isDark);
    for (const key of STATISTICS_RENDER_KEYS) {
      const visible = layerVisibilityStore.getVisibility(key);
      const state = regionalStatisticsStore.getSnapshot(key);
      const recipe = statisticsRenderRecipe(key, state.selection?.indicatorId);
      if (!layerVisibilityStore.getAll()[key] && !map.getSource(key)) continue;
      if (!map.getSource(key)) {
        rendered.delete(key);
        map.addSource(key, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'area_code' });
        const step: unknown[] = ['step', ['get', 'value'], recipe.colors[0]];
        statisticsColorStops(recipe.breaks, recipe.colors).forEach(({ value, color }) => step.push(value, color));
        map.addLayer({ id: `${key}-fill`, type: 'fill', source: key, layout: { visibility: 'none' }, paint: {
          'fill-color': ['case', HAS_VALUE, step, NO_FILL] as mapboxgl.ExpressionSpecification,
          'fill-opacity': 0.55,
        } });
        map.addLayer({ id: `${key}-missing`, type: 'fill', source: key, filter: IS_MISSING as mapboxgl.FilterSpecification, layout: { visibility: 'none' }, paint: { 'fill-pattern': hatchImageId('missing', isDark), 'fill-opacity': 0.55 } });
        map.addLayer({ id: `${key}-suppressed`, type: 'fill', source: key, filter: ['==', ['get', 'status'], 'suppressed'], layout: { visibility: 'none' }, paint: { 'fill-pattern': hatchImageId('suppressed', isDark), 'fill-opacity': 0.55 } });
        // F-2：1px 底圖色細縫，不綁透明度滑桿
        map.addLayer({ id: `${key}-line`, type: 'line', source: key, layout: { visibility: 'none' }, paint: { ...seam } });
      }
      // A presentation source survives metric switches; refresh the scale as well as values.
      const colorSteps: unknown[] = ['step', ['get', 'value'], recipe.colors[0]];
      statisticsColorStops(recipe.breaks, recipe.colors).forEach(({value, color}) => colorSteps.push(value, color));
      map.setPaintProperty(`${key}-fill`, 'fill-color', ['case', HAS_VALUE, colorSteps, NO_FILL]);
      map.setPaintProperty(`${key}-missing`, 'fill-pattern', hatchImageId('missing', isDark));
      map.setPaintProperty(`${key}-suppressed`, 'fill-pattern', hatchImageId('suppressed', isDark));
      map.setPaintProperty(`${key}-line`, 'line-color', seam['line-color']);
      map.setPaintProperty(`${key}-line`, 'line-opacity', seam['line-opacity']);
      const data = state.data;
      if (data && rendered.get(key) !== data) {
        rendered.set(key, data);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData(data);
        keepLoadingUntilMapIdle(map, `statistics-render:${key}`, recipe.label, key);
      } else if (!data && rendered.has(key)) {
        rendered.delete(key);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
      for (const suffix of SUFFIXES) map.setLayoutProperty(`${key}-${suffix}`, 'visibility', visible && data ? 'visible' : 'none');
      const opacity = Number(layerParamsStore.getParam(key, `${key}Opacity`) ?? 0.55);
      map.setPaintProperty(`${key}-fill`, 'fill-opacity', opacity);
      map.setPaintProperty(`${key}-missing`, 'fill-opacity', opacity);
      map.setPaintProperty(`${key}-suppressed`, 'fill-opacity', opacity);
    }
  }
  function visibilityChanged() {
    for (const key of STATISTICS_RENDER_KEYS) {
      const visible = layerVisibilityStore.getVisibility(key);
      if (shown.get(key) === visible) continue;
      shown.set(key, visible);
      if (visible) void regionalStatisticsStore.load(key);
      else regionalStatisticsStore.disable(key);
    }
    render();
  }
  const dispose = [layerVisibilityStore.subscribe(visibilityChanged), layerParamsStore.subscribe(render), ...STATISTICS_RENDER_KEYS.map(key => regionalStatisticsStore.subscribe(key, render))];
  map.on('style.load', render);
  // Data may finish during a Mapbox source update; idle retries rendering that state.
  const onIdle = () => {
    if (STATISTICS_RENDER_KEYS.some(key => regionalStatisticsStore.getSnapshot(key).data !== (rendered.get(key) ?? null))) render();
  };
  map.on('idle', onIdle);
  visibilityChanged();
  return () => { dispose.forEach(fn => fn()); map.off('style.load', render); map.off('idle', onIdle); STATISTICS_RENDER_KEYS.forEach(key => regionalStatisticsStore.disable(key)); };
}
