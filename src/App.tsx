import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode, RenderMode, DisplayMode, Flight, ExpandableLayerKey } from "./types";
import type { StationPillarData } from "./three/StationPillarScene";
import { MapView } from "./map/MapView";
import { useFlightData } from "./hooks/useFlightData";
import { useShipData } from "./hooks/useShipData";
import { useRailData } from "./hooks/useRailData";
import { useTimeline } from "./hooks/useTimeline";
import { useIsMobile } from "./hooks/useIsMobile";
import { useTransportParams } from "./hooks/useTransportParams";
import { useRailEngine } from "./hooks/useRailEngine";
import { useLayerVisibility } from "./hooks/useLayerVisibility";
import { useThreeJsLayers } from "./hooks/useThreeJsLayers";
import { useMapInteraction } from "./hooks/useMapInteraction";
import { useH3Data } from "./hooks/useH3Data";
import { useTemperatureData } from "./hooks/useTemperatureData";
import { useDemographicsH3 } from "./hooks/useDemographicsH3";
import { updateH3Layer, getH3Resolution, ensureH3Layers } from "./map/h3LayerFactory";
import { ensurePopCountLayers, ensureIndicatorsLayers, updatePopCountLayer, updateIndicatorsLayer } from "./map/demographicsLayerFactory";
import { DEFAULT_CAMERA, getPresetById } from "./map/cameraPresets";
import { filterByTimeWindow } from "./data/flightLoader";
import { updateRailTracks, removeRailTracks, setRailTracksVisible } from "./map/railTracks";
import { LocationJump } from "./components/AirportSelector";
import { LayerSidebar } from "./components/LayerSidebar";
import { TimelineControls } from "./components/TimelineControls";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";
import { MobileBottomSheet } from "./components/MobileBottomSheet";
import { InfoModal } from "./components/InfoModal";

export default function App() {
  const {
    allFlights,
    selectedAirport,
    setSelectedAirport,
    timeRange,
    loading,
  } = useFlightData();

  const { ships } = useShipData();

  // 燈塔座標
  const [lighthousePositions, setLighthousePositions] = useState<[number, number][]>([]);
  useEffect(() => {
    fetch("./lighthouse.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection<GeoJSON.Point>) => {
        const positions = geojson.features.map((f) => f.geometry.coordinates.slice(0, 2) as [number, number]);
        setLighthousePositions(positions);
      })
      .catch((err) => console.warn("Lighthouse data not available:", err));
  }, []);

  // 車站光柱資料 — 三體系各自獨立
  const [thsrPillarData, setThsrPillarData] = useState<StationPillarData[]>([]);
  const [traPillarData, setTraPillarData] = useState<StationPillarData[]>([]);
  const [metroPillarData, setMetroPillarData] = useState<StationPillarData[]>([]);
  // 機場 / 碼頭光柱資料（從 polygon GeoJSON 算質心）
  const [airportPillarData, setAirportPillarData] = useState<StationPillarData[]>([]);
  const [portPillarData, setPortPillarData] = useState<StationPillarData[]>([]);

  const { railData } = useRailData();
  const { temperatureData } = useTemperatureData();

  // 預計算光柱資料（靜態 JSON，不依賴 railData）
  useEffect(() => {
    fetch("./station_pillars.json")
      .then((r) => r.json())
      .then((data: Record<string, { lng: number; lat: number; height: number }[]>) => {
        const toArr = (entries: { lng: number; lat: number; height: number }[]): StationPillarData[] =>
          entries.map((e) => ({ position: [e.lng, e.lat], height: e.height }));
        setThsrPillarData(toArr(data.thsr ?? []));
        setTraPillarData(toArr(data.tra ?? []));
        setMetroPillarData(toArr(data.metro ?? []));
      })
      .catch((err) => console.warn("Station pillar data:", err));
  }, []);

  // 機場光柱 — 從 airports.geojson 算質心，高度依起降量排序
  useEffect(() => {
    const AIRPORT_HEIGHTS: Record<string, number> = {
      RCTP: 1.0, RCSS: 0.85, RCKH: 0.7, RCMQ: 0.55,
      RCBS: 0.45, RCNN: 0.35, RCFN: 0.3, RCKU: 0.25,
      RCLY: 0.2, RCGI: 0.2, RCMT: 0.2, RCFG: 0.2,
    };
    fetch("./airports.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const data: StationPillarData[] = geojson.features.map((f) => {
          const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          const ring = geom.type === "MultiPolygon"
            ? geom.coordinates[0]![0]!
            : geom.coordinates[0]!;
          const lng = ring.reduce((s, c) => s + c[0]!, 0) / ring.length;
          const lat = ring.reduce((s, c) => s + c[1]!, 0) / ring.length;
          const icao = (f.properties?.icao as string) ?? "";
          return { position: [lng, lat], height: AIRPORT_HEIGHTS[icao] ?? 0.2 };
        });
        setAirportPillarData(data);
      })
      .catch((err) => console.warn("Airport pillar data:", err));
  }, []);

  // 碼頭光柱 — 從 port_polygons.geojson 算質心
  useEffect(() => {
    fetch("./port_polygons.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const data: StationPillarData[] = geojson.features.map((f) => {
          const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          const coords = geom.type === "MultiPolygon"
            ? geom.coordinates[0]![0]!
            : geom.coordinates[0]!;
          const lng = coords.reduce((s, c) => s + c[0]!, 0) / coords.length;
          const lat = coords.reduce((s, c) => s + c[1]!, 0) / coords.length;
          return { position: [lng, lat], height: 1 };
        });
        setPortPillarData(data);
      })
      .catch((err) => console.warn("Port pillar data:", err));
  }, []);

  const { isMobile, isLandscape } = useIsMobile();

  const [viewMode, setViewMode] = useState<ViewMode>("all-taiwan");
  const [expandedLayer, setExpandedLayer] = useState<ExpandableLayerKey | null>(null);
  const [mapStyleId, setMapStyleId] = useState("dark");
  const [renderMode, setRenderMode] = useState<RenderMode>("3d");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("status");
  const [captureMode, setCaptureMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [cameraInfo, setCameraInfo] = useState({ lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 });

  const timeline = useTimeline({
    startTime: timeRange.start,
    endTime: timeRange.end,
  });

  // ── Custom Hooks ──

  const transportParams = useTransportParams();

  const isDarkTheme = !["light", "streets"].includes(mapStyleId);
  const showTrails = displayMode === "trails";

  // Refs for Three.js render loops
  const mapRef = useRef<MapboxMap | null>(null);
  const flightsRef = useRef<Flight[]>([]);
  const shipsRef = useRef(ships);
  const timeRef = useRef(timeline.currentTime);
  const renderModeRef = useRef(renderMode);
  const isDarkThemeRef = useRef(isDarkTheme);
  const showTrailsRef = useRef(showTrails);
  const railDataRef = useRef(railData);
  const lighthousePositionsRef = useRef(lighthousePositions);
  const thsrPillarDataRef = useRef(thsrPillarData);
  const traPillarDataRef = useRef(traPillarData);
  const metroPillarDataRef = useRef(metroPillarData);
  const airportPillarDataRef = useRef(airportPillarData);
  const portPillarDataRef = useRef(portPillarData);
  const temperatureDataRef = useRef(temperatureData);
  const playingRef = useRef(timeline.playing);

  // 根據 viewMode 決定要顯示的航班
  const displayedFlights = useMemo(() => {
    switch (viewMode) {
      case "time-window":
        return filterByTimeWindow(allFlights, selectedAirport, timeline.currentTime);
      case "all-taiwan":
      default:
        return allFlights;
    }
  }, [allFlights, viewMode, selectedAirport, timeline.currentTime]);

  flightsRef.current = displayedFlights;
  shipsRef.current = ships;
  timeRef.current = timeline.currentTime;
  renderModeRef.current = renderMode;
  isDarkThemeRef.current = isDarkTheme;
  showTrailsRef.current = showTrails;
  railDataRef.current = railData;
  lighthousePositionsRef.current = lighthousePositions;
  thsrPillarDataRef.current = thsrPillarData;
  traPillarDataRef.current = traPillarData;
  metroPillarDataRef.current = metroPillarData;
  airportPillarDataRef.current = airportPillarData;
  portPillarDataRef.current = portPillarData;
  temperatureDataRef.current = temperatureData;
  playingRef.current = timeline.playing;

  const { activeTrains, activeTrainsRef } = useRailEngine(railData, timeRef);
  const { layerVisibility, layerVisibilityRef, setLayerVisibility, toggleVisibility } = useLayerVisibility();
  const { h3DataMap, loadResolution } = useH3Data();
  const { demographicsDataMap, loadDemographicsResolution } = useDemographicsH3();

  const {
    flightSceneRef, shipSceneRef, railSceneRef,
    addFlightLayer,
    addAllLayers,
  } = useThreeJsLayers({
    timeRef, flightsRef, renderModeRef, isDarkThemeRef, showTrailsRef,
    shipsRef, activeTrainsRef, railDataRef,
    lighthousePositionsRef, thsrPillarDataRef, traPillarDataRef, metroPillarDataRef,
    airportPillarDataRef, portPillarDataRef, temperatureDataRef,
    playingRef, layerVisibilityRef,
    paramRefs: transportParams.refs,
  });

  const { tooltipInfo, setTooltipInfo, trainTooltipInfo, bindEvents } =
    useMapInteraction(mapRef, flightSceneRef, flightsRef, timeRef, railSceneRef);

  // ── Derived values ──

  const preset = useMemo(
    () => getPresetById(selectedAirport) ?? DEFAULT_CAMERA,
    [selectedAirport],
  );

  const styleUrl = useMemo(() => getStyleUrl(mapStyleId), [mapStyleId]);

  // ── Map ready handler ──

  // H3 resolution state (driven by zoom)
  const [h3Resolution, setH3Resolution] = useState(7);
  // Demographics resolution (capped at 8, no res9 for village polygons)
  const [demoResolution, setDemoResolution] = useState(7);

  const handleMapReady = (map: MapboxMap) => {
    mapRef.current = map;
    addAllLayers(map);

    const updateCamera = () => {
      const c = map.getCenter();
      setCameraInfo({
        lng: +c.lng.toFixed(4),
        lat: +c.lat.toFixed(4),
        zoom: +map.getZoom().toFixed(1),
        pitch: +map.getPitch().toFixed(0),
        bearing: +map.getBearing().toFixed(0),
      });
    };
    map.on("move", updateCamera);
    updateCamera();

    // H3 zoom-based resolution switching
    const onZoomH3 = () => {
      const res = getH3Resolution(map.getZoom());
      setH3Resolution(res);
      setDemoResolution(Math.min(res, 8)); // cap at 8 for demographics
    };
    map.on("zoomend", onZoomH3);
    onZoomH3(); // initial
    loadResolution(7); // preload default resolution
    loadDemographicsResolution(7); // preload demographics

    bindEvents(map);
  };

  // ── Effects ──

  // 航班資料或模式變更時重建 layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addFlightLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport, viewMode]);

  // 軌道靜態線（2D Mapbox）
  const { railTrackMode } = transportParams;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (railData && layerVisibility.rail) {
      updateRailTracks(map, railData.allTracks, isDarkTheme);
      setRailTracksVisible(map, railTrackMode === "2d");
    } else {
      removeRailTracks(map);
    }
  }, [railData, isDarkTheme, layerVisibility.rail, railTrackMode]);

  // Three.js 圖層可見性由各 custom layer 內部 getIsVisible 控制
  // layers 常駐，不做 remove/re-add（避免 WebGL dispose/reinit 問題）

  // H3: load resolution when it changes
  useEffect(() => {
    if (layerVisibility.h3Population) {
      loadResolution(h3Resolution);
    }
  }, [h3Resolution, layerVisibility.h3Population, loadResolution]);

  // H3: update native Mapbox layers
  // Guard: getStyle() returns truthy after style parse (unaffected by tile loading),
  // undefined before style loads. This avoids both isStyleLoaded() false-during-tiles
  // and addSource-before-style-ready crashes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    ensureH3Layers(map);
    const cells = h3DataMap.get(h3Resolution) ?? [];
    updateH3Layer(map, cells, transportParams.h3Params, layerVisibility.h3Population);
  }, [h3DataMap, h3Resolution, layerVisibility.h3Population, transportParams.h3Params]);

  // Demographics: load resolution when it changes
  useEffect(() => {
    if (layerVisibility.popCount || layerVisibility.indicators) {
      loadDemographicsResolution(demoResolution);
    }
  }, [demoResolution, layerVisibility.popCount, layerVisibility.indicators, loadDemographicsResolution]);

  // Demographics: update popCount layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    ensurePopCountLayers(map);
    const cells = demographicsDataMap.get(demoResolution) ?? [];
    updatePopCountLayer(map, cells, transportParams.popCountParams, layerVisibility.popCount);
  }, [demographicsDataMap, demoResolution, layerVisibility.popCount, transportParams.popCountParams]);

  // Demographics: update indicators layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    ensureIndicatorsLayers(map);
    const cells = demographicsDataMap.get(demoResolution) ?? [];
    updateIndicatorsLayer(map, cells, transportParams.indicatorsParams, layerVisibility.indicators);
  }, [demographicsDataMap, demoResolution, layerVisibility.indicators, transportParams.indicatorsParams]);

  // ESC 退出拍攝模式
  useEffect(() => {
    if (!captureMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCaptureMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [captureMode]);

  // 資料載入完成後自動播放
  useEffect(() => {
    if (!loading && timeRange.start > 0) {
      timeline.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timeRange.start]);

  // ── Render ──

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a14",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "monospace",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700 }}>
          Mini Taiwan Pulse
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
          Loading transport data...
        </div>
        <div
          style={{
            width: 120,
            height: 2,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 1,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <div
            style={{
              width: "40%",
              height: "100%",
              background: "rgba(100,170,255,0.8)",
              borderRadius: 1,
              animation: "loadbar 1.2s ease-in-out infinite alternate",
            }}
          />
        </div>
        <style>{`@keyframes loadbar { from { margin-left: 0 } to { margin-left: 60% } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <MapView
        preset={preset}
        styleUrl={styleUrl}
        flights={displayedFlights}
        renderMode={renderMode}
        isDarkTheme={isDarkTheme}
        showTrails={showTrails}
        layerVisibility={layerVisibility}
        overlayParams={transportParams.overlayParams}
        onMapReady={handleMapReady}
      />

      {/* ── 拍攝模式 vignette + 標題 ── */}
      {captureMode && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.6) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: isMobile ? 16 : 32,
              left: isMobile ? 16 : 32,
              zIndex: 21,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 20 : 28,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: isMobile ? 2 : 4,
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
              }}
            >
              Mini Taiwan Pulse
            </div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "monospace",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: 2,
                marginTop: 6,
                textShadow: "0 1px 8px rgba(0,0,0,0.5)",
              }}
            >
              Taiwan Transport Visualization
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 1,
                marginTop: 4,
                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              }}
            >
              {new Date(timeline.currentTime * 1000).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: 1,
                marginTop: 4,
                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              }}
            >
              {cameraInfo.lat}, {cameraInfo.lng} z{cameraInfo.zoom} pitch {cameraInfo.pitch} bearing {cameraInfo.bearing}
            </div>
          </div>
          <button
            onClick={() => setCaptureMode(false)}
            style={isMobile ? {
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 21,
              width: 48,
              height: 48,
              borderRadius: 24,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            } : {
              position: "absolute",
              bottom: 32,
              right: 32,
              zIndex: 21,
              padding: "4px 12px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 4,
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            {isMobile ? "✕" : "ESC"}
          </button>
        </>
      )}

      {/* ── 一般模式 UI ── */}
      {!captureMode && !isMobile && (
        <>
          {/* Row 1: 標題 + 樣式 + 地點跳轉 */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 10,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                color: isDarkTheme ? "#fff" : "#333",
                fontFamily: "monospace",
                letterSpacing: 2,
              }}
            >
              Mini Taiwan Pulse
            </h1>

            <StyleSelector
              selected={mapStyleId}
              isDarkTheme={isDarkTheme}
              onChange={setMapStyleId}
            />

            <LocationJump
              isDarkTheme={isDarkTheme}
              currentId={selectedAirport}
              onJump={(id) => {
                const p = getPresetById(id);
                if (p && mapRef.current) {
                  if (p.category === "airport") setSelectedAirport(p.id);
                  mapRef.current.flyTo({
                    center: p.center,
                    zoom: p.zoom,
                    pitch: p.pitch,
                    bearing: p.bearing,
                    duration: 2000,
                  });
                }
              }}
            />

            {loading && (
              <span style={{ color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", fontSize: 13 }}>
                Loading...
              </span>
            )}
          </div>

          {/* LayerSidebar */}
          <div style={{ position: "absolute", top: 92, left: 16, zIndex: 10 }}>
            <LayerSidebar
              visibility={layerVisibility}
              expandedLayer={expandedLayer}
              viewMode={viewMode}
              displayMode={displayMode}
              isDarkTheme={isDarkTheme}
              counts={{
                flights: displayedFlights.length,
                ships: shipSceneRef.current?.getVisibleCount() ?? ships.length,
                trains: activeTrains.length,
              }}
              onLayerClick={(layer) => {
                const isVisible = layerVisibility[layer];
                if (!isVisible) {
                  setLayerVisibility((prev) => ({ ...prev, [layer]: true }));
                  setExpandedLayer(layer as ExpandableLayerKey);
                } else if (expandedLayer === layer) {
                  setExpandedLayer(null);
                } else {
                  setExpandedLayer(layer as ExpandableLayerKey);
                }
              }}
              onToggleVisibility={toggleVisibility}
              onViewModeChange={setViewMode}
              onDisplayModeChange={(mode) => { setDisplayMode(mode); setTooltipInfo(null); }}
              onHideTransport={() => {
                if (expandedLayer) {
                  setLayerVisibility((prev) => ({ ...prev, [expandedLayer]: false }));
                  setExpandedLayer(null);
                }
              }}
              getControls={transportParams.getControls}
            />
          </div>

          {/* 時間軸 */}
          <TimelineControls
            playing={timeline.playing}
            speed={timeline.speed}
            progress={timeline.progress}
            currentTime={timeline.currentTime}
            startTime={timeRange.start}
            endTime={timeRange.end}
            isDarkTheme={isDarkTheme}
            onToggle={timeline.toggle}
            onSpeedChange={timeline.setSpeed}
            onSeekByProgress={timeline.seekByProgress}
          />

          {/* 右上角按鈕群 */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={() => setCaptureMode(true)}
              style={{
                padding: "6px 14px",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                borderRadius: 6,
                color: isDarkTheme ? "#fff" : "#333",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              Capture
            </button>
            <button
              onClick={() => setRenderMode((m) => (m === "3d" ? "2d" : "3d"))}
              style={{
                padding: "6px 14px",
                background: renderMode === "3d"
                  ? (isDarkTheme ? "rgba(80,140,255,0.25)" : "rgba(80,140,255,0.15)")
                  : (isDarkTheme ? "rgba(255,170,68,0.25)" : "rgba(255,170,68,0.15)"),
                border: `1px solid ${renderMode === "3d" ? "rgba(80,140,255,0.5)" : "rgba(255,170,68,0.5)"}`,
                borderRadius: 6,
                color: isDarkTheme ? "#fff" : "#333",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              {renderMode === "3d" ? "3D Altitude" : "2D Flat"}
            </button>
          </div>

          {/* 右上角第二排 */}
          <div
            style={{
              position: "absolute",
              top: 52,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setShowInfo(true)}
              style={{
                padding: "6px 14px",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                borderRadius: 6,
                color: isDarkTheme ? "#fff" : "#333",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              Info
            </button>
          </div>

          {/* 操作提示 */}
          <div
            style={{
              position: "absolute",
              top: 84,
              right: 16,
              zIndex: 10,
              color: isDarkTheme ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)",
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: 0.5,
              textAlign: "right",
            }}
          >
            Right-drag to rotate · Scroll to zoom
          </div>

          {/* 統計 + 相機角度 */}
          <div
            style={{
              position: "absolute",
              top: 48,
              left: 16,
              zIndex: 10,
              background: isDarkTheme ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)",
              backdropFilter: "blur(8px)",
              borderRadius: 6,
              padding: "4px 10px",
            }}
          >
            <div
              style={{
                color: isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {displayedFlights.length} flights
              {layerVisibility.ships && ` · ${shipSceneRef.current?.getVisibleCount() ?? 0} ships`}
              {layerVisibility.rail && ` · ${activeTrains.length} trains`}
              {viewMode === "time-window" && " (±12h)"}
            </div>
            <div
              style={{
                color: isDarkTheme ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {cameraInfo.lat}, {cameraInfo.lng} z{cameraInfo.zoom} pitch {cameraInfo.pitch} bearing {cameraInfo.bearing}
            </div>
          </div>
        </>
      )}

      {/* ── 手機版 UI ── */}
      {!captureMode && isMobile && (
        <>
          {/* Compact Header */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 44,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              paddingTop: "env(safe-area-inset-top, 0px)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <span style={{ color: "#fff", fontSize: 14, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>
              MTP
            </span>

            <div style={{ flex: 1 }} />

            {loading && (
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace" }}>
                Loading...
              </span>
            )}

            <button
              onClick={() => setShowInfo(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Info
            </button>

            <button
              onClick={() => setCaptureMode(true)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              Capture
            </button>

            <button
              onClick={() => setRenderMode((m) => (m === "3d" ? "2d" : "3d"))}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                background: renderMode === "3d"
                  ? "rgba(80,140,255,0.25)"
                  : "rgba(255,170,68,0.25)",
                border: `1px solid ${renderMode === "3d" ? "rgba(80,140,255,0.5)" : "rgba(255,170,68,0.5)"}`,
                color: "#fff",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {renderMode === "3d" ? "3D" : "2D"}
            </button>
          </div>

          {/* Timeline */}
          <div
            style={{
              position: "absolute",
              top: 44,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <TimelineControls
              playing={timeline.playing}
              speed={timeline.speed}
              progress={timeline.progress}
              currentTime={timeline.currentTime}
              startTime={timeRange.start}
              endTime={timeRange.end}
              isDarkTheme={true}
              isMobile={true}
              onToggle={timeline.toggle}
              onSpeedChange={timeline.setSpeed}
              onSeekByProgress={timeline.seekByProgress}
            />
          </div>

          {/* Bottom Sheet */}
          <MobileBottomSheet isLandscape={isLandscape}>
            {(level) => (
              <>
                {(level === "half" || level === "full") && (
                  <div style={{ marginTop: 12 }}>
                    <LayerSidebar
                      visibility={layerVisibility}
                      expandedLayer={expandedLayer}
                      viewMode={viewMode}
                      displayMode={displayMode}
                      isDarkTheme={true}
                      isMobile={true}
                      counts={{
                        flights: displayedFlights.length,
                        ships: shipSceneRef.current?.getVisibleCount() ?? ships.length,
                        trains: activeTrains.length,
                      }}
                      onLayerClick={(layer) => {
                        const isVisible = layerVisibility[layer];
                        if (!isVisible) {
                          setLayerVisibility((prev) => ({ ...prev, [layer]: true }));
                          setExpandedLayer(layer as ExpandableLayerKey);
                        } else if (expandedLayer === layer) {
                          setExpandedLayer(null);
                        } else {
                          setExpandedLayer(layer as ExpandableLayerKey);
                        }
                      }}
                      onToggleVisibility={toggleVisibility}
                      onViewModeChange={setViewMode}
                      onDisplayModeChange={(mode) => { setDisplayMode(mode); setTooltipInfo(null); }}
                      onHideTransport={() => {
                        if (expandedLayer) {
                          setLayerVisibility((prev) => ({ ...prev, [expandedLayer]: false }));
                          setExpandedLayer(null);
                        }
                      }}
                      getControls={transportParams.getControls}
                    />
                  </div>
                )}

                {level === "full" && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace" }}>Style</span>
                      <StyleSelector
                        selected={mapStyleId}
                        isDarkTheme={true}
                        onChange={setMapStyleId}
                      />
                    </div>
                    <LocationJump
                      isDarkTheme={true}
                      currentId={selectedAirport}
                      onJump={(id) => {
                        const p = getPresetById(id);
                        if (p && mapRef.current) {
                          if (p.category === "airport") setSelectedAirport(p.id);
                          mapRef.current.flyTo({
                            center: p.center,
                            zoom: p.zoom,
                            pitch: p.pitch,
                            bearing: p.bearing,
                            duration: 2000,
                          });
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </MobileBottomSheet>
        </>
      )}

      {/* ── 飛機 Tooltip ── */}
      {tooltipInfo && (
        <div
          style={{
            position: "absolute",
            left: tooltipInfo.x + 12,
            top: tooltipInfo.y - 10,
            zIndex: 30,
            background: "rgba(10,10,20,0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(100,170,255,0.4)",
            borderRadius: 8,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: "monospace",
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
            {tooltipInfo.flight.callsign}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            {tooltipInfo.flight.origin_iata} → {tooltipInfo.flight.dest_iata}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            {tooltipInfo.flight.aircraft_type}
            {tooltipInfo.altitude != null && ` · ${tooltipInfo.altitude}m`}
          </div>
          <div style={{ fontSize: 10, color: "rgba(100,170,255,0.6)", marginTop: 4 }}>
            double-click to track
          </div>
        </div>
      )}

      {/* ── 列車 Tooltip ── */}
      {trainTooltipInfo && (
        <div
          style={{
            position: "absolute",
            left: trainTooltipInfo.x + 12,
            top: trainTooltipInfo.y - 10,
            zIndex: 30,
            background: "rgba(10,10,20,0.9)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${trainTooltipInfo.train.color}66`,
            borderRadius: 8,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: "monospace",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: trainTooltipInfo.train.color, letterSpacing: 1 }}>
            {trainTooltipInfo.train.trainId}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            {trainTooltipInfo.train.systemId.toUpperCase()} · {trainTooltipInfo.train.trackId}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            {trainTooltipInfo.train.status === "running" ? "行駛中" : "停靠中"}
            {trainTooltipInfo.train.trainTypeCode && ` · ${trainTooltipInfo.train.trainTypeCode}`}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            {trainTooltipInfo.train.position[0].toFixed(4)}, {trainTooltipInfo.train.position[1].toFixed(4)}
          </div>
        </div>
      )}

      {/* ── Info Modal ── */}
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} isMobile={isMobile} />
    </div>
  );
}
