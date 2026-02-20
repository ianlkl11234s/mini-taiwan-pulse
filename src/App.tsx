import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode } from "./types";
import { MapView } from "./map/MapView";
import { useFlightData } from "./hooks/useFlightData";
import { useTimeline } from "./hooks/useTimeline";
import { CAMERA_PRESETS, getPresetByIcao } from "./map/cameraPresets";
import { createFlightLayer } from "./map/customLayer";
import { AirportSelector } from "./components/AirportSelector";
import { FlightPicker } from "./components/FlightPicker";
import { TimelineControls } from "./components/TimelineControls";

export default function App() {
  const {
    filteredFlights,
    airports,
    selectedAirport,
    setSelectedAirport,
    timeRange,
    loading,
  } = useFlightData();

  const [viewMode, setViewMode] = useState<ViewMode>("overlay");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  const timeline = useTimeline({
    startTime: timeRange.start,
    endTime: timeRange.end,
  });

  // 根據 viewMode 決定要顯示的航班
  const displayedFlights = useMemo(() => {
    if (viewMode === "single" && selectedFlightId) {
      return filteredFlights.filter((f) => f.fr24_id === selectedFlightId);
    }
    return filteredFlights;
  }, [filteredFlights, viewMode, selectedFlightId]);

  const mapRef = useRef<MapboxMap | null>(null);
  const flightsRef = useRef(displayedFlights);
  const timeRef = useRef(timeline.currentTime);

  flightsRef.current = displayedFlights;
  timeRef.current = timeline.currentTime;

  const preset = useMemo(
    () => getPresetByIcao(selectedAirport) ?? CAMERA_PRESETS[0]!,
    [selectedAirport],
  );

  const handleMapReady = (map: MapboxMap) => {
    mapRef.current = map;
    const layer = createFlightLayer(
      () => timeRef.current,
      () => flightsRef.current,
    );
    map.addLayer(layer);
  };

  // 航班資料變更時重建 layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("flight-3d")) {
      map.removeLayer("flight-3d");
    }
    const layer = createFlightLayer(
      () => timeRef.current,
      () => flightsRef.current,
    );
    map.addLayer(layer);
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
      <MapView preset={preset} onMapReady={handleMapReady} />

      {/* 頂部控制列 */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          gap: 12,
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

        <FlightPicker
          flights={filteredFlights}
          viewMode={viewMode}
          selectedFlightId={selectedFlightId}
          onViewModeChange={setViewMode}
          onFlightSelect={setSelectedFlightId}
        />

        {loading && (
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Loading...
          </span>
        )}
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
          top: 56,
          left: 16,
          zIndex: 10,
          color: "rgba(255,255,255,0.4)",
          fontSize: 11,
          fontFamily: "monospace",
        }}
      >
        {displayedFlights.length} / {filteredFlights.length} flights
      </div>
    </div>
  );
}
