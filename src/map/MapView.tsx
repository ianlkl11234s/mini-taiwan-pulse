import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CameraPreset, Flight, RenderMode } from "../types";
import { updateStaticTrails, removeStaticTrails } from "./staticTrails";

interface MapViewProps {
  preset: CameraPreset;
  styleUrl: string;
  flights: Flight[];
  renderMode: RenderMode;
  airportOpacity: number;
  airportGlow: number;
  onMapReady?: (map: mapboxgl.Map) => void;
}

const AIRPORT_SOURCE = "airport-boundaries";
const AIRPORT_FILL = "airport-fill";
const AIRPORT_LINE = "airport-outline";
const AIRPORT_GLOW_1 = "airport-glow-1";
const AIRPORT_GLOW_2 = "airport-glow-2";

const AIRPORT_LAYERS = [AIRPORT_GLOW_2, AIRPORT_GLOW_1, AIRPORT_FILL, AIRPORT_LINE];

function addAirportOverlay(map: mapboxgl.Map, opacity: number, glow: number) {
  if (map.getSource(AIRPORT_SOURCE)) return;

  map.addSource(AIRPORT_SOURCE, {
    type: "geojson",
    data: "./airports.geojson",
  });

  // 外層光暈（寬、模糊）
  map.addLayer({
    id: AIRPORT_GLOW_2,
    type: "line",
    source: AIRPORT_SOURCE,
    paint: {
      "line-color": "#ffffff",
      "line-width": 30,
      "line-blur": 15,
      "line-opacity": glow * 0.06,
    },
  });

  // 內層光暈
  map.addLayer({
    id: AIRPORT_GLOW_1,
    type: "line",
    source: AIRPORT_SOURCE,
    paint: {
      "line-color": "#ffffff",
      "line-width": 10,
      "line-blur": 5,
      "line-opacity": glow * 0.15,
    },
  });

  // 填充
  map.addLayer({
    id: AIRPORT_FILL,
    type: "fill",
    source: AIRPORT_SOURCE,
    paint: {
      "fill-color": "#ffffff",
      "fill-opacity": opacity,
    },
  });

  // 邊框線
  map.addLayer({
    id: AIRPORT_LINE,
    type: "line",
    source: AIRPORT_SOURCE,
    paint: {
      "line-color": "#ffffff",
      "line-width": 1.5,
      "line-opacity": Math.min(opacity * 3, 0.5),
    },
  });
}

function updateAirportStyle(map: mapboxgl.Map, opacity: number, glow: number) {
  if (!map.getSource(AIRPORT_SOURCE)) return;
  map.setPaintProperty(AIRPORT_FILL, "fill-opacity", opacity);
  map.setPaintProperty(AIRPORT_LINE, "line-opacity", Math.min(opacity * 3, 0.5));
  map.setPaintProperty(AIRPORT_GLOW_1, "line-opacity", glow * 0.15);
  map.setPaintProperty(AIRPORT_GLOW_2, "line-opacity", glow * 0.06);
}

function removeAirportOverlay(map: mapboxgl.Map) {
  for (const id of AIRPORT_LAYERS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(AIRPORT_SOURCE)) map.removeSource(AIRPORT_SOURCE);
}

function setupTerrain(map: mapboxgl.Map) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
}

function rebuildLayers(
  map: mapboxgl.Map,
  opacity: number,
  glow: number,
  onMapReady: ((map: mapboxgl.Map) => void) | undefined,
) {
  setupTerrain(map);
  removeAirportOverlay(map);
  addAirportOverlay(map, opacity, glow);
  onMapReady?.(map);
}

export function MapView({ preset, styleUrl, flights, renderMode, airportOpacity, airportGlow, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  const onMapReadyRef = useRef(onMapReady);
  const presetRef = useRef(preset);
  onMapReadyRef.current = onMapReady;
  presetRef.current = preset;

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: presetRef.current.center,
      zoom: presetRef.current.zoom,
      pitch: presetRef.current.pitch,
      bearing: presetRef.current.bearing,
      antialias: true,
    });

    map.on("style.load", () => {
      setupTerrain(map);
      addAirportOverlay(map, 0.12, 0.8);
    });

    map.on("load", () => {
      mapRef.current = map;
      readyRef.current = true;
      onMapReadyRef.current?.(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切換底圖樣式
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const onStyleLoad = () => {
      rebuildLayers(map, airportOpacity, airportGlow, onMapReadyRef.current);
      map.off("style.load", onStyleLoad);
    };

    map.on("style.load", onStyleLoad);
    map.setStyle(styleUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // 切換機場時平滑飛行 + 更新標記
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    map.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: 2000,
    });
  }, [preset]);

  // 2D/3D 渲染模式切換：管理 Mapbox 原生靜態軌跡
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;

    if (renderMode === "2d") {
      updateStaticTrails(map, flights);
    } else {
      removeStaticTrails(map);
    }
  }, [renderMode, flights]);

  // 機場圖層樣式即時更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    updateAirportStyle(map, airportOpacity, airportGlow);
  }, [airportOpacity, airportGlow]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
