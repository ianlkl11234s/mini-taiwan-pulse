// 災害 / 即時快照 / 地震的 Layer Host（AR-22 P2）—— App.tsx 原 L1040-1082

import { useLightningLayer, useNuclearLayer } from "../../hooks/useHazardLayer";
import { useErHospitalLayer } from "../../hooks/useErHospitalLayer";
import { useLibrarySeatsLayer } from "../../hooks/useLibrarySeatsLayer";
import { useParkingLayer } from "../../hooks/useParkingLayer";
import { useEarthquakeLayer } from "../../hooks/useEarthquakeLayer";
import { useEarthquakeReplayLayer } from "../../hooks/useEarthquakeReplayLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramNum, paramStr, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

/** 閃電（台電源） */
export const LightningHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useLightningLayer:tpc");
  const p = useKeyOverlayParams("lightning");
  useLightningLayer(
    deps.mapRef,
    deps.layerVisibility.lightning,
    p.lightningMinutes ?? 60,
  );
  return null;
};

/** 閃電（氣象署源，migration 338 雙源）—— 獨立 source / cache，可與台電源同時開著對照 */
export const LightningCwaHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useLightningLayer:cwa");
  const p = useKeyOverlayParams("lightningCwa");
  useLightningLayer(
    deps.mapRef,
    deps.layerVisibility.lightningCwa,
    p.lightningCwaMinutes ?? 60,
    "cwa",
  );
  return null;
};

/** 核安環境輻射 */
export const NuclearHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useNuclearLayer");
  useNuclearLayer(deps.mapRef, deps.layerVisibility.nuclearRadiation);
  return null;
};

/** 急診壅塞（當下快照，比照核安 LIVE） */
export const ErHospitalHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useErHospitalLayer");
  useErHospitalLayer(deps.mapRef, deps.layerVisibility.erHospital);
  return null;
};

/** 圖書館空位 */
export const LibrarySeatsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useLibrarySeatsLayer");
  useLibrarySeatsLayer(deps.mapRef, deps.layerVisibility.librarySeats);
  return null;
};

/** 停車 Parking（路邊 + 場外 當下快照，比照急診 LIVE） */
export const ParkingHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useParkingLayer");
  useParkingLayer(
    deps.mapRef,
    deps.layerVisibility.parkingOnstreet,
    deps.layerVisibility.parkingOffstreet,
    deps.timeMode,
  );
  return null;
};

/**
 * 地震事件時間軸。
 * ⚠️ `eqShowHistory` 的控件是 **select（timeline / history）**，傳給 hook 的仍是
 * 原本的 boolean —— 逐字照抄 runtime 的 `pStr(…, "eqMode") === "history"`。
 */
export const EarthquakeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEarthquakeLayer");
  const values = useLayerParams("earthquakes");
  useEarthquakeLayer(
    deps.mapRef,
    deps.layerVisibility.earthquakes,
    paramNum(values, "earthquakes", "eqOpacity"),
    paramStr(values, "earthquakes", "eqMode") === "history",
  );
  return null;
};

/** 地震回放（scoped 播放器，時鐘在 earthquakeReplayClock，不掛 timeStore） */
export const EarthquakeReplayHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEarthquakeReplayLayer");
  const values = useLayerParams("earthquakeReplay");
  useEarthquakeReplayLayer(
    deps.mapRef,
    deps.layerVisibility.earthquakeReplay,
    paramNum(values, "earthquakeReplay", "eqReplayOpacity"),
    deps.eqReplaySelectedId,
    deps.eqReplayPlaying,
    deps.onEqReplayEnd,
  );
  return null;
};
