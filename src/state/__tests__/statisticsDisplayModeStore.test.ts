import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATISTICS_CHOROPLETH_KEYS } from "../../data/statisticsLayerRegistry";
import { layerVisibilityStore } from "../layerVisibilityStore";
import {
  STATISTICS_DISPLAY_MODE_STORAGE_KEY,
  resolveStatisticsModeForUrl,
  statisticsDisplayModeStore,
} from "../statisticsDisplayModeStore";

const [A, B, C] = STATISTICS_CHOROPLETH_KEYS;

function apply(next: ReturnType<typeof statisticsDisplayModeStore.enable>) {
  layerVisibilityStore.setAll(next);
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  layerVisibilityStore.reset();
  statisticsDisplayModeStore.reset();
});

describe("statisticsDisplayModeStore", () => {
  it("URL 明示模式優先於 local preference；舊統計連結安全回退 single", () => {
    expect(resolveStatisticsModeForUrl("overlap", true)).toBe("overlap");
    expect(resolveStatisticsModeForUrl("single", true)).toBe("single");
    expect(resolveStatisticsModeForUrl(undefined, true)).toBe("single");
    expect(resolveStatisticsModeForUrl(undefined, false)).toBeUndefined();
  });

  it("預設為單一模式", () => {
    expect(statisticsDisplayModeStore.getSnapshot()).toEqual({ mode: "single", lastEnabledKey: null, recentEnabledKeys: [] });
  });

  it("單一模式 A → B 只保留 B，且不影響一般圖層", () => {
    layerVisibilityStore.setVisibility("flights", true);
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(B!, layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility(B!)).toBe(true);
    expect(layerVisibilityStore.getVisibility("flights")).toBe(true);
  });

  it("重疊模式可同時開啟多個統計層", () => {
    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(B!, layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(A!)).toBe(true);
    expect(layerVisibilityStore.getVisibility(B!)).toBe(true);
  });

  it("從重疊切回單一時保留最近啟用的統計層", () => {
    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(B!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.setMode("single", layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility(B!)).toBe(true);
    expect(statisticsDisplayModeStore.getSnapshot().mode).toBe("single");
  });

  it("沒有最近啟用紀錄時以 registry 的反向順序穩定收斂", () => {
    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    layerVisibilityStore.setBulk({ [A!]: true, [B!]: true });
    apply(statisticsDisplayModeStore.setMode("single", layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility(B!)).toBe(true);
  });

  it("將模式與最近啟用圖層持久化", () => {
    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(B!, layerVisibilityStore.getAll()));

    expect(storage.getItem(STATISTICS_DISPLAY_MODE_STORAGE_KEY)).toBe(
      JSON.stringify({ mode: "overlap", lastEnabledKey: B, recentEnabledKeys: [B] }),
    );
  });

  it("關閉最新 C 後切回單一會保留 recency stack 的 B", () => {
    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(B!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(C!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.setVisible(C!, false, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.setMode("single", layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(B!)).toBe(true);
    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility(C!)).toBe(false);
  });

  it("crimeAreaMonthly 與 recipes 都受互斥，行政邊界不受影響", () => {
    layerVisibilityStore.setVisibility("countyBoundary", true);
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable("crimeAreaMonthly", layerVisibilityStore.getAll()));

    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility("crimeAreaMonthly")).toBe(true);
    expect(layerVisibilityStore.getVisibility("countyBoundary")).toBe(true);
  });

  it("航港 county layer 在單一與重疊模式都走同一 admission contract", () => {
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable("statsMaritimeSubsidyCounty", layerVisibilityStore.getAll()));
    expect(layerVisibilityStore.getVisibility(A!)).toBe(false);
    expect(layerVisibilityStore.getVisibility("statsMaritimeSubsidyCounty")).toBe(true);

    apply(statisticsDisplayModeStore.setMode("overlap", layerVisibilityStore.getAll()));
    apply(statisticsDisplayModeStore.enable(A!, layerVisibilityStore.getAll()));
    expect(layerVisibilityStore.getVisibility(A!)).toBe(true);
    expect(layerVisibilityStore.getVisibility("statsMaritimeSubsidyCounty")).toBe(true);
  });

  it("raw restore 在單一模式也會經 admission gate 收斂", () => {
    const restored = statisticsDisplayModeStore.admitVisibility({
      ...layerVisibilityStore.getAll(),
      [A!]: true,
      [B!]: true,
      countyBoundary: true,
    });

    expect(restored[A!]).toBe(false);
    expect(restored[B!]).toBe(true);
    expect(restored.countyBoundary).toBe(true);
  });
});
