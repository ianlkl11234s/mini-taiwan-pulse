import { describe, expect, it } from "vitest";
import type { Locale } from "../../i18n/locales";
import { SUPPORTED_LOCALES } from "../../i18n/locales";
import { applyBasemapLanguage, basemapLabelLanguage, bindBasemapLanguage, type LanguageMap } from "../basemapLanguage";

function fakeMap(initial?: string): LanguageMap & { calls: string[] } {
  let language = initial;
  const calls: string[] = [];
  return {
    calls,
    getLanguage: () => language,
    setLanguage: (next: string) => { calls.push(next); language = next; },
  };
}

function fakeStore(initial: Locale) {
  let locale = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ({ locale }),
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next: Locale) { locale = next; for (const l of listeners) l(); },
    listenerCount: () => listeners.size,
  };
}

describe("basemapLanguage", () => {
  it("中文介面用繁中地名，英日各用自己的地名", () => {
    expect(basemapLabelLanguage("zh-TW")).toBe("zh-Hant");
    expect(basemapLabelLanguage("en")).toBe("en");
    expect(basemapLabelLanguage("ja")).toBe("ja");
  });

  it("每個支援語系都有對應的底圖語言", () => {
    for (const locale of SUPPORTED_LOCALES) expect(basemapLabelLanguage(locale)).toMatch(/^[a-z]{2}(-[A-Z][a-z]{3})?$/);
  });

  it("語言相同時不呼叫 setLanguage（避免重抓 tile）", () => {
    const map = fakeMap("ja");
    expect(applyBasemapLanguage(map, "ja")).toBe(false);
    expect(map.calls).toEqual([]);
    expect(applyBasemapLanguage(map, "en")).toBe(true);
    expect(map.calls).toEqual(["en"]);
  });

  it("bind：建立時對齊目前語系，之後跟著切換，取消訂閱後不再變", () => {
    const map = fakeMap("zh-Hant");
    const store = fakeStore("zh-TW");
    const unbind = bindBasemapLanguage(map, store);
    expect(map.calls).toEqual([]);
    store.set("ja");
    store.set("en");
    expect(map.calls).toEqual(["ja", "en"]);
    unbind();
    expect(store.listenerCount()).toBe(0);
    store.set("zh-TW");
    expect(map.calls).toEqual(["ja", "en"]);
  });
});
