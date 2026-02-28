import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { StationPillarScene } from "../three/StationPillarScene";
import type { StationPillarData } from "../three/StationPillarScene";

export interface StationPillarLayerOptions {
  getPositions: () => StationPillarData[];
  getPillarVisible: () => boolean;
  getPillarHeight: () => number;
  getIsDarkTheme: () => boolean;
  getIsVisible: () => boolean;
}

export function createStationPillarLayer(opts: StationPillarLayerOptions): CustomLayerInterface {
  const scene = new StationPillarScene();
  let map: MapboxMap | null = null;
  let initialized = false;

  return {
    id: "station-pillar-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!initialized) {
        const positions = opts.getPositions();
        if (positions.length > 0) {
          scene.setPositions(positions);
          initialized = true;
        }
      }

      scene.setPillarVisible(opts.getPillarVisible());
      scene.setPillarHeight(opts.getPillarHeight());
      scene.setTheme(opts.getIsDarkTheme());

      if (!opts.getIsVisible()) return;

      scene.render(matrix);
      map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
