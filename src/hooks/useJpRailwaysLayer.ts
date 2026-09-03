import { useEffect } from "react";
import type { Map as MapboxMap, LineLayer, ExpressionSpecification } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { JP_RAILWAY_TYPE_COLOR_EXPRESSION } from "../data/jpRailwayTypes";

const SOURCE_ID = "jp-railways";
const SOURCE_LAYER = "jp_railways";
const LINE_LAYER_ID = "jp-railways-line";
const FILE = "jp_railways.pmtiles";
const MINZOOM = 4;
const MAXZOOM = 12;

// UX baseline（主要路網線層）：z6=1px → z14=3px
const LINE_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, 1,
  14, 3,
] as unknown as ExpressionSpecification;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function railwayLineLayer(opacity: number): LineLayer {
  return {
    id: LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": JP_RAILWAY_TYPE_COLOR_EXPRESSION,
      "line-width": LINE_WIDTH,
      "line-opacity": clampOpacity(opacity),
    },
  } as LineLayer;
}

/** 日本鐵道路線：單一 PMTiles line 子層，按事業者種別分色，靜態無時間維度。 */
export function useJpRailwaysLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer(railwayLineLayer(opacity));
      }
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LINE_LAYER_ID, "line-opacity", clampOpacity(opacity));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick]);
}
