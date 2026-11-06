import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 英格蘭 EA Pollution Inventory（站主限定）：EA Conditional Licence 限 internal or personal purposes。
// 守門兩層：(1) 非站主上鎖（GATED_LAYERS／isLayerLocked），toggle 不會讓 visible 變 true；
// (2) hook 只在 visible 時呼叫 owner-only RPC → 非站主永遠不會打 RPC。
vi.mock("react", async () => (await import("./hookHarness")).reactMock);
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { harness } = await import("./hookHarness");
const { useGbEaPollutionInventoryLayer, resetGbEaPollutionCacheForTest } = await import("../useGbEaPollutionInventoryLayer");
const { GATED_LAYERS, RELEASE_HOLD_LAYERS } = await import("../../components/sidebar/layerCatalog");
const { EMBED_ALLOWED } = await import("../../embed/embedWhitelist");
const { parseUrlState, URL_STATE_VERSION } = await import("../../lib/urlState");
const { isLayerLocked } = await import("../../lib/layerGates");
const { LAYER_MANIFEST } = await import("../../data/layerManifest");
const { normalizeGbEaPollution } = await import("../../data/gbEaPollutionLoader");
const { runOwnerGateResets } = await import("../../lib/ownerGateRevoke");

const KEY = "gbPollutionInventoryEngland" as const;
const mapRef = { current: null };

describe("英格蘭污染排放申報：站主限定", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { type: "FeatureCollection", features: [] }, error: null, status: 200 });
    resetGbEaPollutionCacheForTest();
  });
  afterEach(() => harness.cleanup());

  it("非站主上鎖：在 GATED_LAYERS、不在 RELEASE_HOLD；不進 embed、網址不還原", () => {
    expect(GATED_LAYERS.has(KEY)).toBe(true);
    expect(RELEASE_HOLD_LAYERS.has(KEY)).toBe(false);
    expect(EMBED_ALLOWED.has(KEY)).toBe(false);
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY}`).layers).toBeUndefined();
  });

  it("未登入、member、gates 未載入或沒有這列都鎖；只有站主解鎖", () => {
    expect(isLayerLocked(KEY, null, null)).toBe(true);
    expect(isLayerLocked(KEY, "member", null)).toBe(true);
    expect(isLayerLocked(KEY, "insider", new Map())).toBe(true);
    expect(isLayerLocked(KEY, "owner", null)).toBe(false);
  });

  it("manifest 標示 OWNER_ONLY，資料只走 Supabase、沒有任何公開靜態資產", () => {
    const entry = LAYER_MANIFEST[KEY];
    expect(entry.topics).toContain("OWNER_ONLY");
    expect(entry.source.kind).toBe("supabase");
    expect("staticAssets" in entry.source).toBe(false);
  });

  it("visible=false（非站主開不了）時不呼叫 RPC；visible=true 才呼叫一次", async () => {
    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, false);
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();

    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_gb_ea_pollution_inventory");
  });

  it("撤權（登出／失去站主權限）：module cache 與 hook 資料清空，之後再開要重新打 RPC（review F088）", async () => {
    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(rpc).toHaveBeenCalledTimes(1);
    // 重繪拿到資料：有 cache／data 時不重打
    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(rpc).toHaveBeenCalledTimes(1);

    runOwnerGateResets(new Set([KEY]));

    // 重繪：hook 的 data 已被清成 null → visible 時重新呼叫 RPC（cache 也清了）
    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("撤權前發出、撤權後才回來的請求不寫回 cache", async () => {
    let resolveRpc!: (v: unknown) => void;
    rpc.mockReturnValueOnce(new Promise((r) => { resolveRpc = r; }));
    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    runOwnerGateResets(new Set([KEY]));
    resolveRpc({ data: { type: "FeatureCollection", features: [] }, error: null, status: 200 });
    await new Promise((r) => setTimeout(r, 0));
    harness.cleanup();

    harness.begin();
    useGbEaPollutionInventoryLayer(mapRef, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("RPC 回應只留 Point，保留 released 給實心／空心", () => {
    const fc = normalizeGbEaPollution({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [-1, 52] }, properties: { site_ref: "A", released: true } },
        { type: "Feature", geometry: null, properties: { site_ref: "B" } },
      ],
    });
    expect(fc.features.map((f) => f.properties?.site_ref)).toEqual(["A"]);
    expect(fc.features[0]!.properties?.released).toBe(true);
  });
});
