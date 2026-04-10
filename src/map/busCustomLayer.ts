import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { BusVehicle } from "../types";
import { BusScene } from "../three/BusScene";

export interface BusLayerOptions {
  getBuses: () => BusVehicle[];
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  onSceneReady?: (scene: BusScene) => void;
}

export function createBusLayer(opts: BusLayerOptions): CustomLayerInterface {
  const busScene = new BusScene();
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
      busScene.update(opts.getBuses());
      busScene.render(matrix);

      map?.triggerRepaint();
    },

    onRemove() {
      busScene.dispose();
    },
  };
}
