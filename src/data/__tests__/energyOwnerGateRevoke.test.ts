import { describe, expect, it, vi } from "vitest";

// review F088：撤權時 energyLoader 的 owner-gated cache 被清掉（再開要重打 RPC），公開 staticRpc 不受影響。
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
const staticRpc = vi.fn();
vi.mock("../staticRpc", () => ({ staticRpc: (...args: unknown[]) => staticRpc(...args) }));

const { fetchFacPlanned, fetchOsmWindTurbines } = await import("../energyLoader");
const { runOwnerGateResets } = await import("../../lib/ownerGateRevoke");

describe("energyLoader 撤權清快取", () => {
  it("facPlanned 撤權後重打 RPC；公開風機快照不重抓", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    staticRpc.mockResolvedValue({ data: [], error: null });
    await fetchFacPlanned();
    await fetchFacPlanned();
    expect(rpc).toHaveBeenCalledTimes(1);
    await fetchOsmWindTurbines();
    expect(staticRpc).toHaveBeenCalledTimes(1);

    runOwnerGateResets(new Set(["facPlanned"]));

    await fetchFacPlanned();
    expect(rpc).toHaveBeenCalledTimes(2);
    await fetchOsmWindTurbines();
    expect(staticRpc).toHaveBeenCalledTimes(1);
  });
});
