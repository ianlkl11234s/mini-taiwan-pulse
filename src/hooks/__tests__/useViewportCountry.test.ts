import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VIEWPORT_HINT_MIN_ZOOM,
  VIEWPORT_HINT_SETTLE_MS,
  VIEWPORT_HINT_STORAGE_KEY,
  createHintDismissals,
  createViewportSettleWatcher,
  settleViewport,
  viewportCountryAt,
  viewportHintTarget,
  type SettleMap,
} from "../useViewportCountry";
import type { CountryCode } from "../../constants/countries";

const TOKYO = [139.77, 35.68] as const;
const TAIPEI = [121.53, 25.05] as const;
const PARIS = [2.35, 48.86] as const;
const DIAOYUTAI = [123.5, 25.75] as const;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const always = (n: number) => () => n;
const never = () => false;

describe("視野提示：zoom 門檻", () => {
  it("zoom < 4.5 不判斷（看東亞、全歐時不跳）", () => {
    expect(viewportCountryAt(TOKYO, 3)).toBeNull();
    expect(viewportCountryAt(TOKYO, VIEWPORT_HINT_MIN_ZOOM - 0.01)).toBeNull();
    expect(viewportCountryAt(TOKYO, VIEWPORT_HINT_MIN_ZOOM)).toBe("JP");
    expect(viewportCountryAt(PARIS, 6)).toBe("FR");
  });

  it("中心不在任何國家時回 none（公海、爭議海域）", () => {
    expect(viewportCountryAt(DIAOYUTAI, 8)).toBe("none");
  });
});

describe("視野提示：要不要跳", () => {
  it("他國且≠目前國家且有可用圖層才跳", () => {
    expect(viewportHintTarget({ view: "JP", country: "TW", isKept: never, availableCount: always(10) })).toBe("JP");
    expect(viewportHintTarget({ view: "TW", country: "JP", isKept: never, availableCount: always(10) })).toBe("TW");
  });

  it("同國、不判斷、無國家都不跳", () => {
    expect(viewportHintTarget({ view: "TW", country: "TW", isKept: never, availableCount: always(10) })).toBeNull();
    expect(viewportHintTarget({ view: null, country: "TW", isKept: never, availableCount: always(10) })).toBeNull();
    expect(viewportHintTarget({ view: "none", country: "TW", isKept: never, availableCount: always(10) })).toBeNull();
  });

  it("可用圖層數為 0（全部上鎖或 release-hold）不跳", () => {
    expect(viewportHintTarget({ view: "FR", country: "TW", isKept: never, availableCount: always(0) })).toBeNull();
  });

  it("按過「保持」的國家不跳，其他國家照跳", () => {
    const isKept = (code: CountryCode) => code === "JP";
    expect(viewportHintTarget({ view: "JP", country: "TW", isKept, availableCount: always(10) })).toBeNull();
    expect(viewportHintTarget({ view: "FR", country: "TW", isKept, availableCount: always(10) })).toBe("FR");
  });
});

describe("視野提示：「保持」紀錄（關閉規則）", () => {
  it("寫進 sessionStorage，重新建立（同一次瀏覽重整）後仍記得", () => {
    const storage = memoryStorage();
    const first = createHintDismissals(storage);
    first.add("JP");
    expect(JSON.parse(storage.data.get(VIEWPORT_HINT_STORAGE_KEY)!)).toEqual(["JP"]);
    expect(createHintDismissals(storage).has("JP")).toBe(true);
  });

  it("壞掉的 storage 內容忽略，未知國碼濾掉", () => {
    const storage = memoryStorage();
    storage.setItem(VIEWPORT_HINT_STORAGE_KEY, "{oops");
    expect(createHintDismissals(storage).has("JP")).toBe(false);
    storage.setItem(VIEWPORT_HINT_STORAGE_KEY, JSON.stringify(["JP", "KR", 3]));
    const dismissals = createHintDismissals(storage);
    expect(dismissals.has("JP")).toBe(true);
  });

  it("storage 不可用時只存在記憶體", () => {
    const dismissals = createHintDismissals(null);
    dismissals.add("FR");
    expect(dismissals.has("FR")).toBe(true);
  });

  it("視野回到目前國家時清除（重新啟用）", () => {
    const storage = memoryStorage();
    const dismissals = createHintDismissals(storage);
    dismissals.add("JP");
    // 還在日本：不清
    expect(settleViewport(TOKYO, 8, "TW", dismissals)).toEqual({ view: "JP", cleared: false });
    expect(dismissals.has("JP")).toBe(true);
    // zoom 太小不判斷：不清
    expect(settleViewport(TAIPEI, 3, "TW", dismissals)).toEqual({ view: null, cleared: false });
    expect(dismissals.has("JP")).toBe(true);
    // 回到台灣：清掉，下次到日本會再跳
    expect(settleViewport(TAIPEI, 8, "TW", dismissals)).toEqual({ view: "TW", cleared: true });
    expect(dismissals.has("JP")).toBe(false);
    expect(storage.data.has(VIEWPORT_HINT_STORAGE_KEY)).toBe(false);
  });

  it("手動切國家＝clear（hook 在 countryStore 改變時呼叫）", () => {
    const dismissals = createHintDismissals(memoryStorage());
    expect(dismissals.clear()).toBe(false);
    dismissals.add("JP");
    expect(dismissals.clear()).toBe(true);
    expect(dismissals.has("JP")).toBe(false);
  });
});

describe("視野提示：停穩 600ms", () => {
  afterEach(() => vi.useRealTimers());

  function fakeMap(center: readonly [number, number], zoom: number) {
    const listeners = new Map<string, Set<() => void>>();
    const map: SettleMap & { emit: (type: string) => void; center: readonly [number, number]; listenerCount: () => number } = {
      center,
      on: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      off: (type, fn) => {
        listeners.get(type)?.delete(fn);
      },
      getCenter: () => ({ lng: map.center[0], lat: map.center[1] }),
      getZoom: () => zoom,
      emit: (type) => listeners.get(type)?.forEach((fn) => fn()),
      listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    };
    return map;
  }

  it("moveend 後 600ms 才判斷；中途又開始移動就重算", () => {
    vi.useFakeTimers();
    const map = fakeMap(TOKYO, 8);
    const onSettle = vi.fn();
    const dispose = createViewportSettleWatcher({ map, onSettle, onSkip: vi.fn() });
    map.emit("movestart");
    map.emit("moveend");
    vi.advanceTimersByTime(VIEWPORT_HINT_SETTLE_MS - 1);
    map.emit("movestart");
    vi.advanceTimersByTime(VIEWPORT_HINT_SETTLE_MS);
    expect(onSettle).not.toHaveBeenCalled();
    map.emit("moveend");
    vi.advanceTimersByTime(VIEWPORT_HINT_SETTLE_MS);
    expect(onSettle).toHaveBeenCalledExactlyOnceWith([TOKYO[0], TOKYO[1]], 8);
    dispose();
    expect(map.listenerCount()).toBe(0);
  });

  it("Agent 移動鏡頭的那一段不判斷，下一次手動移動照常", () => {
    vi.useFakeTimers();
    const map = fakeMap(TOKYO, 8);
    let agent = true;
    const onSettle = vi.fn();
    const onSkip = vi.fn();
    const dispose = createViewportSettleWatcher({ map, isAgentMotion: () => agent, onSettle, onSkip });
    map.emit("movestart");
    agent = false; // moveResearchCamera 在 moveend 時就結束了，所以要在 movestart 記住
    map.emit("moveend");
    vi.advanceTimersByTime(VIEWPORT_HINT_SETTLE_MS);
    expect(onSettle).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledOnce();
    map.emit("movestart");
    map.emit("moveend");
    vi.advanceTimersByTime(VIEWPORT_HINT_SETTLE_MS);
    expect(onSettle).toHaveBeenCalledOnce();
    dispose();
  });
});
