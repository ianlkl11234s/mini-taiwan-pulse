// 南韓 Layer Host（2026-10-31 第 0 波起）。clone hosts/ukHosts.tsx 的 GbAdminHost 慣例。

import { useKrAdminLayers } from "../../hooks/useKrAdminLayers";
import { useKrDataLayer } from "../../hooks/useKrDataLayers";
import { KR_SPEC_BY_KEY } from "../../data/krDataLayers";
import type { KrDataKey } from "../../data/krDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 南韓行政邊界：시·도／시군구／행정동 三層級（同一個 PMTiles，select 切換）。 */
export const KrAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrAdminLayers");
  const p = useKeyOverlayParams("krAdminBoundaries");
  const level = p.krAdminBoundariesLevelIdx;
  useKrAdminLayers(
    deps.mapRef,
    deps.layerVisibility.krAdminBoundaries,
    p.krAdminBoundariesOpacity ?? 0.85,
    level === 1 || level === 2 ? level : 0,
    deps.isDarkTheme,
  );
  return null;
};

/** 第 3–5 波資料層：一個 key 一個 Host，共用 `useKrDataLayer`（規格見 data/krDataLayers.ts）。 */
function makeKrDataHost(key: KrDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = KR_SPEC_BY_KEY[key];
  const hookId = `useKr${key.slice(2)}Layer`;
  const KrDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    useKrDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme);
    return null;
  };
  return KrDataHost;
}

export const KrWaterLevelStationsHost = makeKrDataHost("krWaterLevelStations", 0.8);
export const KrSluiceGatesHost = makeKrDataHost("krSluiceGates", 0.8);
export const KrWaterQualityStationsHost = makeKrDataHost("krWaterQualityStations", 0.8);
export const KrCoastalErosionFacilitiesHost = makeKrDataHost("krCoastalErosionFacilities", 0.8);
export const KrRiversOsmHost = makeKrDataHost("krRiversOsm", 0.85);
export const KrMarinePollutionIncidentsHost = makeKrDataHost("krMarinePollutionIncidents", 0.8);
export const KrMarineEnvSitesHost = makeKrDataHost("krMarineEnvSites", 0.85);
export const KrMarineProtectedAreasHost = makeKrDataHost("krMarineProtectedAreas", 0.7);
export const KrPublicBicycleStationsHost = makeKrDataHost("krPublicBicycleStations", 0.8);
export const KrSeoulSubwayCongestionHost = makeKrDataHost("krSeoulSubwayCongestion", 0.85);
export const KrBridgesHost = makeKrDataHost("krBridges", 0.7);
export const KrParkingLotsHost = makeKrDataHost("krParkingLots", 0.7);
export const KrSpeedCamerasHost = makeKrDataHost("krSpeedCameras", 0.7);
export const KrChildProtectionZonesHost = makeKrDataHost("krChildProtectionZones", 0.7);
export const KrNationalParksHost = makeKrDataHost("krNationalParks", 0.5);
export const KrNpLocationSignsHost = makeKrDataHost("krNpLocationSigns", 0.8);
export const KrNpTrailsHost = makeKrDataHost("krNpTrails", 0.85);
export const KrStreetTreesHost = makeKrDataHost("krStreetTrees", 0.5);
