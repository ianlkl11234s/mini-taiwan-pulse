import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 愛爾蘭 Coillte 國有林兩層（站主限定）：Coillte 條款限研究或私人學習、不得轉供他人或用於其他網站。
// 守門兩層：(1) 非站主上鎖（GATED_LAYERS／isLayerLocked），toggle 不會讓 visible 變 true；
// (2) hook 只在 visible 時呼叫 owner-only RPC → 非站主永遠不會打 RPC。資料不得有任何公開靜態資產。
vi.mock("react", async () => (await import("./hookHarness")).reactMock);
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { harness, createFakeMap } = await import("./hookHarness");
const { useIeCoillteLayer, useIeCoillteForestRoadsLayer, resetIeCoillteCacheForTest, snapIeCoillteBounds } = await import("../useIeCoillteLayers");
const { GATED_LAYERS, RELEASE_HOLD_LAYERS } = await import("../../components/sidebar/layerCatalog");
const { EMBED_ALLOWED } = await import("../../embed/embedWhitelist");
const { parseUrlState, URL_STATE_VERSION } = await import("../../lib/urlState");
const { isLayerLocked } = await import("../../lib/layerGates");
const { LAYER_MANIFEST } = await import("../../data/layerManifest");
const { IE_COILLTE_KEYS, IE_COILLTE_SPEC_BY_KEY, IE_COILLTE_ROADS_MIN_ZOOM, ieCoillteKindFilter, normalizeIeCoillte } = await import("../../data/ieCoillteTypes");
const { OVERLAY_REGISTRY } = await import("../../map/overlayRegistry");

const mapRef = { current: null };

describe("愛爾蘭 Coillte 國有林：站主限定", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { type: "FeatureCollection", features: [] }, error: null, status: 200 });
    resetIeCoillteCacheForTest();
  });
  afterEach(() => harness.cleanup());

  it.each(IE_COILLTE_KEYS)("%s：上鎖、不進 embed、網址不還原；未登入／member／insider 都鎖，只有站主解鎖", (key) => {
    expect(GATED_LAYERS.has(key)).toBe(true);
    expect(RELEASE_HOLD_LAYERS.has(key)).toBe(false);
    expect(EMBED_ALLOWED.has(key)).toBe(false);
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${key}`).layers).toBeUndefined();
    expect(isLayerLocked(key, null, null)).toBe(true);
    expect(isLayerLocked(key, "member", null)).toBe(true);
    expect(isLayerLocked(key, "insider", new Map())).toBe(true);
    expect(isLayerLocked(key, "owner", null)).toBe(false);
  });

  it.each(IE_COILLTE_KEYS)("%s：manifest 標 OWNER_ONLY，資料只走 Supabase、沒有任何公開靜態資產", (key) => {
    const entry = LAYER_MANIFEST[key];
    expect(entry.topics).toContain("OWNER_ONLY");
    expect(entry.source.kind).toBe("supabase");
    expect("staticAssets" in entry.source).toBe(false);
    expect(JSON.stringify(entry)).not.toMatch(/\.pmtiles|\/world\//);
  });

  it("遊憩點：visible=false 不呼叫 RPC；visible=true 才整包呼叫一次", async () => {
    harness.begin();
    useIeCoillteLayer(mapRef, "ieCoillteRecreation", false);
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();

    harness.begin();
    useIeCoillteLayer(mapRef, "ieCoillteRecreation", true);
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_ie_coillte_recreation");
  });

  it("林道：依畫面 p_bbox 分批，低於 z10 不查；圖層 minzoom 同值", async () => {
    expect(IE_COILLTE_ROADS_MIN_ZOOM).toBe(10);
    const line = OVERLAY_REGISTRY.find((c) => c.id === "ieCoillteForestRoads")?.layers[0];
    expect(line?.minzoom).toBe(IE_COILLTE_ROADS_MIN_ZOOM);

    const rpcSpy = rpc;
    rpcSpy.mockReturnValue(Object.assign(
      Promise.resolve({ data: { type: "FeatureCollection", features: [] }, error: null, status: 200 }),
      { abortSignal() { return this; } },
    ));
    const fake = createFakeMap();
    let zoom = 8;
    Object.assign(fake.raw, {
      getZoom: () => zoom,
      getBounds: () => ({ getWest: () => -6.62, getSouth: () => 52.86, getEast: () => -6.11, getNorth: () => 53.14 }),
    });
    const ref = { current: fake.map };

    harness.begin();
    useIeCoillteForestRoadsLayer(ref, false);
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();

    harness.begin();
    useIeCoillteForestRoadsLayer(ref, true);
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled(); // z8 < z10

    zoom = 11;
    vi.useFakeTimers();
    fake.emit("moveend");
    vi.advanceTimersByTime(400);
    vi.useRealTimers();
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_ie_coillte_forest_roads", { p_bbox: [-6.65, 52.85, -6.1, 53.15] });
  });

  it("bbox 向外對齊 0.05° 格網", () => {
    expect(snapIeCoillteBounds({ west: -6.62, south: 52.86, east: -6.11, north: 53.14 }))
      .toEqual({ west: -6.65, south: 52.85, east: -6.1, north: 53.15 });
  });

  it("RPC 回應只留該層幾何；類別多選 filter（全選不篩、全不選擋光）", () => {
    const fc = normalizeIeCoillte({ features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [-7, 53] }, properties: { uid: "site-1", kind: "site" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[-7, 53], [-7.1, 53.1]] }, properties: { uid: "forest_road-1" } },
      { type: "Feature", geometry: null, properties: { uid: "x" } },
    ] }, ["Point"]);
    expect(fc.features.map((f) => f.properties?.uid)).toEqual(["site-1"]);
    const spec = IE_COILLTE_SPEC_BY_KEY.ieCoillteForestRoads;
    expect(ieCoillteKindFilter(spec, undefined)).toEqual(["all"]);
    expect(ieCoillteKindFilter(spec, 0b11)).toEqual(["all"]);
    expect(ieCoillteKindFilter(spec, 0b10)).toEqual(["in", ["coalesce", ["get", "kind"], ""], ["literal", ["recreation_trail"]]]);
    expect(ieCoillteKindFilter(spec, 0)).toEqual(["==", ["get", "kind"], "__multi_select_none__"]);
  });
});
