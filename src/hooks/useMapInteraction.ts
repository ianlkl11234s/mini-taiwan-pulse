import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Flight, RailTrain } from "../types";
import type { FlightScene } from "../three/FlightScene";
import type { RailScene } from "../three/RailScene";

interface TooltipInfo {
  flight: Flight;
  x: number;
  y: number;
  altitude: number | null;
}

interface TrainTooltipInfo {
  train: RailTrain;
  x: number;
  y: number;
}

export function useMapInteraction(
  mapRef: React.RefObject<MapboxMap | null>,
  flightSceneRef: React.RefObject<FlightScene | null>,
  flightsRef: React.RefObject<Flight[]>,
  timeRef: React.RefObject<number>,
  railSceneRef?: React.RefObject<RailScene | null>,
) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [trainTooltipInfo, setTrainTooltipInfo] = useState<TrainTooltipInfo | null>(null);
  const clickBoundRef = useRef(false);

  const bindEvents = (map: MapboxMap) => {
    if (clickBoundRef.current) return;
    clickBoundRef.current = true;

    map.on("click", (e) => {
      const container = map.getContainer();
      const w = container.clientWidth;
      const h = container.clientHeight;

      // 先嘗試拾取列車
      const railScene = railSceneRef?.current;
      if (railScene) {
        const train = railScene.pickTrain(e.point.x, e.point.y, w, h);
        if (train) {
          setTrainTooltipInfo({ train, x: e.point.x, y: e.point.y });
          setTooltipInfo(null);
          return;
        }
      }

      // 再嘗試拾取飛機
      const scene = flightSceneRef.current;
      if (!scene) { setTooltipInfo(null); setTrainTooltipInfo(null); return; }
      const flightId = scene.pickFlight(e.point.x, e.point.y, w, h);
      if (flightId) {
        const flight = flightsRef.current.find((f) => f.fr24_id === flightId);
        if (flight) {
          let altitude: number | null = null;
          const t = timeRef.current;
          for (let i = flight.path.length - 1; i >= 0; i--) {
            if (flight.path[i]![3] <= t) { altitude = Math.round(flight.path[i]![2]); break; }
          }
          setTooltipInfo({ flight, x: e.point.x, y: e.point.y, altitude });
          setTrainTooltipInfo(null);
        }
      } else {
        setTooltipInfo(null);
        setTrainTooltipInfo(null);
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
        setSelectedFlightId(flightId);
        setTooltipInfo(null);
        setTrainTooltipInfo(null);
      }
    });

    map.on("dragstart", () => setSelectedFlightId(null));
    map.on("move", () => { setTooltipInfo(null); setTrainTooltipInfo(null); });
  };

  // 雙擊追蹤：相機鎖定飛機
  useEffect(() => {
    if (!selectedFlightId) return;
    const map = mapRef.current;
    if (!map) return;

    let animId: number;
    const tick = () => {
      const flight = flightsRef.current.find((f) => f.fr24_id === selectedFlightId);
      if (flight && flight.path.length > 0) {
        const t = timeRef.current;
        const path = flight.path;
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
  }, [selectedFlightId, mapRef, flightsRef, timeRef]);

  return {
    tooltipInfo, setTooltipInfo,
    trainTooltipInfo, setTrainTooltipInfo,
    selectedFlightId, setSelectedFlightId,
    bindEvents,
  };
}
