import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { Flight, Ship, RailTrain, RenderMode } from "../types";
import { FlightScene } from "../three/FlightScene";
import { ShipScene } from "../three/ShipScene";
import { RailScene } from "../three/RailScene";
import { setAltExaggeration, getAltExaggeration, setAltOffset, getAltOffset } from "../utils/coordinates";
import { loadingRegistry } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * 時間驅動圖層的重繪觸發：時間值改變且圖層可見時才 triggerRepaint。
 * 暫停（timeStore 不再 setTime）→ 0 次重繪；播放中每幀時間都在變 → 每幀畫（平滑不變）。
 * 資料／參數／可見性改變由 useThreeJsLayers 的 wake-up 通道負責；相機移動 Mapbox 本來就會重畫。
 */
export function subscribeTimeRepaint(
  getMap: () => MapboxMap | null,
  getIsVisible: () => boolean,
): () => void {
  return timeStore.subscribe(() => {
    if (getIsVisible()) getMap()?.triggerRepaint();
  });
}

// 首次開啟 flight/ship 圖層時，Three.js 軌跡建構是同步阻塞主執行緒（5-10s）。
// 用「首幀只啟動 loading 圈圈並 return、下一幀才真正建構」讓圈圈先畫出來，
// 建構完成後收掉圈圈。最壞情況（狀態異常）也只是沒圈圈，不影響既有渲染。
type RenderGateState = "off" | "spinning" | "on";

export interface FlightLayerOptions {
  getCurrentTime: () => number;
  getFlights: () => Flight[];
  getRenderMode: () => RenderMode;
  getAltExaggeration: () => number;
  getAltOffset: () => number;
  getStaticOpacity: () => number;
  getOrbScale: () => number;
  getIsDarkTheme: () => boolean;
  getShowTrails: () => boolean;
  getIsVisible: () => boolean;
  onSceneReady?: (scene: FlightScene) => void;
}

/**
 * 建立 Mapbox CustomLayer，橋接 Three.js 場景
 */
export function createFlightLayer(opts: FlightLayerOptions): CustomLayerInterface {
  const flightScene = new FlightScene();
  let map: MapboxMap | null = null;
  let lastAltExag = getAltExaggeration();
  let lastAltOffset = getAltOffset();
  let lastDarkTheme = true;
  let lastShowTrails = true;
  let gate: RenderGateState = "off";
  let loadId = "";
  let armFrames = 0;
  let unsubTime: (() => void) | null = null;
  // 只在時間／資料／模式／參數變動時才重算軌跡（相機移動觸發的 render 直接重畫上一份結果）
  let lastFlights: Flight[] | null = null;
  let lastTime = Number.NaN;
  let lastMode: RenderMode | null = null;
  let sceneDirty = true;

  return {
    id: "flight-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      flightScene.init(gl);
      opts.onSceneReady?.(flightScene);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) {
        if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
        gate = "off";
        return;
      }
      // 首次可見：先啟動 loading 圈圈、本幀不建構，讓瀏覽器先畫圈圈
      if (gate === "off") {
        gate = "spinning";
        armFrames = 0;
        sceneDirty = true;
        loadId = `flight-3d:${Date.now()}`;
        loadingRegistry.start(loadId, "航班軌跡 渲染中");
        map?.triggerRepaint();
        return;
      }
      // 同步建構會阻塞主執行緒，先空轉幾幀確保圈圈真的 paint 出來，再開始建構
      if (gate === "spinning" && armFrames < 3) {
        armFrames++;
        map?.triggerRepaint();
        return;
      }

      const flights = opts.getFlights();
      const time = opts.getCurrentTime();
      const mode = opts.getRenderMode();
      const altExag = opts.getAltExaggeration();
      const altOff = opts.getAltOffset();
      const isDark = opts.getIsDarkTheme();

      // 主題變更 → 更新顏色 + 重建靜態軌跡
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        flightScene.setTheme(isDark);
        sceneDirty = true;
      }

      // 高度參數變更 → 更新座標模組 + 強制重建靜態軌跡
      setAltExaggeration(altExag);
      setAltOffset(altOff);
      if (altExag !== lastAltExag || altOff !== lastAltOffset) {
        lastAltExag = altExag;
        lastAltOffset = altOff;
        flightScene.forceRebuildStatic();
        sceneDirty = true;
      }

      const needUpdate = sceneDirty || flights !== lastFlights || time !== lastTime || mode !== lastMode;

      // 先更新靜態軌跡（可能重建 mesh）
      if (needUpdate) flightScene.updateStaticTrails(flights, mode);

      // showTrails 切換
      const showTrails = opts.getShowTrails();
      if (showTrails !== lastShowTrails) {
        lastShowTrails = showTrails;
        flightScene.setShowTrails(showTrails);
      }

      // 再套用不透明度 & 光球大小（確保新建的 mesh 也能正確套用）
      flightScene.setStaticOpacity(opts.getStaticOpacity());
      flightScene.setOrbScale(opts.getOrbScale());

      if (needUpdate) {
        flightScene.update(flights, time);
        lastFlights = flights;
        lastTime = time;
        lastMode = mode;
        sceneDirty = false;
      }
      flightScene.render(matrix);

      // 首幀建構完成 → 收掉 loading 圈圈
      if (gate === "spinning") {
        gate = "on";
        if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
      }
      // 不再無條件每幀 triggerRepaint：時間變動由 subscribeTimeRepaint 驅動
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
      flightScene.dispose();
    },
  };
}

// ── 船舶圖層 ──

export interface ShipLayerOptions {
  getCurrentTime: () => number;
  getShips: () => Ship[];
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getTrailOpacity: () => number;
  getMapBounds: () => { minLng: number; maxLng: number; minLat: number; maxLat: number } | null;
  getIsVisible: () => boolean;
  onSceneReady?: (scene: ShipScene) => void;
}

export function createShipLayer(opts: ShipLayerOptions): CustomLayerInterface {
  const shipScene = new ShipScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;
  let gate: RenderGateState = "off";
  let loadId = "";
  let armFrames = 0;
  let unsubTime: (() => void) | null = null;

  return {
    id: "ship-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      shipScene.init(gl);
      opts.onSceneReady?.(shipScene);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) {
        if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
        gate = "off";
        return;
      }
      // 首次可見：先啟動 loading 圈圈、本幀不建構，讓瀏覽器先畫圈圈
      if (gate === "off") {
        gate = "spinning";
        armFrames = 0;
        loadId = `ship-3d:${Date.now()}`;
        loadingRegistry.start(loadId, "船舶軌跡 渲染中");
        map?.triggerRepaint();
        return;
      }
      // 同步建構會阻塞主執行緒，先空轉幾幀確保圈圈真的 paint 出來，再開始建構
      if (gate === "spinning" && armFrames < 3) {
        armFrames++;
        map?.triggerRepaint();
        return;
      }

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        shipScene.setTheme(isDark);
      }

      shipScene.setOrbScale(opts.getOrbScale());
      shipScene.setTrailOpacity(opts.getTrailOpacity());
      shipScene.setViewBounds(opts.getMapBounds());
      shipScene.update(opts.getShips(), opts.getCurrentTime());
      shipScene.render(matrix);

      // 首幀建構完成 → 收掉 loading 圈圈
      if (gate === "spinning") {
        gate = "on";
        if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
      }
      // 不再無條件每幀 triggerRepaint：時間變動由 subscribeTimeRepaint 驅動
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      if (loadId) { loadingRegistry.end(loadId); loadId = ""; }
      shipScene.dispose();
    },
  };
}

// ── 軌道列車圖層 ──

export interface RailLayerOptions {
  getTrains: () => RailTrain[];
  getCurrentTime: () => number;
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getTrackOpacity: () => number;
  getRailAltOffset: () => number;
  getTrackFeatures: () => GeoJSON.FeatureCollection | null;
  getIsVisible: () => boolean;
  getTrainVisible: () => boolean;
  getTrackMode: () => string;
  onSceneReady?: (scene: RailScene) => void;
}

export function createRailLayer(opts: RailLayerOptions): CustomLayerInterface {
  const railScene = new RailScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;
  let lastTrackFeatures: GeoJSON.FeatureCollection | null = null;
  let unsubTime: (() => void) | null = null;

  return {
    id: "rail-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      railScene.init(gl);
      opts.onSceneReady?.(railScene);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        railScene.setTheme(isDark);
      }

      // 靜態軌道 GeoJSON 更新
      const features = opts.getTrackFeatures();
      if (features && features !== lastTrackFeatures) {
        lastTrackFeatures = features;
        railScene.setStaticTracks(features);
      }

      railScene.setOrbScale(opts.getOrbScale());
      railScene.setTrackOpacity(opts.getTrackMode() === "3d" ? opts.getTrackOpacity() : 0);
      railScene.setAltitudeOffset(opts.getRailAltOffset());
      const trains = opts.getTrainVisible() ? opts.getTrains() : [];
      railScene.update(trains, opts.getCurrentTime());
      railScene.render(matrix);
      // 不再無條件每幀 triggerRepaint：時間變動由 subscribeTimeRepaint 驅動
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      railScene.dispose();
    },
  };
}
