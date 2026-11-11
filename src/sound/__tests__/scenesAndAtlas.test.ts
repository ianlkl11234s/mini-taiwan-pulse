import { describe, expect, it, vi } from "vitest";
import sceneJson from "./__fixtures__/scene-mini.json";
import { flightRowsToFlights, type FlightTrailRow } from "../../data/flightTrails";
import type { RainGaugeDayRow } from "../../data/rainGaugeLoader";
import {
  SOUND_SCENES,
  fetchSceneSnapshot,
  parseSceneSnapshot,
  snapshotApplies,
  snapshotFetchers,
} from "../scenes";
import { citiesNearReceiver, prefilterSetsForReceiver } from "../soundAtlasData";
import { activeWavefronts, geodesicRing } from "../engines/wavefronts";
import { haversineM } from "../engines/geometryDistance";
import { dayProfile, queryReceiver } from "../engines/receiverQuery";
import { flightsToAviationRecords, loadAviation } from "../sourceAdapters/aviationAdapter";
import { loadRain, rainRowsToRecords } from "../sourceAdapters/rainFieldAdapter";
import { loadThunder } from "../sourceAdapters/thunderAdapter";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

const snap = parseSceneSnapshot(sceneJson)!;

describe("場景快照契約 pulse-sound-scene-v1", () => {
  it("合規快照解析成功；schema 不符／HTML 字串／缺 bbox → null", () => {
    expect(snap).not.toBeNull();
    expect(snap.thunder?.health).toEqual({ cwa: "empty", taipower: "ok" });
    expect(snap.rain).toBeUndefined();
    expect(parseSceneSnapshot({ ...sceneJson, schema: "other" })).toBeNull();
    expect(parseSceneSnapshot("<!doctype html>")).toBeNull();
    const { bbox: _b, ...noBbox } = sceneJson;
    expect(parseSceneSnapshot(noBbox)).toBeNull();
  });

  it("fetchSceneSnapshot：404 或 dev server 回 HTML（200）都回 null，不丟例外", async () => {
    const html = vi.fn(async () => new Response("<!doctype html><html></html>", { status: 200 }));
    expect(await fetchSceneSnapshot("x", html as unknown as typeof fetch)).toBeNull();
    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    expect(await fetchSceneSnapshot("x", notFound as unknown as typeof fetch)).toBeNull();
    const ok = vi.fn(async () => new Response(JSON.stringify(sceneJson), { status: 200 }));
    expect((await fetchSceneSnapshot("x", ok as unknown as typeof fetch))?.id).toBe("test-mini");
  });

  it("只在同日期且接收點在 bbox 內才適用（bbox 外改走 RPC，避免被算成 0）", () => {
    expect(snapshotApplies(snap, DATE, RECV)).toBe(true);
    expect(snapshotApplies(snap, "2026-07-15", RECV)).toBe(false);
    expect(snapshotApplies(snap, DATE, { longitude: 122.5, latitude: 25 })).toBe(false);
    expect(snapshotApplies(snap, DATE, null)).toBe(false);
  });

  it("落雷 health：ok 用快照事件、empty 回空集合（→ coverage empty，不等於無雷）、未寫的來源交回即時", async () => {
    const live = vi.fn(async () => []);
    const fx = snapshotFetchers(snap, live);
    const set = await loadThunder({ date: DATE, nowUnix: DAY_START + 3 * 86_400 }, fx.thunder!);
    expect(set.coverage.map((c) => [c.provider, c.status])).toEqual([["cwa", "empty"], ["taipower", "ok"]]);
    expect(set.records).toHaveLength(1);
    expect(live).not.toHaveBeenCalled();
    const partial = parseSceneSnapshot({ ...sceneJson, thunder: { ...sceneJson.thunder, health: { taipower: "ok" } } })!;
    await snapshotFetchers(partial, live).thunder!(DATE, "cwa");
    expect(live).toHaveBeenCalledWith(DATE, "cwa");
  });

  it("health=error → 該源 coverage error；兩源都不是 ok → 雷家族 unknown（不是安靜）", async () => {
    const bad = parseSceneSnapshot({ ...sceneJson, thunder: { ...sceneJson.thunder, health: { cwa: "error", taipower: "empty" } } })!;
    const set = await loadThunder({ date: DATE, nowUnix: DAY_START + 3 * 86_400 }, snapshotFetchers(bad, async () => []).thunder!);
    expect(set.coverage.map((c) => c.status)).toEqual(["error", "empty"]);
    const r = queryReceiver(RECV, DAY_START + 15 * 3600 + 2, [set], ["thunder"]);
    expect(r.families[0]!.status).toBe("unknown");
    expect(r.families[0]!.relativePotential).toBeNull();
  });

  it("航班區塊轉成 adapter 可吃的 flights；雨區塊缺 → 沒有 rain fetcher（呼叫端走 RPC）", async () => {
    const fx = snapshotFetchers(snap, async () => []);
    expect(fx.rain).toBeUndefined();
    const set = await loadAviation({ date: DATE, nowUnix: DAY_START + 3 * 86_400 }, fx.aviation!);
    expect(set.coverage[0]!.status).toBe("ok");
    const r = queryReceiver(RECV, 1784012460, [set], ["aviation"]);
    expect(r.families[0]!.status).toBe("active");
  });

  it("內建三個場景：日期、焦點時刻與接收點在 bbox 內", () => {
    expect(SOUND_SCENES.map((s) => s.id)).toEqual(["taipei-1109", "taichung-heping-1108", "taipei-typhoon-1024"]);
    for (const s of SOUND_SCENES) {
      const [w, so, e, n] = s.bbox;
      expect(s.receiver.lon).toBeGreaterThan(w);
      expect(s.receiver.lon).toBeLessThan(e);
      expect(s.receiver.lat).toBeGreaterThan(so);
      expect(s.receiver.lat).toBeLessThan(n);
      expect(new Date(s.focusTime).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })).toBe(s.date);
      expect(s.receiver.heightM).toBe(1.5);
    }
  });
});

describe("loadRain fetcher 注入", () => {
  it("注入的 fetcher 取代 RPC；空 → empty；丟例外 → error", async () => {
    const row: RainGaugeDayRow = {
      station_id: "S1", station_name: "甲", county: null, town: null, lat: latNorth(500), lng: RECV.longitude,
      bucket_at: new Date((DAY_START + 3600) * 1000).toISOString(), observed_at: new Date((DAY_START + 3600) * 1000).toISOString(),
      precipitation_10min: null, precipitation_1hr: 5, precipitation_3hr: null, precipitation_24hr: null,
    };
    expect((await loadRain({ date: DATE }, async () => [row])).coverage[0]!.status).toBe("ok");
    expect((await loadRain({ date: DATE }, async () => [])).coverage[0]!.status).toBe("empty");
    expect((await loadRain({ date: DATE }, async () => { throw new Error("x"); })).coverage[0]!.status).toBe("error");
  });
});

describe("接收點預篩：結果必須與不篩完全相同", () => {
  const trail = (pts: [number, number, number, number][]) => pts.map((p) => p.join(",")).join(";");
  const rows: FlightTrailRow[] = [
    // 正上方飛越
    { flight_id: "aaa111", callsign: "A", aircraft_type: "", origin: "", destination: "", trail: trail([[latNorth(-30_000), RECV.longitude, 900, DAY_START + 36_000], [latNorth(30_000), RECV.longitude, 900, DAY_START + 36_300]]) },
    // 兩端都在 20 km 外、但直線穿過接收點（只看端點會被漏掉）
    { flight_id: "bbb222", callsign: "B", aircraft_type: "", origin: "", destination: "", trail: trail([[RECV.latitude, RECV.longitude - 0.3, 3000, DAY_START + 40_000], [RECV.latitude, RECV.longitude + 0.3, 3000, DAY_START + 40_400]]) },
    // 遠方航班
    { flight_id: "ccc333", callsign: "C", aircraft_type: "", origin: "", destination: "", trail: trail([[23.0, 120.3, 9000, DAY_START + 36_000], [23.1, 120.4, 9000, DAY_START + 36_300]]) },
    // 有 >30 分鐘缺口、缺口端點在半徑內（unknown 候選）
    { flight_id: "ddd444", callsign: "D", aircraft_type: "", origin: "", destination: "", trail: trail([[latNorth(5000), RECV.longitude, 500, DAY_START + 50_000], [latNorth(6000), RECV.longitude, 500, DAY_START + 50_060], [latNorth(9000), RECV.longitude, 500, DAY_START + 54_000], [latNorth(9500), RECV.longitude, 500, DAY_START + 54_060]]) },
  ];
  const cov = (family: "aviation" | "rain", provider: string) => [{ family, provider, dateKey: DATE, status: "ok" as const, windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "day_series" as const }];
  const avSet: SoundSourceSet = { family: "aviation", dateKey: DATE, records: flightsToAviationRecords(flightRowsToFlights(rows).flights), coverage: cov("aviation", "flight_trails") };
  const rainRows: RainGaugeDayRow[] = [0, 1, 2].flatMap((i) =>
    [3, 4].map((h) => ({
      station_id: `S${i}`, station_name: null, county: null, town: null, lat: latNorth(2000 + i * 3000), lng: RECV.longitude,
      bucket_at: new Date((DAY_START + h * 3600) * 1000).toISOString(), observed_at: new Date((DAY_START + h * 3600) * 1000).toISOString(),
      precipitation_10min: null, precipitation_1hr: i === 0 ? null : 3, precipitation_3hr: null, precipitation_24hr: null,
    })),
  );
  const rainSet: SoundSourceSet = { family: "rain", dateKey: DATE, records: rainRowsToRecords(rainRows), coverage: cov("rain", "cwa_rain_gauge") };

  it("aviation／rain 24h 構成與當下查詢逐格相同，且遠方航班被篩掉", () => {
    const sets = [avSet, rainSet];
    const filtered = prefilterSetsForReceiver(sets, RECV);
    expect(filtered[0]!.records.map((r) => r.id).sort()).toEqual(["aviation:aaa111", "aviation:bbb222", "aviation:ddd444"]);
    const a = dayProfile(RECV, DATE, 10, sets, ["aviation", "rain"]);
    const b = dayProfile(RECV, DATE, 10, filtered, ["aviation", "rain"]);
    expect(b.families).toEqual(a.families);
    for (const t of [DAY_START + 36_150, DAY_START + 40_200, DAY_START + 52_000, DAY_START + 3 * 3600 + 10]) {
      expect(queryReceiver(RECV, t, filtered, ["aviation", "rain"])).toEqual(queryReceiver(RECV, t, sets, ["aviation", "rain"]));
    }
  });

  it("最近雨量站超過 5 km：預篩後仍回 unknown，不變成 0", () => {
    const far = { ...RECV, latitude: latNorth(-20_000) };
    const filtered = prefilterSetsForReceiver([rainSet], far);
    const r = queryReceiver(far, DAY_START + 3 * 3600 + 10, filtered, ["rain"]);
    expect(r.families[0]!.status).toBe("unknown");
    expect(r.families[0]!.relativePotential).toBeNull();
  });
});

describe("垃圾車縣市選擇", () => {
  it("臺北市內 → 包含臺北市（外框偏大，可能多含新北）；海上 → 空", () => {
    expect(citiesNearReceiver({ longitude: 121.6068, latitude: 25.071 })).toContain("臺北市");
    expect(citiesNearReceiver({ longitude: 121.44, latitude: 24.315 })).toContain("臺中市");
    expect(citiesNearReceiver({ longitude: 123.5, latitude: 22 })).toEqual([]);
  });
});

describe("雷聲波前（示意）", () => {
  const strikes = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, lon: RECV.longitude, lat: latNorth(i * 500), flashTime: 1000 }));

  it("半徑 = 經過秒數 × 343 m/s；閃光前與超過候選半徑後不畫", () => {
    const { fronts } = activeWavefronts([strikes[0]!], 1010, null);
    expect(fronts[0]!.radiusM).toBeCloseTo(3430, 6);
    expect(activeWavefronts([strikes[0]!], 999, null).fronts).toHaveLength(0);
    expect(activeWavefronts([strikes[0]!], 1000 + 25_000 / 343 + 1, null).fronts).toHaveLength(0);
  });

  it("同時波前有上限，保留離中心最近的；activeCount 記錄未截斷數", () => {
    const { fronts, activeCount } = activeWavefronts(strikes, 1005, { lon: RECV.longitude, lat: RECV.latitude }, 5);
    expect(activeCount).toBe(30);
    expect(fronts.map((f) => f.id)).toEqual(["s0", "s1", "s2", "s3", "s4"]);
  });

  it("測地圓環每個頂點到圓心距離 = 半徑", () => {
    const ring = geodesicRing(121.5, 25, 5000, 32);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lon, lat] of ring) expect(haversineM(121.5, 25, lon, lat)).toBeCloseTo(5000, 0);
  });
});
