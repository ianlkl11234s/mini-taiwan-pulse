import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { TemperatureWaveScene } from "../three/TemperatureWaveScene";
import type { TemperatureGridData } from "../data/temperatureLoader";

export interface TemperatureWaveLayerOptions {
  getData: () => TemperatureGridData | null;
  getIsVisible: () => boolean;
  getHeightScale: () => number;
  getZOffset: () => number;
  getExtruded: () => boolean;
  getOpacity: () => number;
  getCurrentTime: () => number; // unix timestamp (秒)
  getWireframe: () => boolean;
  getIsDarkTheme: () => boolean;
}

export function createTemperatureWaveLayer(
  opts: TemperatureWaveLayerOptions,
): CustomLayerInterface {
  const scene = new TemperatureWaveScene();
  let map: MapboxMap | null = null;
  let initialized = false;

  return {
    id: "temperature-wave-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;

      // 延遲初始化：等資料準備好
      if (!initialized) {
        const data = opts.getData();
        if (data) {
          scene.setData(data);
          initialized = true;
        } else {
          return;
        }
      }

      scene.setHeightScale(opts.getHeightScale());
      scene.setZOffset(opts.getZOffset());
      scene.setExtruded(opts.getExtruded());
      scene.setOpacity(opts.getOpacity());
      scene.setCurrentTime(opts.getCurrentTime());
      scene.setWireframe(opts.getWireframe());
      scene.render(matrix);

      // timeline 播放時需持續重繪
      map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
