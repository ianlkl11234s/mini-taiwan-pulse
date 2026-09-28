import { describe, expect, it } from "vitest";
import { chipText, contrastRatio, LIGHT_INTEL, mixHex } from "../intelTheme";
import { ALERT_GROUPS_DEF, ALERT_SEVERITY } from "../intelTokens";
import { NEWS_CATEGORIES } from "../../../data/newsEventTypes";

/**
 * design-system.md §5.21：淡色主題下，chipTint／chipOutline 把資料 hue 當文字色時
 * 必須維持可讀對比。這裡驗證「§5.21 的 45% 原色／55% textStrong 混色規則」對本專案
 * 目前所有會流進 chipText() 的資料色，在淡色面板底（近白）上都能達到 WCAG 4.5:1。
 *
 * chipTint 的字實際疊在「白 + 該色 14% alpha」的淡底上（比純白更貼近該色一點點），
 * 純白是稍微保守（更難過）的測法；chipOutline 的字直接疊在面板底（LIGHT.surfacePanel
 * ≈ 不透明白），純白即精確測法。兩者都以純白為對照，結論同時對兩種徽章成立。
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
  it("每個資料色經 chipText 混色後，對純白對比皆 ≥ 4.5:1", () => {
    const results = Object.entries(colors).map(([name, hex]) => {
      const mixed = chipText(hex, LIGHT_INTEL);
      return { name, hex, mixed, ratio: contrastRatio(mixed, WHITE) };
    });
    const failing = results.filter((r) => r.ratio < MIN_CONTRAST);
    if (failing.length > 0) {
      // 誠實列出做不到的顏色（design-system.md §5.21 要求），不要靜默放過。
      throw new Error(
        `以下資料色套用 chipText 後仍未達 ${MIN_CONTRAST}:1 —— ${failing
          .map((f) => `${f.name}(${f.hex}→${f.mixed}: ${f.ratio.toFixed(2)})`)
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
