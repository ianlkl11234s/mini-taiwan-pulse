import { afterEach, describe, expect, it, vi } from "vitest";
import { countryStore, resolveInitialCountry } from "../countryStore";

afterEach(() => countryStore.reset());

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
