import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { GlowPointsScene, type GlowPoint } from "../three/GlowPointsScene";
import {
  SUBSTATION_CLASS_COLORS,
  type OsmSubstation,
} from "../data/energyLoader";

export interface SubstationEhvGlowLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getSizeMul: () => number;
  getSubstations: () => OsmSubstation[] | null;
}

export const SUBSTATION_EHV_GLOW_LAYER_ID = "substation-ehv-glow-3d";

/**
 * 篩選：class = EHV_SWITCH / EHV（超高壓 38 座）
 * voltage 字串 parse 出 kV 數 → sizeNorm（161=0.5, 345=1.0）
 */
function toGlow(rows: OsmSubstation[]): GlowPoint[] {
  const ehv = rows.filter(
    (r) => r.class === "EHV_SWITCH" || r.class === "EHV",
  );
  return ehv.map((r) => {
    const kv = parseFloat(r.voltage ?? "") || 161;
    const norm = Math.min(1, Math.max(0.3, (kv - 100) / 250)); // 100kV=0.3, 350kV=1.0
    return {
      lon: r.lon,
      lat: r.lat,
      colorHex: SUBSTATION_CLASS_COLORS[r.class ?? "EHV"] ?? "#ef4444",
      sizeNorm: norm,
    };
  });
}

export function createSubstationEhvGlowLayer(
  opts: SubstationEhvGlowLayerOptions,
): CustomLayerInterface {
  // 變電所比發電廠密集，光暈略小 + 中心更爆白 → 有小尖峰的感覺
  const scene = new GlowPointsScene({
    minSizePx: 20,
    maxSizePx: 96,
    coreBoost: 0.95,
  });
  let map: MapboxMap | null = null;
  let lastRef: OsmSubstation[] | null = null;

  return {
    id: SUBSTATION_EHV_GLOW_LAYER_ID,
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

      const rows = opts.getSubstations();
      if (rows && rows !== lastRef) {
        const glow = toGlow(rows);
        scene.setData(glow);
        lastRef = rows;
        console.log(`[SubstationEhvGlow] setData: ${rows.length} rows → ${glow.length} EHV`);
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
