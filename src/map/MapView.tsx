import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CameraPreset, Flight, RenderMode, LayerVisibility } from "../types";
import { updateStaticTrails, setStaticTrailsOpacity, setStaticTrailsVisible } from "./staticTrails";
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import { addAllOverlays, updateAllOverlayThemes, setOverlayVisible } from "./overlayManager";
import { initDeckOverlay } from "./deckOverlay";

interface MapViewProps {
  preset: CameraPreset;
  styleUrl: string;
  flights: Flight[];
  renderMode: RenderMode;
  isDarkTheme?: boolean;
  showTrails?: boolean;
  layerVisibility: LayerVisibility;
  overlayParams: Record<string, number>;
  onMapReady?: (map: mapboxgl.Map) => void;
}

/**
 * 3D 模式下，根據 zoom 計算 2D 軌跡應有的透明度
 */
const ZOOM_FADE_IN = 3;
const ZOOM_FADE_OUT = 5;

function calc2dTrailOpacity(zoom: number, isDark: boolean) {
  const t = Math.max(0, Math.min(1, (zoom - ZOOM_FADE_IN) / (ZOOM_FADE_OUT - ZOOM_FADE_IN)));
  const fade = 1 - t;
  return {
    line: (isDark ? 0.25 : 0.5) * fade,
    glow: (isDark ? 0.08 : 0.15) * fade,
  };
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

export function MapView({ preset, styleUrl, flights, renderMode, isDarkTheme = true, showTrails = true, layerVisibility, overlayParams, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  const onMapReadyRef = useRef(onMapReady);
  const presetRef = useRef(preset);
  const renderModeRef = useRef(renderMode);
  const flightsRef = useRef(flights);
  const isDarkThemeRef = useRef(isDarkTheme);
  const showTrailsRef = useRef(showTrails);
  const layerVisibilityRef = useRef(layerVisibility);
  const overlayParamsRef = useRef(overlayParams);

  onMapReadyRef.current = onMapReady;
  presetRef.current = preset;
  renderModeRef.current = renderMode;
  flightsRef.current = flights;
  isDarkThemeRef.current = isDarkTheme;
  showTrailsRef.current = showTrails;
  layerVisibilityRef.current = layerVisibility;
  overlayParamsRef.current = overlayParams;

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

    // 唯一的 style.load handler：每次底圖切換都會觸發，重建所有圖層
    map.on("style.load", () => {
      setupTerrain(map);

      // 批量新增所有 overlays + 設定初始可見性
      addAllOverlays(
        map,
        OVERLAY_REGISTRY,
        isDarkThemeRef.current,
        layerVisibilityRef.current,
        overlayParamsRef.current,
      );

      // 永遠保留 Mapbox 原生靜態軌跡
      const is3d = renderModeRef.current === "3d";
      updateStaticTrails(map, flightsRef.current, isDarkThemeRef.current, is3d);
      if (is3d) {
        const { line, glow } = calc2dTrailOpacity(map.getZoom(), isDarkThemeRef.current);
        setStaticTrailsOpacity(map, line, glow);
      }

      // Live Status 模式：隱藏 2D 軌跡
      if (!showTrailsRef.current) {
        setStaticTrailsVisible(map, false);
      }

      // 初次載入後，每次樣式切換都重建 flight layer
      if (readyRef.current) {
        onMapReadyRef.current?.(map);
      }
    });

    map.on("load", () => {
      mapRef.current = map;
      readyRef.current = true;
      initDeckOverlay(map);
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
    map.setStyle(styleUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // 切換機場時平滑飛行
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

  // 2D/3D 渲染模式切換
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    const is3d = renderMode === "3d";
    updateStaticTrails(map, flights, isDarkTheme, is3d);
    if (is3d) {
      const { line, glow } = calc2dTrailOpacity(map.getZoom(), isDarkTheme);
      setStaticTrailsOpacity(map, line, glow);
    }
  }, [renderMode, flights, isDarkTheme]);

  // 3D 模式：zoom 驅動 2D 軌跡 crossfade
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (renderMode !== "3d") return;
    const onZoom = () => {
      if (!map.isStyleLoaded()) return;
      const { line, glow } = calc2dTrailOpacity(map.getZoom(), isDarkThemeRef.current);
      setStaticTrailsOpacity(map, line, glow);
    };
    map.on("zoom", onZoom);
    return () => { map.off("zoom", onZoom); };
  }, [renderMode]);

  // showTrails 切換
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    setStaticTrailsVisible(map, showTrails);
  }, [showTrails]);

  // Overlay 主題 + params 即時更新（一個 useEffect 取代原本 5+ 個）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    updateAllOverlayThemes(map, OVERLAY_REGISTRY, isDarkTheme, overlayParams);
  }, [isDarkTheme, overlayParams]);

  // Overlay 可見性（一個 useEffect 取代原本 7 個）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    for (const config of OVERLAY_REGISTRY) {
      setOverlayVisible(map, config, layerVisibility[config.id]);
    }
  }, [layerVisibility]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
