import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { BusVehicle, BusColorMode } from "../types";
import { BusScene } from "../three/BusScene";

export interface BusLayerOptions {
  getBuses: () => BusVehicle[];
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  getColorMode: () => BusColorMode;
  getAltOffset: () => number;
  onSceneReady?: (scene: BusScene) => void;
  maxInstances?: number;
}

export function createBusLayer(opts: BusLayerOptions): CustomLayerInterface {
  const busScene = new BusScene(opts.maxInstances ?? 5000);
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: "bus-3d",
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
      busScene.update(opts.getBuses(), opts.getColorMode());
      busScene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      busScene.dispose();
    },
  };
}
