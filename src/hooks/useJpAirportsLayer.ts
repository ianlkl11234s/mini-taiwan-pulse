import { useEffect, useRef, useState } from "react";
import type { FillLayer, LineLayer, ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import { fetchJpAirports } from "../data/jpAirportsLoader";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-airports";
const FILL_LAYER_ID = "jp-airports-fill";
const LINE_LAYER_ID = "jp-airports-line";
const COLOR = "#a78bfa";

const LINE_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, 0.5,
  14, 2,
] as unknown as ExpressionSpecification;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function fillLayer(opacity: number): FillLayer {
  return {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    layout: { visibility: "none" },
    paint: {
      "fill-color": COLOR,
      "fill-opacity": clampOpacity(opacity),
    },
  } as FillLayer;
}

function lineLayer(): LineLayer {
  return {
    id: LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    layout: { visibility: "none" },
    paint: {
      "line-color": COLOR,
      "line-opacity": 0.6,
      "line-width": LINE_WIDTH,
    },
  } as LineLayer;
}

/**
 * 日本機場（GeoJSON polygon，lazy fetch）：source `jp-airports`、
 * layer `jp-airports-fill` / `jp-airports-line`。
 * 機場 footprint 在國家級 zoom 幾乎看不見是預期行為，不特別放大。
 */
export function useJpAirportsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    fetchJpAirports()
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        setDataTick((tick) => tick + 1);
      })
      .catch((error) => console.warn("[JpAirports] load failed:", error));
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, "visibility", "none");
      if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, "visibility", "none");
      return;
    }
    if (!dataRef.current) return;

    const mount = () => {
      if (!dataRef.current) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current });
      }
      if (!map.getLayer(FILL_LAYER_ID)) map.addLayer(fillLayer(opacity));
      if (!map.getLayer(LINE_LAYER_ID)) map.addLayer(lineLayer());
      if (map.getLayer(FILL_LAYER_ID)) {
        map.setLayoutProperty(FILL_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", clampOpacity(opacity));
      }
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, "visibility", "visible");
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick, dataTick]);
}
