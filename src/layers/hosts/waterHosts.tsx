// 水資源 / 水利的 Layer Host（AR-22 P2）—— App.tsx 原 L784-897

import { useReservoirStatusLayer } from "../../hooks/useReservoirStatusLayer";
import { useRainGaugeLayer } from "../../hooks/useRainGaugeLayer";
import { useFloodSensorLayer } from "../../hooks/useFloodSensorLayer";
import { useFloodSensorIsochroneLayer } from "../../hooks/useFloodSensorIsochroneLayer";
import { useTaipeiSewerLayer } from "../../hooks/useTaipeiSewerLayer";
import { useTaipeiEvacuateLayer } from "../../hooks/useTaipeiEvacuateLayer";
import { useTaipeiPumbLayer } from "../../hooks/useTaipeiPumbLayer";
import { usePrecipRasterLayer } from "../../hooks/usePrecipRasterLayer";
import { useRiverLevelLayer } from "../../hooks/useRiverLevelLayer";
import { useGroundwaterWellsLayer } from "../../hooks/useGroundwaterWellsLayer";
import { useGroundwaterLayer } from "../../hooks/useGroundwaterLayer";
import { useIotWraRiverLayer } from "../../hooks/useIotWraRiverLayer";
import { useIotWraStructureLayer } from "../../hooks/useIotWraStructureLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 水庫 3D 水位計（Three.js cylinder：外殼 = 容量、內水位 = 蓄水率） */
export const ReservoirStatusHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useReservoirStatusLayer");
  const p = useKeyOverlayParams("waterReservoirs");
  useReservoirStatusLayer(
    deps.mapRef,
    deps.layerVisibility.waterReservoirs,
    deps.isDarkTheme,
    p.reservoirPillarHeight ?? 1,
    p.waterReservoirsScale ?? 1,
    deps.reservoirSceneRef,
    deps.reservoirStatusesRef,
    deps.activeReservoirId,
  );
  return null;
};

/** Phase 2.1：即時雨量（Mapbox circle，0 bubble size for 無雨） */
export const RainGaugeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRainGaugeLayer");
  const p = useKeyOverlayParams("rainGauge");
  useRainGaugeLayer(
    deps.mapRef,
    deps.layerVisibility.rainGauge,
    deps.isDarkTheme,
    p.rainGaugeScale ?? 1,
    p.rainGaugeOpacity ?? 1,
  );
  return null;
};

/** 都市淹水感測器 USWG（Mapbox circle + 500m/1km buffer） */
export const FloodSensorHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFloodSensorLayer");
  const p = useKeyOverlayParams("floodSensor");
  useFloodSensorLayer(
    deps.mapRef,
    deps.layerVisibility.floodSensor,
    deps.isDarkTheme,
    p.floodSensorScale ?? 1,
    p.floodSensorOpacity ?? 1,
  );
  return null;
};

/** 雙北 USWG 3-min 步行等時圈（PMTiles，依站即時 depth_cm 著色） */
export const FloodSensorIsochroneHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFloodSensorIsochroneLayer");
  const p = useKeyOverlayParams("floodSensorIsochrone");
  useFloodSensorIsochroneLayer(
    deps.mapRef,
    deps.layerVisibility.floodSensorIsochrone,
    p.floodSensorIsochroneOpacity ?? 0.55,
  );
  return null;
};

/** 北市水利處水情即時三本柱之一：下水道水位（每 60s 重抓 latest） */
export const TaipeiSewerHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTaipeiSewerLayer");
  const p = useKeyOverlayParams("taipeiSewer");
  useTaipeiSewerLayer(
    deps.mapRef,
    deps.layerVisibility.taipeiSewer,
    p.taipeiSewerScale ?? 1,
    p.taipeiSewerOpacity ?? 0.85,
  );
  return null;
};

/** 北市水情三本柱之二：疏散門 */
export const TaipeiEvacuateHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTaipeiEvacuateLayer");
  const p = useKeyOverlayParams("taipeiEvacuate");
  useTaipeiEvacuateLayer(
    deps.mapRef,
    deps.layerVisibility.taipeiEvacuate,
    p.taipeiEvacuateScale ?? 1,
    p.taipeiEvacuateOpacity ?? 0.9,
  );
  return null;
};

/** 北市水情三本柱之三：抽水站 */
export const TaipeiPumbHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTaipeiPumbLayer");
  const p = useKeyOverlayParams("taipeiPumb");
  useTaipeiPumbLayer(
    deps.mapRef,
    deps.layerVisibility.taipeiPumb,
    p.taipeiPumbScale ?? 1,
    p.taipeiPumbOpacity ?? 0.9,
  );
  return null;
};

/** 累積雨量柵格（PNG raster image source，dropdown 切 1/3/6/24h） */
export const PrecipRasterHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePrecipRasterLayer");
  const p = useKeyOverlayParams("precipRaster");
  usePrecipRasterLayer(
    deps.mapRef,
    deps.layerVisibility.precipRaster,
    (p.precipRasterHours as 1 | 3 | 6 | 24) ?? 24,
    p.precipRasterOpacity ?? 0.6,
  );
  return null;
};

/** Phase 2.2：河川水位（Mapbox circle，check_result=0 異常紅） */
export const RiverLevelHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRiverLevelLayer");
  const p = useKeyOverlayParams("riverLevel");
  useRiverLevelLayer(
    deps.mapRef,
    deps.layerVisibility.riverLevel,
    deps.isDarkTheme,
    p.riverLevelScale ?? 1,
    p.riverLevelOpacity ?? 1,
  );
  return null;
};

/** W002：地下水井靜態 backdrop（站位灰點，always visible 不受 timeline 影響） */
export const GroundwaterWellsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGroundwaterWellsLayer");
  const p = useKeyOverlayParams("groundwaterWells");
  useGroundwaterWellsLayer(
    deps.mapRef,
    deps.layerVisibility.groundwaterWells,
    deps.isDarkTheme,
    p.groundwaterWellsScale ?? 1,
    p.groundwaterWellsOpacity ?? 1,
  );
  return null;
};

/** W002：地下水井動態層（當前 vs 當日起始水位 delta 著色，timeline 驅動） */
export const GroundwaterHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGroundwaterLayer");
  const p = useKeyOverlayParams("groundwater");
  useGroundwaterLayer(
    deps.mapRef,
    deps.layerVisibility.groundwater,
    deps.isDarkTheme,
    p.groundwaterScale ?? 1,
    p.groundwaterOpacity ?? 1,
  );
  return null;
};

/** IoT 河川（補強 riverLevel；migration 063 預聚合表，timeline 驅動） */
export const IotWraRiverHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIotWraRiverLayer");
  const p = useKeyOverlayParams("iotWraRiver");
  useIotWraRiverLayer(
    deps.mapRef,
    deps.layerVisibility.iotWraRiver,
    deps.isDarkTheme,
    p.iotWraRiverScale ?? 1,
    p.iotWraRiverOpacity ?? 1,
    !!(p.iotWraRiverShowMeasured ?? 1),
    !!(p.iotWraRiverShowForecast ?? 1),
  );
  return null;
};

/** IoT 水工結構（流量/閘門/堤防/沖刷/揚塵 5 in 1，純 latest snapshot） */
export const IotWraStructureHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIotWraStructureLayer");
  const p = useKeyOverlayParams("iotWraStructure");
  useIotWraStructureLayer(
    deps.mapRef,
    deps.layerVisibility.iotWraStructure,
    deps.isDarkTheme,
    p.iotWraStructureScale ?? 1,
    p.iotWraStructureOpacity ?? 1,
    !!(p.iotWraStructureFlow ?? 1),
    !!(p.iotWraStructureGate ?? 1),
    !!(p.iotWraStructureDam ?? 1),
    !!(p.iotWraStructureErosion ?? 1),
    !!(p.iotWraStructureDust ?? 1),
  );
  return null;
};
