/**
 * 主題身分 (country, title) 的回歸測試（2026-10-29 英國第 0a 波）。
 *
 * 主題 title 只在同一國家內唯一：不同國家可以同名（例：日本「交通」與之後英國「交通」）。
 * 這裡用測試內的 fixture 模擬一個同名的英國主題（不真的加 GB 國家，那是第 0b 波），
 * 確認顯示名稱、大分類、面板切片、摺疊狀態鍵都各自解析；再釘住既有日本、法國、台灣主題照舊。
 */
import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_SCOPE,
  findTheme,
  scopeThemes,
  themeKey,
  themeMacroGroup,
  themeName,
  themeTitlesForScope,
  type ThemeDef,
  type ThemeScope,
} from "../layerCatalog";
import { localizeThemeTitle } from "../sectionText";
import { FRANCE_THEMES, JAPAN_THEMES, countryLayerThemes, resolveLayerPanel } from "../layerPanels";
import type { I18nContext } from "../../../i18n/layerText";

// fixture 國家：型別上還沒有 GB，用 cast 模擬（不動 constants/countries）
const GB = "GB" as ThemeScope;

const jpTransport: ThemeDef = { title: "交通", country: "JP", groups: [{ title: "鐵道", layers: [] }] };
const gbTransport: ThemeDef = { title: "交通", country: GB, groups: [{ title: "Rail", layers: [] }] };
// 英國第 4 波起真實表已有 GB「交通」；「未登記不可借用日本同名主題」改用 GB 沒有的「人口社經」驗
const gbPeople: ThemeDef = { title: "人口社經", country: GB, groups: [{ title: "Population", layers: [] }] };
const gbBaseMap: ThemeDef = { title: "底圖", country: GB, groups: [{ title: "行政邊界", layers: [] }] };
const jpBaseMap: ThemeDef = { title: "底圖", country: "JP", groups: [{ title: "行政邊界", layers: [] }] };
const fixtureThemes = [jpTransport, gbTransport, gbBaseMap, jpBaseMap];

const fixtureScope = { JP: ["底圖", "交通"], [GB]: ["底圖", "交通"] } as const;
const fixtureNames = {
  JP: { "交通": { zh: "交通", sub: "交通" }, "底圖": { zh: "底圖", sub: "ベースマップ" } },
  [GB]: { "交通": { zh: "交通", sub: "Transport" }, "底圖": { zh: "底圖", sub: "Base Map" } },
};
const fixtureMacro = {
  JP: { "交通": "city", "底圖": "baseline" },
  [GB]: { "交通": "city", "底圖": "baseline" },
} as const;

function i18nOf(active: I18nContext["active"]): I18nContext {
  return { active, lookup: () => undefined } as unknown as I18nContext;
}

describe("主題身分 (country, title)：不同國家同名主題各自解析", () => {
  it("themeKey 依國家區分同名主題", () => {
    expect(themeKey(jpTransport)).toBe("JP:交通");
    expect(themeKey(gbTransport)).toBe("GB:交通");
    expect(new Set(fixtureThemes.map(themeKey)).size).toBe(fixtureThemes.length);
  });

  it("顯示名稱與副標依國家查（日本日文副標、英國英文副標）", () => {
    expect(themeName(jpTransport, fixtureNames)).toEqual({ zh: "交通", sub: "交通" });
    expect(themeName(gbTransport, fixtureNames)).toEqual({ zh: "交通", sub: "Transport" });
    expect(themeName(gbBaseMap, fixtureNames).sub).toBe("Base Map");
    expect(themeName(jpBaseMap, fixtureNames).sub).toBe("ベースマップ");
  });

  it("大分類依國家查；未登記的國家主題直接丟錯（不會誤用他國同名主題的設定）", () => {
    expect(themeMacroGroup(gbTransport, fixtureMacro)).toBe("city");
    expect(themeMacroGroup(gbBaseMap, fixtureMacro)).toBe("baseline");
    // 真實表 GB 沒有「人口社經」：即使日本有同名主題也不能借用
    expect(() => themeMacroGroup(gbPeople)).toThrow(/GB:人口社經/);
    expect(themeMacroGroup(gbTransport)).toBe("city");
    expect(themeMacroGroup(jpTransport)).toBe("city");
  });

  it("各國主題切片只拿到自己國家的同名主題，並依大分類＋登記順序排", () => {
    const tables = { scope: fixtureScope, macroGroups: fixtureMacro };
    expect(scopeThemes(GB, fixtureThemes, tables)).toEqual([gbBaseMap, gbTransport]);
    expect(scopeThemes("JP", fixtureThemes, tables)).toEqual([jpBaseMap, jpTransport]);
    expect(themeTitlesForScope(GB, fixtureScope)).toEqual(["底圖", "交通"]);
  });

  it("findTheme 以 (country, title) 找到正確物件", () => {
    expect(findTheme(GB, "交通", fixtureThemes)).toBe(gbTransport);
    expect(findTheme("JP", "交通", fixtureThemes)).toBe(jpTransport);
    expect(findTheme("FR", "交通", fixtureThemes)).toBeUndefined();
  });

  it("zh-TW 主題列：同名主題顯示各自的副標", () => {
    // localizeThemeTitle 讀真實 THEME_NAMES：日本「交通」有日文副標、英國「交通」有英文副標；GB 未登記的主題退回整串中文、無副標
    expect(localizeThemeTitle(jpTransport, i18nOf("zh-TW"))).toEqual({ primary: "交通", sub: "交通" });
    expect(localizeThemeTitle(gbTransport, i18nOf("zh-TW"))).toEqual({ primary: "交通", sub: "Transport" });
    expect(localizeThemeTitle(gbPeople, i18nOf("zh-TW"))).toEqual({ primary: "人口社經", sub: undefined });
  });
});

describe("既有國家主題照舊解析（重構不改畫面）", () => {
  it("日本 15 個主題全屬 JP，順序依大分類（底圖在前）", () => {
    expect(JAPAN_THEMES).toHaveLength(15);
    expect(JAPAN_THEMES.every((theme) => theme.country === "JP")).toBe(true);
    expect(JAPAN_THEMES.map((theme) => theme.title).slice(0, 3)).toEqual(["底圖", "交通", "人口社經"]);
    expect(countryLayerThemes("JP")).toBe(JAPAN_THEMES);
    expect(themeName(findTheme("JP", "交通")!)).toEqual({ zh: "交通", sub: "交通" });
  });

  it("法國只有「通訊」，副標法文；台灣「通訊 Telecom」副標英文，兩者各自解析", () => {
    expect(FRANCE_THEMES.map(themeKey)).toEqual(["FR:通訊"]);
    expect(resolveLayerPanel("layers", "FR").themes).toBe(FRANCE_THEMES);
    expect(themeName({ country: "FR", title: "通訊" })).toEqual({ zh: "通訊", sub: "Télécommunications" });
    expect(themeName({ country: "TW", title: "通訊 Telecom" })).toEqual({ zh: "通訊", sub: "Telecommunications" });
    // 同字串在別國查不到 → 退回整串中文，不會串到別國的副標
    expect(themeName({ country: "TW", title: "通訊" })).toEqual({ zh: "通訊" });
  });

  it("台灣圖層入口全是 TW 主題、世界入口全是 WORLD 主題", () => {
    expect(resolveLayerPanel("layers", "TW").themes.every((theme) => theme.country === "TW")).toBe(true);
    expect(resolveLayerPanel("world", "TW").themes.every((theme) => theme.country === "WORLD")).toBe(true);
    expect(THEME_SCOPE.WORLD).toHaveLength(resolveLayerPanel("world", "TW").themes.length);
  });

  it("每個主題都有國家主體，且與 THEME_SCOPE 一致", () => {
    for (const theme of THEMES) expect(THEME_SCOPE[theme.country], themeKey(theme)).toContain(theme.title);
  });
});
