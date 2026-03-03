import { useMemo, useRef, useState } from "react";
import type { ExpandableLayerKey } from "../types";

export interface SliderConfig {
  type?: "slider";
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

export interface ToggleConfig {
  type: "toggle";
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export interface SelectConfig {
  type: "select";
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

export type ParamControl = SliderConfig | ToggleConfig | SelectConfig;

export function useTransportParams() {
  // Flight
  const [altExaggeration, setAltExaggeration] = useState(3);
  const [altOffset, setAltOffset] = useState(50);
  const [staticOpacity, setStaticOpacity] = useState(0.1);
  const [orbScale, setOrbScale] = useState(0.000005);
  const [airportOpacity, setAirportOpacity] = useState(0.12);
  const [airportGlow, setAirportGlow] = useState(0.8);
  // Ship
  const [shipOrbScale, setShipOrbScale] = useState(0.000003);
  const [shipTrailOpacity, setShipTrailOpacity] = useState(0.15);
  // Rail
  const [railAltOffset, setRailAltOffset] = useState(110);
  const [railOrbScale, setRailOrbScale] = useState(0.00001);
  const [railTrackOpacity, setRailTrackOpacity] = useState(0.35);
  const [railTrainVisible, setRailTrainVisible] = useState(true);
  const [railTrackMode, setRailTrackMode] = useState<"2d" | "3d">("3d");
  const [stationScale, setStationScale] = useState(1);
  // Bus
  const [busScale, setBusScale] = useState(0.4);
  // Bike
  const [bikeScale, setBikeScale] = useState(1);
  // Cycling
  const [cyclingWidth, setCyclingWidth] = useState(1);
  // Freeway
  const [freewayWidth, setFreewayWidth] = useState(1);
  // Weather
  const [weatherScale, setWeatherScale] = useState(1);
  // Population Flow (H3)
  const [h3Opacity, setH3Opacity] = useState(0.6);
  const [h3Extruded, setH3Extruded] = useState(false);
  const [h3ElevationScale, setH3ElevationScale] = useState(50);
  const [h3Metric, setH3Metric] = useState<"day" | "night">("day");
  const [h3Contrast, setH3Contrast] = useState(1.8);
  // Population Count (SEGIS)
  const [pcOpacity, setPcOpacity] = useState(0.6);
  const [pcContrast, setPcContrast] = useState(1.8);
  const [pcExtruded, setPcExtruded] = useState(false);
  const [pcElevationScale, setPcElevationScale] = useState(50);
  // Population Indicators (SEGIS)
  const [indCategory, setIndCategory] = useState("count");
  const [indMetric, setIndMetric] = useState("hh");
  const [indOpacity, setIndOpacity] = useState(0.6);
  const [indContrast, setIndContrast] = useState(1.8);
  const [indExtruded, setIndExtruded] = useState(false);
  const [indElevationScale, setIndElevationScale] = useState(50);
  // Lighthouse
  const [lighthouseScale, setLighthouseScale] = useState(0.6);
  const [beamVisible, setBeamVisible] = useState(true);
  const [beamDistance, setBeamDistance] = useState(0.9);
  const [beamOpacity, setBeamOpacity] = useState(0.1);
  // Station pillar — 3 systems
  const [thsrPillarVisible, setThsrPillarVisible] = useState(true);
  const [thsrPillarHeight, setThsrPillarHeight] = useState(0.6);
  const [traPillarVisible, setTraPillarVisible] = useState(true);
  const [traPillarHeight, setTraPillarHeight] = useState(0.5);
  const [metroPillarVisible, setMetroPillarVisible] = useState(false);
  const [metroPillarHeight, setMetroPillarHeight] = useState(0.2);
  // Highway (國道)
  const [highwayWidth, setHighwayWidth] = useState(0.6);
  const [highwayGlow, setHighwayGlow] = useState(0.3);
  // Provincial Road (省道)
  const [provincialWidth, setProvincialWidth] = useState(0.6);
  const [provincialGlow, setProvincialGlow] = useState(0.2);
  // Port pillar (碼頭)
  const [portGlow, setPortGlow] = useState(1);
  const [portPillarVisible, setPortPillarVisible] = useState(false);
  const [portPillarHeight, setPortPillarHeight] = useState(0.3);
  // Airport pillar (機場)
  const [airportPillarVisible, setAirportPillarVisible] = useState(false);
  const [airportPillarHeight, setAirportPillarHeight] = useState(0.6);
  // Temperature Wave (溫度波浪)
  const [tempHeight, setTempHeight] = useState(200);
  const [tempZOffset, setTempZOffset] = useState(300);
  const [tempExtruded, setTempExtruded] = useState(true);
  const [tempOpacity, setTempOpacity] = useState(0.85);
  const [tempWireframe, setTempWireframe] = useState(false);

  // Mirror refs for Three.js render loops
  const altExagRef = useRef(altExaggeration);
  const altOffsetRef = useRef(altOffset);
  const staticOpacityRef = useRef(staticOpacity);
  const orbScaleRef = useRef(orbScale);
  const shipOrbScaleRef = useRef(shipOrbScale);
  const shipTrailOpacityRef = useRef(shipTrailOpacity);
  const railAltOffsetRef = useRef(railAltOffset);
  const railOrbScaleRef = useRef(railOrbScale);
  const railTrackOpacityRef = useRef(railTrackOpacity);
  const railTrainVisibleRef = useRef(railTrainVisible);
  const railTrackModeRef = useRef(railTrackMode);
  const beamVisibleRef = useRef(beamVisible);
  const beamDistanceRef = useRef(beamDistance);
  const beamOpacityRef = useRef(beamOpacity);
  const thsrPillarVisibleRef = useRef(thsrPillarVisible);
  const thsrPillarHeightRef = useRef(thsrPillarHeight);
  const traPillarVisibleRef = useRef(traPillarVisible);
  const traPillarHeightRef = useRef(traPillarHeight);
  const metroPillarVisibleRef = useRef(metroPillarVisible);
  const metroPillarHeightRef = useRef(metroPillarHeight);
  const portPillarVisibleRef = useRef(portPillarVisible);
  const portPillarHeightRef = useRef(portPillarHeight);
  const airportPillarVisibleRef = useRef(airportPillarVisible);
  const airportPillarHeightRef = useRef(airportPillarHeight);
  const tempHeightRef = useRef(tempHeight);
  const tempZOffsetRef = useRef(tempZOffset);
  const tempExtrudedRef = useRef(tempExtruded);
  const tempOpacityRef = useRef(tempOpacity);
  const tempWireframeRef = useRef(tempWireframe);

  altExagRef.current = altExaggeration;
  altOffsetRef.current = altOffset;
  staticOpacityRef.current = staticOpacity;
  orbScaleRef.current = orbScale;
  shipOrbScaleRef.current = shipOrbScale;
  shipTrailOpacityRef.current = shipTrailOpacity;
  railAltOffsetRef.current = railAltOffset;
  railOrbScaleRef.current = railOrbScale;
  railTrackOpacityRef.current = railTrackOpacity;
  railTrainVisibleRef.current = railTrainVisible;
  railTrackModeRef.current = railTrackMode;
  beamVisibleRef.current = beamVisible;
  beamDistanceRef.current = beamDistance;
  beamOpacityRef.current = beamOpacity;
  thsrPillarVisibleRef.current = thsrPillarVisible;
  thsrPillarHeightRef.current = thsrPillarHeight;
  traPillarVisibleRef.current = traPillarVisible;
  traPillarHeightRef.current = traPillarHeight;
  metroPillarVisibleRef.current = metroPillarVisible;
  metroPillarHeightRef.current = metroPillarHeight;
  portPillarVisibleRef.current = portPillarVisible;
  portPillarHeightRef.current = portPillarHeight;
  airportPillarVisibleRef.current = airportPillarVisible;
  airportPillarHeightRef.current = airportPillarHeight;
  tempHeightRef.current = tempHeight;
  tempZOffsetRef.current = tempZOffset;
  tempExtrudedRef.current = tempExtruded;
  tempOpacityRef.current = tempOpacity;
  tempWireframeRef.current = tempWireframe;

  const overlayParams = useMemo<Record<string, number>>(() => ({
    stationScale,
    airportOpacity,
    airportGlow,
    busScale,
    bikeScale,
    lighthouseScale,
    cyclingWidth,
    freewayWidth,
    weatherScale,
    highwayWidth,
    highwayGlow,
    provincialWidth,
    provincialGlow,
    portGlow,
  }), [stationScale, airportOpacity, airportGlow, busScale, bikeScale, lighthouseScale, cyclingWidth, freewayWidth, weatherScale, highwayWidth, highwayGlow, provincialWidth, provincialGlow, portGlow]);

  const getControls = (layer: ExpandableLayerKey): ParamControl[] => {
    switch (layer) {
      case "flights": return [
        { label: `Alt ×${altExaggeration.toFixed(1)}`, value: altExaggeration, min: 1, max: 5, step: 0.5, onChange: setAltExaggeration },
        { label: `Z +${altOffset}m`, value: altOffset, min: 0, max: 200, step: 50, onChange: setAltOffset },
        { label: `Opacity ${staticOpacity.toFixed(2)}`, value: staticOpacity, min: 0.02, max: 0.5, step: 0.02, onChange: setStaticOpacity },
        { label: `Orb ${(orbScale * 100000).toFixed(1)}`, value: orbScale, min: 0.000001, max: 0.00001, step: 0.000001, onChange: setOrbScale },
      ];
      case "ships": return [
        { label: `Ship Orb ${(shipOrbScale * 100000).toFixed(1)}`, value: shipOrbScale, min: 0.000001, max: 0.00002, step: 0.000001, onChange: setShipOrbScale },
        { label: `Ship Trail ${shipTrailOpacity.toFixed(2)}`, value: shipTrailOpacity, min: 0.05, max: 1, step: 0.05, onChange: setShipTrailOpacity },
      ];
      case "rail": return [
        { type: "toggle" as const, label: "Train", value: railTrainVisible, onChange: setRailTrainVisible },
        { type: "select" as const, label: "Track", value: railTrackMode, options: [{ label: "2D", value: "2d" }, { label: "3D", value: "3d" }], onChange: (v: string) => setRailTrackMode(v as "2d" | "3d") },
        { label: `Rail Z +${railAltOffset}m`, value: railAltOffset, min: 0, max: 500, step: 10, onChange: setRailAltOffset },
        { label: `Rail Orb ${(railOrbScale * 100000).toFixed(1)}`, value: railOrbScale, min: 0.000001, max: 0.00002, step: 0.000001, onChange: setRailOrbScale },
        { label: `Rail Trk ${railTrackOpacity.toFixed(2)}`, value: railTrackOpacity, min: 0.05, max: 1, step: 0.05, onChange: setRailTrackOpacity },
      ];
      case "busStationsCity":
      case "busStationsIntercity": return [
        { label: `Bus ${busScale.toFixed(1)}`, value: busScale, min: 0.3, max: 3, step: 0.1, onChange: setBusScale },
      ];
      case "bikeStations": return [
        { label: `Bike ${bikeScale.toFixed(1)}`, value: bikeScale, min: 0.3, max: 3, step: 0.1, onChange: setBikeScale },
      ];
      case "lighthouses": return [
        { label: `LH ${lighthouseScale.toFixed(1)}`, value: lighthouseScale, min: 0.3, max: 3, step: 0.1, onChange: setLighthouseScale },
        { type: "toggle", label: "Beam", value: beamVisible, onChange: setBeamVisible },
        { label: `Dist ${beamDistance.toFixed(1)}`, value: beamDistance, min: 0.2, max: 3, step: 0.1, onChange: setBeamDistance },
        { label: `Opa ${beamOpacity.toFixed(2)}`, value: beamOpacity, min: 0.05, max: 0.8, step: 0.05, onChange: setBeamOpacity },
      ];
      case "stationsTHSR": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: thsrPillarVisible, onChange: setThsrPillarVisible },
        { label: `Height ${thsrPillarHeight.toFixed(1)}`, value: thsrPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setThsrPillarHeight },
      ];
      case "stationsTRA": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: traPillarVisible, onChange: setTraPillarVisible },
        { label: `Height ${traPillarHeight.toFixed(1)}`, value: traPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setTraPillarHeight },
      ];
      case "stationsMetro": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: metroPillarVisible, onChange: setMetroPillarVisible },
        { label: `Height ${metroPillarHeight.toFixed(1)}`, value: metroPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setMetroPillarHeight },
      ];
      case "highways": return [
        { label: `Width ${highwayWidth.toFixed(1)}`, value: highwayWidth, min: 0.3, max: 3, step: 0.1, onChange: setHighwayWidth },
        { label: `Glow ${highwayGlow.toFixed(1)}`, value: highwayGlow, min: 0, max: 3, step: 0.1, onChange: setHighwayGlow },
      ];
      case "provincialRoads": return [
        { label: `Width ${provincialWidth.toFixed(1)}`, value: provincialWidth, min: 0.3, max: 3, step: 0.1, onChange: setProvincialWidth },
        { label: `Glow ${provincialGlow.toFixed(1)}`, value: provincialGlow, min: 0, max: 3, step: 0.1, onChange: setProvincialGlow },
      ];
      case "ports": return [
        { label: `Glow ${portGlow.toFixed(1)}`, value: portGlow, min: 0, max: 3, step: 0.1, onChange: setPortGlow },
        { type: "toggle" as const, label: "Pillar", value: portPillarVisible, onChange: setPortPillarVisible },
        { label: `Height ${portPillarHeight.toFixed(1)}`, value: portPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setPortPillarHeight },
      ];
      case "airports": return [
        { label: `APT ${airportOpacity.toFixed(2)}`, value: airportOpacity, min: 0, max: 0.3, step: 0.01, onChange: setAirportOpacity },
        { label: `Glow ${airportGlow.toFixed(1)}`, value: airportGlow, min: 0, max: 2, step: 0.1, onChange: setAirportGlow },
        { type: "toggle" as const, label: "Pillar", value: airportPillarVisible, onChange: setAirportPillarVisible },
        { label: `Height ${airportPillarHeight.toFixed(1)}`, value: airportPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setAirportPillarHeight },
      ];
      case "cyclingRoutes": return [
        { label: `Cycling ${cyclingWidth.toFixed(1)}`, value: cyclingWidth, min: 0.3, max: 3, step: 0.1, onChange: setCyclingWidth },
      ];
      case "freewayCongestion": return [
        { label: `Freeway ${freewayWidth.toFixed(1)}`, value: freewayWidth, min: 0.3, max: 3, step: 0.1, onChange: setFreewayWidth },
      ];
      case "weatherStations": return [
        { label: `Weather ${weatherScale.toFixed(1)}`, value: weatherScale, min: 0.3, max: 3, step: 0.1, onChange: setWeatherScale },
      ];
      case "temperatureWave": return [
        { type: "toggle" as const, label: "3D", value: tempExtruded, onChange: setTempExtruded },
        { label: `Height ${tempHeight}`, value: tempHeight, min: 0, max: 400, step: 20, onChange: setTempHeight },
        { label: `Z Offset ${tempZOffset}`, value: tempZOffset, min: 0, max: 1000, step: 50, onChange: setTempZOffset },
        { label: `Opacity ${tempOpacity.toFixed(2)}`, value: tempOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTempOpacity },
        { type: "toggle" as const, label: "Grid", value: tempWireframe, onChange: setTempWireframe },
      ];
      case "windPlan": return [];
      case "h3Population": return [
        { label: `Opacity ${h3Opacity.toFixed(1)}`, value: h3Opacity, min: 0.1, max: 1, step: 0.1, onChange: setH3Opacity },
        { label: `Contrast ${h3Contrast.toFixed(1)}`, value: h3Contrast, min: 0.5, max: 4, step: 0.1, onChange: setH3Contrast },
        { type: "toggle" as const, label: "3D", value: h3Extruded, onChange: setH3Extruded },
        { label: `Height ${h3ElevationScale}`, value: h3ElevationScale, min: 10, max: 200, step: 10, onChange: setH3ElevationScale },
        { type: "select" as const, label: "Metric", value: h3Metric, options: [{ label: "Day", value: "day" }, { label: "Night", value: "night" }], onChange: (v: string) => setH3Metric(v as "day" | "night") },
      ];
      case "popCount": return [
        { label: `Opacity ${pcOpacity.toFixed(1)}`, value: pcOpacity, min: 0.1, max: 1, step: 0.1, onChange: setPcOpacity },
        { label: `Contrast ${pcContrast.toFixed(1)}`, value: pcContrast, min: 0.5, max: 4, step: 0.1, onChange: setPcContrast },
        { type: "toggle" as const, label: "3D", value: pcExtruded, onChange: setPcExtruded },
        { label: `Height ${pcElevationScale}`, value: pcElevationScale, min: 10, max: 200, step: 10, onChange: setPcElevationScale },
      ];
      case "indicators": {
        const categoryOptions = [
          { label: "Count", value: "count" },
          { label: "Struct", value: "struct" },
          { label: "Burden", value: "burden" },
        ];
        const metricMap: Record<string, { label: string; value: string }[]> = {
          count: [{ label: "HH", value: "hh" }, { label: "M", value: "m" }, { label: "F", value: "f" }],
          struct: [{ label: "Sex", value: "sr" }, { label: "PPH", value: "pph" }],
          burden: [{ label: "Dep", value: "dr" }, { label: "Child", value: "cd" }, { label: "Elder", value: "ed" }, { label: "Aging", value: "ai" }],
        };
        const currentMetrics = metricMap[indCategory] ?? metricMap.count!;
        return [
          { type: "select" as const, label: "Category", value: indCategory, options: categoryOptions, onChange: (v: string) => { setIndCategory(v); const first = (metricMap[v] ?? metricMap.count!)[0]!; setIndMetric(first.value); } },
          { type: "select" as const, label: "Metric", value: indMetric, options: currentMetrics, onChange: setIndMetric },
          { label: `Opacity ${indOpacity.toFixed(1)}`, value: indOpacity, min: 0.1, max: 1, step: 0.1, onChange: setIndOpacity },
          { label: `Contrast ${indContrast.toFixed(1)}`, value: indContrast, min: 0.5, max: 4, step: 0.1, onChange: setIndContrast },
          { type: "toggle" as const, label: "3D", value: indExtruded, onChange: setIndExtruded },
          { label: `Height ${indElevationScale}`, value: indElevationScale, min: 10, max: 200, step: 10, onChange: setIndElevationScale },
        ];
      }
    }
  };

  return {
    stationScale,
    railTrackMode,
    refs: {
      altExag: altExagRef,
      altOffset: altOffsetRef,
      staticOpacity: staticOpacityRef,
      orbScale: orbScaleRef,
      shipOrbScale: shipOrbScaleRef,
      shipTrailOpacity: shipTrailOpacityRef,
      railAltOffset: railAltOffsetRef,
      railOrbScale: railOrbScaleRef,
      railTrackOpacity: railTrackOpacityRef,
      railTrainVisible: railTrainVisibleRef,
      railTrackMode: railTrackModeRef,
      beamVisible: beamVisibleRef,
      beamDistance: beamDistanceRef,
      beamOpacity: beamOpacityRef,
      thsrPillarVisible: thsrPillarVisibleRef,
      thsrPillarHeight: thsrPillarHeightRef,
      traPillarVisible: traPillarVisibleRef,
      traPillarHeight: traPillarHeightRef,
      metroPillarVisible: metroPillarVisibleRef,
      metroPillarHeight: metroPillarHeightRef,
      portPillarVisible: portPillarVisibleRef,
      portPillarHeight: portPillarHeightRef,
      airportPillarVisible: airportPillarVisibleRef,
      airportPillarHeight: airportPillarHeightRef,
      tempHeight: tempHeightRef,
      tempZOffset: tempZOffsetRef,
      tempExtruded: tempExtrudedRef,
      tempOpacity: tempOpacityRef,
      tempWireframe: tempWireframeRef,
    },
    overlayParams,
    getControls,
    h3Params: useMemo(() => ({ opacity: h3Opacity, extruded: h3Extruded, elevationScale: h3ElevationScale, metric: h3Metric, contrast: h3Contrast }), [h3Opacity, h3Extruded, h3ElevationScale, h3Metric, h3Contrast]),
    popCountParams: useMemo(() => ({ opacity: pcOpacity, contrast: pcContrast, extruded: pcExtruded, elevationScale: pcElevationScale }), [pcOpacity, pcContrast, pcExtruded, pcElevationScale]),
    indicatorsParams: useMemo(() => ({ category: indCategory, metric: indMetric, opacity: indOpacity, contrast: indContrast, extruded: indExtruded, elevationScale: indElevationScale }), [indCategory, indMetric, indOpacity, indContrast, indExtruded, indElevationScale]),
  };
}
