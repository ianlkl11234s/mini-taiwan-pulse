import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode, RenderMode, DisplayMode, Flight, Ship, RailTrain, LayerVisibility } from "./types";
import type { FlightScene } from "./three/FlightScene";
import type { ShipScene } from "./three/ShipScene";
import type { RailScene } from "./three/RailScene";
import { MapView } from "./map/MapView";
import { useFlightData } from "./hooks/useFlightData";
import { useShipData } from "./hooks/useShipData";
import { useRailData } from "./hooks/useRailData";
import { useTimeline } from "./hooks/useTimeline";
import { useIsMobile } from "./hooks/useIsMobile";
import { CAMERA_PRESETS, getPresetByIcao, getAirportInfo } from "./map/cameraPresets";
import { createFlightLayer, createShipLayer, createRailLayer } from "./map/customLayer";
import { filterByAirport, filterByTimeWindow } from "./data/flightLoader";
import { RailEngine } from "./engines/RailEngine";
import { updateRailTracks, removeRailTracks } from "./map/railTracks";
import { AirportSelector } from "./components/AirportSelector";
import { FlightPicker } from "./components/FlightPicker";
import { TimelineControls } from "./components/TimelineControls";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";
import { MobileBottomSheet } from "./components/MobileBottomSheet";
import { LayerToggle } from "./components/LayerToggle";

const getSliderLabelStyle = (dark: boolean): React.CSSProperties => ({
  color: dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
  fontSize: 11,
  fontFamily: "monospace",
  display: "flex",
  alignItems: "center",
  gap: 4,
});
const getSliderStyle = (dark: boolean): React.CSSProperties => ({
  width: 60,
  height: 4,
  accentColor: dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
  cursor: "pointer",
});

export default function App() {
  const {
    allFlights,
    filteredFlights,
    airports,
    selectedAirport,
    setSelectedAirport,
    timeRange,
    loading,
  } = useFlightData();

  const { ships } = useShipData();
  const { railData } = useRailData();

  // 軌道列車引擎
  const railEngineRef = useRef<RailEngine | null>(null);
  const [activeTrains, setActiveTrains] = useState<RailTrain[]>([]);

  // 初始化 RailEngine
  useEffect(() => {
    if (railData) {
      railEngineRef.current = new RailEngine(railData.systems);
    }
  }, [railData]);

  // 圖層可見性
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    flights: true,
    ships: true,
    rail: true,
  });
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;

  const [viewMode, setViewMode] = useState<ViewMode>("airport");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [mapStyleId, setMapStyleId] = useState("dark");
  const [renderMode, setRenderMode] = useState<RenderMode>("3d");
  const [altExaggeration, setAltExaggeration] = useState(3);
  const [altOffset, setAltOffset] = useState(50);
  const [staticOpacity, setStaticOpacity] = useState(0.1);
  const [orbScale, setOrbScale] = useState(0.000005);
  const [airportOpacity, setAirportOpacity] = useState(0.12);
  const [airportGlow, setAirportGlow] = useState(0.8);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("trails");
  const [railAltOffset, setRailAltOffset] = useState(0);
  const [captureMode, setCaptureMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipInfo, setTooltipInfo] = useState<{ flight: Flight; x: number; y: number; altitude: number | null } | null>(null);
  const [cameraInfo, setCameraInfo] = useState({ lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 });
  const { isMobile, isLandscape } = useIsMobile();

  const timeline = useTimeline({
    startTime: timeRange.start,
    endTime: timeRange.end,
  });

  // 根據 viewMode 決定要顯示的航班
  const displayedFlights = useMemo(() => {
    switch (viewMode) {
      case "single":
        return selectedFlightId
          ? filteredFlights.filter((f) => f.fr24_id === selectedFlightId)
          : filteredFlights;
      case "all-taiwan":
        return allFlights;
      case "time-window":
        return filterByTimeWindow(
          allFlights,
          selectedAirport,
          timeline.currentTime,
        );
      case "airport":
      default:
        return filteredFlights;
    }
  }, [
    allFlights,
    filteredFlights,
    viewMode,
    selectedFlightId,
    selectedAirport,
    timeline.currentTime,
  ]);

  // 用於 FlightPicker 的航班列表（always based on airport filter）
  const pickableFlights = useMemo(
    () => filterByAirport(allFlights, selectedAirport),
    [allFlights, selectedAirport],
  );

  const isDarkTheme = !["light", "streets"].includes(mapStyleId);

  const mapRef = useRef<MapboxMap | null>(null);
  const flightsRef = useRef(displayedFlights);
  const timeRef = useRef(timeline.currentTime);
  const renderModeRef = useRef(renderMode);
  const altExagRef = useRef(altExaggeration);
  const altOffsetRef = useRef(altOffset);
  const staticOpacityRef = useRef(staticOpacity);
  const orbScaleRef = useRef(orbScale);
  const isDarkThemeRef = useRef(isDarkTheme);
  const showTrailsRef = useRef(displayMode === "trails");
  const flightSceneRef = useRef<FlightScene | null>(null);
  const shipSceneRef = useRef<ShipScene | null>(null);
  const railSceneRef = useRef<RailScene | null>(null);
  const shipsRef = useRef<Ship[]>(ships);
  const activeTrainsRef = useRef<RailTrain[]>(activeTrains);
  const railAltOffsetRef = useRef(railAltOffset);
  const railDataRef = useRef(railData);
  const clickBoundRef = useRef(false);

  flightsRef.current = displayedFlights;
  shipsRef.current = ships;
  activeTrainsRef.current = activeTrains;
  timeRef.current = timeline.currentTime;
  renderModeRef.current = renderMode;
  altExagRef.current = altExaggeration;
  altOffsetRef.current = altOffset;
  staticOpacityRef.current = staticOpacity;
  orbScaleRef.current = orbScale;
  isDarkThemeRef.current = isDarkTheme;
  showTrailsRef.current = displayMode === "trails";
  railAltOffsetRef.current = railAltOffset;
  railDataRef.current = railData;

  const showTrails = displayMode === "trails";

  const preset = useMemo(
    () => getPresetByIcao(selectedAirport) ?? CAMERA_PRESETS[0]!,
    [selectedAirport],
  );

  const styleUrl = useMemo(() => getStyleUrl(mapStyleId), [mapStyleId]);

  const addFlightLayer = (map: MapboxMap) => {
    if (map.getLayer("flight-3d")) {
      map.removeLayer("flight-3d");
    }
    const layer = createFlightLayer({
      getCurrentTime: () => timeRef.current,
      getFlights: () => flightsRef.current,
      getRenderMode: () => renderModeRef.current,
      getAltExaggeration: () => altExagRef.current,
      getAltOffset: () => altOffsetRef.current,
      getStaticOpacity: () => staticOpacityRef.current,
      getOrbScale: () => orbScaleRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getShowTrails: () => showTrailsRef.current,
      onSceneReady: (scene) => { flightSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addShipLayer = (map: MapboxMap) => {
    if (map.getLayer("ship-3d")) map.removeLayer("ship-3d");
    const layer = createShipLayer({
      getCurrentTime: () => timeRef.current,
      getShips: () => shipsRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => orbScaleRef.current,
      getMapBounds: () => {
        const b = map.getBounds();
        if (!b) return null;
        return {
          minLng: b.getWest(),
          maxLng: b.getEast(),
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
        };
      },
      onSceneReady: (scene) => { shipSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addRailLayer = (map: MapboxMap) => {
    if (map.getLayer("rail-3d")) map.removeLayer("rail-3d");
    const layer = createRailLayer({
      getTrains: () => activeTrainsRef.current,
      getCurrentTime: () => timeRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => orbScaleRef.current,
      getRailAltOffset: () => railAltOffsetRef.current,
      getTrackFeatures: () => railDataRef.current?.allTracks ?? null,
      onSceneReady: (scene) => { railSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const handleMapReady = (map: MapboxMap) => {
    mapRef.current = map;
    addFlightLayer(map);
    addShipLayer(map);
    addRailLayer(map);
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

    if (!clickBoundRef.current) {
      clickBoundRef.current = true;

      map.on("click", (e) => {
        const scene = flightSceneRef.current;
        if (!scene) { setTooltipInfo(null); return; }
        const container = map.getContainer();
        const flightId = scene.pickFlight(
          e.point.x, e.point.y,
          container.clientWidth, container.clientHeight,
        );
        if (flightId) {
          const flight = flightsRef.current.find((f) => f.fr24_id === flightId);
          if (flight) {
            let altitude: number | null = null;
            const t = timeRef.current;
            for (let i = flight.path.length - 1; i >= 0; i--) {
              if (flight.path[i]![3] <= t) { altitude = Math.round(flight.path[i]![2]); break; }
            }
            setTooltipInfo({ flight, x: e.point.x, y: e.point.y, altitude });
          }
        } else {
          setTooltipInfo(null);
        }
      });

      map.on("dblclick", (e) => {
        const scene = flightSceneRef.current;
        if (!scene) return;
        const container = map.getContainer();
        const flightId = scene.pickFlight(
          e.point.x, e.point.y,
          container.clientWidth, container.clientHeight,
        );
        if (flightId) {
          e.preventDefault();
          setViewMode("single");
          setSelectedFlightId(flightId);
          setTooltipInfo(null);
        }
      });

      map.on("move", () => setTooltipInfo(null));
    }
  };

  // 航班資料或模式變更時重建 layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addFlightLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport, viewMode, selectedFlightId]);

  // 每幀更新軌道列車
  useEffect(() => {
    if (!railEngineRef.current) return;
    let animId: number;
    const tick = () => {
      const engine = railEngineRef.current;
      if (engine) {
        const trains = engine.update(timeRef.current);
        activeTrainsRef.current = trains;
        setActiveTrains(trains);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [railData]);

  // 軌道靜態線
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (railData && layerVisibility.rail) {
      updateRailTracks(map, railData.allTracks, isDarkTheme);
    } else {
      removeRailTracks(map);
    }
  }, [railData, isDarkTheme, layerVisibility.rail]);

  // 圖層可見性 → add/remove layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (layerVisibility.flights && !map.getLayer("flight-3d")) {
      addFlightLayer(map);
    } else if (!layerVisibility.flights && map.getLayer("flight-3d")) {
      map.removeLayer("flight-3d");
    }

    if (layerVisibility.ships && !map.getLayer("ship-3d")) {
      addShipLayer(map);
    } else if (!layerVisibility.ships && map.getLayer("ship-3d")) {
      map.removeLayer("ship-3d");
    }

    if (layerVisibility.rail && !map.getLayer("rail-3d")) {
      addRailLayer(map);
    } else if (!layerVisibility.rail && map.getLayer("rail-3d")) {
      map.removeLayer("rail-3d");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerVisibility]);

  // Track Single 模式：相機鎖定飛機，飛機固定在畫面中央
  useEffect(() => {
    if (viewMode !== "single" || !selectedFlightId) return;
    const map = mapRef.current;
    if (!map) return;

    let animId: number;
    const tick = () => {
      const flight = flightsRef.current.find((f) => f.fr24_id === selectedFlightId);
      if (flight && flight.path.length > 0) {
        const t = timeRef.current;
        const path = flight.path;
        // 線性插值取得精確位置
        let lat: number, lng: number;
        if (t <= path[0]![3]) {
          lat = path[0]![0]; lng = path[0]![1];
        } else if (t >= path[path.length - 1]![3]) {
          lat = path[path.length - 1]![0]; lng = path[path.length - 1]![1];
        } else {
          lat = path[0]![0]; lng = path[0]![1];
          for (let i = 1; i < path.length; i++) {
            if (path[i]![3] >= t) {
              const a = path[i - 1]!;
              const b = path[i]!;
              const r = (t - a[3]) / (b[3] - a[3]);
              lat = a[0] + (b[0] - a[0]) * r;
              lng = a[1] + (b[1] - a[1]) * r;
              break;
            }
          }
        }
        map.setCenter([lng, lat]);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [viewMode, selectedFlightId]);

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
          Taiwan Flight Arc
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
        airportOpacity={airportOpacity}
        airportGlow={airportGlow}
        isDarkTheme={isDarkTheme}
        showTrails={showTrails}
        onMapReady={handleMapReady}
      />

      {/* ── 拍攝模式 vignette + 標題 ── */}
      {captureMode && (
        <>
          {/* 暗角 vignette */}
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
          {/* 左上標題 */}
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
              Taiwan Flight Arc
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
              {(() => {
                const info = getAirportInfo(selectedAirport);
                return info
                  ? `${info.name} / ${info.iata} / ${selectedAirport}`
                  : selectedAirport;
              })()}
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
          {/* 退出按鈕 */}
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
          {/* 頂部控制列 */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
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
              Taiwan Flight Arc
            </h1>

            <AirportSelector
              airports={airports}
              selected={selectedAirport}
              isDarkTheme={isDarkTheme}
              onChange={setSelectedAirport}
            />

            <StyleSelector
              selected={mapStyleId}
              isDarkTheme={isDarkTheme}
              onChange={setMapStyleId}
            />

            {loading && (
              <span style={{ color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", fontSize: 13 }}>
                Loading...
              </span>
            )}
          </div>

          {/* 第二列：Display Mode 切換 + Layer Toggle */}
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 16,
              zIndex: 10,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            {(["trails", "status"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setDisplayMode(mode); setTooltipInfo(null); }}
                style={{
                  background: displayMode === mode
                    ? (isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)")
                    : (isDarkTheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)"),
                  color: isDarkTheme ? "#fff" : "#333",
                  border: `1px solid ${displayMode === mode
                    ? (isDarkTheme ? "rgba(100,170,255,0.6)" : "rgba(100,170,255,0.5)")
                    : (isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)")}`,
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                }}
              >
                {mode === "trails" ? "Flight Trails" : "Live Status"}
              </button>
            ))}

            <span style={{ color: isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)", margin: "0 2px" }}>|</span>

            <LayerToggle
              visibility={layerVisibility}
              isDarkTheme={isDarkTheme}
              counts={{
                flights: displayedFlights.length,
                ships: shipSceneRef.current?.getVisibleCount() ?? ships.length,
                trains: activeTrains.length,
              }}
              onChange={(layer) =>
                setLayerVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))
              }
            />
          </div>

          {/* 第三列：模式選擇 */}
          <div
            style={{
              position: "absolute",
              top: 84,
              left: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <FlightPicker
              flights={pickableFlights}
              viewMode={viewMode}
              selectedFlightId={selectedFlightId}
              isDarkTheme={isDarkTheme}
              onViewModeChange={setViewMode}
              onFlightSelect={setSelectedFlightId}
            />
          </div>

          {/* 第四列：視覺參數調整 */}
          <div
            style={{
              position: "absolute",
              top: 116,
              left: 16,
              zIndex: 10,
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Alt ×{altExaggeration.toFixed(1)}
              <input type="range" min={1} max={5} step={0.5} value={altExaggeration}
                onChange={(e) => setAltExaggeration(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Z +{altOffset}m
              <input type="range" min={0} max={200} step={50} value={altOffset}
                onChange={(e) => setAltOffset(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Opacity {staticOpacity.toFixed(2)}
              <input type="range" min={0.02} max={0.5} step={0.02} value={staticOpacity}
                onChange={(e) => setStaticOpacity(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Orb {(orbScale * 100000).toFixed(1)}
              <input type="range" min={0.000001} max={0.00001} step={0.000001} value={orbScale}
                onChange={(e) => setOrbScale(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <span style={{ color: isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)", margin: "0 2px" }}>|</span>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              APT {airportOpacity.toFixed(2)}
              <input type="range" min={0} max={0.3} step={0.01} value={airportOpacity}
                onChange={(e) => setAirportOpacity(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Glow {airportGlow.toFixed(1)}
              <input type="range" min={0} max={2} step={0.1} value={airportGlow}
                onChange={(e) => setAirportGlow(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
            <span style={{ color: isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)", margin: "0 2px" }}>|</span>
            <label style={getSliderLabelStyle(isDarkTheme)}>
              Rail Z +{railAltOffset}m
              <input type="range" min={0} max={500} step={10} value={railAltOffset}
                onChange={(e) => setRailAltOffset(Number(e.target.value))} style={getSliderStyle(isDarkTheme)} />
            </label>
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

          {/* 右上角第二排：Info / Github / Threads / Mini Taiwan */}
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
            <a
              href="https://github.com/ianlkl11234s/flight-arc-graph"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                color: isDarkTheme ? "#fff" : "#333",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
              title="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
            <a
              href="https://www.threads.com/@ianlkl1314"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                color: isDarkTheme ? "#fff" : "#333",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
              title="Threads"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.784 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.346-.789-.96-1.42-1.744-1.838.164 3.1-1.063 5.453-3.693 5.453-1.602 0-2.97-.767-3.652-2.048-.585-1.098-.63-2.545.013-3.878.926-1.916 3.083-2.878 5.29-2.472.1-.612.133-1.266.08-1.952l2.036-.244c.083.87.06 1.693-.06 2.455 1.038.497 1.892 1.2 2.494 2.1.864 1.29 1.196 2.86.96 4.539-.32 2.28-1.462 4.1-3.298 5.272C15.692 23.347 13.718 24 12.186 24zm.512-7.17c.828 0 1.474-.31 1.858-.892.532-.806.56-2.04-.02-2.834-.328-.21-.702-.382-1.126-.506-.078 1.072-.29 2.089-.648 2.983-.137.343-.5 1.25.064 1.25h-.128z"/>
              </svg>
            </a>
            <a
              href="https://mini-taiwan-learning-project.zeabur.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                color: isDarkTheme ? "#fff" : "#333",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                fontSize: 9,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: -0.5,
              }}
              title="Mini Taiwan"
            >
              TW
            </a>
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
              top: 144,
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
              {viewMode === "all-taiwan" && " (all Taiwan)"}
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
            <AirportSelector
              airports={airports}
              selected={selectedAirport}
              isDarkTheme={true}
              onChange={setSelectedAirport}
            />

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

          {/* Timeline 固定在 header 下方 */}
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
                {/* half: FlightPicker + Stats */}
                {(level === "half" || level === "full") && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {(["trails", "status"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => { setDisplayMode(mode); setTooltipInfo(null); }}
                          style={{
                            background: displayMode === mode
                              ? "rgba(100,170,255,0.3)" : "rgba(0,0,0,0.6)",
                            color: "#fff",
                            border: `1px solid ${displayMode === mode
                              ? "rgba(100,170,255,0.6)" : "rgba(255,255,255,0.2)"}`,
                            borderRadius: 4,
                            padding: "8px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {mode === "trails" ? "Flight Trails" : "Live Status"}
                        </button>
                      ))}
                    </div>
                    <FlightPicker
                      flights={pickableFlights}
                      viewMode={viewMode}
                      selectedFlightId={selectedFlightId}
                      isDarkTheme={true}
                      isMobile={true}
                      onViewModeChange={setViewMode}
                      onFlightSelect={setSelectedFlightId}
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    >
                      {displayedFlights.length} flights
                      {layerVisibility.ships && ` · ${shipSceneRef.current?.getVisibleCount() ?? 0} ships`}
                      {layerVisibility.rail && ` · ${activeTrains.length} trains`}
                      {viewMode === "time-window" && " (±12h)"}
                      {viewMode === "all-taiwan" && " (all Taiwan)"}
                    </div>
                  </div>
                )}

                {/* full: Sliders + StyleSelector */}
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: `Alt ×${altExaggeration.toFixed(1)}`, min: 1, max: 5, step: 0.5, value: altExaggeration, set: setAltExaggeration },
                        { label: `Z +${altOffset}m`, min: 0, max: 200, step: 50, value: altOffset, set: setAltOffset },
                        { label: `Opacity ${staticOpacity.toFixed(2)}`, min: 0.02, max: 0.5, step: 0.02, value: staticOpacity, set: setStaticOpacity },
                        { label: `Orb ${(orbScale * 100000).toFixed(1)}`, min: 0.000001, max: 0.00001, step: 0.000001, value: orbScale, set: setOrbScale },
                        { label: `APT ${airportOpacity.toFixed(2)}`, min: 0, max: 0.3, step: 0.01, value: airportOpacity, set: setAirportOpacity },
                        { label: `Glow ${airportGlow.toFixed(1)}`, min: 0, max: 2, step: 0.1, value: airportGlow, set: setAirportGlow },
                        { label: `Rail Z +${railAltOffset}m`, min: 0, max: 500, step: 10, value: railAltOffset, set: setRailAltOffset },
                      ].map((s) => (
                        <label key={s.label} style={{
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 11,
                          fontFamily: "monospace",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}>
                          <span style={{ minWidth: 90 }}>{s.label}</span>
                          <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                            onChange={(e) => s.set(Number(e.target.value))}
                            style={{ flex: 1, height: 6, accentColor: "rgba(255,255,255,0.6)" }} />
                        </label>
                      ))}
                    </div>
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

      {/* ── Info 面板 ── */}
      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
              background: "rgba(20,20,30,0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: isMobile ? "24px 20px" : "32px 36px",
              color: "#fff",
              fontFamily: "monospace",
            }}
          >
            <button
              onClick={() => setShowInfo(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>

            <h2 style={{ margin: "0 0 16px", fontSize: 20, letterSpacing: 2 }}>
              Taiwan Flight Arc
            </h2>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>ABOUT</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.8)", margin: 0 }}>
                台灣航班弧線視覺化 — 以 3D 弧線呈現台灣各機場的航班軌跡，
                資料來源為 Flightradar24 API，透過 Mapbox GL 繪製於互動地圖上。
              </p>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>PARAMETERS</h3>
              <ul style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: 0, paddingLeft: 18 }}>
                <li><b>Alt ×</b> — 高度誇張倍率，數值越大弧線越高聳</li>
                <li><b>Z offset</b> — 基礎海拔偏移（公尺），避免弧線貼地</li>
                <li><b>Opacity</b> — 靜態航線透明度</li>
                <li><b>Orb</b> — 飛行光球大小</li>
                <li><b>APT</b> — 機場區域底色透明度</li>
                <li><b>Glow</b> — 機場光暈強度</li>
              </ul>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "12px 0 6px", letterSpacing: 1 }}>CAMERA</h3>
              <ul style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: 0, paddingLeft: 18 }}>
                <li><b>Pitch</b> — 相機俯仰角（0° 正俯視，90° 水平視角）</li>
                <li><b>Bearing</b> — 相機方位角（0° 朝北，正值順時針旋轉）</li>
                <li><b>Zoom</b> — 地圖縮放層級</li>
              </ul>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>DISPLAY MODES</h3>
              <ul style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: 0, paddingLeft: 18 }}>
                <li><b>Flight Trails</b> — 顯示完整航線軌跡 + 動態光球（預設）</li>
                <li><b>Live Status</b> — 隱藏完整航線，只保留飛機動態尾跡與光球</li>
              </ul>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>VIEW MODES</h3>
              <ul style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: 0, paddingLeft: 18 }}>
                <li><b>This Airport</b> — 顯示選定機場的所有航班</li>
                <li><b>All Taiwan</b> — 顯示全台灣所有航班</li>
                <li><b>±12h Window</b> — 以當前時間為中心的 24 小時窗口</li>
                <li><b>Track Single</b> — 追蹤單一航班，相機鎖定飛機在畫面中央跟隨移動</li>
              </ul>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>INTERACTION</h3>
              <ul style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: 0, paddingLeft: 18 }}>
                <li><b>Click</b> — 點擊飛機光球顯示航班資訊（航班號、路線、機型、高度）</li>
                <li><b>Double-click</b> — 雙擊飛機光球直接進入 Track Single 跟隨模式</li>
              </ul>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 6px", letterSpacing: 1 }}>DIY</h3>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                想自己做？Clone GitHub repo，準備 Mapbox token，
                放入 FR24 航班 JSON 資料即可。詳見 README。
              </p>
            </section>

            <section>
              <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 8px", letterSpacing: 1 }}>LINKS</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="https://github.com/ianlkl11234s/flight-arc-graph" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#66aaff", textDecoration: "none" }}>
                  GitHub
                </a>
                <a href="https://www.threads.com/@ianlkl1314" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#66aaff", textDecoration: "none" }}>
                  Threads
                </a>
                <a href="https://mini-taiwan-learning-project.zeabur.app/" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#66aaff", textDecoration: "none" }}>
                  Mini Taiwan
                </a>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
