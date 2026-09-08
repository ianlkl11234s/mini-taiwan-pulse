import { useCoralReefDistributionLayer } from "../../hooks/useCoralReefDistributionLayer";
import { type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const CoralReefDistributionHost: LayerHostComponent = ({ deps }) => {
  const params = useKeyOverlayParams("coralReefDistribution");
  const visible = deps.layerVisibility.coralReefDistribution;
  const state = useCoralReefDistributionLayer(deps.mapRef, visible, params.coralReefDistributionOpacity ?? 0.55);
  if (!visible || state !== "error") return null;
  return <div role="alert" style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: 10000, width: "min(360px, 90vw)", padding: 12, background: "#422006", color: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
    珊瑚礁資料載入失敗或逾時。這不是沒有珊瑚或沒有 coverage；請確認本人帳號登入與私人資料服務，再關閉並重新開啟圖層。
  </div>;
};
