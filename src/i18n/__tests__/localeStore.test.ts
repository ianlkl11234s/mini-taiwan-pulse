import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_STORAGE_KEY, localeStore } from "../../state/localeStore";

function env(opts: { languages?: string[]; search?: string; saved?: string }) {
  vi.stubGlobal("navigator", { languages: opts.languages ?? [], language: opts.languages?.[0] });
  vi.stubGlobal("location", { search: opts.search ?? "" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k === LOCALE_STORAGE_KEY ? opts.saved ?? null : null),
    setItem: () => {},
  });
  localeStore.init();
  return localeStore.getSnapshot().locale;
}

afterEach(() => vi.unstubAllGlobals());

describe("localeStore 初始語系", () => {
  it("沒有任何訊號時為 zh-TW", () => {
    expect(env({})).toBe("zh-TW");
  });
  it("依瀏覽器語言：ja-JP → ja、en-GB → en", () => {
    expect(env({ languages: ["ja-JP"] })).toBe("ja");
    expect(env({ languages: ["en-GB"] })).toBe("en");
  });
  it("不支援的語言跳過，取下一個；全不支援則中文", () => {
    expect(env({ languages: ["fr", "ja"] })).toBe("ja");
    expect(env({ languages: ["fr"] })).toBe("zh-TW");
  });
  it("zh-* 一律中文", () => {
    expect(env({ languages: ["zh-CN"] })).toBe("zh-TW");
    expect(env({ languages: ["zh-CN", "en"] })).toBe("zh-TW");
  });
  it("網址 ?lang= 優先於瀏覽器與 localStorage", () => {
    expect(env({ languages: ["ja"], search: "?lang=en", saved: "ja" })).toBe("en");
  });
  it("localStorage 優先於瀏覽器", () => {
    expect(env({ languages: ["ja"], saved: "en" })).toBe("en");
    expect(env({ languages: ["en"], saved: "zh-TW" })).toBe("zh-TW");
  });
});

describe("localeStore", () => {
  it("載入 ja 時連同回退語系 en 一起載入，ja 缺字才能退到 en", async () => {
    await localeStore.ready("ja");
    localeStore.set("en");
    // en 已隨 ja 載入 → 切到 en 立即生效，不必再等 lazy import
    expect(localeStore.getSnapshot().active).toBe("en");
    expect(localeStore.getSnapshot().t("auth.signIn")).toBe("Sign in");
    localeStore.set("ja");
    expect(localeStore.getSnapshot().t("auth.signIn")).toBe("ログイン");
  });
});
