/**
 * 英日文分批載入（B1 P6）：開站只載開站檔；查不到的字先回退中文、補載完換成該語言；國家包的圖層名檔另外登記。
 * 每個情境用 vi.resetModules() 取全新的 localeStore（已載入的檔是模組層級狀態）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOT_FILES } from "../localeFiles";

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function freshStore(search: string) {
  vi.stubGlobal("location", { search });
  vi.stubGlobal("navigator", { languages: [], language: undefined });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  const mod = await import("../../state/localeStore");
  return mod.localeStore;
}

async function settle(store: { getSnapshot: () => { active: string } }, active: string) {
  for (let i = 0; i < 50 && store.getSnapshot().active !== active; i++) await new Promise((r) => setTimeout(r, 10));
  await new Promise((r) => setTimeout(r, 30));
}

describe("英日文分批載入", () => {
  it("?lang=en 開站只載開站檔，載完才換語系", async () => {
    const store = await freshStore("?lang=en");
    store.init();
    expect(store.getSnapshot().locale).toBe("en");
    expect(store.getSnapshot().active).toBe("zh-TW"); // 開站檔載完前維持中文，不閃 key
    await settle(store, "en");
    expect(store.getSnapshot().active).toBe("en");
    expect(store.loadedFiles("en")).toEqual([...BOOT_FILES].sort());
    expect(store.loadedFiles("zh-TW")).toEqual([]);
  });

  it("查不到的字先回退中文，補載該檔後換成英文；不是 key 也不是空白", async () => {
    const store = await freshStore("?lang=en");
    store.init();
    await settle(store, "en");
    const zh = await import("../locales/zh-TW/paramsPanel.json");
    const en = await import("../locales/en/paramsPanel.json");
    const key = "paramsPanel.loading" as const;
    expect(store.getSnapshot().t(key)).toBe((zh.default as Record<string, string>)[key]);
    await new Promise((r) => setTimeout(r, 50));
    expect(store.loadedFiles("en")).toContain("paramsPanel");
    expect(store.getSnapshot().t(key)).toBe((en.default as Record<string, string>)[key]);
  });

  it("enum 前綴對不到檔名時查索引（enum.jpWelfareCategory 在 enums.japan）", async () => {
    const store = await freshStore("?lang=en");
    store.init();
    await settle(store, "en");
    const snap = store.getSnapshot();
    expect(snap.lookup("enum.jpWelfareCategory.x")).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(store.loadedFiles("en")).toContain("enums.japan");
    expect(store.getSnapshot()).not.toBe(snap); // 補到檔後重發 snapshot，畫面會重畫
  });

  it("need() 登記的檔（國家包的 layers.<cc>）：之後切語系也一起先載", async () => {
    const store = await freshStore("");
    store.init();
    await store.need(["layers.jp"]);
    expect(store.loadedFiles("en")).toEqual([]); // 中文介面不抓英日文
    store.set("ja");
    await settle(store, "ja");
    expect(store.loadedFiles("ja")).toContain("layers.jp");
    expect(store.getSnapshot().lookup("layer.jpWaterSupplyFacilities")).toBeTruthy();
  });

  it("中文介面查字不觸發任何英日文載入", async () => {
    const store = await freshStore("");
    store.init();
    store.getSnapshot().lookup("enum.statDisclosure.x");
    store.getSnapshot().t("paramsPanel.loading");
    await new Promise((r) => setTimeout(r, 30));
    expect(store.loadedFiles("en")).toEqual([]);
    expect(store.loadedFiles("ja")).toEqual([]);
  });
});
