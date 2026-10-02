import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { QuakeRippleScene, type QuakeRippleItem } from "../three/QuakeRippleScene";
import { toMercator } from "../utils/coordinates";

export const EARTHQUAKE_RIPPLE_LAYER_ID = "earthquakes-global-ripple-3d";

export interface EarthquakeRippleSnapshot {
  /** items 換了就 +1；scene 只在 version 變時重建 buffer */
  version: number;
  items: QuakeRippleItem[];
}

export interface EarthquakeRippleLayerOptions {
  getIsVisible: () => boolean;
  /** hook 的 RAF 正在驅動動畫（時間軸在走且窗口內有新地震）；false → 不畫 */
  getIsAnimating: () => boolean;
  getOpacity: () => number;
  getRipples: () => EarthquakeRippleSnapshot;
}

/**
 * 全球地震漣漪 custom layer。重繪由 useEarthquakesGlobalLayer 的節流 RAF 以
 * `map.triggerRepaint()` 驅動（約 20fps，與既有漣漪節流一致）；這裡**不**自己 triggerRepaint，
 * 所以 hook 停掉 RAF（圖層關閉／無新地震／時間軸暫停）時重繪也一起停。
 */
export function createEarthquakeRippleLayer(opts: EarthquakeRippleLayerOptions): CustomLayerInterface {
  const scene = new QuakeRippleScene();
  let map: MapboxMap | null = null;
  let version = -1;

  return {
    id: EARTHQUAKE_RIPPLE_LAYER_ID,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
    },

    render(
      _gl: WebGLRenderingContext,
      matrix: number[],
      projection?: { name?: string },
      globeToMerc?: number[],
      transition?: number,
    ) {
      if (!map || !opts.getIsVisible() || !opts.getIsAnimating()) return;
      const snap = opts.getRipples();
      if (snap.version !== version) {
        scene.setRipples(snap.items);
        version = snap.version;
      }
      if (scene.count === 0) return;
      scene.setOpacity(opts.getOpacity());

      const center = map.getCenter();
      const cx = (center.lng + 180) / 360;
      const cy = toMercator(center.lat, 0, 0).y;
      // column-major：clip.w = m[3]*x + m[7]*y + m[11]*0 + m[15]
      const refW = matrix[3]! * cx + matrix[7]! * cy + matrix[15]!;
      const canvas = map.getCanvas();
      scene.render(matrix, {
        centerMercX: cx,
        refW,
        viewportW: canvas.clientWidth,
        viewportH: canvas.clientHeight,
        nowMs: performance.now(),
        globe: projection?.name === "globe" && globeToMerc
          ? { globeToMerc, transition: transition ?? 0 }
          : undefined,
      });
    },

    onRemove() {
      scene.dispose();
      map = null;
    },
  };
}
