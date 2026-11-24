import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_MEMORY_STORAGE_KEY, MAX_PINNED, PINNED_STORAGE_KEY, countryCameraMemory, countryStore, parsePinned, pinnedCountries, resolveInitialCountry,
} from "../countryStore";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
  pinnedCountries.resetForTest();
  countryCameraMemory.resetForTest();
});

function resetAll(): void {
  localStorage.clear();
  pinnedCountries.resetForTest();
  countryCameraMemory.resetForTest();
  countryStore.reset();
}

afterEach(() => {
  resetAll();
  vi.unstubAllGlobals();
});

describe("countryStore", () => {
  it("初始國家：c= 優先，其次相機中心所屬國，最後台灣", () => {
    expect(resolveInitialCountry("FR", { center: [139.7, 35.7] })).toBe("FR");
    expect(resolveInitialCountry(undefined, { center: [139.7, 35.7] })).toBe("JP");
    expect(resolveInitialCountry(undefined, { center: [123.5, 25.75] })).toBe("TW");
    expect(resolveInitialCountry(undefined, undefined)).toBe("TW");
    // 沒有相機時才看圖層所屬國
    expect(resolveInitialCountry(undefined, undefined, "JP")).toBe("JP");
    expect(resolveInitialCountry(undefined, { center: [121.5, 25.0] }, "JP")).toBe("TW");
  });

  it("set 只在值改變時通知訂閱者", () => {
    const listener = vi.fn();
    const unsubscribe = countryStore.subscribe(listener);
    countryStore.set("TW");
    expect(listener).not.toHaveBeenCalled();
    countryStore.set("JP");
    expect(countryStore.getSnapshot()).toBe("JP");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("pinnedCountries", () => {
  it("依釘選順序、最多 3 國，滿了再釘回 false", () => {
    expect(pinnedCountries.pin("TW")).toBe(true);
    expect(pinnedCountries.pin("GB")).toBe(true);
    expect(pinnedCountries.pin("JP")).toBe(true);
    expect(MAX_PINNED).toBe(3);
    expect(pinnedCountries.pin("KR")).toBe(false);
    expect(pinnedCountries.getSnapshot()).toEqual(["TW", "GB", "JP"]);
  });

  it("重複釘選不重複加入；移除後可再釘、順序接在尾端", () => {
    pinnedCountries.pin("TW");
    expect(pinnedCountries.pin("TW")).toBe(false);
    pinnedCountries.pin("GB");
    pinnedCountries.unpin("TW");
    expect(pinnedCountries.getSnapshot()).toEqual(["GB"]);
    pinnedCountries.pin("TW");
    expect(pinnedCountries.getSnapshot()).toEqual(["GB", "TW"]);
  });

  it("toggle 回傳操作後狀態；滿了釘不進去回 false", () => {
    expect(pinnedCountries.toggle("JP")).toBe(true);
    expect(pinnedCountries.toggle("JP")).toBe(false);
    pinnedCountries.pin("TW"); pinnedCountries.pin("GB"); pinnedCountries.pin("JP");
    expect(pinnedCountries.toggle("KR")).toBe(false);
  });

  it("變動才通知，快照參照在沒變時穩定", () => {
    const listener = vi.fn();
    const off = pinnedCountries.subscribe(listener);
    const first = pinnedCountries.getSnapshot();
    pinnedCountries.unpin("JP");
    expect(listener).not.toHaveBeenCalled();
    pinnedCountries.pin("JP");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(pinnedCountries.getSnapshot()).not.toBe(first);
    expect(pinnedCountries.getSnapshot()).toBe(pinnedCountries.getSnapshot());
    off();
  });

  it("寫進 localStorage，重新載入讀得回來", () => {
    pinnedCountries.pin("TW"); pinnedCountries.pin("GB");
    expect(JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) ?? "null")).toEqual(["TW", "GB"]);
    pinnedCountries.resetForTest();
    expect(pinnedCountries.getSnapshot()).toEqual(["TW", "GB"]);
  });

  it("壞資料：非 JSON、非陣列、未知國碼、重複、超過上限都丟棄", () => {
    localStorage.setItem(PINNED_STORAGE_KEY, "{not json");
    pinnedCountries.resetForTest();
    expect(pinnedCountries.getSnapshot()).toEqual([]);
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify({ a: 1 }));
    pinnedCountries.resetForTest();
    expect(pinnedCountries.getSnapshot()).toEqual([]);
    expect(parsePinned(["TW", "ZZ", 5, "TW", "GB", "JP", "KR"])).toEqual(["TW", "GB", "JP"]);
  });
});

describe("countryCameraMemory", () => {
  const tokyo = { center: [139.7, 35.7] as [number, number], zoom: 11.5, pitch: 40, bearing: -20 };

  it("沒記錄時 get 回 undefined、resolve 回國家預設鏡頭", () => {
    expect(countryCameraMemory.get("JP")).toBeUndefined();
    expect(countryCameraMemory.resolve("JP")).toEqual(countryCameraMemory.resolve("JP"));
    expect(countryCameraMemory.resolve("JP").zoom).not.toBe(tokyo.zoom);
  });

  it("記錄後讀得回來，並寫進 localStorage；重新載入仍在", () => {
    expect(countryCameraMemory.record("JP", tokyo)).toBe(true);
    expect(countryCameraMemory.get("JP")).toEqual(tokyo);
    expect(countryCameraMemory.resolve("JP")).toEqual(tokyo);
    countryCameraMemory.resetForTest();
    expect(countryCameraMemory.get("JP")).toEqual(tokyo);
  });

  it("每國各記各的；後記的覆蓋同國舊的", () => {
    countryCameraMemory.record("JP", tokyo);
    countryCameraMemory.record("TW", { center: [121.5, 25.0], zoom: 12, pitch: 0, bearing: 0 });
    countryCameraMemory.record("JP", { ...tokyo, zoom: 9 });
    expect(countryCameraMemory.get("JP")?.zoom).toBe(9);
    expect(countryCameraMemory.get("TW")?.zoom).toBe(12);
  });

  it("鏡頭中心不在該國內不記（拖到別國不污染）", () => {
    expect(countryCameraMemory.record("TW", tokyo)).toBe(false);
    expect(countryCameraMemory.get("TW")).toBeUndefined();
  });

  it("不合法的鏡頭不記", () => {
    expect(countryCameraMemory.record("JP", { ...tokyo, zoom: Number.NaN })).toBe(false);
    expect(countryCameraMemory.record("JP", { ...tokyo, pitch: 120 })).toBe(false);
    expect(countryCameraMemory.get("JP")).toBeUndefined();
  });

  it("壞 localStorage：非 JSON、型別錯、未知國碼、單筆壞掉只丟該筆", () => {
    localStorage.setItem(CAMERA_MEMORY_STORAGE_KEY, "oops");
    countryCameraMemory.resetForTest();
    expect(countryCameraMemory.get("JP")).toBeUndefined();
    localStorage.setItem(CAMERA_MEMORY_STORAGE_KEY, JSON.stringify([1, 2]));
    countryCameraMemory.resetForTest();
    expect(countryCameraMemory.get("JP")).toBeUndefined();
    localStorage.setItem(CAMERA_MEMORY_STORAGE_KEY, JSON.stringify({
      JP: tokyo,
      TW: { center: ["x", 25], zoom: 12, pitch: 0, bearing: 0 },
      ZZ: tokyo,
    }));
    countryCameraMemory.resetForTest();
    expect(countryCameraMemory.get("JP")).toEqual(tokyo);
    expect(countryCameraMemory.get("TW")).toBeUndefined();
  });
});
