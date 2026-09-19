import { JpMedicalAlert } from "../../components/JpMedicalStatus";
import { JpWaterAlert } from "../../components/JpWaterStatus";
import { useJpMedicalLayers } from "../../hooks/useJpMedicalLayers";
// 日本 Japan Batch 2 的 Layer Host：行政區 2 層（PMTiles polygon）＋ 交通 2 層（GeoJSON）。
// clone hosts/climateHosts.tsx 的 JpReligionHost 慣例。

import { useJpAdminLayers } from "../../hooks/useJpAdminLayers";
import { useJpStationsLayer } from "../../hooks/useJpStationsLayer";
import { useJpAirportsLayer } from "../../hooks/useJpAirportsLayer";
import { useJpRailwaysLayer } from "../../hooks/useJpRailwaysLayer";
import { useJpPoliceFacilitiesLayer } from "../../hooks/useJpPoliceFacilitiesLayer";
import { useJpSchoolsLayer } from "../../hooks/useJpSchoolsLayer";
import { useJpPopulationMeshLayer } from "../../hooks/useJpPopulationMeshLayer";
import { useJpTourismLayers } from "../../hooks/useJpTourismLayers";
import { useJpWaterLayers } from "../../hooks/useJpWaterLayers";
import { JP_TOURISM_LAYER_KEYS, type JpTourismLayerKey } from "../../data/jpTourismTypes";
import { jpWaterLocalResearchEnabled } from "../../data/jpWaterTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 日本行政區：都道府県界 + 市区町村界（各自獨立的 PMTiles polygon 子層）。 */
export const JpAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpAdminLayers");
  const prefecture = useKeyOverlayParams("jpAdminPrefecture");
  const municipality = useKeyOverlayParams("jpAdminBoundaries");
  useJpAdminLayers(
    deps.mapRef,
    {
      jpAdminPrefecture: deps.layerVisibility.jpAdminPrefecture,
      jpAdminBoundaries: deps.layerVisibility.jpAdminBoundaries,
    },
    {
      jpAdminPrefecture: prefecture.jpAdminPrefectureOpacity ?? 0.2,
      jpAdminBoundaries: municipality.jpAdminBoundariesOpacity ?? 0.15,
    },
  );
  return null;
};

/** 日本車站：GeoJSON circle，lazy fetch。 */
export const JpStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpStationsLayer");
  const p = useKeyOverlayParams("jpStations");
  const colorMode = p.jpStationsColorModeIdx === 1 ? "ridership" : "type";
  useJpStationsLayer(
    deps.mapRef,
    deps.layerVisibility.jpStations,
    p.jpStationsOpacity ?? 0.85,
    p.jpStationsScale ?? 1,
    colorMode,
  );
  return null;
};

/** 日本機場：GeoJSON fill+line，lazy fetch。 */
export const JpAirportsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpAirportsLayer");
  const p = useKeyOverlayParams("jpAirports");
  const displayMode = p.jpAirportsDisplayModeIdx === 1 ? "polygon" : "point";
  useJpAirportsLayer(
    deps.mapRef,
    deps.layerVisibility.jpAirports,
    p.jpAirportsOpacity ?? 0.5,
    displayMode,
  );
  return null;
};

/** 日本鐵道路線：PMTiles line，按事業者種別分色，無時間維度。 */
export const JpRailwaysHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpRailwaysLayer");
  const p = useKeyOverlayParams("jpRailways");
  useJpRailwaysLayer(
    deps.mapRef,
    deps.layerVisibility.jpRailways,
    p.jpRailwaysOpacity ?? 0.9,
  );
  return null;
};

/** 日本學校：PMTiles point，按学校分類 13 色分色，無時間維度。 */
export const JpSchoolsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpSchoolsLayer");
  const p = useKeyOverlayParams("jpSchools");
  useJpSchoolsLayer(
    deps.mapRef,
    deps.layerVisibility.jpSchools,
    p.jpSchoolsOpacity ?? 0.75,
    p.jpSchoolsScale ?? 1,
  );
  return null;
};

/** 日本 1km 人口網格：PMTiles polygon choropleth，9 種指標／年份由 select 切換。 */
export const JpPopulationMeshHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpPopulationMeshLayer");
  const p = useKeyOverlayParams("jpPopulationMesh1km");
  useJpPopulationMeshLayer(
    deps.mapRef,
    deps.layerVisibility.jpPopulationMesh1km,
    p.jpPopulationMeshOpacity ?? 0.55,
    p.jpPopulationMeshModeIdx ?? 0,
  );
  return null;
};

export const JpPoliceFacilitiesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpPoliceFacilitiesLayer");
  const p = useKeyOverlayParams("jpPoliceFacilities");
  useJpPoliceFacilitiesLayer(deps.mapRef, deps.layerVisibility.jpPoliceFacilities,
    p.jpPoliceFacilitiesOpacity ?? 0.75, p.jpPoliceFacilitiesScale ?? 1, p.jpPoliceFacilitiesTypeIdx ?? 0);
  return null;
};

export const JpWaterHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpWaterLayers");
  const localResearchEnabled = jpWaterLocalResearchEnabled();
  const lakes = useKeyOverlayParams("jpWaterLakes");
  const dams = useKeyOverlayParams("jpWaterDams");
  const rivers = useKeyOverlayParams("jpWaterRivers");
  const supply = useKeyOverlayParams("jpWaterSupplyFacilities");
  const supplyAreas = useKeyOverlayParams("jpWaterSupplyAreas");
  const sewer = useKeyOverlayParams("jpWaterSewerFacilities");
  const groundwater = useKeyOverlayParams("jpWaterGroundwaterSites");
  const nilim = useKeyOverlayParams("jpWaterNilimDams");
  const agri = useKeyOverlayParams("jpWaterAgriculturalPonds");
  const flood = useKeyOverlayParams("jpWaterFloodHazard");
  const facilities = useKeyOverlayParams("jpWaterLocalFacilities");
  const quality = useKeyOverlayParams("jpWaterQualityStations");
  const levels = useKeyOverlayParams("jpWaterLevelStations");
  useJpWaterLayers(deps.mapRef, {
    jpWaterDams: localResearchEnabled && deps.layerVisibility.jpWaterDams,
    jpWaterLakes: deps.layerVisibility.jpWaterLakes,
    jpWaterRivers: localResearchEnabled && deps.layerVisibility.jpWaterRivers,
    jpWaterSupplyFacilities: localResearchEnabled && deps.layerVisibility.jpWaterSupplyFacilities,
    jpWaterSupplyAreas: localResearchEnabled && deps.layerVisibility.jpWaterSupplyAreas,
    jpWaterSewerFacilities: localResearchEnabled && deps.layerVisibility.jpWaterSewerFacilities,
    jpWaterGroundwaterSites: localResearchEnabled && deps.layerVisibility.jpWaterGroundwaterSites,
    jpWaterNilimDams: localResearchEnabled && deps.layerVisibility.jpWaterNilimDams,
    jpWaterAgriculturalPonds: localResearchEnabled && deps.layerVisibility.jpWaterAgriculturalPonds,
    jpWaterFloodHazard: deps.layerVisibility.jpWaterFloodHazard,
    jpWaterLocalFacilities: deps.layerVisibility.jpWaterLocalFacilities,
    jpWaterQualityStations: deps.layerVisibility.jpWaterQualityStations,
    jpWaterLevelStations: deps.layerVisibility.jpWaterLevelStations,
  }, {
    jpWaterDams: dams.jpWaterDamsOpacity ?? 0.85,
    jpWaterLakes: lakes.jpWaterLakesOpacity ?? 0.35,
    jpWaterRivers: rivers.jpWaterRiversOpacity ?? 0.75,
    jpWaterSupplyFacilities: supply.jpWaterSupplyFacilitiesOpacity ?? 0.85,
    jpWaterSupplyAreas: supplyAreas.jpWaterSupplyAreasOpacity ?? 0.18,
    jpWaterSewerFacilities: sewer.jpWaterSewerFacilitiesOpacity ?? 0.82,
    jpWaterGroundwaterSites: groundwater.jpWaterGroundwaterSitesOpacity ?? 0.82,
    jpWaterNilimDams: nilim.jpWaterNilimDamsOpacity ?? 0.82,
    jpWaterAgriculturalPonds: agri.jpWaterAgriculturalPondsOpacity ?? 0.55,
    jpWaterFloodHazard: flood.jpWaterFloodHazardOpacity ?? 0.7,
    jpWaterLocalFacilities: facilities.jpWaterLocalFacilitiesOpacity ?? 0.85,
    jpWaterQualityStations: quality.jpWaterQualityStationsOpacity ?? 0.75,
    jpWaterLevelStations: levels.jpWaterLevelStationsOpacity ?? 0.85,
  });
  return <JpWaterAlert />;
};

/** 日本旅宿、自然保護與世界遺產：production PMTiles/GeoJSON + DEV-only research layers。 */
export const JpTourismHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpTourismLayers");
  const canonical = useKeyOverlayParams("jpAccommodationCanonical");
  const jta = useKeyOverlayParams("jpAccommodationJta");
  const local = useKeyOverlayParams("jpAccommodationLocal");
  const osm = useKeyOverlayParams("jpAccommodationOsm");
  const parksNational = useKeyOverlayParams("jpNaturalParksNational");
  const parksQuasi = useKeyOverlayParams("jpNaturalParksQuasiNational");
  const parksPrefectural = useKeyOverlayParams("jpNaturalParksPrefectural");
  const conservation = useKeyOverlayParams("jpNatureConservationArea");
  const primitive = useKeyOverlayParams("jpPrimitiveNatureEnvironmentArea");
  const specialConservation = useKeyOverlayParams("jpNatureConservationSpecialDistrict");
  const wildlife = useKeyOverlayParams("jpWildlifeProtectionNational");
  const wildlifeSpecial = useKeyOverlayParams("jpWildlifeSpecialProtectionDistrict");
  const wildlifeDesignated = useKeyOverlayParams("jpWildlifeSpecialProtectionDesignatedArea");
  const unescoCultural = useKeyOverlayParams("jpWorldHeritageCultural");
  const unescoNatural = useKeyOverlayParams("jpWorldHeritageNatural");
  const a28 = useKeyOverlayParams("jpWorldNaturalHeritageHistorical");
  const ramsar = useKeyOverlayParams("jpRamsarSites");
  const ebsa = useKeyOverlayParams("jpMarineEbsaCoastal");

  const visibility = useMemo(() => Object.fromEntries(
    JP_TOURISM_LAYER_KEYS.map((key) => [key, deps.layerVisibility[key]]),
  ) as Record<JpTourismLayerKey, boolean>, [deps.layerVisibility]);
  const opacity = useMemo(() => ({
    jpAccommodationCanonical: canonical.jpAccommodationCanonicalOpacity ?? 0.85,
    jpAccommodationJta: jta.jpAccommodationJtaOpacity ?? 0.85,
    jpAccommodationLocal: local.jpAccommodationLocalOpacity ?? 0.85,
    jpAccommodationOsm: osm.jpAccommodationOsmOpacity ?? 0.72,
    jpNaturalParksNational: parksNational.jpNaturalParksNationalOpacity ?? 0.28,
    jpNaturalParksQuasiNational: parksQuasi.jpNaturalParksQuasiNationalOpacity ?? 0.25,
    jpNaturalParksPrefectural: parksPrefectural.jpNaturalParksPrefecturalOpacity ?? 0.22,
    jpNatureConservationArea: conservation.jpNatureConservationAreaOpacity ?? 0.25,
    jpPrimitiveNatureEnvironmentArea: primitive.jpPrimitiveNatureEnvironmentAreaOpacity ?? 0.3,
    jpNatureConservationSpecialDistrict: specialConservation.jpNatureConservationSpecialDistrictOpacity ?? 0.28,
    jpWildlifeProtectionNational: wildlife.jpWildlifeProtectionNationalOpacity ?? 0.25,
    jpWildlifeSpecialProtectionDistrict: wildlifeSpecial.jpWildlifeSpecialProtectionDistrictOpacity ?? 0.28,
    jpWildlifeSpecialProtectionDesignatedArea: wildlifeDesignated.jpWildlifeSpecialProtectionDesignatedAreaOpacity ?? 0.32,
    jpWorldHeritageCultural: unescoCultural.jpWorldHeritageCulturalOpacity ?? 0.9,
    jpWorldHeritageNatural: unescoNatural.jpWorldHeritageNaturalOpacity ?? 0.9,
    jpWorldNaturalHeritageHistorical: a28.jpWorldNaturalHeritageHistoricalOpacity ?? 0.25,
    jpRamsarSites: ramsar.jpRamsarSitesOpacity ?? 0.9,
    jpMarineEbsaCoastal: ebsa.jpMarineEbsaCoastalOpacity ?? 0.22,
  }), [canonical, jta, local, osm, parksNational, parksQuasi, parksPrefectural, conservation, primitive, specialConservation, wildlife, wildlifeSpecial, wildlifeDesignated, unescoCultural, unescoNatural, a28, ramsar, ebsa]);
  const scale = useMemo(() => ({
    jpAccommodationCanonical: canonical.jpAccommodationCanonicalScale ?? 1,
    jpAccommodationJta: jta.jpAccommodationJtaScale ?? 1,
    jpAccommodationLocal: local.jpAccommodationLocalScale ?? 1,
    jpAccommodationOsm: osm.jpAccommodationOsmScale ?? 1,
    jpWorldHeritageCultural: unescoCultural.jpWorldHeritageCulturalScale ?? 1,
    jpWorldHeritageNatural: unescoNatural.jpWorldHeritageNaturalScale ?? 1,
    jpRamsarSites: ramsar.jpRamsarSitesScale ?? 1,
  }), [canonical, jta, local, osm, unescoCultural, unescoNatural, ramsar]);
  const ramsarMode = (["name_match", "degraded", "all"] as const)[ramsar.jpRamsarGeometryIdx ?? 0] ?? "name_match";
  useJpTourismLayers(deps.mapRef, visibility, opacity, scale, ramsarMode);
  return null;
};

/** 日本靜態醫療：可見時才讀 allowlist，點位與詳情均按需載入。 */
export const JpMedicalHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpMedicalLayers");
  const hospitals = useKeyOverlayParams("jpMedicalHospitals");
  const clinics = useKeyOverlayParams("jpMedicalClinics");
  const dental = useKeyOverlayParams("jpMedicalDental");
  const maternity = useKeyOverlayParams("jpMedicalMaternity");
  const pharmacies = useKeyOverlayParams("jpMedicalPharmacies");
  const carePlanning = useKeyOverlayParams("jpCarePlanning");
  const careHomeVisit = useKeyOverlayParams("jpCareHomeVisit");
  const careDayServices = useKeyOverlayParams("jpCareDayServices");
  const careResidential = useKeyOverlayParams("jpCareResidential");
  const careCombined = useKeyOverlayParams("jpCareCombined");
  const careEquipment = useKeyOverlayParams("jpCareEquipment");
  const areasPrimary = useKeyOverlayParams("jpMedicalAreasPrimary");
  const areasSecondary = useKeyOverlayParams("jpMedicalAreasSecondary");
  const areasTertiary = useKeyOverlayParams("jpMedicalAreasTertiary");
  const medicalKeys = [
    "jpMedicalHospitals", "jpMedicalClinics", "jpMedicalDental", "jpMedicalMaternity", "jpMedicalPharmacies",
    "jpCarePlanning", "jpCareHomeVisit", "jpCareDayServices", "jpCareResidential", "jpCareCombined", "jpCareEquipment",
    "jpMedicalAreasPrimary", "jpMedicalAreasSecondary", "jpMedicalAreasTertiary",
  ] as const;
  useJpMedicalLayers(deps.mapRef, {
    jpMedicalHospitals: deps.layerVisibility.jpMedicalHospitals,
    jpMedicalClinics: deps.layerVisibility.jpMedicalClinics,
    jpMedicalDental: deps.layerVisibility.jpMedicalDental,
    jpMedicalMaternity: deps.layerVisibility.jpMedicalMaternity,
    jpMedicalPharmacies: deps.layerVisibility.jpMedicalPharmacies,
    jpCarePlanning: deps.layerVisibility.jpCarePlanning,
    jpCareHomeVisit: deps.layerVisibility.jpCareHomeVisit,
    jpCareDayServices: deps.layerVisibility.jpCareDayServices,
    jpCareResidential: deps.layerVisibility.jpCareResidential,
    jpCareCombined: deps.layerVisibility.jpCareCombined,
    jpCareEquipment: deps.layerVisibility.jpCareEquipment,
    jpMedicalAreasPrimary: deps.layerVisibility.jpMedicalAreasPrimary,
    jpMedicalAreasSecondary: deps.layerVisibility.jpMedicalAreasSecondary,
    jpMedicalAreasTertiary: deps.layerVisibility.jpMedicalAreasTertiary,
  }, {
    ...hospitals, ...clinics, ...dental, ...maternity, ...pharmacies,
    ...carePlanning, ...careHomeVisit, ...careDayServices, ...careResidential, ...careCombined, ...careEquipment,
    ...areasPrimary, ...areasSecondary, ...areasTertiary,
  });
  return medicalKeys.some((key) => deps.layerVisibility[key]) ? <JpMedicalAlert /> : null;
};
import { useMemo } from "react";
