import { describe, expect, it, vi } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only validator.
import { featureFilter, validate } from "mapbox-gl/dist/style-spec/index.cjs";
import {
  BRIDGE_RESILIENCE_CLICK_LAYERS, BRIDGE_RESILIENCE_LAYER_IDS, BRIDGE_RESILIENCE_SOURCE_ID, decodeDestinationView, type VillageDestinations, type VillageImpacts,
} from "../../data/bridgeResilienceTypes";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { applyDestinationState, applyVillageState, buildBridgeResilienceLayers, destTopFilter, highlightFilter, originFilter, routeFilter, type BridgeResilienceControls } from "../useBridgeResilienceLayers";

const passes = (filter: unknown, properties: Record<string, unknown>) => featureFilter(filter).filter({ zoom: 10 }, { type: 2, properties });
const CONTROLS: BridgeResilienceControls = { mode: "car", showVillages: true, metric: "p90", showRoutes: true, joint: false };
const STATE = { visible: true, opacity: 0.8, controls: CONTROLS, selected: "三鶯大橋" as string | null };

describe("橋梁韌性 style layers", () => {
  it("全部通過 style-spec 驗證，且三個橋梁線層與村里面都接進點擊登記簿", () => {
    const layers = buildBridgeResilienceLayers(STATE);
    expect(layers.map((l) => l.id)).toEqual(Object.values(BRIDGE_RESILIENCE_LAYER_IDS));
    const errors = validate({ version: 8, sources: { [BRIDGE_RESILIENCE_SOURCE_ID]: { type: "vector", url: "mapbox://x.test" } }, layers });
    expect(errors).toEqual([]);
    const entry = GIS_LAYERS.find((item) => item.type === "bridgeResilienceTwinCity")!;
    expect(new Set(entry.layers)).toEqual(new Set(BRIDGE_RESILIENCE_CLICK_LAYERS));
  });
  it("初始 hidden；透明度套到線與村里面", () => {
    for (const layer of buildBridgeResilienceLayers(STATE)) expect((layer.layout as { visibility?: string }).visibility).toBe("none");
    const at = (id: string, opacity: number) => (buildBridgeResilienceLayers({ ...STATE, opacity }).find((l) => l.id === id)!.paint as Record<string, unknown>);
    expect(at(BRIDGE_RESILIENCE_LAYER_IDS.structure, 0.4)["line-opacity"]).toBe(0.4);
    expect(at(BRIDGE_RESILIENCE_LAYER_IDS.ground, 0.4)["line-opacity"] as number).toBeLessThan(0.4);
  });
  it("地面引道與被移除橋段分層；引道是虛線", () => {
    const layers = buildBridgeResilienceLayers(STATE);
    const ground = layers.find((l) => l.id === BRIDGE_RESILIENCE_LAYER_IDS.ground)!;
    const structure = layers.find((l) => l.id === BRIDGE_RESILIENCE_LAYER_IDS.structure)!;
    expect(passes(ground.filter, { is_removed_structure: false })).toBe(true);
    expect(passes(ground.filter, { is_removed_structure: true })).toBe(false);
    expect(passes(structure.filter, { is_removed_structure: true })).toBe(true);
    expect((ground.paint as Record<string, unknown>)["line-dasharray"]).toBeTruthy();
  });
});

describe("選取高亮與替代路線 filter", () => {
  it("沒有選取時不命中任何 feature", () => {
    expect(passes(highlightFilter(null, false), { bridge_uid: "三鶯大橋" })).toBe(false);
    expect(passes(routeFilter(null, CONTROLS, "after"), { bridge_uid: "三鶯大橋", mode: "car", variant: "after" })).toBe(false);
  });
  it("聯合情境同時高亮兩座成員橋；其他橋不受聯合影響", () => {
    const joint = highlightFilter("關渡大橋", true);
    expect(passes(joint, { bridge_uid: "關渡大橋" })).toBe(true);
    expect(passes(joint, { bridge_uid: "淡江大橋" })).toBe(true);
    expect(passes(joint, { bridge_uid: "三鶯大橋" })).toBe(false);
    expect(passes(highlightFilter("關渡大橋", false), { bridge_uid: "淡江大橋" })).toBe(false);
    expect(passes(highlightFilter("三鶯大橋", true), { bridge_uid: "三鶯大橋" })).toBe(true);
  });
  it("替代路線依模式、前後與情境過濾；聯合時改用聯合鍵；未開時全不顯示", () => {
    const after = routeFilter("三鶯大橋", CONTROLS, "after");
    expect(passes(after, { bridge_uid: "三鶯大橋", mode: "car", variant: "after" })).toBe(true);
    expect(passes(after, { bridge_uid: "三鶯大橋", mode: "car", variant: "before" })).toBe(false);
    expect(passes(after, { bridge_uid: "三鶯大橋", mode: "scooter", variant: "after" })).toBe(false);
    const joint = routeFilter("淡江大橋", { ...CONTROLS, joint: true }, "before");
    expect(passes(joint, { bridge_uid: "關渡大橋+淡江大橋", mode: "car", variant: "before" })).toBe(true);
    expect(passes(joint, { bridge_uid: "淡江大橋", mode: "car", variant: "before" })).toBe(false);
    expect(passes(routeFilter("三鶯大橋", { ...CONTROLS, showRoutes: false }, "after"), { bridge_uid: "三鶯大橋", mode: "car", variant: "after" })).toBe(false);
  });
});

describe("村里 feature-state", () => {
  const data = { summary: { bridges: {} }, impacts: {
    scenarios: ["三鶯大橋|car"], villages: { "63000010002": { p90_dT_s: [null], affected_dest_pop_share: [0] }, "65000160008": { p90_dT_s: [120], affected_dest_pop_share: [0.2] } },
  } as VillageImpacts };
  const fakeMap = () => ({ getSource: vi.fn(() => ({})), setFeatureState: vi.fn(), removeFeatureState: vi.fn() });
  it("null 寫 has=0、有值寫 has=1；share 的 0 仍是 has=1", () => {
    const map = fakeMap();
    expect(applyVillageState(map as never, data, "三鶯大橋|car", "p90", true)).toBe(2);
    expect(map.setFeatureState).toHaveBeenCalledWith({ source: "bridge-resilience", sourceLayer: "villages", id: 63000010002 }, { has: 0, v: 0 });
    expect(map.setFeatureState).toHaveBeenCalledWith({ source: "bridge-resilience", sourceLayer: "villages", id: 65000160008 }, { has: 1, v: 120 });
    const share = fakeMap();
    applyVillageState(share as never, data, "三鶯大橋|car", "share", true);
    expect(share.setFeatureState).toHaveBeenCalledWith(expect.objectContaining({ id: 63000010002 }), { has: 1, v: 0 });
  });
  it("關閉、沒有情境或沒有資料時清空 state；source 不存在不丟例外", () => {
    for (const args of [[data, "三鶯大橋|car", "p90", false], [data, null, "p90", true], [null, "三鶯大橋|car", "p90", true], [data, "不存在|car", "p90", true]] as const) {
      const map = fakeMap();
      expect(applyVillageState(map as never, args[0], args[1], args[2], args[3])).toBe(0);
      expect(map.removeFeatureState).toHaveBeenCalledTimes(1);
      expect(map.setFeatureState).not.toHaveBeenCalled();
    }
    const missing = { ...fakeMap(), getSource: vi.fn(() => undefined) };
    expect(applyVillageState(missing as never, data, "三鶯大橋|car", "p90", true)).toBe(0);
  });
});

describe("目的地視角圖層", () => {
  it("起點／前 20 名外框 filter 以 feature id 比對；沒有起點時不命中", () => {
    const has = (filter: unknown, id: number) => featureFilter(filter).filter({ zoom: 10 }, { type: 3, properties: {}, id });
    expect(has(originFilter(63000010002), 63000010002)).toBe(true);
    expect(has(originFilter(63000010002), 63000010003)).toBe(false);
    expect(has(originFilter(null), 63000010002)).toBe(false);
    expect(has(destTopFilter([1, 2]), 2)).toBe(true);
    expect(has(destTopFilter([1, 2]), 3)).toBe(false);
    expect(has(destTopFilter([]), 1)).toBe(false);
  });
  it("目的地視角時村里填色換成目的地運算式（不可達有自己的色）；起點視角維持原運算式", () => {
    const fill = (focus?: { originId: number | null; topIds: number[]; active: boolean }) =>
      JSON.stringify((buildBridgeResilienceLayers({ ...STATE, focus }).find((l) => l.id === BRIDGE_RESILIENCE_LAYER_IDS.villageFill)!.paint as Record<string, unknown>)["fill-color"]);
    expect(fill({ originId: 1, topIds: [], active: true })).toContain("#a855f7");
    expect(fill()).not.toContain("#a855f7");
    expect(fill({ originId: 1, topIds: [], active: false })).not.toContain("#a855f7");
  });
  it("村里面在最底層、起點外框在其上；點擊層包含村里面", () => {
    const ids = buildBridgeResilienceLayers(STATE).map((l) => l.id);
    expect(ids.indexOf(BRIDGE_RESILIENCE_LAYER_IDS.villageFill)).toBeLessThan(ids.indexOf(BRIDGE_RESILIENCE_LAYER_IDS.origin));
    expect(ids.indexOf(BRIDGE_RESILIENCE_LAYER_IDS.villageFill)).toBeLessThan(ids.indexOf(BRIDGE_RESILIENCE_LAYER_IDS.structure));
    expect(BRIDGE_RESILIENCE_CLICK_LAYERS).toContain(BRIDGE_RESILIENCE_LAYER_IDS.villageFill);
  });
  const dest: VillageDestinations = {
    scenarios: ["三鶯大橋|car"], villages: ["63000010002", "63000020001"], village_names: ["莊敬里", "民權里"],
    districts: [["臺北市", "松山區"], ["臺北市", "大同區"]], village_district: [0, 1],
    data: { "0": { "0": { d: [1, 70, 600, 480, 720], t: [1, 720, 70] } } },
  };
  it("feature-state：起點 has=3、受影響區 has=1（v＝區平均秒）；source 不存在或沒有 view 不寫", () => {
    const set = vi.fn();
    const map = { getSource: vi.fn(() => ({})), setFeatureState: set };
    const view = decodeDestinationView(dest, "三鶯大橋|car", "63000010002")!;
    expect(applyDestinationState(map as never, dest, view)).toBe(2);
    expect(set).toHaveBeenCalledWith({ source: "bridge-resilience", sourceLayer: "villages", id: 63000010002 }, { has: 3, v: 0 });
    expect(set).toHaveBeenCalledWith({ source: "bridge-resilience", sourceLayer: "villages", id: 63000020001 }, { has: 1, v: 480 });
    expect(applyDestinationState({ ...map, getSource: () => undefined } as never, dest, view)).toBe(0);
    expect(applyDestinationState(map as never, dest, null)).toBe(0);
  });
});
