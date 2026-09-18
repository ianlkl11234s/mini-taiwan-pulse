import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { allenCoralColor, allenCoralFilter, allenCoralSource, ALLEN_CORAL_ATTRIBUTION, type AllenCoralAtlasRegion, type AllenCoralAtlasView } from "../data/allenCoralAtlasTypes";
import { isExplicitAccessDenied } from "../lib/accessDenied";
import { loadingRegistry } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { useAllenCoralPrivateAccess, allenCoralAccessToken } from "./useAllenCoralPrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";

type LoadState = "loading" | "ready" | "error";
/** Own one thematic source at a time. A failed range removes every owned map resource. */
export function mountAllenCoralAtlas(
  map: MapboxMap, opacity: number, view: AllenCoralAtlasView, region: AllenCoralAtlasRegion,
  onState: (state: LoadState) => void, getToken: () => Promise<string>,
): () => void {
  window.dispatchEvent?.(new Event("allen-coral-selection-clear"));
  const source = allenCoralSource(view);
  const fill = `${source.sourceId}-fill`;
  const task = `${source.sourceId}:tiles`;
  let disposed = false;
  let failed = false;
  let loading = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => { clearTimeout(timer); if (loading) loadingRegistry.end(task); loading = false; };
  const remove = () => {
    if (!map.getStyle()) return;
    if (map.getLayer(fill)) map.removeLayer(fill);
    if (map.getSource(source.sourceId)) map.removeSource(source.sourceId);
  };
  const failAccessDenied = () => {
    if (disposed || failed) return;
    failed = true;
    finish();
    remove();
    onState("error");
    window.dispatchEvent?.(new Event("allen-coral-access-denied"));
  };
  // Mapbox emits source errors for transient network failures and malformed tile
  // responses as well as authorization failures. Keep the mounted source in place
  // so its own retry path (or a later source-data event) can recover.
  const reportError = () => {
    if (disposed || failed) return;
    finish();
    onState("error");
  };
  const handleError = (error: unknown) => {
    if (isExplicitAccessDenied(error)) failAccessDenied();
    else reportError();
  };
  const begin = () => {
    if (disposed || failed || loading) return;
    loading = true;
    loadingRegistry.start(task, "Allen Coral Atlas（私人研究）");
    onState("loading");
    timer = setTimeout(reportError, 30000);
  };
  const onLoading = (event: { sourceId?: string }) => { if (event.sourceId === source.sourceId) begin(); };
  const onData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (disposed || failed || event.sourceId !== source.sourceId) return;
    if (event.isSourceLoaded) { finish(); onState("ready"); }
    else if (loading) {
      // Large regional views may need several authenticated ranges; only stalled
      // loading times out. Successfully arriving tiles do not imply completion.
      clearTimeout(timer);
      timer = setTimeout(reportError, 30000);
    }
  };
  const onError = (event: { sourceId?: string; error?: unknown }) => {
    if (event.sourceId === source.sourceId) handleError(event.error ?? event);
  };
  map.on("sourcedataloading", onLoading);
  map.on("sourcedata", onData);
  map.on("error", onError);
  begin();
  try {
    registerPrivateCoralSourceOnce();
    map.addSource(source.sourceId, {
      type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
      url: new URL(source.url, window.location.href).href,
      getToken: async () => { try { return await getToken(); } catch (error) { handleError(error); throw error; } },
      onAccessDenied: failAccessDenied,
      minzoom: 0, maxzoom: 14, promoteId: "feature_id",
    } as unknown as Parameters<MapboxMap["addSource"]>[1]);
    const mounted = map.getSource(source.sourceId);
    if (mounted) (mounted as unknown as { attribution: string }).attribution = ALLEN_CORAL_ATTRIBUTION;
    map.addLayer({ id: fill, type: "fill", source: source.sourceId, "source-layer": source.sourceLayer,
      filter: allenCoralFilter(view, region), paint: { "fill-color": allenCoralColor(view), "fill-opacity": opacity } });
  } catch (error) { handleError(error); }
  return () => {
    disposed = true; finish();
    map.off("sourcedataloading", onLoading); map.off("sourcedata", onData); map.off("error", onError);
    remove();
  };
}

export function useAllenCoralAtlasLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number,
  view: AllenCoralAtlasView = "coralAlgae", region: AllenCoralAtlasRegion = "all",
) {
  const [state, setState] = useState<LoadState>("loading");
  const access = useAllenCoralPrivateAccess();
  const enabled = access.allowed && visible;
  const mapTick = useMapReadyTick(mapRef, enabled);
  const opacityRef = useRef(opacity); opacityRef.current = opacity;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;
    let dispose: (() => void) | undefined;
    const mount = () => {
      dispose?.();
      dispose = mountAllenCoralAtlas(map, opacityRef.current, view, region, setState, () => allenCoralAccessToken(access.userId!));
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); dispose?.(); };
  }, [mapRef, enabled, mapTick, access.userId, view, region]);
  useEffect(() => {
    const map = mapRef.current; const fill = `${allenCoralSource(view).sourceId}-fill`;
    if (map && enabled && map.getLayer(fill)) map.setPaintProperty(fill, "fill-opacity", opacity);
  }, [mapRef, enabled, opacity, view, mapTick]);
  return state;
}
