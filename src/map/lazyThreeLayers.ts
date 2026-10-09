/**
 * 獨立 3D 圖層 hook 的 three.js 模組按需載入（C1b 首屏瘦身）。
 *
 * 這些 hook（水庫、房地產點、GFW v4 航跡、歷史航跡、電力 glow/bars/beam、夜景 bloom）
 * 只經由這裡的 `import()` 取用 *CustomLayer／Scene，three.js 因此不進首屏 bundle：
 * 圖層第一次可見才下載（掛 loadingRegistry），之後同步可用。
 *
 * ⚠️ 本檔（及引用它的 hook）不可靜態 import 任何 *CustomLayer.ts／three/*Scene.ts 的值
 * —— 連 layer id 常數也不行（會把 three 拉回首屏）。id 在下方重複宣告，
 * 由 __tests__/lazyThreeLayers.test.ts 對照原模組確保一致。
 */
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { withLoading } from "../lib/loadingRegistry";

export interface LazyModule<T> {
  /** 已載入的模組；尚未載入回 null（同步、不觸發下載）。 */
  get(): T | null;
  /** 載入（快取；失敗清快取讓下次重試）。不掛 loading UI —— 給背景預載用。 */
  load(): Promise<T>;
  /** 載入並掛 loading UI（同一次載入只註冊一次）。已載入時不掛。 */
  ensure(): Promise<T>;
}

export function lazyModule<T>(key: string, label: string, importer: () => Promise<T>): LazyModule<T> {
  let mod: T | null = null;
  let pending: Promise<T> | null = null;
  let uiPending: Promise<T> | null = null;
  const load = (): Promise<T> => {
    if (mod) return Promise.resolve(mod);
    if (!pending) {
      pending = importer().then(
        (m) => { mod = m; return m; },
        (err) => { pending = null; throw err; },
      );
    }
    return pending;
  };
  return {
    get: () => mod,
    load,
    ensure() {
      if (mod) return Promise.resolve(mod);
      if (!uiPending) {
        uiPending = withLoading(key, label, load());
        const clear = () => { uiPending = null; };
        uiPending.then(clear, clear);
      }
      return uiPending;
    },
  };
}

// ── layer id（與各 *CustomLayer.ts 一致；見檔頭說明） ──
export const RE_POINTS_LAYER_ID = "re-points-three";
export const GFW_V4_TRACK_CUSTOM_LAYER_ID = "gfw-v4-tracks-custom";
export const BUILDINGS_NIGHT_BLOOM_LAYER_ID = "buildings-night-bloom-3d";
export const POWER_REGION_BARS_LAYER_ID = "power-region-bars-3d";
export const SUBSTATION_EHV_GLOW_LAYER_ID = "substation-ehv-glow-3d";
export const POWER_PLANT_GLOW_LAYER_ID = "power-plant-glow-3d";
export const OSM_POWER_LINES_GLOW_LAYER_ID = "osm-power-lines-three-glow";
export const POWER_GENERATION_BEAM_LAYER_ID = "power-generation-beam-3d";
export const EARTHQUAKE_RIPPLE_LAYER_ID = "earthquakes-global-ripple-3d";

// ── 各圖層的 lazy 模組 ──
export const reservoirLayerModule = lazyModule("three:reservoir", "水庫 3D 工具", () =>
  Promise.all([import("../three/ReservoirScene"), import("./reservoirCustomLayer")]).then(
    ([scene, layer]) => ({ ReservoirScene: scene.ReservoirScene, createReservoirLayer: layer.createReservoirLayer }),
  ));
export const realEstatePointsModule = lazyModule("three:re-points", "房地產點 3D 工具", () => import("./realEstatePointsCustomLayer"));
export const gfwV4TrackLayerModule = lazyModule("three:gfw-v4-tracks", "GFW 航跡 3D 工具", () => import("./gfwV4TrackCustomLayer"));
export const historicalFlightTrailsModule = lazyModule("three:historical-flights", "歷史航跡 3D 工具", () => import("./historicalFlightTrails"));
export const buildingsNightBloomModule = lazyModule("three:night-bloom", "夜景 3D 工具", () => import("./buildingsNightBloomCustomLayer"));
export const powerRegionBarsModule = lazyModule("three:power-region-bars", "區域用電 3D 工具", () => import("./powerRegionBarsCustomLayer"));
export const substationEhvGlowModule = lazyModule("three:substation-glow", "變電所 3D 工具", () => import("./substationEhvGlowCustomLayer"));
export const powerPlantGlowModule = lazyModule("three:power-plant-glow", "發電廠 3D 工具", () => import("./powerPlantGlowCustomLayer"));
export const osmPowerLinesGlowModule = lazyModule("three:power-lines-glow", "輸電線 3D 工具", () => import("./osmPowerLinesGlowCustomLayer"));
export const powerGenerationBeamModule = lazyModule("three:power-beam", "機組出力 3D 工具", () => import("./powerGenerationBeamCustomLayer"));
export const earthquakeRippleModule = lazyModule("three:quake-ripple", "地震漣漪 3D 工具", () => import("./earthquakeRippleCustomLayer"));

/**
 * 背景預載清單（prewarmLayerChunks 用）。
 * R6 段 1（2026-10-05）：「立體效果」改為選配的三個模組（夜景 bloom、輸電線 glow、地震漣漪）
 * 不預載 —— 使用者開啟立體效果時才下載（mountLazyCustomLayer 的 ensure() 會掛 loading UI）。
 */
export const R6_STEREO_ON_DEMAND_MODULES: ReadonlyArray<LazyModule<unknown>> = [
  buildingsNightBloomModule, osmPowerLinesGlowModule, earthquakeRippleModule,
];
export const LAZY_THREE_LAYER_LOADERS: Array<() => Promise<unknown>> = [
  reservoirLayerModule, realEstatePointsModule, gfwV4TrackLayerModule, historicalFlightTrailsModule,
  powerRegionBarsModule, substationEhvGlowModule, powerPlantGlowModule,
  powerGenerationBeamModule,
].map((m) => () => m.load());

export function lazyAnchorId(layerId: string): string {
  return `${layerId}--lazy-anchor`;
}

/**
 * 以錨點佔位的延遲掛載（取代「開站即 addLayer」的 tryMount 主體）。
 *
 * - 錨點（空 render 的 custom layer）在原本 addLayer 的時機／位置加入 → 圖層順序不變；
 *   style 未就緒時 addLayer 會丟錯，呼叫端沿用既有 try/catch + idle 重試。
 * - 模組已載入 → 立即把真圖層插在錨點前（與改前同步行為相同）。
 * - 未載入且 isVisible() 為 false → 不下載（圖層關閉期間不觸發）。
 * - 未載入且可見 → ensure()（loading UI）完成後，若仍可見、錨點仍在且尚未加入才加入。
 */
export function mountLazyCustomLayer<T>(
  map: MapboxMap,
  layerId: string,
  lazy: LazyModule<T>,
  create: (mod: T) => CustomLayerInterface,
  isVisible: () => boolean,
): void {
  if (map.getLayer(layerId)) return;
  const anchorId = lazyAnchorId(layerId);
  if (!map.getLayer(anchorId)) {
    map.addLayer({ id: anchorId, type: "custom", renderingMode: "2d", render: () => {} });
  }
  const mod = lazy.get();
  if (mod) {
    map.addLayer(create(mod), anchorId);
    return;
  }
  if (!isVisible()) return;
  lazy.ensure().then(
    (loaded) => {
      try {
        if (!isVisible() || map.getLayer(layerId) || !map.getLayer(anchorId)) return;
        map.addLayer(create(loaded), anchorId);
        map.triggerRepaint();
      } catch (err) {
        // 地圖已銷毀或 style 重建中：下次 effect／style.load 的 tryMount 會同步補上
        console.warn(`[lazyThreeLayers] deferred addLayer ${layerId} failed`, err);
      }
    },
    (err) => console.error(`[lazyThreeLayers] failed to load module for ${layerId}`, err),
  );
}

/** 移除真圖層與錨點（給 cleanup 會 removeLayer 的 hook 用）。 */
export function removeLazyCustomLayer(map: MapboxMap, layerId: string): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  const anchorId = lazyAnchorId(layerId);
  if (map.getLayer(anchorId)) map.removeLayer(anchorId);
}
