import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { HistoricalFlightCollection, HistoricalFlightCountry, HistoricalFlightParams } from "../data/historicalFlightTrailsTypes";
import { HistoricalFlightTrailsScene } from "../three/HistoricalFlightTrailsScene";

export interface HistoricalFlightTrailsCustomLayer extends CustomLayerInterface {
  setData(data: HistoricalFlightCollection): void;
  setParams(params: HistoricalFlightParams): void;
  pick(x: number, y: number, width: number, height: number): GeoJSON.Feature<GeoJSON.MultiLineString> | null;
}

export function historicalFlightTrails3dLayerId(country: HistoricalFlightCountry) {
  return `historical-flight-trails-${country.toLowerCase()}-3d`;
}

/** Static custom layer: it deliberately owns no repaint loop. */
export function createHistoricalFlightTrailsLayer(
  country: HistoricalFlightCountry,
  data: HistoricalFlightCollection,
  params: HistoricalFlightParams,
): HistoricalFlightTrailsCustomLayer {
  const scene = new HistoricalFlightTrailsScene();
  let map: MapboxMap | null = null;
  return {
    id: historicalFlightTrails3dLayerId(country),
    type: "custom" as const,
    renderingMode: "3d" as const,
    onAdd(mapInstance, gl) {
      map = mapInstance;
      scene.init(gl);
      scene.setParams(params);
      scene.setData(data);
    },
    render(
      _gl,
      matrix,
      projection?: { name?: string },
      projectionToMercatorMatrix?: number[],
      projectionToMercatorTransition?: number,
    ) {
      // A style/update call requests the single repaint needed for this static layer.
      if (map) {
        const camera = map.getFreeCameraOptions().position;
        const globe = projection?.name === "globe" ? projectionToMercatorMatrix : null;
        scene.setGlobe(globe, projectionToMercatorTransition, camera ? { x: camera.x, y: camera.y, z: camera.z } : null);
        scene.render(matrix);
      }
    },
    onRemove() {
      scene.dispose();
      map = null;
    },
    setData(next) { scene.setData(next); map?.triggerRepaint(); },
    setParams(next) { scene.setParams(next); map?.triggerRepaint(); },
    pick(x, y, width, height) { return scene.pick(x, y, width, height); },
  };
}
