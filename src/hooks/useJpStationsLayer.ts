import { useEffect, useRef, useState } from "react";
import type { CircleLayer, ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import { fetchJpStations } from "../data/jpStationsLoader";
import { JP_STATION_TYPE_COLOR_EXPRESSION, JP_STATION_PAX_COLOR_EXPRESSION } from "../data/jpStationTypes";
import { useMapReadyTick } from "./useMapReadyTick";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

const DEFAULT_OPACITY = Number(paramDefault("jpStations", "jpStationsOpacity") ?? 1);

const SOURCE_ID = "jp-stations";
const LAYER_ID = "jp-stations-circle";

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function colorExpression(colorMode: "type" | "ridership"): ExpressionSpecification {
  return colorMode === "ridership" ? JP_STATION_PAX_COLOR_EXPRESSION : JP_STATION_TYPE_COLOR_EXPRESSION;
}

function circleLayer(radius: number, opacity: number, colorMode: "type" | "ridership", isDark: boolean): CircleLayer {
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": radius,
      "circle-color": colorExpression(colorMode),
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / DEFAULT_OPACITY),
    },
  } as CircleLayer;
}

/** 日本車站（GeoJSON circle，lazy fetch）：source `jp-stations`、layer `jp-stations-circle`。 */
export function useJpStationsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  colorMode: "type" | "ridership",
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    fetchJpStations()
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        setDataTick((tick) => tick + 1);
      })
      .catch((error) => console.warn("[JpStations] load failed:", error));
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      return;
    }
    if (!dataRef.current) return;

    const mount = () => {
      const isDark = isDarkTheme;
      if (!dataRef.current) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer(circleLayer(pointRadius("M", scale), opacity, colorMode, isDark));
      }
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("M", scale));
        map.setPaintProperty(LAYER_ID, "circle-color", colorExpression(colorMode));
        const stroke = pointStrokePaint(isDark, clampOpacity(opacity) / DEFAULT_OPACITY);
        for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(LAYER_ID, prop, stroke[prop]);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, colorMode, isDarkTheme, mapTick, dataTick]);
}
