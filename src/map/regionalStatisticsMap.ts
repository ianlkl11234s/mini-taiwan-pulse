import { statisticsFillCase, statisticsMissingFilter } from '../data/statisticsFillColor';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe, statisticsReleaseFallback, type StatisticsRenderKey } from '../data/regionalStatisticsRecipes';
import { regionalStatisticsStore } from '../state/regionalStatisticsStore';
import { layerVisibilityStore } from '../state/layerVisibilityStore';
import { layerParamsStore } from '../state/layerParamsStore';
import { keepLoadingUntilMapIdle, withLoading } from '../lib/loadingRegistry';
import { STATISTICS_FILL_OPACITY, statisticsDefaultOpacity } from '../data/statisticsVisuals';
import { BOUNDARY_GRAY, gradedSeamPaint, hatchImageData, hatchImageId, type HatchKind } from './mapStyleScale';
import { isPresentationKey, statisticsCircleHollow, statisticsPresentationMode } from '../state/statisticsPresentationStore';
import { PROPORTIONAL_CIRCLE, proportionalCircleRadiusExpression, statisticsCircleData } from './statisticsCircles';
import { DOT_STYLE, dataDotUnit, statisticsDotRadius, statisticsDotData, statisticsDotDataReady } from './statisticsDots';

/** 有數值才上色；缺值、未發布、遮蔽一律透明底，由 hatch 子圖層表示（F-3 A）。 */
const NO_FILL = 'rgba(0,0,0,0)';
const HAS_VALUE: unknown[] = ['all', ['==', ['get', 'status'], 'observed'], ['!=', ['get', 'value'], null]];
const IS_MISSING: unknown[] = ['all', ['!', HAS_VALUE], ['!=', ['get', 'status'], 'suppressed']];
const SUFFIXES = ['fill', 'missing', 'suppressed', 'line'] as const;
/** 比例圓（呈現方式＝比例圓）：另一個點 source `<key>-circles`，halo＋circle 兩個子圖層，排在所有統計面之上 */
const CIRCLE_SUFFIXES = ['circle-halo', 'circle'] as const;
const circleSourceId = (key: string) => `${key}-circles`;
/** 比例圓的 map layer id（點擊開 popup 用；gisClickRegistry） */
export const statisticsCircleLayerId = (key: string) => `${key}-circle`;
/** 點密度（呈現方式＝點密度）：點 source `<key>-dots`、一個 circle 子圖層（不進點擊登記：點不是實際地點，點區域開面的 popup） */
const dotSourceId = (key: string) => `${key}-dot-points`;
export const statisticsDotLayerId = (key: string) => `${key}-dots`;
/** 右側期別／細項與左側不同時，右圖用的 store key 後綴（`regionalStatisticsStore` 不寫 localStorage） */
export const RIGHT_STORE_SUFFIX = '::R';

/**
 * 多地圖共存（比較模式，docs/features/compare-mode/DESIGN.md §3）：同一份統計 store 可同時掛主地圖與比較用的右圖。
 *
 * - **主地圖**（`primary`，預設）：擁有每個 key 本身的資料——註冊 recipe、依圖層開關載入／清除、管透明度預設；
 *   `isShown` 只決定這張圖畫不畫（側別＝只在右側時主地圖不畫，但資料照樣留著給右圖與圖例用）。
 * - **右圖**（`primary: false`）：對 key 本身只讀；只擁有 `storeKey(key) !== key` 的那份（`key::R`，右側期別／細項不同時才有），
 *   載入、清除、關閉時的 cleanup 都只碰自己擁有的 key——關右圖不會清掉主地圖的統計資料。
 */
export interface StatisticsAttachOptions {
  /** 這張圖讀哪個 store key（預設＝key） */
  storeKey?: (key: StatisticsRenderKey) => string;
  /** 這張圖畫不畫（預設＝圖層開關） */
  isShown?: (key: StatisticsRenderKey) => boolean;
  /** 是否為主地圖（預設 true） */
  primary?: boolean;
  /** 額外的重畫觸發（例：比較模式的側別改變）；回傳取消訂閱 */
  subscribe?: (callback: () => void) => () => void;
  /** 比例圓參考值覆寫（左右期別不同時兩張圖共用較大者）；回 undefined＝用本圖資料自己的參考值 */
  circleReference?: (key: StatisticsRenderKey, own: number | null) => number | null | undefined;
  /** 點密度「一點＝N」覆寫（左右期別不同時兩張圖共用較大者）；回 undefined＝用本圖資料自己的 N */
  dotUnit?: (key: StatisticsRenderKey, own: number) => number | undefined;
  /** loadingRegistry 任務 id 前綴（兩張圖同時載入同一層時不互相結束） */
  loadingPrefix?: string;
}

/**
 * Owns only statistics sources/layers; other GIS visibility is untouched.
 * @param getIsDark 目前底圖是否暗色（色階、填色透明度、細縫與斜線顏色依底圖切換；換底圖會觸發 style.load 重畫）。
 */
export function attachRegionalStatistics(map: mapboxgl.Map, getIsDark: () => boolean = () => true, options: StatisticsAttachOptions = {}): () => void {
  const primary = options.primary ?? true;
  const storeKey = (key: StatisticsRenderKey) => options.storeKey?.(key) ?? key;
  const isShown = (key: StatisticsRenderKey) => options.isShown ? options.isShown(key) : layerVisibilityStore.getVisibility(key);
  /** 這張圖負責載入／清除的 store key：主地圖＝key 本身；右圖＝與 key 不同的那份 */
  const ownedKey = (key: StatisticsRenderKey): string | null => primary ? key : storeKey(key) !== key ? storeKey(key) : null;
  const loadingPrefix = options.loadingPrefix ?? '';
  const shown = new Map<string, boolean>();
  const rendered = new Map<StatisticsRenderKey, GeoJSON.FeatureCollection>();
  const renderedCircles = new Map<StatisticsRenderKey, GeoJSON.FeatureCollection>();
  const renderedDots = new Map<StatisticsRenderKey, GeoJSON.FeatureCollection>();
  const pendingDots = new Set<Promise<unknown>>();
  let disposed = false;
  if (primary) for (const key of STATISTICS_RENDER_KEYS) {
    const recipe = statisticsRenderRecipe(key);
    const fallback = statisticsReleaseFallback(key);
    regionalStatisticsStore.registerRecipe(key, { layerKey: key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, label: recipe.label, dimensions: recipe.dimensions, ...('releaseId' in recipe ? { releaseId: recipe.releaseId, allowReleaseFallback: true } : {}), ...(fallback ? { releaseFallback: fallback } : {}), ...('includeHealth' in recipe ? { includeHealth: recipe.includeHealth } : {}) });
  }
  /**
   * @param fromStyleLoad 換底圖（setStyle）後的 style.load：此時 `isStyleLoaded()` 可能仍為 false，
   *   但 style 已可加 source／layer；略過檢查，用 store 快取資料直接重建（不重抓，perf-audit §7）。
   */
  /**
   * 透明度預設跟底圖走（2026-11-10 使用者決定；map-layers §3.6 K-4）：滑桿顯示實際透明度。
   * 每個 key 記住上次自動寫入的預設值；換底圖時，目前值仍等於它（使用者沒動過）才換成新底圖的預設，
   * 動過就保留使用者的值。初始值＝規格預設（淡底 0.55）。
   */
  const autoOpacity = new Map<StatisticsRenderKey, number>();
  let opacityBasemap: boolean | undefined;
  let syncingOpacity = false;
  function syncOpacityDefaults(isDark: boolean) {
    if (opacityBasemap === isDark) return;
    opacityBasemap = isDark;
    const target = statisticsDefaultOpacity(isDark);
    const writes: { key: string; name: string; value: number }[] = [];
    for (const key of STATISTICS_RENDER_KEYS) {
      const name = `${key}Opacity`;
      const current = layerParamsStore.getParam(key, name);
      if (current !== (autoOpacity.get(key) ?? STATISTICS_FILL_OPACITY.light)) continue;
      autoOpacity.set(key, target);
      if (current !== target) writes.push({ key, name, value: target });
    }
    syncingOpacity = true;
    try { layerParamsStore.setManyDirect(writes); } finally { syncingOpacity = false; }
  }
  function render(fromStyleLoad = false) {
    if (!fromStyleLoad && !map.isStyleLoaded()) return;
    const isDark = getIsDark();
    if (primary) syncOpacityDefaults(isDark);
    for (const kind of ['missing', 'suppressed'] as HatchKind[]) {
      for (const dark of [true, false]) {
        const id = hatchImageId(kind, dark);
        if (!map.hasImage(id)) map.addImage(id, hatchImageData(kind, dark));
      }
    }
    const seam = gradedSeamPaint(isDark, HAS_VALUE);
    for (const key of STATISTICS_RENDER_KEYS) {
      const visible = isShown(key);
      const state = regionalStatisticsStore.getSnapshot(storeKey(key));
      if (!visible && !map.getSource(key)) continue;
      const recipe = statisticsRenderRecipe(key, state.selection?.indicatorId, state.selection?.dimensions, { isDark });
      if (!map.getSource(key)) {
        rendered.delete(key);
        renderedCircles.delete(key);
        renderedDots.delete(key);
        map.addSource(key, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'area_code' });
        const before = beforeCircles();
        map.addLayer({ id: `${key}-fill`, type: 'fill', source: key, layout: { visibility: 'none' }, paint: {
          'fill-color': statisticsFillCase(recipe, HAS_VALUE, NO_FILL) as mapboxgl.ExpressionSpecification,
          'fill-opacity': statisticsDefaultOpacity(isDark),
        } }, before);
        map.addLayer({ id: `${key}-missing`, type: 'fill', source: key, filter: IS_MISSING as mapboxgl.FilterSpecification, layout: { visibility: 'none' }, paint: { 'fill-pattern': hatchImageId('missing', isDark), 'fill-opacity': 0.55 } }, before);
        map.addLayer({ id: `${key}-suppressed`, type: 'fill', source: key, filter: ['==', ['get', 'status'], 'suppressed'], layout: { visibility: 'none' }, paint: { 'fill-pattern': hatchImageId('suppressed', isDark), 'fill-opacity': 0.55 } }, before);
        // F-2：有值 1px 底圖色細縫、無值中性灰；不綁透明度滑桿
        map.addLayer({ id: `${key}-line`, type: 'line', source: key, layout: { visibility: 'none' }, paint: { ...seam } as mapboxgl.LinePaint }, before);
      }
      // A presentation source survives metric switches; refresh the scale as well as values.
      map.setPaintProperty(`${key}-fill`, 'fill-color', statisticsFillCase(recipe, HAS_VALUE, NO_FILL) as mapboxgl.ExpressionSpecification);
      map.setFilter(`${key}-missing`, statisticsMissingFilter(recipe, IS_MISSING) as mapboxgl.FilterSpecification);
      map.setPaintProperty(`${key}-missing`, 'fill-pattern', hatchImageId('missing', isDark));
      map.setPaintProperty(`${key}-suppressed`, 'fill-pattern', hatchImageId('suppressed', isDark));
      map.setPaintProperty(`${key}-line`, 'line-color', seam['line-color'] as mapboxgl.ExpressionSpecification);
      map.setPaintProperty(`${key}-line`, 'line-opacity', seam['line-opacity'] as mapboxgl.ExpressionSpecification);
      map.setPaintProperty(`${key}-line`, 'line-width', seam['line-width']);
      const data = state.data;
      if (data && rendered.get(key) !== data) {
        rendered.set(key, data);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData(data);
        keepLoadingUntilMapIdle(map, `statistics-render:${loadingPrefix}${key}`, recipe.label, key);
      } else if (!data && rendered.has(key)) {
        rendered.delete(key);
        (map.getSource(key) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
      for (const suffix of SUFFIXES) map.setLayoutProperty(`${key}-${suffix}`, 'visibility', visible && data ? 'visible' : 'none');
      // 滑桿值＝實際透明度（填色與斜線同值）；暗底預設 0.75 由 syncOpacityDefaults 寫進滑桿（K-4 統計例外）。
      const opacity = Number(layerParamsStore.getParam(key, `${key}Opacity`) ?? statisticsDefaultOpacity(isDark));
      map.setPaintProperty(`${key}-fill`, 'fill-opacity', opacity);
      map.setPaintProperty(`${key}-missing`, 'fill-opacity', opacity);
      map.setPaintProperty(`${key}-suppressed`, 'fill-opacity', opacity);
      if (isPresentationKey(key)) {
        renderCircles(key, visible && Boolean(data), data, recipe.colors[recipe.colors.length - 1]!, recipe.level, opacity, isDark);
        renderDots(key, visible && Boolean(data), data, recipe.colors[recipe.colors.length - 1]!, recipe.label, opacity, isDark);
      }
    }
  }
  /**
   * 比例圓：面量圖的 fill 關掉（不攔下層面量圖的點擊）、缺值／遮蔽斜線與細縫保留；圓的 properties 與面相同，
   * 點圓開同一個 popup。單獨顯示＝實心（最深一級色、透明度＝滑桿），疊在其他面量圖上＝空心圈（statisticsCircleHollow）。
   */
  function renderCircles(key: StatisticsRenderKey, layerShown: boolean, data: GeoJSON.FeatureCollection | null | undefined, color: string, level: string, opacity: number, isDark: boolean) {
    const circle = layerShown && statisticsPresentationMode(key) === 'circle';
    const circles = circle && data ? statisticsCircleData(data) : null;
    const reference = circles ? options.circleReference?.(key, circles.reference) ?? circles.reference : null;
    if (!circles || !reference) {
      if (circle) map.setLayoutProperty(`${key}-fill`, 'visibility', 'none');
      for (const suffix of CIRCLE_SUFFIXES) if (map.getLayer(`${key}-${suffix}`)) map.setLayoutProperty(`${key}-${suffix}`, 'visibility', 'none');
      return;
    }
    map.setLayoutProperty(`${key}-fill`, 'visibility', 'none');
    const sourceId = circleSourceId(key);
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'area_code' });
      for (const suffix of CIRCLE_SUFFIXES) {
        map.addLayer({ id: `${key}-${suffix}`, type: 'circle', source: sourceId, layout: { visibility: 'none', 'circle-sort-key': ['-', 0, ['to-number', ['get', 'value'], 0]] }, paint: {} });
      }
    }
    if (renderedCircles.get(key) !== circles.points) {
      renderedCircles.set(key, circles.points);
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(circles.points);
    }
    const theme = isDark ? 'dark' : 'light';
    const hollow = statisticsCircleHollow(key);
    const radius = proportionalCircleRadiusExpression(reference, level) as mapboxgl.ExpressionSpecification;
    const halo = `${key}-circle-halo`;
    const main = statisticsCircleLayerId(key);
    map.setPaintProperty(halo, 'circle-radius', radius);
    map.setPaintProperty(halo, 'circle-opacity', 0);
    map.setPaintProperty(halo, 'circle-stroke-width', PROPORTIONAL_CIRCLE.ringHalo.width);
    map.setPaintProperty(halo, 'circle-stroke-color', PROPORTIONAL_CIRCLE.ringHalo.color[theme]);
    map.setPaintProperty(halo, 'circle-stroke-opacity', opacity);
    map.setPaintProperty(main, 'circle-radius', radius);
    map.setPaintProperty(main, 'circle-color', color);
    map.setPaintProperty(main, 'circle-opacity', hollow ? 0 : opacity);
    map.setPaintProperty(main, 'circle-stroke-width', hollow ? PROPORTIONAL_CIRCLE.ring.width : PROPORTIONAL_CIRCLE.fillStroke.width);
    map.setPaintProperty(main, 'circle-stroke-color', hollow ? PROPORTIONAL_CIRCLE.ring.color[theme] : PROPORTIONAL_CIRCLE.fillStroke.color[theme]);
    map.setPaintProperty(main, 'circle-stroke-opacity', hollow ? 1 : Math.min(1, opacity + 0.15));
    map.setLayoutProperty(halo, 'visibility', hollow ? 'visible' : 'none');
    map.setLayoutProperty(main, 'visibility', 'visible');
  }
  /**
   * 點密度：面量圖填色關掉（fill 保持 visible、透明度 0 → 點區域內任何地方仍開原本的區 popup）；缺值／遮蔽斜線照舊、
   * 不撒點；細縫換成淡淡的行政區界（關掉填色後底圖色細縫看不見）。點位分批計算（`statisticsDotData`），
   * 算好前保留上一份點（換期別不閃白），算好再重畫；計算中註冊 loadingRegistry。
   */
  function renderDots(key: StatisticsRenderKey, layerShown: boolean, data: GeoJSON.FeatureCollection | null | undefined, color: string, label: string, opacity: number, isDark: boolean) {
    const layerId = statisticsDotLayerId(key);
    const dots = layerShown && statisticsPresentationMode(key) === 'dots' && data;
    if (!dots) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
      return;
    }
    const theme = isDark ? 'dark' : 'light';
    map.setPaintProperty(`${key}-fill`, 'fill-opacity', 0);
    map.setPaintProperty(`${key}-line`, 'line-color', BOUNDARY_GRAY[theme]);
    map.setPaintProperty(`${key}-line`, 'line-opacity', DOT_STYLE.boundaryOpacity[theme]);
    map.setPaintProperty(`${key}-line`, 'line-width', DOT_STYLE.boundaryWidth);
    const own = dataDotUnit(data);
    const unit = options.dotUnit?.(key, own) ?? own;
    const ready = statisticsDotDataReady(data, unit);
    if (!ready) {
      const pending = statisticsDotData(data, unit);
      if (!pendingDots.has(pending)) {
        pendingDots.add(pending);
        void withLoading(`statistics-dots:${loadingPrefix}${key}`, label, pending).finally(() => { pendingDots.delete(pending); if (!disposed) render(); }).catch(() => undefined);
      }
    }
    const sourceId = dotSourceId(key);
    if (!map.getSource(sourceId)) {
      renderedDots.delete(key);
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: layerId, type: 'circle', source: sourceId, layout: { visibility: 'none' }, paint: { 'circle-pitch-alignment': 'map' } });
    }
    if (ready && renderedDots.get(key) !== ready.dots) {
      renderedDots.set(key, ready.dots);
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(ready.dots);
      keepLoadingUntilMapIdle(map, `statistics-dots-render:${loadingPrefix}${key}`, label, sourceId);
    }
    map.setPaintProperty(layerId, 'circle-radius', statisticsDotRadius() as mapboxgl.ExpressionSpecification);
    map.setPaintProperty(layerId, 'circle-color', color);
    map.setPaintProperty(layerId, 'circle-opacity', opacity);
    map.setLayoutProperty(layerId, 'visibility', renderedDots.has(key) ? 'visible' : 'none');
  }
  /** 比例圓／點密度永遠在所有統計面之上：之後才建立的統計面插在第一個比例圓／點層之前（不然後開的面量圖會疊到上面） */
  function beforeCircles(): string | undefined {
    for (const key of renderedCircles.keys()) if (map.getLayer(`${key}-circle-halo`)) return `${key}-circle-halo`;
    for (const key of renderedDots.keys()) if (map.getLayer(statisticsDotLayerId(key))) return statisticsDotLayerId(key);
    return undefined;
  }
  /** 擁有的 key 要不要有資料：主地圖看圖層開關（不看側別）；右圖看自己畫不畫 */
  const wanted = (key: StatisticsRenderKey) => primary ? layerVisibilityStore.getVisibility(key) : isShown(key);
  function visibilityChanged() {
    const owned = new Set<string>();
    for (const key of STATISTICS_RENDER_KEYS) {
      const own = ownedKey(key);
      if (!own) continue;
      owned.add(own);
      const want = wanted(key);
      if (shown.get(own) === want) continue;
      shown.set(own, want);
      if (want) void regionalStatisticsStore.load(own);
      else regionalStatisticsStore.disable(own);
    }
    // 右圖：不再擁有的 key（右側選擇改回與左側相同）→ 清掉那份資料
    for (const own of [...shown.keys()]) {
      if (owned.has(own)) continue;
      if (shown.get(own)) regionalStatisticsStore.disable(own);
      shown.delete(own);
    }
    render();
  }
  const rerender = () => { if (!syncingOpacity) render(); };
  const storeChanged = () => { if (primary) rerender(); else visibilityChanged(); };
  /** 右圖讀的 store key 會在 key 與 key::R 之間換：兩份都訂 */
  const watched = STATISTICS_RENDER_KEYS.flatMap(key => primary ? [key] : [...new Set([key, storeKey(key), `${key}${RIGHT_STORE_SUFFIX}`])]);
  const dispose = [layerVisibilityStore.subscribe(visibilityChanged), layerParamsStore.subscribe(rerender), ...watched.map(key => regionalStatisticsStore.subscribe(key, storeChanged)), ...(options.subscribe ? [options.subscribe(visibilityChanged)] : [])];
  const onStyleLoad = () => render(true);
  map.on('style.load', onStyleLoad);
  // Data may finish during a Mapbox source update; idle retries rendering that state.
  const onIdle = () => {
    if (STATISTICS_RENDER_KEYS.some(key => (isShown(key) || map.getSource(key)) && regionalStatisticsStore.getSnapshot(storeKey(key)).data !== (rendered.get(key) ?? null))) render();
  };
  map.on('idle', onIdle);
  visibilityChanged();
  return () => {
    disposed = true;
    dispose.forEach(fn => fn()); map.off('style.load', onStyleLoad); map.off('idle', onIdle);
    // 只清自己擁有的資料：主地圖＝全部 key（同原本行為）；右圖＝只有 key::R
    if (primary) STATISTICS_RENDER_KEYS.forEach(key => regionalStatisticsStore.disable(key));
    else for (const own of shown.keys()) regionalStatisticsStore.disable(own);
  };
}
