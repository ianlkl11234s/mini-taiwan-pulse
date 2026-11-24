// 設施研究 M 的 Layer Host（站主限定，owner-data 私人檔）。

import { useSiteStudyMLayer } from "../../hooks/useSiteStudyMLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramBool, useLayerParams } from "../layerParamsAccess";

/** 「參考資料」開關不進 paint：開啟才讀第二支檔並併進同一個 source */
export const SiteStudyMHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSiteStudyMLayer");
  const showOverlays = paramBool(useLayerParams("siteStudyM"), "siteStudyM", "siteStudyMOverlays");
  useSiteStudyMLayer(deps.mapRef, deps.layerVisibility.siteStudyM, showOverlays);
  return null;
};
