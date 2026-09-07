import { useSyncExternalStore, type CSSProperties } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

export interface CameraInfo {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

const EMPTY_CAMERA: CameraInfo = { lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 };

export function readCameraInfo(map: MapboxMap): CameraInfo {
  const center = map.getCenter();
  return {
    lng: +center.lng.toFixed(4),
    lat: +center.lat.toFixed(4),
    zoom: +map.getZoom().toFixed(1),
    pitch: +map.getPitch().toFixed(0),
    bearing: +map.getBearing().toFixed(0),
  };
}

export function formatCameraInfo(camera: CameraInfo): string {
  return `${camera.lat}, ${camera.lng} z${camera.zoom} pitch ${camera.pitch} bearing ${camera.bearing}`;
}

/** A map-local external store: move events only re-render HUD subscribers. */
export function createCameraHudStore() {
  let map: MapboxMap | null = null;
  let snapshot = EMPTY_CAMERA;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());
  const refresh = () => {
    if (!map) return;
    snapshot = readCameraInfo(map);
    notify();
  };
  const unbind = () => {
    if (!map) return;
    map.off("move", refresh);
    map.off("remove", unbind);
    map = null;
  };

  return {
    bind(nextMap: MapboxMap) {
      if (map === nextMap) {
        refresh();
        return;
      }
      unbind();
      map = nextMap;
      map.on("move", refresh);
      map.on("remove", unbind);
      refresh();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    dispose() {
      unbind();
      listeners.clear();
    },
  };
}

export type CameraHudStore = ReturnType<typeof createCameraHudStore>;

export function CameraHud({ store, style }: { store: CameraHudStore; style: CSSProperties }) {
  const camera = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <div style={style}>{formatCameraInfo(camera)}</div>;
}
