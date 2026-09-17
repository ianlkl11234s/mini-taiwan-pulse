import { useAllenCoralAtlasLayer } from "../../hooks/useAllenCoralAtlasLayer";
import type { AllenCoralAtlasRegion, AllenCoralAtlasView } from "../../data/allenCoralAtlasTypes";
import { type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramStr, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

const VIEWS = ["coralAlgae", "benthic", "geomorphic"] as const satisfies readonly AllenCoralAtlasView[];
const REGIONS = ["all", "taiwan", "okinawa"] as const satisfies readonly AllenCoralAtlasRegion[];

export const AllenCoralAtlasHost: LayerHostComponent = ({ deps }) => {
  const values = useLayerParams("allenCoralAtlas");
  const overlay = useKeyOverlayParams("allenCoralAtlas");
  const visible = deps.layerVisibility.allenCoralAtlas;
  const view = oneOfParam(paramStr(values, "allenCoralAtlas", "allenCoralAtlasView"), VIEWS, "coralAlgae");
  const region = oneOfParam(paramStr(values, "allenCoralAtlas", "allenCoralAtlasRegion"), REGIONS, "all");
  const state = useAllenCoralAtlasLayer(deps.mapRef, visible, overlay.allenCoralAtlasOpacity ?? 0.65, view, region);
  if (!visible || state !== "error") return null;
  return <div role="alert" style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: 10000, width: "min(420px, 90vw)", padding: 12, background: "#422006", color: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
    Allen Coral Atlas 私人資料無法取得。這不是沒有珊瑚或沒有製圖 coverage；請確認本人帳號登入與 owner-authenticated 資料服務，再關閉並重新開啟圖層。
  </div>;
};
