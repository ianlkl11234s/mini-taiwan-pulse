// 設施研究 M 的 Layer Host（站主限定，owner-data 私人檔）：四個圖層共用同一支 hook，只差資料檔代號。

import { useSiteStudyMLayer } from "../../hooks/useSiteStudyMLayer";
import { SITE_STUDY_M_PARTS, type SiteStudyPart } from "../../data/siteStudyMTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";

function siteStudyHost(part: SiteStudyPart): LayerHostComponent {
  const key = SITE_STUDY_M_PARTS[part].layerKey;
  return ({ deps }) => {
    bumpHostRender("useSiteStudyMLayer");
    useSiteStudyMLayer(deps.mapRef, deps.layerVisibility[key], part);
    return null;
  };
}

export const SiteStudyMHost = siteStudyHost("sites");
export const SiteStudyMRangesHost = siteStudyHost("ranges");
export const SiteStudyMParcelsHost = siteStudyHost("parcels");
export const SiteStudyMPastHost = siteStudyHost("past");
