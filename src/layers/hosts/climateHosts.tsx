// 全球氣候 / 世界 / 災防告警 / 共機活動區的 Layer Host（AR-22 P2）
// —— App.tsx 原 L1088-1201

import { useEarthquakesGlobalLayer } from "../../hooks/useEarthquakesGlobalLayer";
import { useTyphoonTracksLayer, type TyphoonSource } from "../../hooks/useTyphoonTracksLayer";
import { useWorldTrashDebrisLayer } from "../../hooks/useWorldTrashDebrisLayer";
import { useClimateParticleLineLayer } from "../../hooks/useClimateParticleLineLayer";
import { useDustForecastLayer } from "../../hooks/useDustForecastLayer";
import { useDisasterAlertLayer } from "../../hooks/useDisasterAlertLayer";
import { usePlaActivityLayer } from "../../hooks/usePlaActivityLayer";
import { useVesselWatchLayer } from "../../hooks/useVesselWatchLayer";
// 色帶集中在 climateRamps（module-level 常數，避免每次 render 新 object 觸發 hook re-mount）；
// LegendPanel 圖例吃同一份，改色階兩邊自動同步。
import {
  WIND_FIELD_RAMP, WIND_SPEED_MAX, OCEAN_CURRENTS_RAMP, OCEAN_SPEED_MAX,
} from "../../map/climateRamps";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramBool, paramNum, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

/** 全球地震（USGS） */
export const EarthquakesGlobalHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEarthquakesGlobalLayer");
  const p = useKeyOverlayParams("earthquakesGlobal");
  useEarthquakesGlobalLayer(
    deps.mapRef,
    deps.layerVisibility.earthquakesGlobal,
    p.earthquakesGlobalOpacity ?? 0.9,
  );
  return null;
};

/** 颱風路徑（JMA / JTWC 雙源，select 切換） */
export const TyphoonTracksHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTyphoonTracksLayer");
  const p = useKeyOverlayParams("typhoonTracks");
  useTyphoonTracksLayer(
    deps.mapRef,
    deps.layerVisibility.typhoonTracks,
    p.typhoonTracksOpacity ?? 0.9,
    (["all", "jma", "jtwc"][p.typhoonSourceIdx ?? 0] ?? "all") as TyphoonSource,
  );
  return null;
};

/** 🌍 世界 WORLD：全球垃圾殘骸（Outerview 靜態 GeoJSON，載一次，不接 timeline） */
export const WorldTrashDebrisHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useWorldTrashDebrisLayer");
  const p = useKeyOverlayParams("worldTrashDebris");
  useWorldTrashDebrisLayer(
    deps.mapRef,
    deps.layerVisibility.worldTrashDebris,
    p.worldTrashDebrisOpacity ?? 0.85,
  );
  return null;
};

/** 風場：地理座標 WebGL instanced 細線，全 zoom 涵蓋（drape 已移除，mercator 投影下線層各 zoom 皆正確）。 */
export const WindFieldHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useClimateParticleLineLayer:wind");
  const p = useKeyOverlayParams("windField");
  useClimateParticleLineLayer(deps.mapRef, {
    layerId: "climate-windfield",
    pngUrl: "/climate/wind10m_latest.png",
    metaUrl: "/climate/wind10m_latest.json",
    frameDataset: "wind10m",
    statusKey: "windField",
    visible: deps.layerVisibility.windField,
    opacity: p.windFieldOpacity ?? 0.8,
    animationSpeed: p.windAnimationSpeed ?? 1.0,
    particleCount: Math.floor(p.windParticleCount ?? 7_000),
    lineWidth: p.windLineWidth ?? 1.15,
    speedMax: WIND_SPEED_MAX,
    rampColors: WIND_FIELD_RAMP,
    timeScaleSeconds: 18_000,
    trailPoints: 22,
    particleAlpha: 0.66,
  });
  return null;
};

/** 海流：地理座標 WebGL instanced 細線 + strict ocean mask，全 zoom 涵蓋。 */
export const OceanCurrentsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useClimateParticleLineLayer:ocean");
  const p = useKeyOverlayParams("oceanCurrents");
  useClimateParticleLineLayer(deps.mapRef, {
    layerId: "climate-ocean-currents",
    pngUrl: "/climate/currents_latest.png",
    metaUrl: "/climate/currents_latest.json",
    frameDataset: "currents",
    statusKey: "oceanCurrents",
    visible: deps.layerVisibility.oceanCurrents,
    opacity: p.oceanCurrentsOpacity ?? 0.65,
    animationSpeed: p.oceanAnimationSpeed ?? 1.0,
    particleCount: Math.floor(p.oceanParticleCount ?? 8_000),
    lineWidth: p.oceanLineWidth ?? 1.05,
    speedMax: OCEAN_SPEED_MAX,
    rampColors: OCEAN_CURRENTS_RAMP,
    timeScaleSeconds: 86_400,
    trailPoints: 20,
    maskErodePx: 1,
    particleAlpha: 0.62,
  });
  return null;
};

/** 沙塵預報 raster overlay（CAMS duaod550 預烤棕色色階 + alpha mask） */
export const DustForecastHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useDustForecastLayer");
  const p = useKeyOverlayParams("dustForecast");
  useDustForecastLayer(
    deps.mapRef,
    deps.layerVisibility.dustForecast,
    p.dustForecastOpacity ?? 0.7,
  );
  return null;
};

/**
 * NCDR Disaster Alerts timeline（5 主題群組共用 source）。
 * ⚠️ `daOpacity` 掛在 **`lifelineAlerts`** 這個 key 下（不是每個群組各一份）——
 * 逐字照抄 `useLayerParamsRuntime` 的第二通道來源。
 */
export const DisasterAlertHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useDisasterAlertLayer");
  const values = useLayerParams("lifelineAlerts");
  const v = deps.layerVisibility;
  useDisasterAlertLayer(
    deps.mapRef,
    {
      lifelineAlerts: v.lifelineAlerts,
      floodAlerts: v.floodAlerts,
      weatherAlerts: v.weatherAlerts,
      transitAlerts: v.transitAlerts,
      safetyAlerts: v.safetyAlerts,
    },
    paramNum(values, "lifelineAlerts", "daOpacity"),
  );
  return null;
};

/**
 * 共機活動區（航跡示意圖向量化；依日期回放 + 30/60/90/120 天疊加）。
 *
 * 歷史模式走 HistoricalTimeline 的 年/月/日（它不寫 timeStore），所以要把日期
 * 算成視窗結束日交給圖層（`plaHistoricalDate`，在 App 端算好經 deps 傳入）；
 * 同時停掉圖層自己的回放，避免兩個 clock 互相打架。
 */
export const PlaActivityHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePlaActivityLayer");
  const values = useLayerParams("plaActivity");
  usePlaActivityLayer(
    deps.mapRef,
    deps.layerVisibility.plaActivity,
    paramNum(values, "plaActivity", "plaOpacity"),
    paramBool(values, "plaActivity", "plaShowReview"),
    paramNum(values, "plaActivity", "plaTrailDays"),
    deps.appMode === "realtime" && paramBool(values, "plaActivity", "plaReplay"),
    deps.plaHistoricalDate,
  );
  return null;
};

/**
 * 特殊船舶（AIS 海警／海巡／科研船／軍艦）。
 *
 * ⚠️ 純 Mapbox circle + line —— 不可改用 Three.js（`ships` 已佔用唯一的
 * CustomLayer 名額，見 useVesselWatchLayer 檔頭）。軌跡視窗結束日走 timeStore
 * 訂閱，故本 Host 不需要（也不可以）從 deps 拿時間。
 */
export const VesselWatchHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useVesselWatchLayer");
  const values = useLayerParams("vesselWatch");
  useVesselWatchLayer(
    deps.mapRef,
    deps.layerVisibility.vesselWatch,
    paramNum(values, "vesselWatch", "vesselWatchOpacity"),
    paramNum(values, "vesselWatch", "vesselWatchTrailDays"),
    paramBool(values, "vesselWatch", "vesselWatchShowPresumed"),
  );
  return null;
};
