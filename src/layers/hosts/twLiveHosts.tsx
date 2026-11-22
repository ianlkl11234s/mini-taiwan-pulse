// 台灣即時快照 Layer Host（台灣圖層延伸 B8）：登革熱聚集區、航船布告、大潮與長浪警戒（皆讀 R2 live/tw/…）。

import { useMemo } from "react";
import { useDengueClusterLayer, useNavNoticesLayer, useTideSwellAlertsLayer } from "../../hooks/useTwLiveSnapshotLayer";
import { selectedMultiSelectValues } from "../../data/multiSelectMapbox";
import { NAV_KIND_BY_ID, NAV_KIND_IDS, NAV_LIFETIME_BY_ID, NAV_LIFETIME_DEFAULT_IDS, NAV_LIFETIME_IDS, TIDE_KINDS } from "../../data/twLiveTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** mask 缺值時用 fallback（全選或預設） */
function maskValues(mask: number | undefined, ids: readonly string[], fallback: readonly string[]): string[] {
  return mask === undefined || !Number.isFinite(mask) ? [...fallback] : selectedMultiSelectValues(mask, ids);
}

/** 登革熱聚集區：每 30 分鐘重抓；一級發布區面＋低縮放中心圈 */
export const DengueClustersHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useDengueClusterLayer");
  const p = useKeyOverlayParams("dengueClusters");
  useDengueClusterLayer(deps.mapRef, deps.layerVisibility.dengueClusters, {
    opacity: p.dengueClustersOpacity ?? 0.9,
    scale: p.dengueClustersScale ?? 1,
    isDark: deps.isDarkTheme,
  });
  return null;
};

/** 航船布告：每 10 分鐘重抓；類型與期限篩選（永久預設不勾） */
export const NavNoticesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useNavNoticesLayer");
  const p = useKeyOverlayParams("navNotices");
  const kindMask = p.navNoticesKindMask;
  const lifeMask = p.navNoticesLifetimeMask;
  const kinds = useMemo(() => maskValues(kindMask, NAV_KIND_IDS, NAV_KIND_IDS).map((id) => NAV_KIND_BY_ID[id]!).filter(Boolean), [kindMask]);
  const lifetimes = useMemo(() => maskValues(lifeMask, NAV_LIFETIME_IDS, NAV_LIFETIME_DEFAULT_IDS).map((id) => NAV_LIFETIME_BY_ID[id]!).filter(Boolean), [lifeMask]);
  useNavNoticesLayer(deps.mapRef, deps.layerVisibility.navNotices, {
    opacity: p.navNoticesOpacity ?? 0.9,
    scale: p.navNoticesScale ?? 1,
    isDark: deps.isDarkTheme,
    kinds,
    lifetimes,
  });
  return null;
};

/** 大潮與長浪警戒：每 10 分鐘重抓；色＝等級，有警戒的點脈動 */
export const TideSwellAlertsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTideSwellAlertsLayer");
  const p = useKeyOverlayParams("tideSwellAlerts");
  const kindMask = p.tideSwellAlertsKindMask;
  const kinds = useMemo(() => maskValues(kindMask, TIDE_KINDS, TIDE_KINDS), [kindMask]);
  useTideSwellAlertsLayer(deps.mapRef, deps.layerVisibility.tideSwellAlerts, {
    opacity: p.tideSwellAlertsOpacity ?? 0.95,
    scale: p.tideSwellAlertsScale ?? 1,
    isDark: deps.isDarkTheme,
    kinds,
  });
  return null;
};
