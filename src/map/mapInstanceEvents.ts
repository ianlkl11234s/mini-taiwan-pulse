import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";

interface Callbacks {
  onStart(): void;
  onPrepared(): void;
  onMove(): void;
  onZoomEnd(): void;
  onClick(event: MapMouseEvent): void;
}

/** Map-instance listeners survive style changes, but never survive map removal. */
export function createMapInstanceEvents() {
  let boundMap: MapboxMap | null = null;
  let callbacks: Callbacks | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prepared = false;
  const move = () => callbacks?.onMove();
  const zoomEnd = () => callbacks?.onZoomEnd();
  const click = (event: MapMouseEvent) => callbacks?.onClick(event);
  const markPrepared = () => {
    if (prepared || !boundMap) return;
    prepared = true;
    clearTimeout(timer);
    boundMap.off("idle", markPrepared);
    callbacks?.onPrepared();
  };

  function dispose() {
    const map = boundMap;
    boundMap = null;
    callbacks = null;
    clearTimeout(timer);
    timer = undefined;
    prepared = false;
    if (!map) return;
    map.off("move", move);
    map.off("zoomend", zoomEnd);
    map.off("click", click);
    map.off("idle", markPrepared);
    map.off("remove", dispose);
  }

  return {
    ready(map: MapboxMap, nextCallbacks: Callbacks) {
      if (boundMap !== map) {
        dispose();
        boundMap = map;
        callbacks = nextCallbacks;
        map.on("move", move);
        map.on("zoomend", zoomEnd);
        map.on("click", click);
        map.on("remove", dispose);
        map.once("idle", markPrepared);
        timer = setTimeout(markPrepared, 4000);
        callbacks.onStart();
      } else {
        callbacks = nextCallbacks;
      }
      // Style rebuilds still refresh the camera/H3 consumers with current values.
      move();
      zoomEnd();
    },
    dispose,
  };
}
