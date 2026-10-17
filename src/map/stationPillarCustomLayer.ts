import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import * as THREE from "three";
import { StationPillarScene } from "../three/StationPillarScene";
import type { StationPillarData } from "../three/StationPillarScene";

export interface StationPillarGroupOptions {
  pillarColor: { dark: number; light: number };
  getPositions: () => StationPillarData[];
  getPillarVisible: () => boolean;
  getPillarHeight: () => number;
  /** 同一個 layer 的 Mapbox 與 Three.js 光柱共用的透明度倍率。未提供時維持 1。 */
  getOpacity?: () => number;
  getIsVisible: () => boolean;
}

export interface CombinedStationPillarLayerOptions {
  getIsDarkTheme: () => boolean;
  groups: Record<string, StationPillarGroupOptions>;
}

/**
 * 合併的光柱圖層 — 多個 StationPillarScene 共享 1 個 WebGLRenderer
 * 避免多個 renderer 共享同一 GL context 造成衝突
 */
export function createCombinedStationPillarLayer(
  opts: CombinedStationPillarLayerOptions,
): CustomLayerInterface {
  const entries = Object.entries(opts.groups).map(([key, group]) => ({
    key,
    scene: new StationPillarScene(group.pillarColor.dark, group.pillarColor.light),
    initialized: false,
    group,
  }));

  let renderer: THREE.WebGLRenderer | null = null;

  return {
    id: "station-pillar-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(_map: MapboxMap, gl: WebGLRenderingContext) {
      renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      renderer.autoClear = false;

      for (const entry of entries) {
        entry.scene.init(renderer);
      }
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {

      for (const entry of entries) {
        // 延遲初始化：等 positions 準備好
        if (!entry.initialized) {
          const positions = entry.group.getPositions();
          if (positions.length > 0) {
            entry.scene.setPositions(positions);
            entry.initialized = true;
          }
        }

        entry.scene.setPillarVisible(entry.group.getPillarVisible());
        entry.scene.setPillarHeight(entry.group.getPillarHeight());
        entry.scene.setOpacity(entry.group.getOpacity?.() ?? 1);
        entry.scene.setTheme(opts.getIsDarkTheme());

        if (entry.group.getIsVisible()) {
          entry.scene.render(matrix);
        }
      }

      // 靜態光柱：不自行 triggerRepaint；資料／可見性／參數變動由 useThreeJsLayers wake-up 通道觸發
    },

    onRemove() {
      for (const entry of entries) {
        entry.scene.dispose();
      }
      renderer?.dispose();
      renderer = null;
    },
  };
}
