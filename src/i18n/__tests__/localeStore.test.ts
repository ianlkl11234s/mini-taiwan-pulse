import { describe, expect, it } from "vitest";
import { localeStore } from "../../state/localeStore";

describe("localeStore", () => {
  it("預設為 zh-TW（不看瀏覽器語言）", () => {
    localeStore.init();
    expect(localeStore.getSnapshot().active).toBe("zh-TW");
  });

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
