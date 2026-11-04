import { useMemo, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * 地圖導航控制（spec §5.43）用的鏡頭狀態：未四捨五入的原始值。
 * 不沿用 CameraHud 的 snapshot（zoom 取到 0.1、bearing 取整數，比例尺會差約 7%）。
 * 與時間無關，只訂閱 map 的 move 事件，不碰 timeStore。
 */
export interface MapCameraState {
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
  minZoom: number;
  maxZoom: number;
}

const EMPTY: MapCameraState = { lat: 0, zoom: 0, bearing: 0, pitch: 0, minZoom: 0, maxZoom: 22 };

function read(map: MapboxMap): MapCameraState {
  return {
    lat: map.getCenter().lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    minZoom: map.getMinZoom(),
    maxZoom: map.getMaxZoom(),
  };
}

function createStore(map: MapboxMap | null) {
  let snapshot = map ? read(map) : EMPTY;
  return {
    subscribe(listener: () => void) {
      if (!map) return () => {};
      const onMove = () => {
        snapshot = read(map);
        listener();
      };
      map.on("move", onMove);
      snapshot = read(map); // React 訂閱後會再比一次 getSnapshot，不必在這裡通知
      return () => { map.off("move", onMove); };
    },
    getSnapshot: () => snapshot,
  };
}

export function useMapCamera(map: MapboxMap | null): MapCameraState {
  const store = useMemo(() => createStore(map), [map]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
