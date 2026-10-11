import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { getJpWaterRuntime, retryJpWaterAssets, subscribeJpWaterRuntime } from "../data/jpWaterLoader";
import { RADIUS, Z_INDEX } from "../styles/designTokens";

/** Visible failure state for local-only PMTiles; a blank viewport is never reported as zero features or no risk. */
export function JpWaterAlert() {
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  // 關閉只針對「這一次錯誤」：revision 與訊息都要相同才抑制；離開 error 狀態（重試、載入中、成功）即清除，
  // 之後另一個水資源資產失敗（revision 不變）仍會再顯示。
  const [dismissed, setDismissed] = useState<{ revision: number; error: string | undefined } | null>(null);
  useEffect(() => { if (runtime.status !== "error") setDismissed(null); }, [runtime.status]);
  if (runtime.status !== "error" || (dismissed && dismissed.revision === runtime.revision && dismissed.error === runtime.error)) return null;
  // 層級 popover：在工具列選單之上（LayerHosts 最後渲染），但在說明／分享等置中視窗之下（design-system §5.25）
  return <div role="alert" style={{ position: "absolute", top: 100, right: 16, zIndex: Z_INDEX.popover, maxWidth: "min(360px, 85vw)", padding: 12, background: "#451a1a", color: "#fff", borderRadius: 8 }}>
    <button aria-label="關閉" onClick={() => setDismissed({ revision: runtime.revision, error: runtime.error })} style={{ float: "right", marginLeft: 8, width: 24, height: 24, borderRadius: RADIUS.md, background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
    日本水資源資料載入失敗：{runtime.error}<br /><button onClick={retryJpWaterAssets}>重試水資源資料</button>
  </div>;
}
