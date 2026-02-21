import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { Flight, RenderMode } from "../types";
import { FlightScene } from "../three/FlightScene";
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
