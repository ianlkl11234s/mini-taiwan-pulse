import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode, RenderMode } from "./types";
import { MapView } from "./map/MapView";
import { useFlightData } from "./hooks/useFlightData";
import { useTimeline } from "./hooks/useTimeline";
import { CAMERA_PRESETS, getPresetByIcao } from "./map/cameraPresets";
import { createFlightLayer } from "./map/customLayer";
import { filterByAirport, filterByTimeWindow } from "./data/flightLoader";
import { AirportSelector } from "./components/AirportSelector";
import { FlightPicker } from "./components/FlightPicker";
import { TimelineControls } from "./components/TimelineControls";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";

const sliderLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.6)",
  fontSize: 11,
  fontFamily: "monospace",
  display: "flex",
  alignItems: "center",
  gap: 4,
};
const sliderStyle: React.CSSProperties = {
  width: 60,
  height: 4,
  accentColor: "rgba(255,255,255,0.6)",
  cursor: "pointer",
};

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
  const [altOffset, setAltOffset] = useState(0);
  const [staticOpacity, setStaticOpacity] = useState(0.2);
  const [orbScale, setOrbScale] = useState(0.000005);
  const [airportOpacity, setAirportOpacity] = useState(0.12);
  const [airportGlow, setAirportGlow] = useState(0.8);

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

  const mapRef = useRef<MapboxMap | null>(null);
  const flightsRef = useRef(displayedFlights);
  const timeRef = useRef(timeline.currentTime);
  const renderModeRef = useRef(renderMode);
  const altExagRef = useRef(altExaggeration);
  const altOffsetRef = useRef(altOffset);
  const staticOpacityRef = useRef(staticOpacity);
  const orbScaleRef = useRef(orbScale);

  flightsRef.current = displayedFlights;
  timeRef.current = timeline.currentTime;
  renderModeRef.current = renderMode;
  altExagRef.current = altExaggeration;
  altOffsetRef.current = altOffset;
  staticOpacityRef.current = staticOpacity;
  orbScaleRef.current = orbScale;

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
        onMapReady={handleMapReady}
      />

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
            color: "#fff",
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          plan-art
        </h1>

        <AirportSelector
          airports={airports}
          selected={selectedAirport}
          onChange={setSelectedAirport}
        />

        <StyleSelector
          selected={mapStyleId}
          onChange={setMapStyleId}
        />

        {loading && (
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
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
        {/* 高度倍率 */}
        <label style={sliderLabelStyle}>
          Alt ×{altExaggeration.toFixed(1)}
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={altExaggeration}
            onChange={(e) => setAltExaggeration(Number(e.target.value))}
            style={sliderStyle}
          />
        </label>

        {/* Z 偏移 */}
        <label style={sliderLabelStyle}>
          Z +{altOffset}m
          <input
            type="range"
            min={0}
            max={2000}
            step={100}
            value={altOffset}
            onChange={(e) => setAltOffset(Number(e.target.value))}
            style={sliderStyle}
          />
        </label>

        {/* 軌跡不透明度 */}
        <label style={sliderLabelStyle}>
          Opacity {staticOpacity.toFixed(2)}
          <input
            type="range"
            min={0.02}
            max={0.5}
            step={0.02}
            value={staticOpacity}
            onChange={(e) => setStaticOpacity(Number(e.target.value))}
            style={sliderStyle}
          />
        </label>

        {/* 光球大小 */}
        <label style={sliderLabelStyle}>
          Orb {(orbScale * 100000).toFixed(1)}
          <input
            type="range"
            min={0.000001}
            max={0.00001}
            step={0.000001}
            value={orbScale}
            onChange={(e) => setOrbScale(Number(e.target.value))}
            style={sliderStyle}
          />
        </label>

        <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 2px" }}>|</span>

        {/* 機場填充不透明度 */}
        <label style={sliderLabelStyle}>
          APT {airportOpacity.toFixed(2)}
          <input
            type="range"
            min={0}
            max={0.3}
            step={0.01}
            value={airportOpacity}
            onChange={(e) => setAirportOpacity(Number(e.target.value))}
            style={sliderStyle}
          />
        </label>

        {/* 機場光暈 */}
        <label style={sliderLabelStyle}>
          Glow {airportGlow.toFixed(1)}
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={airportGlow}
            onChange={(e) => setAirportGlow(Number(e.target.value))}
            style={sliderStyle}
          />
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
        onToggle={timeline.toggle}
        onSpeedChange={timeline.setSpeed}
        onSeekByProgress={timeline.seekByProgress}
      />

      {/* 右上角：渲染模式切換 */}
      <button
        onClick={() => setRenderMode((m) => (m === "3d" ? "2d" : "3d"))}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          padding: "6px 14px",
          background: renderMode === "3d" ? "rgba(80,140,255,0.25)" : "rgba(255,170,68,0.25)",
          border: `1px solid ${renderMode === "3d" ? "rgba(80,140,255,0.5)" : "rgba(255,170,68,0.5)"}`,
          borderRadius: 6,
          color: "#fff",
          fontSize: 12,
          fontFamily: "monospace",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          letterSpacing: 1,
        }}
      >
        {renderMode === "3d" ? "3D Altitude" : "2D Flat"}
      </button>

      {/* 航班數統計 */}
      <div
        style={{
          position: "absolute",
          top: 112,
          left: 16,
          zIndex: 10,
          color: "rgba(255,255,255,0.4)",
          fontSize: 11,
          fontFamily: "monospace",
        }}
      >
        {displayedFlights.length} flights
        {viewMode === "time-window" && " (±12h)"}
        {viewMode === "all-taiwan" && " (all Taiwan)"}
      </div>
    </div>
  );
}
