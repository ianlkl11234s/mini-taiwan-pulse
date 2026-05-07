import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { WasteTrailRow } from "../data/wasteLoader";
import { WasteTruckScene } from "../three/WasteTruckScene";
import { WasteMusicNoteScene } from "../three/WasteMusicNoteScene";

/**
 * 垃圾車 Custom Layer
 *
 * 同一個 layer 包兩個 sub-scene（共用同一個 toggle 「wasteTruck」）：
 *   1. WasteTruckScene  — InstancedMesh 光球
 *   2. WasteMusicNoteScene — GPU billboard 音符（只對 collecting truck 飄出）
 *
 * Render 順序：truck 先、note 後（note 疊在光球上方）
 */
export interface WasteTruckLayerOptions {
  id?: string;
  getTrails: () => WasteTrailRow[];
  getCurrentTime?: () => number;
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  getAltOffset: () => number;
  /** 是否啟用音符特效（預設 true，跟 wasteTruck 同 toggle） */
  getMusicNoteEnabled?: () => boolean;
  /** 音符大小倍率（base 38px，0.5~3） */
  getMusicNoteSize?: () => number;
  onSceneReady?: (truckScene: WasteTruckScene, noteScene: WasteMusicNoteScene) => void;
  maxInstances?: number;
}

export function createWasteTruckLayer(opts: WasteTruckLayerOptions): CustomLayerInterface {
  const truckScene = new WasteTruckScene(opts.maxInstances ?? 500);
  const noteScene = new WasteMusicNoteScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: opts.id ?? "waste-truck-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      truckScene.init(gl);
      noteScene.init(gl);
      opts.onSceneReady?.(truckScene, noteScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        truckScene.setTheme(isDark);
      }

      truckScene.setOrbScale(opts.getOrbScale());
      truckScene.setAltitudeOffset(opts.getAltOffset());
      truckScene.update(opts.getTrails(), opts.getCurrentTime?.());
      truckScene.render(matrix);

      // 音符：跟 wasteTruck 同 toggle（getMusicNoteEnabled 預設 true）
      const noteEnabled = opts.getMusicNoteEnabled?.() ?? true;
      if (noteEnabled) {
        noteScene.setSizeMultiplier(opts.getMusicNoteSize?.() ?? 1);
        const nowMs = Date.now();
        noteScene.spawnFromTrucks(truckScene.getCollectingPositions(), nowMs);
        noteScene.render(matrix, nowMs);
      }

      map?.triggerRepaint();
    },

    onRemove() {
      truckScene.dispose();
      noteScene.dispose();
    },
  };
}
