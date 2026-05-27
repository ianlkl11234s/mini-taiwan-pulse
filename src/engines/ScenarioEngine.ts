/**
 * 想定引擎 — 把 inject 清單依 timeStore 的 unix 時間展開成當下狀態
 *
 * 純資料推導，無 React 依賴（仿 BusEngine 風格）。所有「想定相對秒」
 * 透過 scenario.startUnix 換成 unix 比對。
 */

import type {
  Scenario,
  FireInject,
  DispatchInject,
  BannerInject,
  CameraInject,
} from "../types/scenario";
import { computeDispatchUnits, type DispatchUnit } from "./DispatchEngine";

const DEFAULT_BANNER_HOLD_SEC = 8;

export interface FireState {
  id: string;
  origin: [number, number];
  radiusM: number;
  wind?: { bearingDeg: number; stretch: number };
}

export class ScenarioEngine {
  readonly scenario: Scenario;
  private fires: FireInject[];
  private dispatches: DispatchInject[];
  private banners: BannerInject[];
  private cameras: CameraInject[];
  /** camera inject 觸發水位（上次 poll 的 unix）；null = 尚未 poll */
  private lastPolledUnix: number | null = null;

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    const sorted = [...scenario.injects].sort((a, b) => a.at - b.at);
    this.fires = sorted.filter((i): i is FireInject => i.type === "fire");
    this.dispatches = sorted.filter((i): i is DispatchInject => i.type === "dispatch");
    this.banners = sorted.filter((i): i is BannerInject => i.type === "banner");
    this.cameras = sorted.filter((i): i is CameraInject => i.type === "camera");
  }

  private injectUnix(at: number): number {
    return this.scenario.startUnix + at;
  }

  /** 當下所有燃燒中的火場（含依 ramp 算出的半徑） */
  getActiveFires(unix: number): FireState[] {
    const out: FireState[] = [];
    for (const f of this.fires) {
      const ignite = this.injectUnix(f.at);
      if (unix < ignite) continue;
      if (f.endAt != null && unix > this.injectUnix(f.endAt)) continue;
      const elapsed = unix - ignite;
      const { startRadiusM, maxRadiusM, rampSec } = f.growth;
      const t = rampSec > 0 ? Math.min(1, elapsed / rampSec) : 1;
      const radiusM = startRadiusM + (maxRadiusM - startRadiusM) * t;
      out.push({ id: f.id, origin: f.origin, radiusM, wind: f.wind });
    }
    return out;
  }

  /** 當下所有已出動單位的位置 */
  getDispatchUnits(unix: number): DispatchUnit[] {
    return computeDispatchUnits(this.dispatches, this.scenario.startUnix, unix);
  }

  /** 已出動單位的路線（供 context 顯示，單位抵達後即收起） */
  getActiveRoutes(unix: number): [number, number][][] {
    const out: [number, number][][] = [];
    for (const d of this.dispatches) {
      const elapsed = unix - this.injectUnix(d.at);
      if (elapsed >= 0 && elapsed <= d.durationSec) out.push(d.route);
    }
    return out;
  }

  /** 當下應顯示的播報文字（重疊時取最新觸發者） */
  getCurrentBanner(unix: number): string | null {
    let active: string | null = null;
    let activeAt = -Infinity;
    for (const b of this.banners) {
      const start = this.injectUnix(b.at);
      const end = start + (b.holdSec ?? DEFAULT_BANNER_HOLD_SEC);
      if (unix >= start && unix < end && b.at >= activeAt) {
        active = b.text;
        activeAt = b.at;
      }
    }
    return active;
  }

  /**
   * 取得自上次 poll 後應觸發的 camera inject。
   * - 首次 poll 或往回 seek：回傳「當下時間點之前最近一個」以還原鏡頭/圖層狀態
   * - 往前播放：回傳期間內新跨過的所有 camera inject
   */
  pollCameraInjects(unix: number): CameraInject[] {
    let result: CameraInject[];
    if (this.lastPolledUnix === null || unix < this.lastPolledUnix) {
      const past = this.cameras.filter((c) => this.injectUnix(c.at) <= unix);
      result = past.length > 0 ? [past[past.length - 1]!] : [];
    } else {
      const from = this.lastPolledUnix;
      result = this.cameras.filter((c) => {
        const u = this.injectUnix(c.at);
        return u > from && u <= unix;
      });
    }
    this.lastPolledUnix = unix;
    return result;
  }
}
