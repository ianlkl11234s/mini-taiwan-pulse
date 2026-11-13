import { afterEach, describe, expect, it, vi } from "vitest";

// VP-2：換底圖（setStyle）後衛星 5 個圖層整個消失、開關救不回。
// 根因：ensureLayers 用 isStyleLoaded() 擋，而 style.load 當下圖磚仍在載入、它回 false；
// 時間軸暫停時 timeStore 不發 tick、持續重繪時 idle 也不來 → 永遠沒有人重建。
vi.mock("react", async () => (await import("./hookHarness")).reactMock);
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/satelliteLoader", () => ({ loadSatellites: vi.fn(async () => []) }));

const { harness, createFakeMap } = await import("./hookHarness");
const { useSatellitesLayer } = await import("../useSatellitesLayer");

const SAT_LAYERS = ["sat-footprint-outer", "sat-footprint-inner", "sat-track", "sat-current-point", "sat-maneuver-ring"];

function render(mapRef: { current: unknown }) {
  harness.begin();
  useSatellitesLayer(mapRef as never, { visibility: { china_yaogan: true } as never });
}

describe("衛星圖層換底圖後重建（VP-2）", () => {
  afterEach(() => harness.cleanup());

  it("style.load 當下 isStyleLoaded() 仍為 false 也要把 source／layer 建回來", async () => {
    const fake = createFakeMap({ styleLoaded: false });
    const mapRef = { current: fake.map };
    render(mapRef);
    await Promise.resolve();
    await Promise.resolve();
    render(mapRef); // loadSatellites 完成 → dataReady 後重繪
    for (const id of SAT_LAYERS) expect(fake.layers.has(id), `初次建立 ${id}`).toBe(true);

    fake.restyle(); // 底圖切換：自建 source／layer 被清掉後觸發 style.load
    for (const id of SAT_LAYERS) expect(fake.layers.has(id), `換底圖後重建 ${id}`).toBe(true);
    expect(fake.sources.size).toBe(3);
  });

  it("setStyle 進行中（getStyle() throw）時不建，等 style.load 再建", async () => {
    const fake = createFakeMap({ styleLoaded: false });
    let parsing = true;
    fake.raw.getStyle.mockImplementation(() => {
      if (parsing) throw new Error("Style is not done loading");
      return { layers: [] };
    });
    const mapRef = { current: fake.map };
    render(mapRef);
    await Promise.resolve();
    await Promise.resolve();
    render(mapRef);
    expect(fake.layers.size).toBe(0);

    parsing = false;
    fake.emit("style.load");
    for (const id of SAT_LAYERS) expect(fake.layers.has(id)).toBe(true);
  });
});
