import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { WasteScheduleRoute } from "../data/wasteScheduleLoader";
import { WasteScheduleScene } from "../three/WasteScheduleScene";

/**
 * 垃圾車表定 Custom Layer (Phase 3 prototype)
 *
 * 跟 wasteTruckCustomLayer (GPS) 並行存在、互不影響。
 * 只包 WasteScheduleScene 一個 sub-scene（沒音符）。
 */
export interface WasteScheduleLayerOptions {
  id?: string;
  getRoutes: () => WasteScheduleRoute[];
  getCurrentTime: () => number;
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  getAltOffset: () => number;
  onSceneReady?: (scene: WasteScheduleScene) => void;
  maxInstances?: number;
}

export function createWasteScheduleLayer(opts: WasteScheduleLayerOptions): CustomLayerInterface {
  const scene = new WasteScheduleScene(opts.maxInstances ?? 20000);
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: opts.id ?? "waste-schedule-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
      opts.onSceneReady?.(scene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        scene.setTheme(isDark);
      }

      scene.setOrbScale(opts.getOrbScale());
      scene.setAltitudeOffset(opts.getAltOffset());
      scene.update(opts.getRoutes(), opts.getCurrentTime());
      scene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
