import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { RealEstatePointsScene } from "../three/RealEstatePointsScene";
import { rePointsStore } from "../state/realEstatePointsStore";

/**
 * 房地產交易「點」CustomLayer — 取代 3 個 PMTiles circle 圖層。
 * fade 全在 GPU 算（見 RealEstatePointsScene），每幀只更新 uniforms。
 *
 * 狀態走 module-level rePointsStore（時間欄位由 useRealEstateTimeline 寫、控制欄位由 App 寫）。
 * 重繪節奏由 useRealEstateTimeline 的 RAF（播放中）或 useRealEstatePointsLayer 的 effect（暫停/切換）triggerRepaint 帶動，
 * 本 layer 不自轉 RAF（避免雙重 render loop）。
 */

export const RE_POINTS_LAYER_ID = "re-points-three";
const BUFFER_URL = "./coverage/real_estate_points_buffer.bin";

// module 級快取：lazy mount / 切 basemap 重掛時免重抓 7MB
let cachedBuffer: Float32Array | null = null;
let bufferPromise: Promise<Float32Array> | null = null;
function loadBuffer(): Promise<Float32Array> {
  if (cachedBuffer) return Promise.resolve(cachedBuffer);
  if (!bufferPromise) {
    bufferPromise = fetch(BUFFER_URL)
      .then((r) => r.arrayBuffer())
      .then((b) => (cachedBuffer = new Float32Array(b)));
  }
  return bufferPromise;
}

/** 對齊原 circle-radius interpolate（zoom 6→1.5 / 9→2.5 / 14→5），回傳 CSS 半徑 px */
function radiusForZoom(z: number): number {
  if (z <= 6) return 1.5;
  if (z < 9) return 1.5 + (2.5 - 1.5) * ((z - 6) / 3);
  if (z < 14) return 2.5 + (5 - 2.5) * ((z - 9) / 5);
  return 5;
}

/**
 * 目前掛載中的 Scene（W2 pick 用）。
 *
 * 本層不像 Three.js scene 族那樣有 `xxxSceneRef` 一路傳到 App —— Scene 是在
 * `createRealEstatePointsLayer()` 內部 new 的。要讓 `useMapInteraction` 點得到，
 * 最小改動是在 onAdd/onRemove 維護一個 module 級指標（同一時間只會有一個 re-points-three）。
 */
let activeScene: RealEstatePointsScene | null = null;

/** 供 useMapInteraction 的 click 分支取用；未掛載時回 null */
export function getRealEstatePointsScene(): RealEstatePointsScene | null {
  return activeScene;
}

export function createRealEstatePointsLayer(): CustomLayerInterface {
  const scene = new RealEstatePointsScene();
  let map: MapboxMap | null = null;
  let loaded = false;

  const loadData = async () => {
    try {
      const buf = await loadBuffer();
      scene.setBuffer(buf);
      loaded = true;
      console.log("[realEstatePoints] buffer 載入 ✓", buf.length / 5, "點");
      map?.triggerRepaint();
    } catch (e) {
      console.warn("[realEstatePoints] buffer 載入失敗：", e);
    }
  };

  return {
    id: RE_POINTS_LAYER_ID,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(mapInstance, gl) {
      map = mapInstance;
      activeScene = scene;
      scene.init(gl);
      loadData();
    },

    render(_gl, matrix) {
      const anyShown = rePointsStore.show[0] || rePointsStore.show[1] || rePointsStore.show[2];
      if (!loaded || !anyShown) return;
      const dpr = window.devicePixelRatio || 1;
      const pointSize = 2 * radiusForZoom(map?.getZoom() ?? 7) * dpr;
      scene.applyState(rePointsStore, pointSize);
      scene.render(matrix);
    },

    onRemove() {
      if (activeScene === scene) activeScene = null;
      scene.dispose();
    },
  };
}
