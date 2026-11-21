/**
 * 版本化資產（R2 layers/v1）與部署時版本互為備援（VPB-11）。
 * 2026-11-13 實驗：只擋部署路徑 → 0 筆；只擋 R2 → 0 筆（沒有退回部署版）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { OverlayConfig } from "../../types";
import type { ResolvedAsset } from "../../data/layerAssetIndex";

const DEPLOY_URL = "./police_justice/immigration_offices/immigration_offices_20260626.geojson";
const CDN_URL = "https://data.example/layers/v1/assets/immigration_offices/abc.geojson";

// 索引狀態由測試控制：false＝尚未就緒（走部署時版本），true＝就緒（走 CDN）
const indexState = vi.hoisted(() => ({ ready: false }));

vi.mock("../../data/layerAssetIndex", async (importActual) => {
  const actual = await importActual<typeof import("../../data/layerAssetIndex")>();
  return {
    ...actual,
    resolveAssetUrl: (url: string): ResolvedAsset => indexState.ready
      ? {
          url: CDN_URL,
          source: "cdn",
          // 大於 5 MB 不驗 sha256，讓測試只關注來源切換
          entry: { asset_id: "immigration_offices", kind: "geojson", path: "assets/x.geojson", sha256: "0".repeat(64), bytes: 6 * 1024 * 1024 },
        }
      : { url, source: "fallback", reason: "索引尚未載入" },
  };
});

const { hydrateOverlayIfNeeded, refreshFallbackHydratedOverlay, resetOverlayHydration } = await import("../overlayManager");

const config = {
  id: "immigrationOffice",
  sourceId: "immigration-office",
  sourceUrl: DEPLOY_URL,
  layers: [],
} as unknown as OverlayConfig;

function fc(n: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: n }, (_, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [121 + i * 0.01, 24] }, properties: { i } })),
  };
}

function mockMap() {
  const setData = vi.fn();
  const map = { getSource: () => ({ setData }) } as unknown as MapboxMap;
  return { map, setData, lastCount: () => (setData.mock.lastCall?.[0] as GeoJSON.FeatureCollection | undefined)?.features.length };
}

/** 依網址決定回應；blocked 內的網址一律網路錯誤（同 agent-browser route --abort）。 */
function stubFetch(blocked: string[]) {
  const spy = vi.fn(async (url: string) => {
    if (blocked.includes(url)) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(fc(url === CDN_URL ? 25 : 24)), { status: 200 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("refreshFallbackHydratedOverlay／hydrate：部署版與 R2 互相備援", () => {
  beforeEach(() => {
    indexState.ready = false;
    resetOverlayHydration();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetOverlayHydration();
  });

  it("A：部署版在索引就緒前失敗 → 索引就緒後改抓 R2，不留 0 筆", async () => {
    const fetchSpy = stubFetch([DEPLOY_URL]);
    const { map, setData, lastCount } = mockMap();

    await hydrateOverlayIfNeeded(map, config);
    expect(setData).not.toHaveBeenCalled();

    indexState.ready = true;
    expect(refreshFallbackHydratedOverlay(map, config, true)).toBe(true);
    await vi.waitFor(() => expect(setData).toHaveBeenCalledTimes(1));
    expect(lastCount()).toBe(25);
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual([DEPLOY_URL, CDN_URL]);
  });

  it("A'：部署版失敗時索引已就緒 → 同一次 hydrate 立刻改抓 R2", async () => {
    stubFetch([DEPLOY_URL]);
    const { map, lastCount } = mockMap();
    let resolveDeploy!: () => void;
    // 部署版請求進行中索引才就緒：讓 fetch 等到索引 ready 後才失敗
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === DEPLOY_URL) {
        await new Promise<void>((r) => { resolveDeploy = r; });
        throw new TypeError("Failed to fetch");
      }
      return new Response(JSON.stringify(fc(25)), { status: 200 });
    }));
    const pending = hydrateOverlayIfNeeded(map, config);
    await vi.waitFor(() => expect(resolveDeploy).toBeTypeOf("function"));
    indexState.ready = true;
    resolveDeploy();
    await pending;
    expect(lastCount()).toBe(25);
  });

  it("B：已用部署版顯示，索引就緒後 R2 失敗 → 退回部署版，不清成 0 筆", async () => {
    const fetchSpy = stubFetch([CDN_URL]);
    const { map, setData, lastCount } = mockMap();

    await hydrateOverlayIfNeeded(map, config);
    expect(lastCount()).toBe(24);

    indexState.ready = true;
    refreshFallbackHydratedOverlay(map, config, true);
    await vi.waitFor(() => expect(setData).toHaveBeenCalledTimes(2));
    expect(lastCount()).toBe(24);
    for (const [data] of setData.mock.calls) expect((data as GeoJSON.FeatureCollection).features.length).toBeGreaterThan(0);
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual([DEPLOY_URL, CDN_URL, DEPLOY_URL]);
  });

  it("B'：部署版請求還沒回來索引就就緒、R2 又失敗 → 仍以部署版結束", async () => {
    stubFetch([CDN_URL]);
    const { map, lastCount } = mockMap();
    const first = hydrateOverlayIfNeeded(map, config);
    indexState.ready = true;
    refreshFallbackHydratedOverlay(map, config, true);
    await first;
    await vi.waitFor(() => expect(lastCount()).toBe(24));
  });

  it("兩邊都失敗：各只試一次，以載入失敗結束，之後開關可重試", async () => {
    indexState.ready = true;
    const fetchSpy = stubFetch([CDN_URL, DEPLOY_URL]);
    const { map, setData } = mockMap();

    await hydrateOverlayIfNeeded(map, config);
    expect(setData).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // 失敗後清掉 hydrate 記錄：下次開啟會重抓
    stubFetch([]);
    await hydrateOverlayIfNeeded(map, config);
    expect(setData).toHaveBeenCalledTimes(1);
  });
});
