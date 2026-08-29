import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { BusVehicle, BusColorMode } from "../types";
import { BusScene } from "../three/BusScene";

export interface BusLayerOptions {
  /** 自訂 layer id（預設 "bus-3d"；若要同時加兩個 bus layer 需指定不同 id） */
  id?: string;
  getBuses: () => BusVehicle[];
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  getColorMode: () => BusColorMode;
  getAltOffset: () => number;
  /** 可選：材質透明度覆寫（未提供則沿用 BusScene 依主題自動決定的 opacity） */
  getOpacity?: () => number;
  /** 圖層透明度倍率；保留亮／暗主題既有的材質 opacity。 */
  getOpacityMultiplier?: () => number;
  onSceneReady?: (scene: BusScene) => void;
  maxInstances?: number;
}

export function createBusLayer(opts: BusLayerOptions): CustomLayerInterface {
  const busScene = new BusScene(opts.maxInstances ?? 5000);
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: opts.id ?? "bus-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      busScene.init(gl);
      opts.onSceneReady?.(busScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        busScene.setTheme(isDark);
      }

      busScene.setOrbScale(opts.getOrbScale());
      busScene.setAltitudeOffset(opts.getAltOffset());
      // `getOpacity` 是台灣好行既有的絕對值覆寫；新的一般 layer control
      // 用 multiplier，避免預設畫面從暗 0.85／亮 0.7 被覆蓋成 1。
      if (opts.getOpacity) busScene.setOpacity(opts.getOpacity());
      else busScene.setOpacityMultiplier(opts.getOpacityMultiplier?.() ?? 1);
      busScene.update(opts.getBuses(), opts.getColorMode());
      busScene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      busScene.dispose();
    },
  };
}
