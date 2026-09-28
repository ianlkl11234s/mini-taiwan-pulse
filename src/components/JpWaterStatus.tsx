import { useSyncExternalStore } from "react";
import { getJpWaterRuntime, retryJpWaterAssets, subscribeJpWaterRuntime } from "../data/jpWaterLoader";
import { Z_INDEX } from "../styles/designTokens";

/** Visible failure state for local-only PMTiles; a blank viewport is never reported as zero features or no risk. */
export function JpWaterAlert() {
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  if (runtime.status !== "error") return null;
  // 層級 popover：在工具列選單之上（LayerHosts 最後渲染），但在說明／分享等置中視窗之下（design-system §5.25）
  return <div role="alert" style={{ position: "absolute", top: 100, right: 16, zIndex: Z_INDEX.popover, maxWidth: "min(360px, 85vw)", padding: 12, background: "#451a1a", color: "#fff", borderRadius: 8 }}>
    日本水資源資料載入失敗：{runtime.error}<br /><button onClick={retryJpWaterAssets}>重試水資源資料</button>
  </div>;
}
