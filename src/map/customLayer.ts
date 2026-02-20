import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { Flight, RenderMode } from "../types";
import { FlightScene } from "../three/FlightScene";

/**
 * 建立 Mapbox CustomLayer，橋接 Three.js 場景
 */
export function createFlightLayer(
  getCurrentTime: () => number,
  getFlights: () => Flight[],
  getRenderMode: () => RenderMode,
): CustomLayerInterface {
  const flightScene = new FlightScene();
  let map: MapboxMap | null = null;

  return {
    id: "flight-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      flightScene.init(gl);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      const flights = getFlights();
      const time = getCurrentTime();
      const mode = getRenderMode();

      flightScene.updateStaticTrails(flights, mode);
      flightScene.update(flights, time);
      flightScene.render(matrix);

      // 請求持續重繪（動畫）
      map?.triggerRepaint();
    },

    onRemove() {
      flightScene.dispose();
    },
  };
}
