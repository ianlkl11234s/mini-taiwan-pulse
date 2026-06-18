import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { PowerRegionBarsScene } from "../three/PowerRegionBarsScene";
import type { PowerDashboard } from "../data/energyLoader";

export interface PowerRegionBarsLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getDashboard: () => PowerDashboard | null;
}

export const POWER_REGION_BARS_LAYER_ID = "power-region-bars-3d";

export function createPowerRegionBarsLayer(opts: PowerRegionBarsLayerOptions): CustomLayerInterface {
  const scene = new PowerRegionBarsScene();
  let map: MapboxMap | null = null;
  let lastDashboardRef: PowerDashboard | null = null;

  return {
    id: POWER_REGION_BARS_LAYER_ID,
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance, gl) {
      map = mapInstance;
      scene.init(gl);
    },

    render(_gl, matrix) {
      const visible = opts.getIsVisible();
      scene.setVisible(visible);
      if (!visible) return;

      const dash = opts.getDashboard();
      if (dash && dash !== lastDashboardRef) {
        scene.setData(dash.status, dash.regions);
        lastDashboardRef = dash;
      }
      scene.setOpacity(opts.getOpacity());

      const moving = scene.render(matrix);
      if (moving) map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
