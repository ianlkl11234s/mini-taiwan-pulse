import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { PowerGenerationBeamScene } from "../three/PowerGenerationBeamScene";
import type { PowerPlantRow } from "../data/energyLoader";

export interface PowerGenerationBeamLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getPlants: () => PowerPlantRow[] | null;
}

export const POWER_GENERATION_BEAM_LAYER_ID = "power-generation-beam-3d";

export function createPowerGenerationBeamLayer(
  opts: PowerGenerationBeamLayerOptions,
): CustomLayerInterface {
  const scene = new PowerGenerationBeamScene();
  let map: MapboxMap | null = null;
  let lastPlantsRef: PowerPlantRow[] | null = null;

  return {
    id: POWER_GENERATION_BEAM_LAYER_ID,
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
        scene.setData(plants);
        lastPlantsRef = plants;
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
