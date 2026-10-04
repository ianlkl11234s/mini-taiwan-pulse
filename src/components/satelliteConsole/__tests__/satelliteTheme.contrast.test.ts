import { describe, expect, it } from "vitest";
import { contrastRatio, DARK_INTEL, LIGHT_INTEL } from "../../intel/intelTheme";
import { SATELLITE_COLORS } from "../../../data/satelliteTypes";
import { satelliteThemeFor } from "../satelliteTheme";
import { severityColor } from "../maneuverAlertKit";

/**
 * 衛星情報 P5（SC2）：淡色面板上 16 個衛星資料色
 * - 線／icon／圓點／色條（fill）對白 ≥ 3:1（保色相、只加深，同監看 D2 lightDataFill）
 * - 計數字、「覆蓋中」等字（text＝chipText）對白 ≥ 4.5:1（§5.21）
 * 面板底 LIGHT.surfacePanel＝白 95% 疊在底圖上，近似不透明白，對純白量測。
 * 暗色一律原色（byte-identical）。
 */
const WHITE = "#ffffff";
const entries = Object.entries(SATELLITE_COLORS);
const light = satelliteThemeFor(LIGHT_INTEL);
const dark = satelliteThemeFor(DARK_INTEL);

function assertAll(kind: string, min: number, pick: (hex: string) => string) {
  const results = entries.map(([name, hex]) => {
    const out = pick(hex);
    return { name, hex, out, ratio: contrastRatio(out, WHITE) };
  });
  const failing = results.filter((r) => r.ratio < min);
  if (failing.length > 0) {
    throw new Error(
      `以下衛星色淡色${kind}未達 ${min}:1 —— ${failing
        .map((f) => `${f.name}(${f.hex}→${f.out}: ${f.ratio.toFixed(2)})`)
        .join("；")}`,
    );
  }
  expect(results).toHaveLength(16);
}

describe("satelliteTheme 淡色對比（P5 SC2）", () => {
  it("fill：16 色對白皆 ≥ 3:1", () => assertAll("線／點", 3, light.fill));
  it("text：16 色對白皆 ≥ 4.5:1", () => assertAll("字", 4.5, light.text));

  it("暗色 fill／text 原樣回傳", () => {
    for (const [, hex] of entries) {
      expect(dark.fill(hex)).toBe(hex);
      expect(dark.text(hex)).toBe(hex);
    }
  });

  it("fill 保色相：原本已 ≥ 3:1 的色不變", () => {
    for (const [, hex] of entries) {
      if (contrastRatio(hex, WHITE) >= 3) expect(light.fill(hex)).toBe(hex);
    }
  });
});

describe("severityColor（P5 SV1）", () => {
  it("暗色與 P4 值相同", () => {
    expect(severityColor("red", DARK_INTEL)).toBe(DARK_INTEL.statusErr);
    expect(severityColor("orange", DARK_INTEL)).toBe(DARK_INTEL.statusWarn);
    expect(severityColor("grey", DARK_INTEL)).toBe(DARK_INTEL.textMuted);
  });
  it("淡色取 LIGHT_INTEL 狀態色，對白 ≥ 4.5:1", () => {
    expect(severityColor("red", LIGHT_INTEL)).toBe(LIGHT_INTEL.statusErr);
    expect(severityColor("orange", LIGHT_INTEL)).toBe(LIGHT_INTEL.statusWarn);
    for (const s of ["red", "orange", "grey", "unknown"] as const) {
      expect(contrastRatio(severityColor(s, LIGHT_INTEL), WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
