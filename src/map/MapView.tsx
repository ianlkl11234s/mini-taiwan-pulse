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
  onMapReady?: (map: mapboxgl.Map) => void;
}

const AIRPORT_MARKER_SOURCE = "airport-marker";
const AIRPORT_MARKER_LAYER = "airport-marker-fill";

function addAirportMarker(map: mapboxgl.Map, center: [number, number]) {
  if (map.getLayer(AIRPORT_MARKER_LAYER)) map.removeLayer(AIRPORT_MARKER_LAYER);
  if (map.getSource(AIRPORT_MARKER_SOURCE)) map.removeSource(AIRPORT_MARKER_SOURCE);

  const lng = center[0];
  const lat = center[1];
  const dLng = 0.008;
  const dLat = 0.002;

  map.addSource(AIRPORT_MARKER_SOURCE, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng - dLng, lat - dLat],
          [lng + dLng, lat - dLat],
          [lng + dLng, lat + dLat],
          [lng - dLng, lat + dLat],
          [lng - dLng, lat - dLat],
        ]],
      },
    },
  });

  map.addLayer({
    id: AIRPORT_MARKER_LAYER,
    type: "fill",
    source: AIRPORT_MARKER_SOURCE,
    paint: {
      "fill-color": "#ffffff",
      "fill-opacity": 0.08,
    },
  });
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
  center: [number, number],
  onMapReady: ((map: mapboxgl.Map) => void) | undefined,
) {
  setupTerrain(map);
  addAirportMarker(map, center);
  onMapReady?.(map);
}

export function MapView({ preset, styleUrl, flights, renderMode, onMapReady }: MapViewProps) {
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
      addAirportMarker(map, presetRef.current.center);
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
      rebuildLayers(map, presetRef.current.center, onMapReadyRef.current);
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

    if (map.isStyleLoaded()) {
      addAirportMarker(map, preset.center);
    }
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

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
