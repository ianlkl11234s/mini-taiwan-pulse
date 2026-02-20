import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode, RenderMode } from "./types";
import { MapView } from "./map/MapView";
import { useFlightData } from "./hooks/useFlightData";
import { useTimeline } from "./hooks/useTimeline";
import { CAMERA_PRESETS, getPresetByIcao, getAirportInfo } from "./map/cameraPresets";
import { createFlightLayer } from "./map/customLayer";
import { filterByAirport, filterByTimeWindow } from "./data/flightLoader";
import { AirportSelector } from "./components/AirportSelector";
import { FlightPicker } from "./components/FlightPicker";
import { TimelineControls } from "./components/TimelineControls";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";

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

  const [viewMode, setViewMode] = useState<ViewMode>("airport");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [mapStyleId, setMapStyleId] = useState("dark");
  const [renderMode, setRenderMode] = useState<RenderMode>("3d");
  const [altExaggeration, setAltExaggeration] = useState(3);
  const [altOffset, setAltOffset] = useState(50);
  const [staticOpacity, setStaticOpacity] = useState(0.2);
  const [orbScale, setOrbScale] = useState(0.000005);
  const [airportOpacity, setAirportOpacity] = useState(0.12);
  const [airportGlow, setAirportGlow] = useState(0.8);
  const [captureMode, setCaptureMode] = useState(false);

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

  flightsRef.current = displayedFlights;
  timeRef.current = timeline.currentTime;
  renderModeRef.current = renderMode;
  altExagRef.current = altExaggeration;
  altOffsetRef.current = altOffset;
  staticOpacityRef.current = staticOpacity;
  orbScaleRef.current = orbScale;
  isDarkThemeRef.current = isDarkTheme;

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
    });
    map.addLayer(layer);
  };

  const handleMapReady = (map: MapboxMap) => {
    mapRef.current = map;
    addFlightLayer(map);
  };

  // 航班資料或模式變更時重建 layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addFlightLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport, viewMode, selectedFlightId]);

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
              top: 32,
              left: 32,
              zIndex: 21,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: 4,
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
          </div>
          {/* 右下退出提示 */}
          <button
            onClick={() => setCaptureMode(false)}
            style={{
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
            ESC
          </button>
        </>
      )}

      {/* ── 一般模式 UI ── */}
      {!captureMode && (
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

          {/* 第二列：模式選擇 */}
          <div
            style={{
              position: "absolute",
              top: 52,
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

          {/* 第三列：視覺參數調整 */}
          <div
            style={{
              position: "absolute",
              top: 84,
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

          {/* 航班數統計 */}
          <div
            style={{
              position: "absolute",
              top: 112,
              left: 16,
              zIndex: 10,
              color: isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {displayedFlights.length} flights
            {viewMode === "time-window" && " (±12h)"}
            {viewMode === "all-taiwan" && " (all Taiwan)"}
          </div>
        </>
      )}
    </div>
  );
}
