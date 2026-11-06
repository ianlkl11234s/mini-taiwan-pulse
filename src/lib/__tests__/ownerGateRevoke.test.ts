import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearOverlaySourcesForKeys, lockedVisibleKeys, newlyLockedKeys,
  registerOwnerGateReset, resetOwnerGateHandlersForTest, runOwnerGateResets,
} from "../ownerGateRevoke";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

// review F088：登出／失去站主權限時，已開的站主限定圖層要關掉、快取與 Mapbox source 資料要清掉。
afterEach(() => resetOwnerGateHandlersForTest());

describe("撤權判定（App lockedKeys 變化）", () => {
  it("已開的 gated 圖層被關；非 gated 圖層不受影響", () => {
    const visibility = { gbPollutionInventoryEngland: true, livestockFarmPig: true, rail: true, aqi: true, facPrimary: false };
    const locked = new Set(["gbPollutionInventoryEngland", "livestockFarmPig", "facPrimary"]);
    expect(lockedVisibleKeys(visibility, locked).sort()).toEqual(["gbPollutionInventoryEngland", "livestockFarmPig"]);
  });

  it("只有「有→無」權限的 key 算新上鎖；初次（prev=當下）與解鎖方向都是空集合", () => {
    const all = new Set(["a", "b", "c"]);
    expect([...newlyLockedKeys(all, all)]).toEqual([]);
    expect([...newlyLockedKeys(all, new Set<string>())]).toEqual([]); // 站主登入＝解鎖
    expect([...newlyLockedKeys(new Set(["c"]), all)].sort()).toEqual(["a", "b"]); // 登出
  });
});

describe("清除註冊表", () => {
  it("只呼叫與撤權 key 有交集的清除，並把完整撤權集合傳入", () => {
    const gated = vi.fn();
    const other = vi.fn();
    registerOwnerGateReset(["gbPollutionInventoryEngland"], gated);
    registerOwnerGateReset(["rail"], other);
    const revoked = new Set(["gbPollutionInventoryEngland", "facPrimary"]);
    runOwnerGateResets(revoked);
    expect(gated).toHaveBeenCalledTimes(1);
    expect(gated).toHaveBeenCalledWith(revoked);
    expect(other).not.toHaveBeenCalled();
  });

  it("unregister 後不再呼叫；空集合不呼叫；單一清除丟錯不影響其他", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = vi.fn(() => { throw new Error("boom"); });
    const b = vi.fn();
    const offA = registerOwnerGateReset(["k"], a);
    registerOwnerGateReset(["k"], b);
    runOwnerGateResets(new Set());
    expect(a).not.toHaveBeenCalled();
    runOwnerGateResets(new Set(["k"]));
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    runOwnerGateResets(new Set(["k"]));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("Mapbox source 資料清空（registry overlay）", () => {
  function fakeMap() {
    const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
    for (const config of OVERLAY_REGISTRY) if (!config.pmtiles) sources.set(config.sourceId, { setData: vi.fn() });
    return { sources, map: { getSource: (id: string) => sources.get(id) } };
  }

  it("registry 裡每個站主限定 overlay 都是 GeoJSON source（撤權能清空，不會漏網）", () => {
    const gatedConfigs = OVERLAY_REGISTRY.filter((c) => GATED_LAYERS.has(c.id));
    expect(gatedConfigs.length).toBeGreaterThan(0);
    expect(gatedConfigs.filter((c) => c.pmtiles).map((c) => c.id)).toEqual([]);
  });

  it("撤權的 gated overlay source 被 setData(空)；非 gated source 不動", () => {
    const { map, sources } = fakeMap();
    const revoked = new Set<string>(GATED_LAYERS);
    const cleared = clearOverlaySourcesForKeys(map, OVERLAY_REGISTRY, revoked);
    expect(cleared).toContain("gb-ea-pollution-inventory");
    expect(cleared).toContain("livestock-farms");
    for (const id of cleared) {
      expect(sources.get(id)!.setData).toHaveBeenCalledWith({ type: "FeatureCollection", features: [] });
    }
    const gatedSourceIds = new Set(OVERLAY_REGISTRY.filter((c) => GATED_LAYERS.has(c.id)).map((c) => c.sourceId));
    for (const [id, src] of sources) {
      if (!gatedSourceIds.has(id)) expect(src.setData).not.toHaveBeenCalled();
    }
  });
});
