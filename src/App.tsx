import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode } from "./types";
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

  flightsRef.current = displayedFlights;
  timeRef.current = timeline.currentTime;

  const preset = useMemo(
    () => getPresetByIcao(selectedAirport) ?? CAMERA_PRESETS[0]!,
    [selectedAirport],
  );

  const styleUrl = useMemo(() => getStyleUrl(mapStyleId), [mapStyleId]);

  const addFlightLayer = (map: MapboxMap) => {
    if (map.getLayer("flight-3d")) {
      map.removeLayer("flight-3d");
    }
    const layer = createFlightLayer(
      () => timeRef.current,
      () => flightsRef.current,
    );
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

      {/* 航班數統計 */}
      <div
        style={{
          position: "absolute",
          top: 84,
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
