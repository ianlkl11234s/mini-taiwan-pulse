import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import type { Scenario } from "../types/scenario";
import { ScenarioEngine } from "../engines/ScenarioEngine";
import { timeStore } from "../state/timeStore";
import { withLoading } from "../lib/loadingRegistry";

const DEFAULT_SCENARIO_URL = "./scenarios/demo.json";

interface UseScenarioArgs {
  active: boolean;
  mapReady: boolean;
  mapRef: React.RefObject<MapboxMap | null>;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerVisibility>>;
}

interface UseScenarioReturn {
  scenario: Scenario | null;
  engineRef: React.RefObject<ScenarioEngine | null>;
  banner: string | null;
  /** 想定時間視窗（unix），餵給 useTimeline 的 overrideWindow */
  scenarioWindow: { start: number; end: number } | undefined;
}

/**
 * 載入想定 JSON、建立 ScenarioEngine，並驅動：
 *  - banner 文字（throttled 250ms）
 *  - camera inject（flyTo + setLayerVisibility，watermark cursor 由 engine 管）
 */
export function useScenario({
  active,
  mapReady,
  mapRef,
  setLayerVisibility,
}: UseScenarioArgs): UseScenarioReturn {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const engineRef = useRef<ScenarioEngine | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // 載入想定 JSON
  useEffect(() => {
    if (!active || scenario) return;
    let cancelled = false;
    withLoading(
      "scenario:demo",
      "載入想定",
      fetch(DEFAULT_SCENARIO_URL).then((r) => {
        if (!r.ok) throw new Error(`scenario ${r.status}`);
        return r.json() as Promise<Scenario>;
      }),
    )
      .then((data) => {
        if (cancelled) return;
        engineRef.current = new ScenarioEngine(data);
        setScenario(data);
      })
      .catch((err) => console.warn("[Scenario] load failed:", err));
    return () => { cancelled = true; };
  }, [active, scenario]);

  // 導播：banner + camera inject（需地圖就緒）
  useEffect(() => {
    if (!active || !mapReady || !scenario) return;
    const engine = engineRef.current;
    if (!engine) return;

    // 進場先框到想定鏡頭
    mapRef.current?.jumpTo({
      center: scenario.camera.center,
      zoom: scenario.camera.zoom,
      pitch: scenario.camera.pitch,
      bearing: scenario.camera.bearing,
    });

    const apply = (unix: number) => {
      setBanner(engine.getCurrentBanner(unix));
      for (const cam of engine.pollCameraInjects(unix)) {
        mapRef.current?.flyTo({
          center: cam.center,
          zoom: cam.zoom,
          pitch: cam.pitch,
          bearing: cam.bearing,
          duration: 1500,
        });
        if (cam.layers) setLayerVisibility((prev) => ({ ...prev, ...cam.layers }));
      }
    };
    apply(timeStore.getTime());
    return timeStore.subscribeThrottled(250, apply);
  }, [active, mapReady, scenario, mapRef, setLayerVisibility]);

  const scenarioWindow = scenario
    ? { start: scenario.startUnix, end: scenario.startUnix + scenario.durationSec }
    : undefined;

  return { scenario, engineRef, banner, scenarioWindow };
}
