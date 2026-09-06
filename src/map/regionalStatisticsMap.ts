import { STATISTICS_KEYS, STATISTICS_RECIPES, type StatisticsLayerKey } from '../data/regionalStatisticsRecipes';
import { regionalStatisticsStore } from '../state/regionalStatisticsStore';
import { layerVisibilityStore } from '../state/layerVisibilityStore';
import { layerParamsStore } from '../state/layerParamsStore';
import { keepLoadingUntilMapIdle } from '../lib/loadingRegistry';

/** Owns only statistics sources/layers; other GIS visibility is untouched. */
export function attachRegionalStatistics(map: mapboxgl.Map): () => void {
  const shown = new Map<StatisticsLayerKey, boolean>();
  const rendered = new Map<StatisticsLayerKey, GeoJSON.FeatureCollection>();
  for (const key of STATISTICS_KEYS) {
    const recipe = STATISTICS_RECIPES[key];
    regionalStatisticsStore.registerRecipe(key, { datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, label: recipe.label, dimensions: recipe.dimensions });
  }
  function render() {
    if (!map.isStyleLoaded()) return;
    for (const key of STATISTICS_KEYS) {
      const visible = layerVisibilityStore.getVisibility(key);
      const state = regionalStatisticsStore.getSnapshot(key);
      const recipe = STATISTICS_RECIPES[key];
      if (!map.getSource(key)) {
        rendered.delete(key);
        map.addSource(key, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'area_code' });
        const step: unknown[] = ['step', ['get', 'value'], recipe.colors[0]];
        recipe.breaks.forEach((value, index) => step.push(value, recipe.colors[index + 1]));
        map.addLayer({ id: `${key}-fill`, type: 'fill', source: key, layout: { visibility: 'none' }, paint: {
          'fill-color': ['case', ['all', ['==', ['get', 'status'], 'observed'], ['!=', ['get', 'value'], null]], step, '#64748b'] as mapboxgl.ExpressionSpecification,
          'fill-opacity': 0.55,
        } });
        map.addLayer({ id: `${key}-line`, type: 'line', source: key, layout: { visibility: 'none' }, paint: { 'line-color': recipe.colors[4], 'line-width': 0.8, 'line-opacity': 0.8 } });
      }
      const data = state.data;
      if (data && rendered.get(key) !== data) {
        rendered.set(key, data);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData(data);
        keepLoadingUntilMapIdle(map, `statistics-render:${key}`, recipe.label, key);
      } else if (!data && rendered.has(key)) {
        rendered.delete(key);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
      for (const suffix of ['fill', 'line']) map.setLayoutProperty(`${key}-${suffix}`, 'visibility', visible && data ? 'visible' : 'none');
      const opacity = Number(layerParamsStore.getParam(key, `${key}Opacity`) ?? 0.55);
      map.setPaintProperty(`${key}-fill`, 'fill-opacity', opacity);
      map.setPaintProperty(`${key}-line`, 'line-opacity', opacity);
    }
  }
  function visibilityChanged() {
    for (const key of STATISTICS_KEYS) {
      const visible = layerVisibilityStore.getVisibility(key);
      if (shown.get(key) === visible) continue;
      shown.set(key, visible);
      if (visible) void regionalStatisticsStore.load(key);
      else regionalStatisticsStore.disable(key);
    }
    render();
  }
  const dispose = [layerVisibilityStore.subscribe(visibilityChanged), layerParamsStore.subscribe(render), ...STATISTICS_KEYS.map(key => regionalStatisticsStore.subscribe(key, render))];
  map.on('style.load', render);
  // Data may finish during a Mapbox source update; idle retries rendering that state.
  const onIdle = () => {
    if (STATISTICS_KEYS.some(key => regionalStatisticsStore.getSnapshot(key).data !== (rendered.get(key) ?? null))) render();
  };
  map.on('idle', onIdle);
  visibilityChanged();
  return () => { dispose.forEach(fn => fn()); map.off('style.load', render); map.off('idle', onIdle); STATISTICS_KEYS.forEach(key => regionalStatisticsStore.disable(key)); };
}
