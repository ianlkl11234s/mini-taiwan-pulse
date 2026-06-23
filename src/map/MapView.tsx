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
  /** 套用「Pure Black」自訂配色：背景純黑、面/路/字壓暗 */
  pureBlack?: boolean;
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

/** 把 Mapbox 內建底圖（dark-v11 等）整套配色壓到「純黑」：
 *  - background / fill / fill-extrusion → 黑或近黑
 *  - line（道路、行政邊界）→ 極暗灰，只剩骨架
 *  - symbol（地名）→ 暗灰 + 黑色 halo
 *  注：只動 Mapbox 原生底圖層；自家 overlay（id 含 "-overlay" 等）不受影響。
 */
function applyPureBlackTheme(map: mapboxgl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    // 只處理 Mapbox composite source 的原生底圖層
    if ((layer as { source?: string }).source !== "composite" && layer.type !== "background") continue;
    const id = layer.id;
    try {
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#000000");
      } else if (layer.type === "fill") {
        // 水域（海/湖/河川面）→ #262626；其餘陸地全黑
        const isWater = /water/i.test(id);
        const fillColor = isWater ? "#262626" : "#000000";
        map.setPaintProperty(id, "fill-color", fillColor);
        map.setPaintProperty(id, "fill-outline-color", fillColor);
      } else if (layer.type === "fill-extrusion") {
        map.setPaintProperty(id, "fill-extrusion-color", "#0a0a0a");
      } else if (layer.type === "line") {
        // waterway（河川線）跟海同色，其餘路網/邊界維持極暗灰
        const lineColor = /waterway/i.test(id) ? "#262626" : "#1a1a1a";
        map.setPaintProperty(id, "line-color", lineColor);
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", "#4a4a4a");
        map.setPaintProperty(id, "text-halo-color", "#000000");
        map.setPaintProperty(id, "text-halo-width", 1);
      }
    } catch {
      // 某些 layer 沒有對應 paint property，吞掉
    }
  }
}

export function MapView({ preset, styleUrl, pureBlack = false, flights, renderMode, isDarkTheme = true, showTrails = true, layerVisibility, overlayParams, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  const onMapReadyRef = useRef(onMapReady);
  const presetRef = useRef(preset);
  const renderModeRef = useRef(renderMode);
  const flightsRef = useRef(flights);
  const isDarkThemeRef = useRef(isDarkTheme);
  const pureBlackRef = useRef(pureBlack);
  const showTrailsRef = useRef(showTrails);
  const layerVisibilityRef = useRef(layerVisibility);
  const overlayParamsRef = useRef(overlayParams);

  onMapReadyRef.current = onMapReady;
  presetRef.current = preset;
  renderModeRef.current = renderMode;
  flightsRef.current = flights;
  isDarkThemeRef.current = isDarkTheme;
  pureBlackRef.current = pureBlack;
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
      // Pure Black 配色：在加 overlay 前先壓 Mapbox 原生底圖層
      if (pureBlackRef.current) applyPureBlackTheme(map);
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
      // debug handle：dev 一律暴露；production 帶 ?debug 才暴露
      // （給 E2E / 線上排障直接操作相機、查 source/layer 狀態用）
      if (import.meta.env.DEV || window.location.search.includes("debug")) {
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
      // 補發 load 之前用戶已切的 toggle / slider：
      // mapRef 在 load 才設定，而 production 首載 load 事件可能晚達 ~30s，
      // 期間 visibility / params effect 全部 no-op（mapRef null）。
      // 這裡用 ref 的最新值重放一次，避免「toggle 開了但圖層沒出現」。
      for (const config of OVERLAY_REGISTRY) {
        setOverlayVisible(map, config, layerVisibilityRef.current[config.id]);
      }
      updateAllOverlayThemes(map, OVERLAY_REGISTRY, isDarkThemeRef.current, overlayParamsRef.current);
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

  // Pure Black 切換：同 styleUrl（都是 dark-v11）下，靠 paint override 切換
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (pureBlack) {
      applyPureBlackTheme(map);
    } else {
      // 關掉 → 重灌目前的 styleUrl 還原原色。
      // ⚠️ 此處 styleUrl 與當前底圖相同（black/dark 共用 dark-v11），預設 setStyle 會走 diff
      //    增量更新 → 移除自訂 overlay 但「不觸發 style.load」→ 圖層全消失回不來。
      //    用 { diff: false } 強制完整 reload，確保 style.load 重建所有 overlay。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setStyle(styleUrl, { diff: false } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pureBlack]);

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
  // ⚠️ guard 不可加 map.isStyleLoaded()：任何 tile 還在載入它就回 false
  //（production 首載 / busy 期間長期 false），會把更新靜默丟棄且不重試。
  // setPaintProperty / setLayoutProperty 對已存在的 layer 任何時刻都安全；
  // style 切換中 layer 不存在時各 update 函式自帶 getLayer no-op。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
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
  // guard 不加 isStyleLoaded()，理由同上 — busy 期間 toggle 會被丟棄
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
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
