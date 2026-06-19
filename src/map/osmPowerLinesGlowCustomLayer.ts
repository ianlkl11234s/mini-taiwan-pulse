import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { OsmPowerLinesGlowScene, type PowerLineFeature } from "../three/OsmPowerLinesGlowScene";

export interface OsmPowerLinesGlowLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getWidthMul: () => number;
  getFeatures: () => PowerLineFeature[] | null;
}

export const OSM_POWER_LINES_GLOW_LAYER_ID = "osm-power-lines-three-glow";

export function createOsmPowerLinesGlowLayer(
  opts: OsmPowerLinesGlowLayerOptions,
): CustomLayerInterface {
  const scene = new OsmPowerLinesGlowScene();
  let map: MapboxMap | null = null;
  let lastFeaturesRef: PowerLineFeature[] | null = null;

  return {
    id: OSM_POWER_LINES_GLOW_LAYER_ID,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(mapInstance, gl) {
      map = mapInstance;
      scene.init(gl);
    },

    render(_gl, matrix) {
      const visible = opts.getIsVisible();
      scene.setVisible(visible);
      if (!visible) return;

      const features = opts.getFeatures();
      if (features && features !== lastFeaturesRef) {
        scene.setData(features);
        lastFeaturesRef = features;
      }
      scene.setOpacity(opts.getOpacity());
      scene.setWidthMul(opts.getWidthMul());

      scene.render(matrix);
      // 不需要 triggerRepaint — line layer 為靜態
      void map;
    },

    onRemove() {
      scene.dispose();
      lastFeaturesRef = null;
    },
  };
}
