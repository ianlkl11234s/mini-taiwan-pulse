import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Feature } from "geojson";
import { timeStore } from "../../state/timeStore";
import { areaPaths } from "../../components/sound/SoundDayProfile";
import { ANIM_CAPS, ANIM_SOURCE, SoundAtlasAnimator, arcLine, hash01, nearbyPath, pointAlong, rainDropCount, ripplePhase, type AnimatorState } from "../soundAtlasAnimator";
import { reasonKey } from "../../components/sound/soundAtlasText";
import { applySceneView, SOUND_SCENES, type SoundSceneSnapshot } from "../scenes";
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
      flags: { aviation: true, rain: true, thunder: true, waste_collection: true, rail: true, road_traffic: true, roadwork: true, wind_vegetation: true, coastal_wave: true, river_water: true },
      opacity: { aviation: 1, rain: 1, thunder: 1, waste_collection: 1, rail: 1, road_traffic: 1, roadwork: 1, wind_vegetation: 1, coastal_wave: 1, river_water: 1 },
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

  it("雷：連續播放跨過 flashTime 才閃白光；時間軸大跳（>120 s）不觸發；閃光後落雷點留小點；dispose 停止迴圈", () => {
    const flash = DAY_START + 1000;
    const { anim, step, lastFeatures, setData } = setup({ thunderStrikes: [{ lon: RECV.longitude, lat: latNorth(2000), flashTime: flash }] });
    const flashes = () => lastFeatures().filter((f) => f.properties?.fill === "#ffffff" && (f.properties?.r as number) >= 8);
    const marks = () => lastFeatures().filter((f) => f.properties?.r === 4);
    timeStore.setTime(flash - 500);
    step();
    expect(setData).not.toHaveBeenCalled(); // 閃光前：什麼都沒有
    timeStore.setTime(flash + 1); // 跳 501 s：不閃，但落雷點小點出現
    step();
    expect(flashes()).toHaveLength(0);
    expect(marks()).toHaveLength(1);
    timeStore.setTime(flash - 1);
    step();
    timeStore.setTime(flash + 0.1);
    step();
    expect(flashes()).toHaveLength(1);
    step(400); // 閃光 0.3 s 牆鐘後消失，小點還在
    expect(flashes()).toHaveLength(0);
    expect(marks()).toHaveLength(1);
    timeStore.setTime(flash + 61); // 超過保留時間 → 清空
    step();
    expect(lastFeatures()).toHaveLength(0);
    anim.dispose();
    expect(rafCb).toBeNull();
  });
});

describe("自然三族示意幾何（W5 接 UI）", () => {
  it("nearbyPath：取最近那條線、沿線前後各約 halfM，且包含最近點", () => {
    const far: [number, number][] = [[121.0, 25.5], [121.01, 25.5]];
    const near: [number, number][] = [[121.5, 25.0], [121.505, 25.0], [121.51, 25.0], [121.515, 25.0], [121.52, 25.0]];
    const path = nearbyPath({ type: "MultiLineString", coordinates: [far, near] }, 121.51, 25.001, 600)!;
    expect(path.every(([, lat]) => lat === 25.0)).toBe(true);
    const lons = path.map(([lon]) => lon);
    expect(Math.min(...lons)).toBeGreaterThanOrEqual(121.5);
    expect(lons).toContain(121.51);
    expect(nearbyPath({ type: "Point", coordinates: [121, 25] }, 121, 25, 100)).toBeNull();
  });

  it("pointAlong 端點與中點；arcLine 每點離圓心等距", () => {
    const path: [number, number][] = [[121.5, 25], [121.52, 25]];
    expect(pointAlong(path, 0)).toEqual([121.5, 25]);
    expect(pointAlong(path, 1)[0]).toBeCloseTo(121.52, 9);
    expect(pointAlong(path, 0.5)[0]).toBeCloseTo(121.51, 9);
    const arc = arcLine(121.5, 25, 500, 0, 0.5, 8);
    expect(arc).toHaveLength(9);
    const kx = 111_195 * Math.cos(25 * Math.PI / 180);
    for (const [lon, lat] of arc) expect(Math.hypot((lon - 121.5) * kx, (lat - 25) * 111_195)).toBeCloseTo(500, 3);
  });

  it("即時模式風、浪 coverage unavailable →「僅場景快照提供」，不是 0 也不是一般無資料", () => {
    expect(reasonKey("no_healthy_source(cwa_weather_obs:unavailable)")).toBe("soundAtlas.reason.snapshotOnly");
    expect(reasonKey("no_healthy_source(cwa_marine_obs:unavailable)")).toBe("soundAtlas.reason.snapshotOnly");
    expect(reasonKey("no_healthy_source(rain_gauge:error)")).toBe("soundAtlas.reason.noHealthy");
    expect(reasonKey("no_wind_station_within_15000m")).toBe("soundAtlas.reason.noNearbyStation");
    expect(reasonKey("river_network_not_loaded_here")).toBe("soundAtlas.reason.naturalNotLoaded");
  });

  it("颱風子場景只換接收點與焦點，快照資料區塊不動", () => {
    const def = SOUND_SCENES.find((s) => s.id === "taipei-typhoon-1024-jinshan")!;
    const snap = { schema: "pulse-sound-scene-v1", id: "taipei-typhoon-1024", date: "2026-10-24", bbox: [121, 24, 122, 26], receiver: { lon: 121.542, lat: 25.18, height_m: 1.5 }, raw: { k: 1 } } as SoundSceneSnapshot;
    const out = applySceneView(snap, def.view);
    expect(out.receiver).toMatchObject({ lon: 121.64, lat: 25.232, height_m: 1.5 });
    expect(out.id).toBe("taipei-typhoon-1024");
    expect(out.raw).toBe(snap.raw);
    expect(applySceneView(snap, undefined)).toBe(snap);
  });
});
