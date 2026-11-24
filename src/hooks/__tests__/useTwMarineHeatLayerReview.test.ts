import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

vi.mock("react", async () => (await import("./hookHarness")).reactMock);

const mocks = vi.hoisted(() => ({
  handle: {
    setOpacity: vi.fn(), setFrame: vi.fn(), setVisible: vi.fn(), ensure: vi.fn(), remove: vi.fn(),
  },
  values: {} as unknown,
}));

vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../map/jmaImageryLayer", () => ({ createJmaImageryLayer: vi.fn(() => mocks.handle) }));
vi.mock("../../data/marineYearAtlas", () => ({
  loadYearAtlasManifest: vi.fn(async () => ({})),
  pickYearAtlasFrame: vi.fn(() => ({ atlas_key: "a", values_key: "v", lon_min: 0, lon_max: 1, lat_min: 0, lat_max: 1 })),
  loadYearAtlasBitmap: vi.fn(async () => ({})),
  loadYearAtlasValues: vi.fn(async () => mocks.values),
  cropYearAtlasTile: vi.fn(async () => "blob:x"),
  yearAtlasCellIndex: vi.fn(() => 0),
  yearAtlasUrl: vi.fn((_b: string, k: string) => k),
}));

import { harness } from "./hookHarness";
import { pickTwMarineHeatCells, useTwMarineHeatLayer } from "../useTwMarineHeatLayer";

const flush = () => new Promise((r) => setTimeout(r, 0));
const map = { getLayer: vi.fn(() => ({})), setPaintProperty: vi.fn(), on: vi.fn(), off: vi.fn() };
const mapRef = { current: map } as unknown as RefObject<MapboxMap | null>;
const PERIOD = "2025-08";

type Opts = Parameters<typeof useTwMarineHeatLayer>[0];
function render(o: Partial<Opts>) {
  harness.begin();
  useTwMarineHeatLayer({ mapRef, visible: true, layerKey: "twMarineHeatwaves", opacity: 0.8, period: PERIOD, channel: "r", color: ["step"], ...o });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { harness.cleanup(); });

describe("useTwMarineHeatLayer review fixes", () => {
  it("K1 改透明度要同步 imagery handle（換底圖重建才不會跳回舊值）", async () => {
    mocks.values = { grid: {}, months: { [PERIOD]: { level: [2], sst_anomaly: [1], sst: [28] } } };
    render({});
    await flush();
    render({ opacity: 0.3 });
    expect(mocks.handle.setOpacity).toHaveBeenCalledWith(0.3);
  });

  it("K2 海洋熱浪：取消勾選的等級不可點出 popup", async () => {
    mocks.values = { grid: {}, months: { [PERIOD]: { level: [2], sst_anomaly: [1], sst: [28] } } };
    render({ classMask: 0b11111 });
    await flush();
    expect(pickTwMarineHeatCells(0, 0)?.mhw).toMatchObject({ level: 2 });
    render({ classMask: 0b11011 }); // 關掉 2 級
    expect(pickTwMarineHeatCells(0, 0)).toBeNull();
    render({ classMask: 0 }); // 全不選
    expect(pickTwMarineHeatCells(0, 0)).toBeNull();
  });

  it("K2 珊瑚：BAA 檢視看等級遮罩、DHW 檢視看 DHW 分級遮罩", async () => {
    mocks.values = { grid: { cells: [0] }, months: { [PERIOD]: { dhw_max: [5.2], baa5_max: [2] } } };
    const key = "twCoralBleachingHeatStress" as const;
    render({ layerKey: key, channel: "g", classMask: 0b11111111 });
    await flush();
    expect(pickTwMarineHeatCells(0, 0)?.crw).toMatchObject({ baa: 2 });
    render({ layerKey: key, channel: "g", classMask: 0b11111011 }); // BAA 關 2 級
    expect(pickTwMarineHeatCells(0, 0)).toBeNull();
    render({ layerKey: key, channel: "r", dhwView: true, classMask: 0b1111011 }); // DHW 5.2 屬第 2 級（4–8），關掉
    expect(pickTwMarineHeatCells(0, 0)).toBeNull();
    render({ layerKey: key, channel: "r", dhwView: true, classMask: 0b1111111 });
    expect(pickTwMarineHeatCells(0, 0)?.crw).toMatchObject({ dhw: 5.2 });
  });
});
