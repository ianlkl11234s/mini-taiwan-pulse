/**
 * 地圖圖層生命週期 review 修正的行為測試：以 hookHarness（假 React effect／ref／state）
 * 加假 Mapbox 地圖實際跑 hook，驗證 style.load、輪詢世代、重開載入選定日等行為。
 * 其餘 review 修正的行為測試在各 hook 自己的測試檔（useRoadEventsLayer／useJpReligionLayers／
 * useCwaImageryLayer／useMapInteraction／useTimelineModeSwitch）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

vi.mock("react", async () => (await import("./hookHarness")).reactMock);
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn(), withLoading: (_k: string, _l: string, p: unknown) => p }));
vi.mock("../../utils/throttledRaf", () => ({ startThrottledRaf: () => () => {} }));

const mocks = vi.hoisted(() => ({
  dateKey: "2026-10-01",
  envLive: vi.fn(),
  rain: vi.fn(),
  earthquakes: vi.fn(),
  airspaceDay: vi.fn(),
  shipDay: vi.fn(),
}));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getDateKey: () => mocks.dateKey,
    getTime: () => Date.parse("2026-10-01T04:00:00Z"),
    subscribeThrottled: () => () => {},
  },
}));
vi.mock("../../data/fireLoader", () => ({
  loadFireEventYears: vi.fn(async () => [{ year: 113 }]),
  loadFireEventsByYear: vi.fn(async () => []),
}));
vi.mock("../../data/animalWelfarePointsLoader", () => ({ fetchAnimalWelfarePoints: vi.fn(async () => []) }));
vi.mock("../../data/rainGaugeLoader", () => ({ fetchRainGaugeLatest: mocks.rain }));
vi.mock("../../data/earthquakeLoader", () => ({
  fetchEarthquakes: mocks.earthquakes,
  earthquakesToGeoJSON: () => ({ type: "FeatureCollection", features: [] }),
}));
vi.mock("../../data/environmentLiveLoaders", () => ({ fetchEnvLiveFC: mocks.envLive, invalidateEnvLive: vi.fn() }));
const dates = [{ date: "2026-09-30" }, { date: "2026-10-01" }];
vi.mock("../../data/airspaceLoader", () => ({
  fetchAirspaceDates: vi.fn(async () => dates),
  loadAirspaceWithDates: vi.fn(async () => ({ flights: [], metadata: { date: "2026-10-01", time_range: [0, 1] } })),
  fetchAirspaceDayArrow: mocks.airspaceDay,
}));
vi.mock("../../data/shipLoader", () => ({
  fetchShipDates: vi.fn(async () => dates),
  loadShipsWithDates: vi.fn(async () => ({ ships: [], metadata: { date: "2026-10-01", time_range: [0, 1] } })),
  fetchShipDayArrow: mocks.shipDay,
}));

import { createFakeMap, harness } from "./hookHarness";
import { fireEventsSparse } from "../useFireEventsLayer";
import { useFireLatestLayer } from "../useFireLatestLayer";
import { useAnimalWelfarePointsLayer } from "../useAnimalWelfarePointsLayer";
import { useBridgeRainLayer } from "../useBridgeRainLayer";
import { useEarthquakeLayer } from "../useEarthquakeLayer";
import { useEnvironmentLiveLayer, ENV_LIVE_SOURCES } from "../useEnvironmentLiveLayer";
import { useAirspaceData } from "../useAirspaceData";
import { useShipData } from "../useShipData";

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const refOf = (map: MapboxMap) => ({ current: map }) as RefObject<MapboxMap | null>;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout });
  mocks.dateKey = "2026-10-01";
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.mocked(console.log).mockRestore();
  harness.cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("style.load 重建後維持隱藏（F209／F210）", () => {
  const cases = [
    { name: "useFireLatestLayer", layers: ["fire-latest-layer", "fire-latest-heatmap"], run: (ref: RefObject<MapboxMap | null>) => useFireLatestLayer(ref, false, true) },
    { name: "useAnimalWelfarePointsLayer", layers: ["animal-welfare-points-circle", "animal-welfare-points-glow"], run: (ref: RefObject<MapboxMap | null>) => useAnimalWelfarePointsLayer(ref, false) },
  ];
  for (const c of cases) {
    it(`${c.name}：圖層關閉時換底圖，重建的圖層仍是隱藏`, async () => {
      const fake = createFakeMap();
      harness.begin();
      c.run(refOf(fake.map));
      await flush();
      fake.restyle();
      for (const id of c.layers) {
        expect(fake.layers.has(id), id).toBe(true);
        expect(fake.visibility(id), id).toBe("none");
      }
    });
  }
});

describe("F181：重開時載入選定日", () => {
  const cases = [
    { name: "useAirspaceData", day: mocks.airspaceDay, run: () => useAirspaceData(true), payload: { flights: [], metadata: { time_range: [0, 1] } } },
    { name: "useShipData", day: mocks.shipDay, run: () => useShipData(true), payload: { ships: [], metadata: { time_range: [0, 1] } } },
  ];
  for (const c of cases) {
    it(`${c.name}：初始載入最新日後，若時間軸選定日不同就改載選定日`, async () => {
      c.day.mockResolvedValue(c.payload);
      mocks.dateKey = "2026-09-30";
      harness.begin();
      c.run();
      await flush();
      expect(c.day).toHaveBeenCalledWith("2026-09-30");
    });

    it(`${c.name}：選定日就是最新日時不重抓`, async () => {
      harness.begin();
      c.run();
      await flush();
      expect(c.day).not.toHaveBeenCalled();
    });
  }
});

describe("其他生命週期守則", () => {
  it("F014 橋梁雨量：換底圖用快取重掛圖層，effect 清理後不再監聽 style.load", async () => {
    mocks.rain.mockResolvedValue([]);
    const fake = createFakeMap();
    harness.begin();
    useBridgeRainLayer(refOf(fake.map), true, 1);
    await flush();
    expect(fake.count("style.load")).toBe(1);
    fake.restyle();
    expect(fake.layers.has("bridge-rain-circle")).toBe(true);
    harness.cleanup();
    expect(fake.count("style.load")).toBe(0);
  });

  it("F196 地震：沒有漣漪 RAF 時，換底圖仍會在下一輪重建圖層", async () => {
    mocks.earthquakes.mockResolvedValue([]);
    const fake = createFakeMap();
    const ref = refOf(fake.map);
    harness.begin();
    useEarthquakeLayer(ref, true);
    await flush();
    harness.begin();
    useEarthquakeLayer(ref, true);
    const before = fake.layers.size;
    expect(before).toBeGreaterThan(0);
    fake.restyle();
    expect(fake.layers.size).toBe(0);
    harness.begin();
    useEarthquakeLayer(ref, true);
    expect(fake.layers.size).toBe(before);
  });

  it("F228 環境即時輪詢：較舊的請求晚回來也不覆寫較新的結果", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout });
      const older = deferred<GeoJSON.FeatureCollection>();
      const newer = deferred<GeoJSON.FeatureCollection>();
      mocks.envLive.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
      const fake = createFakeMap();
      fake.map.addSource(ENV_LIVE_SOURCES.nuscGammaRadiation, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      harness.begin();
      useEnvironmentLiveLayer(refOf(fake.map), true, "nuscGammaRadiation");
      vi.advanceTimersByTime(15 * 60_000); // 下一輪輪詢
      expect(mocks.envLive).toHaveBeenCalledTimes(2);

      const fresh: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: { gen: "new" } }] };
      const stale: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { gen: "old" } }] };
      newer.resolve(fresh);
      await flush();
      older.resolve(stale);
      await flush();
      const calls = fake.sources.get(ENV_LIVE_SOURCES.nuscGammaRadiation)!.setData.mock.calls;
      expect(calls[calls.length - 1]?.[0]).toBe(fresh);
      expect(calls.map((call) => call[0])).not.toContain(stale);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("F234 火災稀疏子集", () => {
  it("月／日粒度走稀疏（全縮放畫點），全年才用熱區", () => {
    expect(fireEventsSparse("year")).toBe(false);
    expect(fireEventsSparse("month")).toBe(true);
    expect(fireEventsSparse("day")).toBe(true);
  });
});
