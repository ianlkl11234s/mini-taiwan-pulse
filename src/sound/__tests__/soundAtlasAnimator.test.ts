import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Feature } from "geojson";
import { timeStore } from "../../state/timeStore";
import { areaPaths } from "../../components/sound/SoundDayProfile";
import { ANIM_CAPS, ANIM_SOURCE, SoundAtlasAnimator, hash01, rainDropCount, ripplePhase, type AnimatorState } from "../soundAtlasAnimator";
import type { ReceiverQueryResult } from "../engines/receiverQuery";
import { flightRowsToFlights, type FlightTrailRow } from "../../data/flightTrails";
import { flightsToAviationRecords } from "../sourceAdapters/aviationAdapter";
import type { SoundSourceRecord, SourceContribution } from "../types";
import { DAY_START, RECV, latNorth } from "./fixtures";

describe("動畫純函式（強度只跟相對潛勢成比例）", () => {
  it("波紋週期：潛勢越高越快；相位在 0–1", () => {
    // 同一時刻，高潛勢的相位前進更多圈
    const lo = ripplePhase(1200, 0, 0, 1);
    const hi = ripplePhase(1200, 1, 0, 1);
    expect(lo).toBeCloseTo(0.5, 5); // 2400 ms 週期
    expect(hi).toBeCloseTo(0.2, 5); // 1000 ms 週期
    expect(ripplePhase(-500, 0.5, 2, 3)).toBeGreaterThanOrEqual(0);
  });

  it("雨滴數：無雨 0 顆、只跟潛勢成比例、有上限", () => {
    expect(rainDropCount(0)).toBe(0);
    expect(rainDropCount(Number.NaN)).toBe(0);
    expect(rainDropCount(0.01)).toBe(1);
    expect(rainDropCount(0.5, 20)).toBe(10);
    expect(rainDropCount(1, 20)).toBe(20);
  });

  it("hash01 決定性且在 [0,1)", () => {
    expect(hash01(3, 7)).toBe(hash01(3, 7));
    for (let i = 0; i < 50; i++) {
      const h = hash01(i, i * 13);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("24h 面積：unknown 斷開成不同區塊、全 0 的區塊不畫", () => {
    const paths = areaPaths([0.5, 0.2, null, 0.4, 0, 0], ["active", "active", "unknown", "active", "inactive", "inactive"], 0, 10, 100, 0);
    expect(paths).toHaveLength(2);
    expect(paths[0]).toMatch(/^M0\.00 100L0\.00 50\.00L10\.00 50\.00L10\.00 80\.00L20\.00 80\.00L20\.00 100Z$/);
    expect(areaPaths([0, 0], ["inactive", "inactive"], 0, 10, 100, 0)).toEqual([]);
  });
});

/** 從 lat0 往 lat1 直線飛 120 秒（高度 300，單位依 flight_id 規則；只用來產生位置） */
function row(flight_id: string, lat0: number, lat1: number): FlightTrailRow {
  const pts = [[lat0, RECV.longitude, 300, DAY_START], [lat1, RECV.longitude, 300, DAY_START + 120]];
  return { flight_id, callsign: flight_id.toUpperCase(), aircraft_type: "", origin: "", destination: "", trail: pts.map((p) => p.join(",")).join(";") };
}

describe("SoundAtlasAnimator（假地圖，手動推影格）", () => {
  let rafCb: FrameRequestCallback | null = null;
  afterEach(() => {
    vi.unstubAllGlobals();
    rafCb = null;
  });

  function setup(state: Partial<AnimatorState>) {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { rafCb = cb; return 1; });
    vi.stubGlobal("cancelAnimationFrame", () => { rafCb = null; });
    const setData = vi.fn();
    const map = { getSource: (id: string) => (id === ANIM_SOURCE ? { setData } : undefined) } as unknown as MapboxMap;
    const anim = new SoundAtlasAnimator(map, () => null, {
      receiver: RECV, result: null, records: new Map(), thunderStrikes: [],
      flags: { aviation: true, rain: true, thunder: true, waste_collection: true },
      opacity: { aviation: 1, rain: 1, thunder: 1, waste_collection: 1 },
      ...state,
    });
    let now = 0;
    const step = (ms = 40) => { now += ms; rafCb?.(now); };
    const lastFeatures = (): Feature[] => (setData.mock.calls[setData.mock.calls.length - 1]?.[0]?.features ?? []) as Feature[];
    return { anim, setData, step, lastFeatures };
  }

  it("沒有任何活動 → 不寫 GeoJSON（畫面靜止）", () => {
    const { setData, step } = setup({});
    step();
    step();
    expect(setData).not.toHaveBeenCalled();
  });

  it("活躍航機沿航跡畫：連線＋波紋＋本體；同時航機數有上限", () => {
    const t = DAY_START + 60;
    timeStore.setTime(t);
    const rows = Array.from({ length: 12 }, (_, i) => row(`f${i}`, latNorth(500), latNorth(1500)));
    const records = flightsToAviationRecords(flightRowsToFlights(rows).flights);
    const contributions = records.map((r) => ({ sourceId: r.id, family: "aviation", status: "active", relativePotential: 0.6 }) as SourceContribution);
    const result = { contributions, families: [{ family: "aviation", status: "active", relativePotential: 0.6, contributions, notes: [] }] } as unknown as ReceiverQueryResult;
    const { step, lastFeatures } = setup({ result, records: new Map(records.map((r) => [r.id, r as SoundSourceRecord])) });
    step();
    const feats = lastFeatures();
    const links = feats.filter((f) => f.properties?.kind === "link");
    expect(links.length).toBe(ANIM_CAPS.planes);
    expect(feats.filter((f) => f.properties?.kind === "circle").length).toBe(ANIM_CAPS.planes * (ANIM_CAPS.ripplesPerPlane + 1));
  });

  it("低於顯示門檻的遠方航機不出波紋", () => {
    timeStore.setTime(DAY_START + 60);
    const records = flightsToAviationRecords(flightRowsToFlights([row("far", latNorth(15000), latNorth(15500))]).flights);
    const contributions = [{ sourceId: records[0]!.id, family: "aviation", status: "active", relativePotential: 0.03 } as SourceContribution];
    const { setData, step } = setup({ result: { contributions, families: [] } as unknown as ReceiverQueryResult, records: new Map([[records[0]!.id, records[0]! as SoundSourceRecord]]) });
    step();
    expect(setData).not.toHaveBeenCalled();
  });

  it("雷：連續播放跨過 flashTime 才閃光；時間軸大跳（>120 s）不觸發；dispose 停止迴圈", () => {
    const flash = DAY_START + 1000;
    const { anim, step, lastFeatures, setData } = setup({ thunderStrikes: [{ lon: RECV.longitude, lat: latNorth(2000), flashTime: flash }] });
    timeStore.setTime(flash - 500);
    step();
    timeStore.setTime(flash + 1); // 跳 501 s：不閃
    step();
    expect(setData).not.toHaveBeenCalled();
    timeStore.setTime(flash - 1);
    step();
    timeStore.setTime(flash + 0.1);
    step();
    expect(lastFeatures().some((f) => f.properties?.kind === "circle")).toBe(true);
    step(400); // 閃光 0.3 s 牆鐘後消失 → 寫一次空集合
    expect(lastFeatures()).toHaveLength(0);
    anim.dispose();
    expect(rafCb).toBeNull();
  });
});
