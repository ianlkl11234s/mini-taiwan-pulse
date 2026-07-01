import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { GlowPointsScene, type GlowPoint } from "../three/GlowPointsScene";
import { fuelColorOf, type FacilityPoint } from "../data/energyLoader";

export interface PowerPlantGlowLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getSizeMul: () => number;
  getPlants: () => FacilityPoint[] | null;
}

export const POWER_PLANT_GLOW_LAYER_ID = "power-plant-glow-3d";

function plantsToGlow(rows: FacilityPoint[]): GlowPoint[] {
  const capMax = rows.reduce((m, r) => Math.max(m, r.total_capacity_mw ?? 0), 1);
  return rows.map((r) => ({
    lon: r.lng,
    lat: r.lat,
    colorHex: fuelColorOf(r.fuel_type),
    sizeNorm: Math.sqrt((r.total_capacity_mw ?? 100) / capMax),
  }));
}

export function createPowerPlantGlowLayer(
  opts: PowerPlantGlowLayerOptions,
): CustomLayerInterface {
  const scene = new GlowPointsScene({ minSizePx: 24, maxSizePx: 128, coreBoost: 0.85 });
  let map: MapboxMap | null = null;
  let lastPlantsRef: FacilityPoint[] | null = null;

  return {
    id: POWER_PLANT_GLOW_LAYER_ID,
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

      const plants = opts.getPlants();
      if (plants && plants !== lastPlantsRef) {
        scene.setData(plantsToGlow(plants));
        lastPlantsRef = plants;
        console.log(`[PowerPlantGlow] setData: ${plants.length} rows`);
      }
      scene.setOpacity(opts.getOpacity());
      scene.setSizeMul(opts.getSizeMul());
      if (map) scene.setZoom(map.getZoom());

      const moving = scene.render(matrix);
      if (moving) map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
