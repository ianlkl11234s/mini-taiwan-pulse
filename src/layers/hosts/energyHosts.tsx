// 能源 / 電力 / 航空管制 / 環境污染的 Layer Host（AR-22 P2）—— App.tsx 原 L916-1033

import { useMemo } from "react";
import { useEnergyPoiLayer } from "../../hooks/useEnergyPoiLayer";
import { useFossilFuelLayers } from "../../hooks/useFossilFuelLayers";
import { useLivestockLayers } from "../../hooks/useLivestockLayers";
import { useA1AccidentRealtimeLayer } from "../../hooks/useA1AccidentRealtimeLayer";
import { useSubstationDiamondIcon } from "../../hooks/useSubstationDiamondIcon";
import { useOsmPowerLinesGlowLayer } from "../../hooks/useOsmPowerLinesGlowLayer";
import { usePowerPolesLayer } from "../../hooks/usePowerPolesLayer";
import { useAviationAirspaceLayer } from "../../hooks/useAviationAirspaceLayer";
import { useDroneZonesLayer } from "../../hooks/useDroneRestrictedZonesLayer";
import { usePollutionLayers } from "../../hooks/usePollutionLayers";
import { usePowerRegionBarsLayer } from "../../hooks/usePowerRegionBarsLayer";
import { usePowerGenerationBeamLayer } from "../../hooks/usePowerGenerationBeamLayer";
import { usePowerPlantGlowLayer } from "../../hooks/usePowerPlantGlowLayer";
import { useBuildingsNightBloomLayer } from "../../hooks/useBuildingsNightBloomLayer";
import { useSubstationEhvGlowLayer } from "../../hooks/useSubstationEhvGlowLayer";
import { usePowerLinesGlowTestLayer } from "../../hooks/usePowerLinesGlowTestLayer";
import { useAviationRestrictedGlowLayer } from "../../hooks/useAviationRestrictedGlowLayer";
import { FACILITY_MEDIA, type PollutionMedium } from "../../data/pollutionTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramBool, paramNum, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

/** Energy MVP：20 個 POI 子層共用一支 hook（一份 RPC / 一組 source） */
export const EnergyPoiHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEnergyPoiLayer");
  const v = deps.layerVisibility;
  useEnergyPoiLayer(deps.mapRef, {
    showPlants: v.powerPlants,
    showSubstations: v.osmSubstations,
    showSubstationsEhv: v.osmSubstationsEhv,
    showPowerLines: v.osmPowerLines,
    showPowerTowers: v.osmPowerTowers,
    showWindTurbines: v.osmWindTurbines,
    showSolarFarms: v.osmSolarFarms,
    showOsmPowerPlantsStatic: v.osmPowerPlantsStatic,
    showOffshoreWindZones: v.offshoreWindZones,
    showIslandPowerGrid: v.islandPowerGrid,
    showFossilFuelInfra: v.fossilFuelInfra,
    showGeothermalWells: v.geothermalWells,
    showRenewablePermitsTaipei: v.renewablePermitsTaipei,
    showEvCharging: v.evChargingStations,
    // Phase 8 SSOT 6-layer
    showFacPrimary: v.facPrimary,
    showFacOffshore: v.facOffshore,
    showFacPlanned: v.facPlanned,
    showFacHistorical: v.facHistorical,
    showFacSecondary: v.facSecondary,
    showFacOsmSupplement: v.facOsmSupplement,
  });
  return null;
};

/** 化石燃料：加油站（公開 get_gas_station_layers）+ 石化（owner-gated get_fossil_fuel_layers） */
export const FossilFuelHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFossilFuelLayers");
  useFossilFuelLayers({ mapRef: deps.mapRef, visibility: deps.layerVisibility });
  return null;
};

/** 畜牧 owner-only 動態層（get_livestock_farms / get_livestock_slaughterhouses） */
export const LivestockHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useLivestockLayers");
  useLivestockLayers({ mapRef: deps.mapRef, visibility: deps.layerVisibility });
  return null;
};

/** A1 即時死亡事故（rpc_a1_by_bbox，每 12h 更新） */
export const A1AccidentRealtimeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useA1AccidentRealtimeLayer");
  useA1AccidentRealtimeLayer(deps.mapRef, deps.layerVisibility.a1AccidentRealtime);
  return null;
};

/**
 * 變電所菱形 SDF icon 註冊（osmSubstations symbol layer 用）。
 * 沒有自己的 layer key —— 它是 `osmSubstations` 的 icon 前置作業，
 * 但不吃 visibility（icon 註冊是冪等的，missing image 事件驅動）。
 */
export const SubstationDiamondIconHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSubstationDiamondIcon");
  useSubstationDiamondIcon(deps.mapRef);
  return null;
};

/** Three.js bloom layer for 高壓輸電線（取代 Mapbox stacking） */
export const OsmPowerLinesGlowHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useOsmPowerLinesGlowLayer");
  const p = useKeyOverlayParams("osmPowerLines");
  useOsmPowerLinesGlowLayer(
    deps.mapRef,
    deps.layerVisibility.osmPowerLines,
    p.osmPowerLinesOpacity ?? 0.4,
    p.osmPowerLinesWidth ?? 1,
  );
  return null;
};

/** 電桿（z5 漸顯 + 熱度） */
export const PowerPolesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePowerPolesLayer");
  const p = useKeyOverlayParams("powerPoles");
  usePowerPolesLayer(
    deps.mapRef,
    deps.layerVisibility.powerPoles,
    p.powerPolesOpacity ?? 0.7,
    p.powerPolesSize ?? 1,
    p.powerPolesHeat ?? 1,
    p.powerPolesZ5Reveal ?? 0,
  );
  return null;
};

/** 航空管制區 + 限航區（一支 hook 兩個 key，各自 opacity） */
export const AviationAirspaceHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAviationAirspaceLayer");
  const control = useKeyOverlayParams("aviationControl");
  const restricted = useKeyOverlayParams("aviationRestricted");
  useAviationAirspaceLayer(
    deps.mapRef,
    deps.layerVisibility.aviationControl,
    deps.layerVisibility.aviationRestricted,
    control.aviationControlOpacity ?? 0.7,
    restricted.aviationRestrictedOpacity ?? 0.7,
  );
  return null;
};

/** 無人機禁航區 + 限航區 */
export const DroneZonesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useDroneZonesLayer");
  const nfz = useKeyOverlayParams("droneNoFlyZone");
  const restricted = useKeyOverlayParams("droneRestrictedZone");
  useDroneZonesLayer(
    deps.mapRef,
    deps.layerVisibility.droneNoFlyZone,
    deps.layerVisibility.droneRestrictedZone,
    nfz.droneNfzOpacity ?? 0.45,
    restricted.droneRestrictedOpacity ?? 0.45,
  );
  return null;
};

/**
 * 環境污染三層 filter（介質 / 嚴重度 / 年份時間軸 / 列管中）— paint 走 overlayManager。
 *
 * ⚠️ 三組 filter 值的 (key, param) **逐字照抄** `useLayerParamsRuntime` 的第二通道：
 * 裁處事件三兄弟（critical / general / mobile）是 `sharedGroup`，讀寫取
 * `pollutionPenaltyCritical` 當代表（同 runtime 的 `PENALTY_KEY`）。
 * `facilityMedia` 是 **7 個 key 的 Record，但只有 5 個有控件** ——
 * noise / other 沒有控件、恆為 false，這裡補常數（同 runtime）。
 */
const PENALTY_KEY = "pollutionPenaltyCritical";

export const PollutionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePollutionLayers");
  const facilityValues = useLayerParams("pollutionFacility");
  const penaltyValues = useLayerParams(PENALTY_KEY);
  const siteValues = useLayerParams("pollutionSite");

  const facilityMedia = useMemo<Record<PollutionMedium, boolean>>(() => {
    const out = { noise: false, other: false } as Record<PollutionMedium, boolean>;
    for (const m of FACILITY_MEDIA) {
      out[m] = paramBool(facilityValues, "pollutionFacility", `pollutionFacilityMedia_${m}`);
    }
    return out;
  }, [facilityValues]);

  const v = deps.layerVisibility;
  usePollutionLayers(
    deps.mapRef,
    {
      pollutionFacility: v.pollutionFacility,
      pollutionPenaltyCritical: v.pollutionPenaltyCritical,
      pollutionPenaltyGeneral: v.pollutionPenaltyGeneral,
      pollutionPenaltyMobile: v.pollutionPenaltyMobile,
      pollutionSite: v.pollutionSite,
    },
    {
      facilityMedia,
      facilityMinSev: paramNum(facilityValues, "pollutionFacility", "pollutionFacilityMinSev"),
      penaltyMediumIdx: paramNum(penaltyValues, PENALTY_KEY, "pollutionPenaltyMediumIdx"),
      penaltyYear: paramNum(penaltyValues, PENALTY_KEY, "pollutionPenaltyYear"),
      penaltyMode: paramNum(penaltyValues, PENALTY_KEY, "pollutionPenaltyMode"),
      siteActiveOnly: paramBool(siteValues, "pollutionSite", "pollutionSiteActiveOnly"),
    },
  );
  return null;
};

/**
 * 區域用電長條（opacity 是**硬寫的 0.55**，不是參數 —— 照抄不動）。
 * 資料由 App 的 `usePowerDashboard` 供給（ref 經 deps 傳入，見 HOOKS_IN_APP_LEDGER）。
 */
export const PowerRegionBarsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePowerRegionBarsLayer");
  usePowerRegionBarsLayer(
    deps.mapRef,
    deps.layerVisibility.powerRegionDemand,
    0.55,
    deps.powerDashboardRef,
  );
  return null;
};

/** 機組發電光柱 */
export const PowerGenerationBeamHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePowerGenerationBeamLayer");
  const p = useKeyOverlayParams("powerGenerationUnit");
  usePowerGenerationBeamLayer(
    deps.mapRef,
    deps.layerVisibility.powerGenerationUnit,
    p.powerGenerationOpacity ?? 0.7,
    p.powerGenerationHeight ?? 1,
  );
  return null;
};

/** 電廠光暈 */
export const PowerPlantGlowHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePowerPlantGlowLayer");
  const p = useKeyOverlayParams("powerPlantGlow");
  usePowerPlantGlowLayer(
    deps.mapRef,
    deps.layerVisibility.powerPlantGlow,
    p.powerPlantGlowOpacity ?? 0.9,
    p.powerPlantGlowSize ?? 1,
  );
  return null;
};

/** 夜景燈光 mode 3 的高樓 bloom 疊層（層開 且 顯示模式=夜景燈光 時才 render） */
export const BuildingsNightBloomHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useBuildingsNightBloomLayer");
  const p = useKeyOverlayParams("buildingsGba");
  useBuildingsNightBloomLayer(
    deps.mapRef,
    deps.layerVisibility.buildingsGba && (p.buildingsGbaModeIdx ?? 0) === 3,
    p.buildingsGbaOpacity ?? 0.75,
    p.buildingsGbaBloomMinHeight ?? 100,
  );
  return null;
};

/** 超高壓變電所光暈 */
export const SubstationEhvGlowHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSubstationEhvGlowLayer");
  const p = useKeyOverlayParams("substationEhvGlow");
  useSubstationEhvGlowLayer(
    deps.mapRef,
    deps.layerVisibility.substationEhvGlow,
    p.substationEhvGlowOpacity ?? 0.9,
    p.substationEhvGlowSize ?? 1,
  );
  return null;
};

/** 輸電線光暈（純 Mapbox 版，與 useOsmPowerLinesGlowLayer 並存） */
export const PowerLinesGlowTestHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePowerLinesGlowTestLayer");
  const p = useKeyOverlayParams("powerLinesGlow");
  usePowerLinesGlowTestLayer(
    deps.mapRef,
    deps.layerVisibility.powerLinesGlow,
    p.powerLinesGlowOpacity ?? 0.7,
    p.powerLinesGlowWidth ?? 2,
  );
  return null;
};

/** 限航區光暈 */
export const AviationRestrictedGlowHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAviationRestrictedGlowLayer");
  const p = useKeyOverlayParams("aviationRestrictedGlow");
  useAviationRestrictedGlowLayer(
    deps.mapRef,
    deps.layerVisibility.aviationRestrictedGlow,
    p.aviationRestrictedGlowOpacity ?? 0.85,
  );
  return null;
};
