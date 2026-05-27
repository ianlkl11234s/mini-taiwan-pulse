/**
 * 消防兵棋推演 — 引導式想定（scripted scenario）資料模型
 *
 * 想定 = 一串以「想定相對秒」(at) 為軸的 inject。引擎把 at 映射到 unix
 * （unix = scenario.startUnix + at），再交給既有 timeStore 時鐘播放。
 *
 * 注意：這不是模擬引擎。火場成長走簡化規則（半徑隨時間 ramp，風向拉長橢圓），
 * 單位移動走 LineString 線性插值，全部由 timeStore.getTime() 推導，無物理。
 */

import type { LayerVisibility } from "./index";

export type InjectType = "fire" | "dispatch" | "banner" | "camera";

interface BaseInject {
  id: string;
  /** 想定相對秒（從 t=0 起算） */
  at: number;
  /** 主持人 inject 清單顯示用標籤 */
  label?: string;
}

/** 火場：在某點點燃，半徑依成長曲線擴大，風向把足跡拉成橢圓 */
export interface FireInject extends BaseInject {
  type: "fire";
  origin: [number, number]; // [lng, lat]
  growth: {
    startRadiusM: number;
    maxRadiusM: number;
    /** 從 startRadius 漲到 maxRadius 所需的想定秒數 */
    rampSec: number;
  };
  wind?: {
    /** 風吹向的方位角（度，0=北、90=東） */
    bearingDeg: number;
    /** 沿風向的拉長倍率（1 = 正圓） */
    stretch: number;
  };
  /** 撲滅時間（想定相對秒）；未指定則持續到想定結束 */
  endAt?: number;
}

/** 出動：單位沿 route 由起點開到火場，durationSec 內走完 */
export interface DispatchInject extends BaseInject {
  type: "dispatch";
  route: [number, number][]; // LineString [lng, lat][]
  durationSec: number;
  unitKind: "engine" | "ambulance" | "ladder";
}

/** 字幕／播報：在 at 時刻顯示一段文字 */
export interface BannerInject extends BaseInject {
  type: "banner";
  text: string;
  /** 顯示持續秒數（想定秒），預設 8 */
  holdSec?: number;
}

/** 鏡頭 + 圖層開關：對齊 CameraPreset，複用 App 既有 flyTo + setLayerVisibility */
export interface CameraInject extends BaseInject {
  type: "camera";
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  layers?: Partial<LayerVisibility>;
}

export type Inject = FireInject | DispatchInject | BannerInject | CameraInject;

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** 進場鏡頭 */
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
  /** 想定 t=0 對應的 unix 時間（驅動時鐘顯示與視窗起點） */
  startUnix: number;
  /** 想定總長（秒） */
  durationSec: number;
  /** 預設播放倍速 */
  defaultSpeed?: number;
  injects: Inject[];
}
