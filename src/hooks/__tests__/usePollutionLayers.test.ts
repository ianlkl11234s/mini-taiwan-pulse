import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  type Slot = { deps?: readonly unknown[]; cleanup?: void | (() => void) };
  const effects: Slot[] = [];
  let e = 0;
  return {
    begin() { e = 0; },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const i = e++;
      const prev = effects[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && prev.deps.every((v, k) => Object.is(v, deps[k]))) return;
      prev?.cleanup?.();
      effects[i] = { deps, cleanup: effect() };
    },
    cleanup() { for (const s of effects) s.cleanup?.(); effects.length = 0; },
  };
});
vi.mock("react", () => ({ useEffect: reactHarness.useEffect }));

import { usePollutionLayers, type PollutionFilterState } from "../usePollutionLayers";
import { FACILITY_MEDIA, type PollutionMedium } from "../../data/pollutionTypes";

const POINT = "pollution-penalty-critical-circle";
const HEAT = "pollution-penalty-critical-heatmap";

function createMap() {
  const layers = new Map<string, unknown>();
  const handlers = new Map<string, Set<() => void>>();
  const map = {
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    getFilter: (id: string) => layers.get(id),
    setFilter: vi.fn((id: string, f: unknown) => { layers.set(id, f); }),
    on: (ev: string, cb: () => void) => { (handlers.get(ev) ?? handlers.set(ev, new Set()).get(ev)!).add(cb); },
    off: (ev: string, cb: () => void) => { handlers.get(ev)?.delete(cb); },
  };
  return {
    map: map as unknown as MapboxMap,
    raw: map,
    addLayer: (id: string, filter: unknown) => { layers.set(id, filter); handlers.get("styledata")?.forEach((h) => h()); },
    filterOf: (id: string) => layers.get(id),
  };
}

const media = Object.fromEntries(FACILITY_MEDIA.map((m) => [m, true])) as Record<PollutionMedium, boolean>;
const state = (year: number): PollutionFilterState => ({
  facilityMedia: media, facilityMinSev: 0, penaltyMediumIdx: 0, penaltyYear: year, penaltyMode: 1, siteActiveOnly: false,
});
const vis = { pollutionFacility: false, pollutionPenaltyCritical: true, pollutionPenaltyGeneral: false, pollutionPenaltyMobile: false, pollutionSite: false };
const BASE = ["==", ["get", "severity_event"], "critical"];

describe("usePollutionLayers 預設年份篩選 (R5-2)", () => {
  afterEach(() => reactHarness.cleanup());

  it("layer 在 hook 套用之後才加入：加入時（styledata）立即套上預設年份，點與熱區一致", () => {
    const { map, addLayer, filterOf } = createMap();
    const ref = { current: map } as RefObject<MapboxMap | null>;
    reactHarness.begin();
    usePollutionLayers(ref, vis, state(2026));
    expect(filterOf(POINT)).toBeUndefined();
    addLayer(POINT, BASE);
    addLayer(HEAT, BASE);
    const expected = ["all", BASE, ["all", ["==", ["coalesce", ["to-number", ["get", "penalty_year"]], 0], 2026]]];
    expect(filterOf(POINT)).toEqual(expected);
    expect(filterOf(HEAT)).toEqual(expected);
  });

  it("加入時的 filter 與「先有 layer、之後改參數」結果相同", () => {
    const a = createMap();
    reactHarness.begin();
    usePollutionLayers({ current: a.map } as RefObject<MapboxMap | null>, vis, state(2026));
    a.addLayer(POINT, BASE);
    reactHarness.cleanup();

    const b = createMap();
    b.addLayer(POINT, BASE);
    reactHarness.begin();
    usePollutionLayers({ current: b.map } as RefObject<MapboxMap | null>, vis, state(2025));
    reactHarness.begin();
    usePollutionLayers({ current: b.map } as RefObject<MapboxMap | null>, vis, state(2026));
    expect(a.filterOf(POINT)).toEqual(b.filterOf(POINT));
  });

  it("apply 冪等：filter 已正確時不重複 setFilter（避免 styledata 迴圈）", () => {
    const { map, raw, addLayer } = createMap();
    reactHarness.begin();
    usePollutionLayers({ current: map } as RefObject<MapboxMap | null>, vis, state(2026));
    addLayer(POINT, BASE);
    const n = raw.setFilter.mock.calls.length;
    addLayer("unrelated", null);
    expect(raw.setFilter.mock.calls.length).toBe(n);
  });
});
