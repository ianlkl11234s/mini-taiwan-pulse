import { describe, expect, it, vi } from "vitest";

// review F088：撤權時 energyLoader 的 owner-gated cache 被清掉（再開要重讀站主私人檔），公開 staticRpc 不受影響。
// 2026-11-08 第 2 批起 facPlanned 等靜態層改讀 owner-data 私人檔（fetchOwnerJson），不再打 RPC。
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
const staticRpc = vi.fn();
vi.mock("../staticRpc", () => ({ staticRpc: (...args: unknown[]) => staticRpc(...args) }));
const fetchOwnerJson = vi.fn();
const reset = vi.fn();
vi.mock("../../lib/ownerData", () => ({
  fetchOwnerJson: (...args: unknown[]) => fetchOwnerJson(...args),
  ownerDataStatus: { reset: (...args: unknown[]) => reset(...args) },
}));

const { fetchFacPlanned, fetchOsmWindTurbines } = await import("../energyLoader");
const { runOwnerGateResets } = await import("../../lib/ownerGateRevoke");

describe("energyLoader 撤權清快取", () => {
  it("facPlanned 撤權後重讀私人檔並清讀取狀態；公開風機快照不重抓", async () => {
    fetchOwnerJson.mockResolvedValue([]);
    staticRpc.mockResolvedValue({ data: [], error: null });
    await fetchFacPlanned();
    await fetchFacPlanned();
    expect(fetchOwnerJson).toHaveBeenCalledTimes(1);
    expect(fetchOwnerJson).toHaveBeenCalledWith("fac-planned", "energy:facPlanned", "規劃電廠 35");
    await fetchOsmWindTurbines();
    expect(staticRpc).toHaveBeenCalledTimes(1);

    runOwnerGateResets(new Set(["facPlanned"]));

    expect(reset).toHaveBeenCalledWith("fac-planned");
    await fetchFacPlanned();
    expect(fetchOwnerJson).toHaveBeenCalledTimes(2);
    await fetchOsmWindTurbines();
    expect(staticRpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});
