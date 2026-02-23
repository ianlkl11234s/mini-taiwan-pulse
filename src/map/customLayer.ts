import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { Flight, Ship, RailTrain, RenderMode } from "../types";
import { FlightScene } from "../three/FlightScene";
import { ShipScene } from "../three/ShipScene";
import { RailScene } from "../three/RailScene";
import { setAltExaggeration, getAltExaggeration, setAltOffset, getAltOffset } from "../utils/coordinates";

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

  return {
    id: "flight-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      flightScene.init(gl);
      opts.onSceneReady?.(flightScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
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
      }

      // 高度參數變更 → 更新座標模組 + 強制重建靜態軌跡
      setAltExaggeration(altExag);
      setAltOffset(altOff);
      if (altExag !== lastAltExag || altOff !== lastAltOffset) {
        lastAltExag = altExag;
        lastAltOffset = altOff;
        flightScene.forceRebuildStatic();
      }

      // 先更新靜態軌跡（可能重建 mesh）
      flightScene.updateStaticTrails(flights, mode);

      // showTrails 切換
      const showTrails = opts.getShowTrails();
      if (showTrails !== lastShowTrails) {
        lastShowTrails = showTrails;
        flightScene.setShowTrails(showTrails);
      }

      // 再套用不透明度 & 光球大小（確保新建的 mesh 也能正確套用）
      flightScene.setStaticOpacity(opts.getStaticOpacity());
      flightScene.setOrbScale(opts.getOrbScale());

      flightScene.update(flights, time);
      flightScene.render(matrix);

      // 請求持續重繪（動畫）
      map?.triggerRepaint();
    },

    onRemove() {
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
  getMapBounds: () => { minLng: number; maxLng: number; minLat: number; maxLat: number } | null;
  onSceneReady?: (scene: ShipScene) => void;
}

export function createShipLayer(opts: ShipLayerOptions): CustomLayerInterface {
  const shipScene = new ShipScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: "ship-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      shipScene.init(gl);
      opts.onSceneReady?.(shipScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        shipScene.setTheme(isDark);
      }

      shipScene.setOrbScale(opts.getOrbScale());
      shipScene.setViewBounds(opts.getMapBounds());
      shipScene.update(opts.getShips(), opts.getCurrentTime());
      shipScene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      shipScene.dispose();
    },
  };
}

// ── 軌道列車圖層 ──

export interface RailLayerOptions {
  getTrains: () => RailTrain[];
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  onSceneReady?: (scene: RailScene) => void;
}

export function createRailLayer(opts: RailLayerOptions): CustomLayerInterface {
  const railScene = new RailScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: "rail-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      railScene.init(gl);
      opts.onSceneReady?.(railScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        railScene.setTheme(isDark);
      }

      railScene.setOrbScale(opts.getOrbScale());
      railScene.update(opts.getTrains());
      railScene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      railScene.dispose();
    },
  };
}
