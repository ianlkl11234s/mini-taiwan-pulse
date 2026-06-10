import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CameraPreset, Flight, RenderMode, LayerVisibility } from "../types";
import { updateStaticTrails, setStaticTrailsOpacity, setStaticTrailsVisible } from "./staticTrails";
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import { addAllOverlays, updateAllOverlayThemes, setOverlayVisible } from "./overlayManager";
import { registerPmtilesSourceTypeOnce } from "./pmtilesSourceType";
import { ensureFireIsochroneLayer, updateFireIsochroneLayer } from "./fireIsochroneLayerFactory";
import { ensureMedicalIsochroneLayers, updateMedicalIsochroneLayers } from "./medicalIsochroneLayerFactory";

/** 從 overlayParams 取等時圈 factory 參數（opacity + 縣市 idx）。 */
function fireIsochroneParamsOf(p: Record<string, number>) {
  return { opacity: p.fireIsochroneOpacity ?? 0.5, countyIdx: p.fireIsochroneCountyIdx ?? 0 };
}
import { ensureH3Layers } from "./h3LayerFactory";
import { ensurePopCountLayers, ensureIndicatorsLayers } from "./demographicsLayerFactory";
import { ensureYoubikeLayers } from "./youbikeLayerFactory";
import {
  ensureAgricultureLayers, updateAgricultureLayer,
  ensureAgriSoilLayers, updateAgriSoilLayer,
  ensureAgriSoilFertilityLayers, updateAgriSoilFertilityLayer,
  ensureAgriLeisureFarmZonesLayers, updateAgriLeisureFarmZonesLayer,
  ensureAgriRuralRegenLayers, updateAgriRuralRegenLayer,
  ensureAgriCropSuitabilityLayers, updateAgriCropSuitabilityLayer,
  ensureAgriPOILayers, updateAgriPOILayer,
} from "./agricultureLayerFactory";
import { SOIL_FERTILITY_METRIC_OPTIONS, type SoilFertilityMetric } from "../data/agriSoilFertilityMetrics";

function agricultureParamsFrom(params: Record<string, number>) {
  return {
    opacity: params.agricultureOpacity ?? 1,
    outlineWidth: params.agricultureOutlineWidth ?? 1,
    showOutline: (params.agricultureShowOutline ?? 1) > 0,
    z: params.agricultureZ ?? 0,
  };
}
function agriPolyOpacityParam(params: Record<string, number>, key: string) {
  return { opacity: params[key] ?? 1 };
}
function agriSoilFertilityParamsFrom(params: Record<string, number>) {
  const idx = params.agriSoilFertilityMetricIdx ?? 0;
  const metric = (SOIL_FERTILITY_METRIC_OPTIONS[idx]?.value ?? "health") as SoilFertilityMetric;
  return {
    opacity: params.agriSoilFertilityOpacity ?? 1,
    metric,
  };
}
function agriCropSuitabilityParamsFrom(params: Record<string, number>) {
  return {
    opacity: params.agriCropSuitabilityOpacity ?? 1,
    cropLayerId: params.agriCropSuitabilityCropId ?? 0,
  };
}
function agriPOIParamsFrom(params: Record<string, number>) {
  return {
    opacity: params.agriPOIOpacity ?? 1,
    scale: params.agriPOIScale ?? 1,
  };
}

function ensureAllAgricultureLayers(map: mapboxgl.Map): void {
  ensureAgricultureLayers(map);
  ensureAgriSoilLayers(map);
  ensureAgriSoilFertilityLayers(map);
  ensureAgriLeisureFarmZonesLayers(map);
  ensureAgriRuralRegenLayers(map);
  ensureAgriCropSuitabilityLayers(map);
  ensureAgriPOILayers(map);
}

function updateAllAgricultureLayers(
  map: mapboxgl.Map,
  vis: LayerVisibility,
  params: Record<string, number>,
): void {
  updateAgricultureLayer(map, vis.agriculture, agricultureParamsFrom(params));
  updateAgriSoilLayer(map, vis.agriSoil, agriPolyOpacityParam(params, "agriSoilOpacity"));
  updateAgriSoilFertilityLayer(map, vis.agriSoilFertility, agriSoilFertilityParamsFrom(params));
  updateAgriLeisureFarmZonesLayer(map, vis.agriLeisureFarmZones, agriPolyOpacityParam(params, "agriLeisureFarmZonesOpacity"));
  updateAgriRuralRegenLayer(map, vis.agriRuralRegen, agriPolyOpacityParam(params, "agriRuralRegenOpacity"));
  updateAgriCropSuitabilityLayer(map, vis.agriCropSuitability, agriCropSuitabilityParamsFrom(params));
  updateAgriPOILayer(map, vis.agriPOI, agriPOIParamsFrom(params));
}

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

      // PMTiles SourceType 須在任何 pmtiles source addSource 前註冊（水利層走 overlayRegistry）
      registerPmtilesSourceTypeOnce();

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

      // 樣式切換後重建 H3 layers（source + layer 會被清除）
      ensureH3Layers(map);
      ensurePopCountLayers(map);
      ensureIndicatorsLayers(map);
      ensureYoubikeLayers(map);
      ensureAllAgricultureLayers(map);
      updateAllAgricultureLayers(map, layerVisibilityRef.current, overlayParamsRef.current);
      // 等時圈 PMTiles 層（須排在 agriculture 之後 → 共用 PMTiles SourceType 已註冊）
      ensureFireIsochroneLayer(map);
      updateFireIsochroneLayer(map, layerVisibilityRef.current.fireIsochrone, fireIsochroneParamsOf(overlayParamsRef.current));
      // 醫療等時圈 + 醫療沙漠（PMTiles fill，共用 SourceType）
      ensureMedicalIsochroneLayers(map);
      updateMedicalIsochroneLayers(map, layerVisibilityRef.current, overlayParamsRef.current);

      // 初次載入後，每次樣式切換都重建 flight layer
      if (readyRef.current) {
        onMapReadyRef.current?.(map);
      }
    });

    map.on("load", () => {
      mapRef.current = map;
      readyRef.current = true;
      // dev-only：給 E2E / 手動 debug 直接操作相機與查 style 用
      if (import.meta.env.DEV) {
        (window as unknown as { __map?: mapboxgl.Map }).__map = map;
      }
      ensureH3Layers(map);
      ensurePopCountLayers(map);
      ensureIndicatorsLayers(map);
      ensureYoubikeLayers(map);
      ensureAllAgricultureLayers(map);
      updateAllAgricultureLayers(map, layerVisibilityRef.current, overlayParamsRef.current);
      ensureFireIsochroneLayer(map);
      updateFireIsochroneLayer(map, layerVisibilityRef.current.fireIsochrone, fireIsochroneParamsOf(overlayParamsRef.current));
      ensureMedicalIsochroneLayers(map);
      updateMedicalIsochroneLayers(map, layerVisibilityRef.current, overlayParamsRef.current);
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
    // OVERLAY_REGISTRY 之外的專屬圖層：params 變動也要 re-apply
    updateAllAgricultureLayers(map, layerVisibility, overlayParams);
    // 等時圈：透明度 / 縣市下拉變動 → 更新
    updateFireIsochroneLayer(map, layerVisibility.fireIsochrone, fireIsochroneParamsOf(overlayParams));
    // 醫療等時圈 + 醫療沙漠
    updateMedicalIsochroneLayers(map, layerVisibility, overlayParams);
  }, [
    isDarkTheme, overlayParams,
    layerVisibility.agriculture,
    layerVisibility.agriSoil,
    layerVisibility.agriSoilFertility,
    layerVisibility.agriLeisureFarmZones,
    layerVisibility.agriRuralRegen,
    layerVisibility.agriCropSuitability,
    layerVisibility.agriPOI,
  ]);

  // Overlay 可見性（一個 useEffect 取代原本 7 個）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.isStyleLoaded()) return;
    for (const config of OVERLAY_REGISTRY) {
      setOverlayVisible(map, config, layerVisibility[config.id]);
    }
    // OVERLAY_REGISTRY 之外的專屬圖層
    updateAllAgricultureLayers(map, layerVisibility, overlayParamsRef.current);
    // 等時圈開/關層
    updateFireIsochroneLayer(map, layerVisibility.fireIsochrone, fireIsochroneParamsOf(overlayParamsRef.current));
    // 醫療等時圈 + 醫療沙漠開/關
    updateMedicalIsochroneLayers(map, layerVisibility, overlayParamsRef.current);
  }, [layerVisibility]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
