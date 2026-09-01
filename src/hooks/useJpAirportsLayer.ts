import { useEffect, useRef, useState } from "react";
import type { CircleLayer, FillLayer, LineLayer, ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import { fetchJpAirports } from "../data/jpAirportsLoader";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-airports";
const FILL_LAYER_ID = "jp-airports-fill";
const LINE_LAYER_ID = "jp-airports-line";
const POINT_SOURCE_ID = "jp-airports-pt";
const CIRCLE_LAYER_ID = "jp-airports-circle";
const COLOR = "#a78bfa";

const LINE_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, 0.5,
  14, 2,
] as unknown as ExpressionSpecification;

const CIRCLE_RADIUS: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, 4,
  12, 8,
] as unknown as ExpressionSpecification;

export type JpAirportsDisplayMode = "point" | "polygon";

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

function circleLayer(opacity: number): CircleLayer {
  return {
    id: CIRCLE_LAYER_ID,
    type: "circle",
    source: POINT_SOURCE_ID,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": CIRCLE_RADIUS,
      "circle-color": COLOR,
      "circle-opacity": clampOpacity(opacity),
      "circle-stroke-color": "rgba(15, 23, 42, 0.45)",
      "circle-stroke-width": 0.35,
    },
  } as CircleLayer;
}

/** polygon feature 的 properties.longitude/latitude（機場基準點）派生點 FeatureCollection。 */
function toPointFeatureCollection(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const feature of data.features) {
    const lon = Number(feature.properties?.longitude);
    const lat = Number(feature.properties?.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: feature.properties,
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * 日本機場（GeoJSON polygon + 衍生點，lazy fetch）：source `jp-airports` / `jp-airports-pt`、
 * layer `jp-airports-fill` / `jp-airports-line`（面）、`jp-airports-circle`（點）。
 * displayMode 切換兩種顯示樣式；面 footprint 在國家級 zoom 幾乎看不見，預設用點位。
 */
export function useJpAirportsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  displayMode: JpAirportsDisplayMode,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const pointDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    fetchJpAirports()
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        pointDataRef.current = toPointFeatureCollection(data);
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
      if (map.getLayer(CIRCLE_LAYER_ID)) map.setLayoutProperty(CIRCLE_LAYER_ID, "visibility", "none");
      return;
    }
    if (!dataRef.current || !pointDataRef.current) return;

    const mount = () => {
      if (!dataRef.current || !pointDataRef.current) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current });
      }
      if (!map.getSource(POINT_SOURCE_ID)) {
        map.addSource(POINT_SOURCE_ID, { type: "geojson", data: pointDataRef.current });
      }
      if (!map.getLayer(FILL_LAYER_ID)) map.addLayer(fillLayer(opacity));
      if (!map.getLayer(LINE_LAYER_ID)) map.addLayer(lineLayer());
      if (!map.getLayer(CIRCLE_LAYER_ID)) map.addLayer(circleLayer(opacity));

      const showPolygon = displayMode === "polygon";
      if (map.getLayer(FILL_LAYER_ID)) {
        map.setLayoutProperty(FILL_LAYER_ID, "visibility", showPolygon ? "visible" : "none");
        map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", clampOpacity(opacity));
      }
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, "visibility", showPolygon ? "visible" : "none");
      }
      if (map.getLayer(CIRCLE_LAYER_ID)) {
        map.setLayoutProperty(CIRCLE_LAYER_ID, "visibility", showPolygon ? "none" : "visible");
        map.setPaintProperty(CIRCLE_LAYER_ID, "circle-opacity", clampOpacity(opacity));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, displayMode, mapTick, dataTick]);
}
