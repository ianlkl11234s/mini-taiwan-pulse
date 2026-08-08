/**
 * MapLibre × Three.js CustomLayer 包裝（EM-16）
 *
 * 對照組 = 主站 `src/map/customLayer.ts`（mapbox-gl 版）。實證來源 =
 * `src/spike/threeMaplibreSpike.ts`（PASS，與 `map.project()` 誤差 ≤0.01px）。
 *
 * ── mapbox → maplibre 的四個硬差異（拿錯不會報錯，只會靜默壞掉）──
 * 1. `render` 第二參數：mapbox 是 `number[16]`，maplibre 是物件 `CustomRenderMethodInput`。
 * 2. 要用的矩陣是 **`options.defaultProjectionData.mainMatrix`**
 *    —— 那把才是「mercator 0..1 → clip」的矩陣，等同 mapbox 傳進來的 matrix。
 *    ❌ `options.modelViewProjectionMatrix` 是另一個座標系（world pixel），
 *    餵給 Three 會**靜默**把整個場景投到畫面外約 -54,000px：畫面全空、console 零錯誤。
 * 3. `onAdd` 的 gl 實際是 WebGL2RenderingContext（型別宣告是聯集）。
 *    `gl.canvas === map.getCanvas()` 兩邊都成立 → `WebGLRenderer` 掛法不變。
 * 4. `renderingMode` 在 maplibre 是 optional 且預設 `"2d"` —— 必須顯式寫 `"3d"`。
 *
 * ── Scene 契約（介面泛化，之後 RailScene 直接插）──
 * 吃任何符合既有 `src/three/*Scene.ts` 形狀的物件：`init(gl)` / `update(t)` /
 * `render(matrix)` / `dispose()`。以下三件事**照主站慣例住在 Scene.render 裡**
 * （`customLayer.ts` 本身也只是委派）：
 *   - `new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl })` + `autoClear = false`（在 `init`）
 *   - `renderer.resetState()` 前後夾住 `renderer.render(...)`
 *   - 完整 blend state 存還：`isEnabled(BLEND)` / `BLEND_SRC_RGB` / `BLEND_DST_RGB` /
 *     `BLEND_SRC_ALPHA` / `BLEND_DST_ALPHA` → 畫完 `enable/disable(BLEND)` + `blendFuncSeparate` 還原
 * `FlightScene` / `RailScene` / `ShipScene` 皆已滿足；新寫的 Scene 必須照做，
 * 否則會污染 MapLibre 自己的 GL state（症狀：底圖標籤忽然變透明或消失）。
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MaplibreMap } from "maplibre-gl";

/** 既有 Scene 形狀的最小公因數。 */
export interface ReplayScene {
  init(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /** @param timeSec 回放時刻（unix 秒） */
  update(timeSec: number): void;
  render(matrix: ArrayLike<number>): void;
  dispose(): void;
}

export interface ThreeReplayLayerOptions {
  /** MapLibre layer id（同一頁不可重複） */
  id: string;
  scene: ReplayScene;
  /** 每幀取回放時刻（unix 秒）—— 一律走 replayClock，不放 React state */
  getTime: () => number;
}

export function createThreeReplayLayer(opts: ThreeReplayLayerOptions): CustomLayerInterface {
  let map: MaplibreMap | null = null;

  return {
    id: opts.id,
    type: "custom" as const,
    // ⚠️ maplibre 預設 "2d"，不寫的話深度測試與繪製時機都不對
    renderingMode: "3d" as const,

    onAdd(mapInstance: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
      map = mapInstance;
      // Scene.init 內部做 `new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl })`
      // + `autoClear = false`（借用 map 既有 canvas 與 GL context，不另開一張）
      opts.scene.init(gl);
    },

    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
      // 見檔頭差異 2：只有 mainMatrix 是對的
      const matrix = options.defaultProjectionData.mainMatrix as ArrayLike<number>;
      opts.scene.update(opts.getTime());
      opts.scene.render(matrix);
      // 動畫靠自我請求重繪（同主站）；回放暫停時仍重繪，但畫面是靜止的同一幀
      map?.triggerRepaint();
    },

    onRemove() {
      opts.scene.dispose();
      map = null;
    },
  };
}
