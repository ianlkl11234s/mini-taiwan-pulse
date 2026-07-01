import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createSubstationEhvGlowLayer,
  SUBSTATION_EHV_GLOW_LAYER_ID,
} from "../map/substationEhvGlowCustomLayer";
import {
  fetchOsmSubstations,
  type OsmSubstation,
} from "../data/energyLoader";

export function useSubstationEhvGlowLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  sizeMul: number,
) {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const sizeMulRef = useRef(sizeMul);
  sizeMulRef.current = sizeMul;
  const rowsRef = useRef<OsmSubstation[] | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tryMount = () => {
      if (map.getLayer(SUBSTATION_EHV_GLOW_LAYER_ID)) return;
      try {
        map.addLayer(
          createSubstationEhvGlowLayer({
            getIsVisible: () => visibleRef.current,
            getOpacity: () => opacityRef.current,
            getSizeMul: () => sizeMulRef.current,
            getSubstations: () => rowsRef.current,
          }),
        );
        console.log("[SubstationEhvGlow] mounted ✓");
      } catch (e) {
        console.log("[SubstationEhvGlow] addLayer 失敗 → idle 後重試", e);
        map.once("idle", tryMount);
      }
    };
    tryMount();
    map.on("style.load", tryMount);
    return () => {
      map.off("style.load", tryMount);
    };
  }, [mapRef, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchOsmSubstations()
      .then((rows) => {
        if (cancelled) return;
        rowsRef.current = rows;
        mapRef.current?.triggerRepaint();
      })
      .catch((err) => console.warn("[SubstationEhvGlow] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [visible, mapRef]);
}
