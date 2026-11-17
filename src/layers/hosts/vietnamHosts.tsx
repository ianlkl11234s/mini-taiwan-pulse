// 越南 Layer Host（2026-11-13 第 0–1 波）。比照 hosts/philippinesHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/usePhLayers";
import { useVnAdminLayers, useVnPopulationLayers, useVnRasterLayer } from "../../hooks/useVnLayers";
import { useOwnerPmtilesSource, useOwnerRevokeCleanup } from "../../hooks/useOwnerPmtilesAccess";
import { VN_RASTER_BY_KEY } from "../../data/vnWavesLayers";
import { selectedMultiSelectValues } from "../../data/multiSelectMapbox";
import { VN_SPEC_BY_KEY, VN_STATUS_IDS, vnMoreSpec, vnStatusFilter } from "../../data/vnDataLayers";
import type { VnDataKey } from "../../data/vnDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：34 省面＋省名。 */
export const VnAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useVnAdminLayers");
  const p = useKeyOverlayParams("vnAdminBoundaries");
  useVnAdminLayers(deps.mapRef, deps.layerVisibility.vnAdminBoundaries, p.vnAdminBoundariesOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

/** 人口（NSO 2025）：34 省人口密度。 */
export const VnPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useVnPopulationLayers");
  const p = useKeyOverlayParams("vnPopulation");
  useVnPopulationLayers(deps.mapRef, deps.layerVisibility.vnPopulation, p.vnPopulationOpacity ?? 0.7, deps.isDarkTheme);
  return null;
};

/** 規格驅動 10 層；有第二個 PMTiles（ODM／OSM、GEM／OSM 分檔）的層畫兩次，hook 數固定。 */
function makeVnDataHost(key: VnDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = VN_SPEC_BY_KEY[key];
  const more = vnMoreSpec(spec);
  const hookId = `useVn${key.slice(2)}Layer`;
  const useParams = (deps: Parameters<LayerHostComponent>[0]["deps"]) => {
    const p = useKeyOverlayParams(key);
    const statusMask = p[`${key}StatusMask`];
    const status = statusMask === undefined || !Number.isFinite(statusMask) ? undefined : selectedMultiSelectValues(statusMask, VN_STATUS_IDS);
    return {
      visible: deps.layerVisibility[key], opacity: p[`${key}Opacity`] ?? fallbackOpacity, scale: p[`${key}Scale`] ?? 1,
      catMask: p[`${key}CategoryMask`], extra: vnStatusFilter(spec, status),
    };
  };
  if (!more) {
    const VnDataHost: LayerHostComponent = ({ deps }) => {
      bumpHostRender(hookId);
      const o = useParams(deps);
      usePhDataLayer(deps.mapRef, spec, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
      return null;
    };
    return VnDataHost;
  }
  const VnDataHost2: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const o = useParams(deps);
    usePhDataLayer(deps.mapRef, spec, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
    usePhDataLayer(deps.mapRef, more, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
    return null;
  };
  return VnDataHost2;
}

export const VnStationsHost = makeVnDataHost("vnStations", 0.85);
export const VnTransportHubsHost = makeVnDataHost("vnTransportHubs", 0.85);
export const VnMajorRoadsHost = makeVnDataHost("vnMajorRoads", 0.85);
export const VnPowerPlantsHost = makeVnDataHost("vnPowerPlants", 0.85);
export const VnRenewablesHost = makeVnDataHost("vnRenewables", 0.85);
export const VnPowerGridHost = makeVnDataHost("vnPowerGrid", 0.85);
export const VnFuelStationsHost = makeVnDataHost("vnFuelStations", 0.85);
export const VnOilGasHost = makeVnDataHost("vnOilGas", 0.85);
export const VnEnvisoftStationsHost = makeVnDataHost("vnEnvisoftStations", 0.85);
export const VnAngiangDemoHost = makeVnDataHost("vnAngiangDemo", 0.85);

// ── 觀光波與第 2–7 波（2026-11-17）：規格在 vnWavesLayers.ts，預設透明度取 spec.opacity
const W = (key: VnDataKey) => makeVnDataHost(key, VN_SPEC_BY_KEY[key].opacity ?? 0.85);
export const VnTourAttractionsHost = W("vnTourAttractions");
export const VnTourNatureHost = W("vnTourNature");
export const VnTourServicesHost = W("vnTourServices");
export const VnNationalTouristAreasHost = W("vnNationalTouristAreas");
export const VnPlaceNamesHost = W("vnPlaceNames");
export const VnBicycleRentalHost = W("vnBicycleRental");
export const VnBridgesHost = W("vnBridges");
export const VnParkingHost = W("vnParking");
export const VnGlideEventsHost = W("vnGlideEvents");
export const VnDamsHost = W("vnDams");
export const VnRiversHost = W("vnRivers");
export const VnWaterSupplyHost = W("vnWaterSupply");
export const VnWaterStructuresHost = W("vnWaterStructures");
export const VnRiverbankErosionHost = W("vnRiverbankErosion");
export const VnSchoolsHost = W("vnSchools");
export const VnSchoolCampusesHost = W("vnSchoolCampuses");
export const VnKindergartensHost = W("vnKindergartens");
export const VnHealthFacilitiesHost = W("vnHealthFacilities");
export const VnPoliceHost = W("vnPolice");
export const VnCourtsPrisonsHost = W("vnCourtsPrisons");
export const VnPostalServicesHost = W("vnPostalServices");
export const VnPublicAmenitiesHost = W("vnPublicAmenities");
export const VnFinancialServicesHost = W("vnFinancialServices");
export const VnPlacesOfWorshipHost = W("vnPlacesOfWorship");
export const VnParksHost = W("vnParks");
export const VnProtectedAreasOdmHost = W("vnProtectedAreasOdm");
export const VnAngiangAquacultureHost = W("vnAngiangAquaculture");
export const VnFieldBoundariesHost = W("vnFieldBoundaries");
export const VnSoilHost = W("vnSoil");
export const VnFarmTracksHost = W("vnFarmTracks");
export const VnCoalMinesHost = W("vnCoalMines");

// ── raster 4 層：只有透明度
function makeVnRasterHost(key: "vnTerrainHillshade" | "vnTerrainRelief" | "vnLandslideSusceptibility"): LayerHostComponent {
  const spec = VN_RASTER_BY_KEY[key];
  const VnRasterHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(`useVn${key.slice(2)}Layer`);
    const p = useKeyOverlayParams(key);
    useVnRasterLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity);
    return null;
  };
  return VnRasterHost;
}
export const VnTerrainHillshadeHost = makeVnRasterHost("vnTerrainHillshade");
export const VnTerrainReliefHost = makeVnRasterHost("vnTerrainRelief");
/** 崩塌潛勢（W3-1）：ODM WMS 預渲染的自有 PNG PMTiles。 */
export const VnLandslideSusceptibilityHost = makeVnRasterHost("vnLandslideSusceptibility");
/** WDPCA 保護區（站主限定，W6-1）：圖磚只走私人 owner-data；未驗證站主不掛 source，撤權時移除 layer 與 source。 */
export const VnWdpcaHost: LayerHostComponent = ({ deps }) => {
  const key = "vnWdpca";
  const spec = VN_RASTER_BY_KEY[key];
  bumpHostRender("useVnWdpcaLayer");
  const p = useKeyOverlayParams(key);
  const visible = deps.layerVisibility[key];
  const priv = useOwnerPmtilesSource("vn-wdpca-raster", visible);
  useOwnerRevokeCleanup(deps.mapRef, !!priv, [spec.layerId], [spec.sourceId]);
  useVnRasterLayer(deps.mapRef, spec, visible, p[`${key}Opacity`] ?? spec.opacity, priv);
  return null;
};
