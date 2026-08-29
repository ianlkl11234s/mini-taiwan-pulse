import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { WasteScheduleRoute } from "../data/wasteScheduleLoader";
import { WasteScheduleScene } from "../three/WasteScheduleScene";
import { WasteMusicNoteScene } from "../three/WasteMusicNoteScene";

/**
 * 垃圾車表定 Custom Layer (Phase 3 prototype)
 *
 * 跟 wasteTruckCustomLayer (GPS) 並行存在、互不影響。
 * 包兩個 sub-scene（仿 GPS layer）：
 *   1. WasteScheduleScene  — InstancedMesh 光球（琥珀色 #fbbf24）
 *   2. WasteMusicNoteScene — GPU billboard 音符（schedule 全部執勤中車都會飄）
 *
 * 音符獨立 toggle（getMusicNoteEnabled）— 可單獨關，跟主 schedule toggle 分離。
 */
export interface WasteScheduleLayerOptions {
  id?: string;
  getRoutes: () => WasteScheduleRoute[];
  getCurrentTime: () => number;
  getIsDarkTheme: () => boolean;
  getOrbScale: () => number;
  getIsVisible: () => boolean;
  getAltOffset: () => number;
  /** 整層透明度倍率（光球與音符同步）。 */
  getOpacity?: () => number;
  /** 音符獨立 toggle（off 時車仍顯示但不噴音符） */
  getMusicNoteEnabled?: () => boolean;
  /** 音符大小倍率（base 38px） */
  getMusicNoteSize?: () => number;
  /** 音符起始高度（公尺） */
  getMusicNoteZOffset?: () => number;
  onSceneReady?: (scene: WasteScheduleScene, noteScene: WasteMusicNoteScene) => void;
  maxInstances?: number;
}

export function createWasteScheduleLayer(opts: WasteScheduleLayerOptions): CustomLayerInterface {
  const scene = new WasteScheduleScene(opts.maxInstances ?? 20000);
  const noteScene = new WasteMusicNoteScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;

  return {
    id: opts.id ?? "waste-schedule-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
      noteScene.init(gl);
      opts.onSceneReady?.(scene, noteScene);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      const isDark = opts.getIsDarkTheme();
      if (isDark !== lastDarkTheme) {
        lastDarkTheme = isDark;
        scene.setTheme(isDark);
      }

      scene.setOrbScale(opts.getOrbScale());
      scene.setAltitudeOffset(opts.getAltOffset());
      const opacity = opts.getOpacity?.() ?? 1;
      scene.setOpacity(opacity);
      scene.update(opts.getRoutes(), opts.getCurrentTime());
      scene.render(matrix);

      // 音符（獨立 toggle）
      const noteEnabled = opts.getMusicNoteEnabled?.() ?? true;
      if (noteEnabled) {
        noteScene.setOpacity(opacity);
        noteScene.setSizeMultiplier(opts.getMusicNoteSize?.() ?? 1);
        noteScene.setBaseHeightMeters(opts.getMusicNoteZOffset?.() ?? 70);
        const nowMs = Date.now();
        noteScene.spawnFromTrucks(scene.getActivePositions(), nowMs);
        noteScene.render(matrix, nowMs);
      }

      map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
      noteScene.dispose();
    },
  };
}
