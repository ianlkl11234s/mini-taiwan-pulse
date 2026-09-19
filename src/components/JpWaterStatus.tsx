import { useSyncExternalStore } from "react";
import { getJpWaterRuntime, retryJpWaterAssets, subscribeJpWaterRuntime } from "../data/jpWaterLoader";

/** Visible failure state for local-only PMTiles; a blank viewport is never reported as zero features or no risk. */
export function JpWaterAlert() {
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  if (runtime.status !== "error") return null;
  return <div role="alert" style={{ position: "absolute", top: 100, right: 16, zIndex: 50, maxWidth: "min(360px, 85vw)", padding: 12, background: "#451a1a", color: "#fff", borderRadius: 8 }}>
    日本水資源資料載入失敗：{runtime.error}<br /><button onClick={retryJpWaterAssets}>重試水資源資料</button>
  </div>;
}
