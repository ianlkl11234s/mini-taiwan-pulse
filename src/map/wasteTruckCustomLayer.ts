import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { WasteTrailRow } from "../data/wasteLoader";
import { WasteTruckScene } from "../three/WasteTruckScene";
import { WasteMusicNoteScene } from "../three/WasteMusicNoteScene";
import { subscribeTimeRepaint } from "./customLayer";

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
  /** 整層透明度倍率（光球與音符同步）。 */
  getOpacity?: () => number;
  /** 是否啟用音符特效（預設 true，跟 wasteTruck 同 toggle） */
  getMusicNoteEnabled?: () => boolean;
  /** 音符大小倍率（base 38px） */
  getMusicNoteSize?: () => number;
  /** 音符起始高度（公尺） */
  getMusicNoteZOffset?: () => number;
  onSceneReady?: (truckScene: WasteTruckScene, noteScene: WasteMusicNoteScene) => void;
  maxInstances?: number;
}

export function createWasteTruckLayer(opts: WasteTruckLayerOptions): CustomLayerInterface {
  const truckScene = new WasteTruckScene(opts.maxInstances ?? 500);
  const noteScene = new WasteMusicNoteScene();
  let map: MapboxMap | null = null;
  let lastDarkTheme = true;
  let unsubTime: (() => void) | null = null;

  return {
    id: opts.id ?? "waste-truck-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      truckScene.init(gl);
      noteScene.init(gl);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
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
      const opacity = opts.getOpacity?.() ?? 1;
      truckScene.setOpacity(opacity);
      truckScene.update(opts.getTrails(), opts.getCurrentTime?.());
      truckScene.render(matrix);

      // 音符：跟 wasteTruck 同 toggle（getMusicNoteEnabled 預設 true）
      const noteEnabled = opts.getMusicNoteEnabled?.() ?? true;
      if (noteEnabled) {
        noteScene.setOpacity(opacity);
        noteScene.setSizeMultiplier(opts.getMusicNoteSize?.() ?? 1);
        noteScene.setBaseHeightMeters(opts.getMusicNoteZOffset?.() ?? 70);
        const nowMs = Date.now();
        const collecting = truckScene.getCollectingPositions();
        noteScene.spawnFromTrucks(collecting, nowMs);
        noteScene.render(matrix, nowMs);
        // 音符是裝飾動畫、走實際時鐘：圖層可見且有收運中車輛（或音符尚未飄完）時持續重繪，
        // 時間軸暫停也不停；圖層關閉 → 上方提早 return，不再排幀。
        if (collecting.length > 0 || noteScene.hasActiveNotes(nowMs)) map?.triggerRepaint();
      }
      // 車輛位置的時間變動由 subscribeTimeRepaint 驅動（暫停且無音符 → 0 次重繪）
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      truckScene.dispose();
      noteScene.dispose();
    },
  };
}
