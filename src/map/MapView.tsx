import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CameraPreset } from "../types";

interface MapViewProps {
  preset: CameraPreset;
  styleUrl: string;
  onMapReady?: (map: mapboxgl.Map) => void;
}

const AIRPORT_MARKER_SOURCE = "airport-marker";
const AIRPORT_MARKER_LAYER = "airport-marker-fill";

function addAirportMarker(map: mapboxgl.Map, center: [number, number]) {
  // 移除舊的
  if (map.getLayer(AIRPORT_MARKER_LAYER)) map.removeLayer(AIRPORT_MARKER_LAYER);
  if (map.getSource(AIRPORT_MARKER_SOURCE)) map.removeSource(AIRPORT_MARKER_SOURCE);

  // 在機場中心建立一個約 1.5km x 0.4km 的矩形（模擬跑道區域）
  const lng = center[0];
  const lat = center[1];
  const dLng = 0.008; // ~800m
  const dLat = 0.002; // ~220m

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

export function MapView({ preset, styleUrl, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  // 初次建立地圖
  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      antialias: true,
    });

    map.on("style.load", () => {
      setupTerrain(map);
      addAirportMarker(map, preset.center);
    });

    map.on("load", () => {
      mapRef.current = map;
      readyRef.current = true;
      onMapReady?.(map);
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

    // setStyle 會觸發 style.load，我們在 style.load 中重建 terrain 和 marker
    const onStyleLoad = () => {
      setupTerrain(map);
      addAirportMarker(map, preset.center);

      // 需要重新觸發 onMapReady 讓 CustomLayer 重建
      onMapReady?.(map);
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

    // 等 style 確定載入後更新 marker
    if (map.isStyleLoaded()) {
      addAirportMarker(map, preset.center);
    }
  }, [preset]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
