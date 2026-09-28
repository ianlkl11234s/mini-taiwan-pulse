import { describe, expect, it } from "vitest";
import { chipText, contrastRatio, levelColor, LIGHT_INTEL, mixHex } from "../intelTheme";
import { ALERT_GROUPS_DEF, ALERT_SEVERITY, GIS_LEVELS, SEV_LEVELS } from "../intelTokens";
import { NEWS_CATEGORIES } from "../../../data/newsEventTypes";

/**
 * design-system.md §5.21：淡色主題下，chipTint／chipOutline 把資料 hue 當文字色時
 * 必須維持可讀對比。這裡驗證「§5.21 的 45% 原色／55% textStrong 混色規則」對本專案
 * 目前所有會流進 chipText() 的資料色，在淡色面板底上都能達到 WCAG 4.5:1。
 *
 * 兩種徽章疊字的底不同，分開量測（不再只用純白當保底近似）：
 * - chipOutline：透明底，字直接疊在面板底（LIGHT.surfacePanel ≈ 不透明白）→ 對純白量測即精確值。
 * - chipTint：字疊在「白 + 該色 14% alpha」的淡底上 → 對 `over(白, 該色, 0.14)` 量測才是真實值
 *   （比純白背景略深，對比會比純白版本略低，此處取真實底驗證，不用保守近似值宣稱過關）。
 */
const WHITE = "#ffffff";
const MIN_CONTRAST = 4.5;

const cluster = "#1ad9e5";

const colors: Record<string, string> = {
  cluster,
  ...Object.fromEntries(NEWS_CATEGORIES.map((c) => [`category:${c.key}`, c.color])),
  ...Object.fromEntries(
    (Object.keys(ALERT_GROUPS_DEF) as Array<keyof typeof ALERT_GROUPS_DEF>).map((k) => [
      `alertGroup:${k}`,
      ALERT_GROUPS_DEF[k].color,
    ]),
  ),
  ...Object.fromEntries(
    [1, 2, 3, 4].map((lv) => [`alertSeverity:${ALERT_SEVERITY[lv]!.key}`, ALERT_SEVERITY[lv]!.color]),
  ),
};

describe("intelTheme chipText 淡色對比（§5.21）", () => {
  it("chipOutline 底（對純白）：每個資料色混色後對比皆 ≥ 4.5:1", () => {
    const results = Object.entries(colors).map(([name, hex]) => {
      const mixed = chipText(hex, LIGHT_INTEL);
      return { name, hex, mixed, ratio: contrastRatio(mixed, WHITE) };
    });
    const failing = results.filter((r) => r.ratio < MIN_CONTRAST);
    if (failing.length > 0) {
      // 誠實列出做不到的顏色（design-system.md §5.21 要求），不要靜默放過。
      throw new Error(
        `以下資料色套用 chipText 後仍未達 ${MIN_CONTRAST}:1（對純白）—— ${failing
          .map((f) => `${f.name}(${f.hex}→${f.mixed}: ${f.ratio.toFixed(2)})`)
          .join("；")}`,
      );
    }
    const worst = results.reduce((min, r) => (r.ratio < min.ratio ? r : min));
    expect(worst.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("chipTint 底（對 over(白,色,0.14) 真實淡底）：每個資料色混色後對比皆 ≥ 4.5:1", () => {
    const results = Object.entries(colors).map(([name, hex]) => {
      const mixed = chipText(hex, LIGHT_INTEL);
      const tintedBg = mixHex(WHITE, hex, 0.14);
      return { name, hex, mixed, tintedBg, ratio: contrastRatio(mixed, tintedBg) };
    });
    const failing = results.filter((r) => r.ratio < MIN_CONTRAST);
    if (failing.length > 0) {
      throw new Error(
        `以下資料色在 chipTint 真實淡底下未達 ${MIN_CONTRAST}:1 —— ${failing
          .map((f) => `${f.name}(text ${f.mixed} on bg ${f.tintedBg}: ${f.ratio.toFixed(2)})`)
          .join("；")}`,
      );
    }
    const worst = results.reduce((min, r) => (r.ratio < min.ratio ? r : min));
    expect(worst.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("暗色主題 chipText 原樣回傳（不套混色，外觀不變）", () => {
    for (const hex of Object.values(colors)) {
      expect(chipText(hex, { ...LIGHT_INTEL, isDark: true })).toBe(hex);
    }
  });

  it("mixHex 邊界：t=0 回原色、t=1 回目標色", () => {
    expect(mixHex("#ef4444", "#111827", 0)).toBe("#ef4444");
    expect(mixHex("#ef4444", "#111827", 1)).toBe("#111827");
  });
});

describe("intelTheme levelColor（GIS_LEVELS／SEV_LEVELS 分級色轉換）", () => {
  it("白色半透明佔位轉中性文字階（淡色）", () => {
    expect(levelColor("rgba(255,255,255,0.22)", LIGHT_INTEL)).toBe(LIGHT_INTEL.textFaint);
    expect(levelColor("rgba(255,255,255,0.42)", LIGHT_INTEL)).toBe(LIGHT_INTEL.textMuted);
  });

  it("與 accent／statusWarn／statusErr 同值的分級色換成對應 palette 欄位（淡色）", () => {
    expect(levelColor(GIS_LEVELS[2]!.color, LIGHT_INTEL)).toBe(LIGHT_INTEL.accent);
    expect(levelColor(GIS_LEVELS[3]!.color, LIGHT_INTEL)).toBe(LIGHT_INTEL.statusWarn);
    expect(levelColor(SEV_LEVELS[3]!.color, LIGHT_INTEL)).toBe(LIGHT_INTEL.statusErr);
  });

  it("其餘資料 hue 走 chipText 混色（淡色），暗色原樣回傳", () => {
    expect(levelColor(SEV_LEVELS[1]!.color, LIGHT_INTEL)).toBe(chipText(SEV_LEVELS[1]!.color, LIGHT_INTEL));
    expect(levelColor(SEV_LEVELS[2]!.color, LIGHT_INTEL)).toBe(chipText(SEV_LEVELS[2]!.color, LIGHT_INTEL));
    const dark = { ...LIGHT_INTEL, isDark: true };
    expect(levelColor("rgba(255,255,255,0.22)", dark)).toBe("rgba(255,255,255,0.22)");
    expect(levelColor(SEV_LEVELS[1]!.color, dark)).toBe(SEV_LEVELS[1]!.color);
  });
});
