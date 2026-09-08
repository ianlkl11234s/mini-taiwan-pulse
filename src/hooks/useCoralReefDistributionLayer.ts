import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { CORAL_REEF_ATTRIBUTION, CORAL_REEF_COLOR, CORAL_REEF_SOURCE_URL } from "../data/coralReefTypes";
import { loadingRegistry } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { useCoralPrivateAccess, coralAccessToken } from "./useCoralPrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";

export const CORAL_SOURCE_ID = "coral-reef-distribution";
const FILL = "coral-reef-distribution-fill";
const LINE = "coral-reef-distribution-line";
const TASK = "coral-reef-distribution:tiles";
export type CoralLoadState = "loading" | "ready" | "error";

/** Source-scoped listeners and resource ownership; dispose also cancels unfinished loading. */
export function mountCoralReefDistribution(
  map: MapboxMap, opacity: number, onState: (state: CoralLoadState) => void,
  getToken: () => Promise<string> = async () => { throw new Error("Coral access denied"); },
): () => void {
  let disposed = false;
  let failed = false;
  let loading = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    clearTimeout(timer);
    if (loading) loadingRegistry.end(TASK);
    loading = false;
  };
  const fail = () => {
    if (disposed) return;
    failed = true;
    finish();
    // Never leave successfully fetched fragments looking like complete coverage.
    if (map.getStyle()) {
      for (const id of [LINE, FILL]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    }
    onState("error");
  };
  const begin = () => {
    if (disposed || failed || loading) return;
    loading = true;
    loadingRegistry.start(TASK, "珊瑚礁歷史分布（私人研究）");
    onState("loading");
    timer = setTimeout(fail, 30000);
  };
  const onLoading = (event: { sourceId?: string }) => {
    if (event.sourceId === CORAL_SOURCE_ID) begin();
  };
  const onData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (!disposed && !failed && event.sourceId === CORAL_SOURCE_ID && event.isSourceLoaded) {
      finish();
      onState("ready");
    }
  };
  const onError = (event: unknown) => {
    if ((event as { sourceId?: string }).sourceId === CORAL_SOURCE_ID) fail();
  };
  map.on("sourcedataloading", onLoading);
  map.on("sourcedata", onData);
  map.on("error", onError);
  begin();
  try {
    registerPrivateCoralSourceOnce();
    map.addSource(CORAL_SOURCE_ID, {
      type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
      getToken,
      url: new URL(CORAL_REEF_SOURCE_URL, window.location.href).href,
      minzoom: 0, maxzoom: 12,
    } as unknown as Parameters<MapboxMap["addSource"]>[1]);
    // mapbox-pmtiles bypasses TileJSON's attribution assignment.
    const source = map.getSource(CORAL_SOURCE_ID);
    if (source) (source as unknown as { attribution: string }).attribution = CORAL_REEF_ATTRIBUTION;
    map.addLayer({ id: FILL, type: "fill", source: CORAL_SOURCE_ID,
      "source-layer": "coral_reef_distribution",
      paint: { "fill-color": CORAL_REEF_COLOR, "fill-opacity": opacity } });
    map.addLayer({ id: LINE, type: "line", source: CORAL_SOURCE_ID,
      "source-layer": "coral_reef_distribution",
      paint: { "line-color": CORAL_REEF_COLOR, "line-opacity": opacity,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 10, 1] } });
  } catch {
    fail();
  }
  return () => {
    disposed = true;
    finish();
    map.off("sourcedataloading", onLoading);
    map.off("sourcedata", onData);
    map.off("error", onError);
    // MapView can destroy the map before LayerHosts unmount.
    if (!map.getStyle()) return;
    if (map.getLayer(LINE)) map.removeLayer(LINE);
    if (map.getLayer(FILL)) map.removeLayer(FILL);
    if (map.getSource(CORAL_SOURCE_ID)) map.removeSource(CORAL_SOURCE_ID);
  };
}

export function useCoralReefDistributionLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number,
) {
  const [state, setState] = useState<CoralLoadState>("loading");
  const access = useCoralPrivateAccess();
  const enabled = access.allowed && visible;
  const mapTick = useMapReadyTick(mapRef, enabled);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;
    let dispose: (() => void) | undefined;
    const mount = () => {
      dispose?.();
      dispose = mountCoralReefDistribution(map, opacityRef.current, setState, () => coralAccessToken(access.userId!));
    };
    // MapReadyTick only resolves after the initial map load; style.load handles later switches.
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); dispose?.(); };
  }, [mapRef, enabled, mapTick, access.userId]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;
    if (map.getLayer(FILL)) map.setPaintProperty(FILL, "fill-opacity", opacity);
    if (map.getLayer(LINE)) map.setPaintProperty(LINE, "line-opacity", opacity);
  }, [mapRef, enabled, opacity, mapTick]);
  return state;
}
