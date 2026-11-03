import { useSyncExternalStore, type CSSProperties } from "react";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { localeStore, useLocale } from "../state/localeStore";
import { formatLatLng } from "../map/coordinates";

export interface CameraInfo {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

const EMPTY_CAMERA: CameraInfo = { lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 };

/** 游標所在的經緯度（滑鼠不在地圖上時為 null） */
export interface CursorInfo {
  lng: number;
  lat: number;
}

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
  const { t } = localeStore.getSnapshot();
  return `${camera.lat}, ${camera.lng} · z${camera.zoom} · ${t("camera.pitch")} ${camera.pitch}° · ${t("camera.bearing")} ${camera.bearing}°`;
}

/** A map-local external store: move events only re-render HUD subscribers. */
export function createCameraHudStore() {
  let map: MapboxMap | null = null;
  let snapshot = EMPTY_CAMERA;
  const listeners = new Set<() => void>();
  // 游標座標（§5.18 第二行）：另一組訂閱者，滑鼠移動只重繪顯示游標的 HUD
  let cursor: CursorInfo | null = null;
  const cursorListeners = new Set<() => void>();
  let pendingCursor: CursorInfo | null = null;
  let cursorFrame = 0;

  const notify = () => listeners.forEach((listener) => listener());
  const refresh = () => {
    if (!map) return;
    snapshot = readCameraInfo(map);
    notify();
  };
  const flushCursor = () => {
    cursorFrame = 0;
    cursor = pendingCursor;
    cursorListeners.forEach((listener) => listener());
  };
  const scheduleCursor = (next: CursorInfo | null) => {
    pendingCursor = next;
    if (next === null) {
      // 離開地圖立刻收起，不等下一幀
      if (cursorFrame) cancelAnimationFrame(cursorFrame);
      flushCursor();
      return;
    }
    if (!cursorFrame) cursorFrame = requestAnimationFrame(flushCursor);
  };
  const onMouseMove = (event: MapMouseEvent) => scheduleCursor({ lng: event.lngLat.lng, lat: event.lngLat.lat });
  const onMouseOut = () => scheduleCursor(null);
  const unbind = () => {
    if (!map) return;
    map.off("move", refresh);
    map.off("mousemove", onMouseMove);
    map.off("mouseout", onMouseOut);
    map.off("remove", unbind);
    map = null;
    scheduleCursor(null);
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
      map.on("mousemove", onMouseMove);
      map.on("mouseout", onMouseOut);
      map.on("remove", unbind);
      refresh();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    subscribeCursor(listener: () => void) {
      cursorListeners.add(listener);
      return () => cursorListeners.delete(listener);
    },
    getCursor: () => cursor,
    dispose() {
      unbind();
      listeners.clear();
      cursorListeners.clear();
    },
  };
}

export type CameraHudStore = ReturnType<typeof createCameraHudStore>;

const noopSubscribe = () => () => {};
const nullCursor = () => null;

/**
 * 座標 HUD（spec §5.18）。`cursor` 有給時，滑鼠在地圖上會多一行「游標 緯度, 經度」（accent 色）；
 * 手機沒有游標，不傳。
 */
export function CameraHud({
  store,
  style,
  cursor: cursorStyle,
}: {
  store: CameraHudStore;
  style: CSSProperties;
  cursor?: CSSProperties;
}) {
  const camera = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const cursor = useSyncExternalStore(
    cursorStyle ? store.subscribeCursor : noopSubscribe,
    cursorStyle ? store.getCursor : nullCursor,
    nullCursor,
  );
  const { t } = useLocale(); // 切換語系時重繪
  return (
    <div style={style}>
      {formatCameraInfo(camera)}
      {cursorStyle && cursor && (
        <div style={cursorStyle} data-testid="camera-hud-cursor">
          {t("camera.cursor")} {formatLatLng(cursor.lat, cursor.lng)}
        </div>
      )}
    </div>
  );
}
