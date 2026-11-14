import { beforeEach, describe, expect, it, vi } from "vitest";

// 首爾用途地域（站主限定，2026-11-14）：圖磚只走私人 owner-data，不得出現公開 ./world/ 路徑；
// 存取探測 200＋allowed 才開放，401／403／404 一律當未開放。
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn() } } }));

const { probeOwnerPmtilesAccess, resetOwnerPmtilesAccessProbes } = await import("../useOwnerPmtilesAccess");
const { KR_SPEC_BY_KEY } = await import("../../data/krDataLayers");
const { LAYER_MANIFEST } = await import("../../data/layerManifest");
const { GATED_LAYERS } = await import("../../components/sidebar/layerCatalog");
const { OWNER_DATA_ASSETS } = await import("../../data/ownerDataAssets");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("首爾用途地域：站主限定 owner-data", () => {
  beforeEach(() => resetOwnerPmtilesAccessProbes());

  it("規格、manifest、gate 與 owner-data 契約一致，且不宣告公開資產", () => {
    const spec = KR_SPEC_BY_KEY.krSeoulZoning;
    expect(spec.ownerAsset).toBe("kr-seoul-zoning");
    expect(OWNER_DATA_ASSETS["kr-seoul-zoning"].filename).toBe(spec.file);
    const entry = LAYER_MANIFEST.krSeoulZoning;
    expect(entry.topics).toContain("OWNER_ONLY");
    expect(GATED_LAYERS.has("krSeoulZoning")).toBe(true);
    expect(JSON.stringify(entry.source)).toContain(`PRIVATE_OWNER_ONLY: ${spec.file}`);
    expect(JSON.stringify(entry.source)).not.toContain("./world/");
  });

  it("探測打同源 owner-data 端點並帶 token；allowed=true 才開放", async () => {
    const fetchFn = vi.fn(async () => json({ allowed: true }));
    await expect(probeOwnerPmtilesAccess("kr-seoul-zoning", "u1", "tok", fetchFn as unknown as typeof fetch)).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("/api/private-research/owner-data/kr-seoul-zoning?access=1", expect.objectContaining({ headers: { Authorization: "Bearer tok" } }));
  });

  it.each([401, 403, 404])("HTTP %i 靜默當成未開放", async (status) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => json({}, status));
    await expect(probeOwnerPmtilesAccess("kr-seoul-zoning", "u1", "tok", fetchFn as unknown as typeof fetch)).resolves.toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("allowed 不是 true 就不開放", async () => {
    const fetchFn = vi.fn(async () => json({ allowed: false }));
    await expect(probeOwnerPmtilesAccess("kr-seoul-zoning", "u2", "tok", fetchFn as unknown as typeof fetch)).resolves.toBe(false);
  });
});
