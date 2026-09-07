import React, { StrictMode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { Map as MapboxMap } from "mapbox-gl";
import { CameraHud, createCameraHudStore, formatCameraInfo } from "../../../src/components/CameraHud";

function fakeMap() {
  const listeners = new Map<string, Set<() => void>>();
  const values = { lng: 121.5, lat: 25, zoom: 9, pitch: 30, bearing: 0 };
  const map = {
    getCenter: () => ({ lng: values.lng, lat: values.lat }), getZoom: () => values.zoom,
    getPitch: () => values.pitch, getBearing: () => values.bearing,
    on(event: string, callback: () => void) { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(callback); return map; },
    off(event: string, callback: () => void) { listeners.get(event)?.delete(callback); return map; },
  } as unknown as MapboxMap;
  return { map, values, emit: (event: string) => [...(listeners.get(event) ?? [])].forEach((callback) => callback()) };
}

const fake = fakeMap();
const store = createCameraHudStore();

function HeavySibling({ renders }: { renders: React.MutableRefObject<number> }) { renders.current++; return <p>heavy sibling</p>; }
function HudProbe({ renders }: { renders: React.MutableRefObject<number> }) {
  renders.current++;
  const camera = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <><CameraHud store={store} style={{ fontFamily: "monospace" }} /><output id="camera-probe">{formatCameraInfo(camera)}</output></>;
}

function Harness() {
  const parentRenders = useRef(0), heavyRenders = useRef(0), hudRenders = useRef(0);
  const [showHud, setShowHud] = useState(true);
  const [result, setResult] = useState("尚未執行");
  parentRenders.current++;
  useEffect(() => { store.bind(fake.map); return () => store.dispose(); }, []);
  const run = async () => {
    const baseline = { parent: parentRenders.current, heavy: heavyRenders.current, hud: hudRenders.current };
    for (let i = 1; i <= 120; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      fake.values.lng = 121.5 + i / 10_000;
      fake.values.lat = 25 + i / 10_000;
      fake.values.zoom = 9 + i / 100;
      fake.emit("move");
    }
    const parentDelta = parentRenders.current - baseline.parent;
    const heavyDelta = heavyRenders.current - baseline.heavy;
    const hudDelta = hudRenders.current - baseline.hud;
    setResult(`120 moves: parent +${parentDelta}, heavy +${heavyDelta}, HUD +${hudDelta}; ${parentDelta === 0 && heavyDelta === 0 && hudDelta >= 120 ? "PASS" : "FAIL"}`);
  };
  const remount = () => { setShowHud(false); requestAnimationFrame(() => setShowHud(true)); };
  return <main><h1>Camera HUD React acceptance</h1><button onClick={() => void run()}>Run 120 moves</button><button onClick={remount}>Unmount/remount HUD</button>{showHud && <HudProbe renders={hudRenders} />}<HeavySibling renders={heavyRenders} /><output id="result">{result}</output></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>);
