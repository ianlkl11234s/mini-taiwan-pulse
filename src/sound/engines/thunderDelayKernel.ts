/**
 * 雷聲延遲傳播（理想化點事件＋固定聲速）：Δt = d / c。
 * 區分 flash_time（閃光）與 perceived_arrival_time（接收者聽到雷聲開始）。
 * 無通道高度時以水平距離近似並標 propagation_approximation='2d'。
 */
import { COMMON, THUNDER } from "../model/soundProfiles";
import { slantDistanceM } from "./geometryDistance";
import type { ThunderTiming } from "../types";

export function soundDelayS(distanceM: number, speedMps: number = COMMON.speedOfSoundMps.value): number {
  return distanceM / speedMps;
}

export function thunderTiming(
  flashTime: number,
  horizontalDistanceM: number,
  channelHeightM: number | null = null,
  envelopeDurationS: number = THUNDER.envelopeDurationS.value,
): ThunderTiming & { distanceM: number } {
  const approx = channelHeightM == null ? "2d" : "3d";
  const distanceM = channelHeightM == null ? horizontalDistanceM : slantDistanceM(horizontalDistanceM, channelHeightM);
  const delayS = soundDelayS(distanceM);
  const perceivedArrivalTime = flashTime + delayS;
  return {
    flashTime,
    perceivedArrivalTime,
    envelopeEndTime: perceivedArrivalTime + envelopeDurationS,
    delayS,
    propagationApproximation: approx,
    distanceM,
  };
}
