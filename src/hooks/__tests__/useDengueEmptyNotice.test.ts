import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";

// Codex review PR #1248 r4688305125：翻譯檔載入中關閉圖層，不得再跳過期的「無聚集區」提示
const h = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cursor = 0;
  const effects: Array<() => void | (() => void)> = [];
  let release: () => void = () => {};
  return {
    reset: () => { cursor = 0; effects.length = 0; },
    effects,
    useRef: (initial: unknown) => (refs[cursor++] ??= { current: initial }),
    gate: () => new Promise<void>((r) => { release = r; }),
    release: () => release(),
  };
});

vi.mock("react", () => ({
  useEffect: (e: () => void | (() => void)) => { h.effects.push(e); },
  useRef: h.useRef,
  useState: () => [{ fc: { type: "FeatureCollection", features: [] }, status: {} }, () => {}] as const,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../components/TransientNotice", () => ({ showTransientNotice: vi.fn() }));
vi.mock("../../state/localeStore", () => ({
  localeStore: { need: () => h.gate(), getSnapshot: () => ({ t: (k: string) => k }) },
}));
vi.mock("../../data/twLiveSnapshots", async (orig) => ({
  ...(await orig<typeof import("../../data/twLiveSnapshots")>()),
  fetchTwLiveSnapshot: () => new Promise(() => {}),
}));

import { useDengueClusterLayer } from "../useTwLiveSnapshotLayer";
import { showTransientNotice } from "../../components/TransientNotice";

describe("dengue 無聚集區提示", () => {
  it("翻譯檔載入完成前圖層關閉（effect cleanup）→ 不顯示提示", async () => {
    h.reset();
    const mapRef = { current: null as MapboxMap | null };
    vi.stubGlobal("window", { setInterval: () => 1, clearInterval: () => {} });
    useDengueClusterLayer(mapRef, true, { opacity: 1, scale: 1, isDark: false });
    const cleanups = h.effects.map((e) => e()).filter((c): c is () => void => typeof c === "function");
    cleanups.forEach((c) => c());
    h.release();
    await Promise.resolve(); await Promise.resolve();
    expect(showTransientNotice).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
