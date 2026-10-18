/**
 * Design tokens — TS（designTokens.ts）與 CSS（tokens.css）同值。規範見 docs/design-system/spec.md §3／§9。
 * 「禁用寫法」類的 design system guard 全部在 ESLint（npm run lint：TS／TSX 為 pulse/design-*，
 * CSS 為 pulse/design-css-*；既有違規記在 eslint-suppressions.json）。本檔只留這種行為性一致檢查。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTROL, COLORS, LIGHT, SLIDER } from "../designTokens";

const root = fileURLToPath(new URL("../../..", import.meta.url));

describe("design tokens — TS 與 CSS 同值", () => {
  const css = readFileSync(join(root, "src/styles/tokens.css"), "utf8");
  const cssVars = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) cssVars.set(m[1]!, m[2]!.trim());
  const norm = (v: string | number) => String(v).replace(/\s+/g, "").toLowerCase();
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  it("LIGHT ↔ --light-*（每個 key 都要有同值 CSS 變數）", () => {
    for (const [key, value] of Object.entries(LIGHT)) {
      expect(norm(cssVars.get(`--light-${kebab(key)}`) ?? "(missing)"), `LIGHT.${key}`).toBe(norm(value));
    }
  });

  it("SLIDER ↔ --slider-*、CONTROL ↔ --control-*、COLORS.link／statusDerived", () => {
    for (const [key, value] of Object.entries(SLIDER)) expect(norm(cssVars.get(`--slider-${key}`) ?? ""), `SLIDER.${key}`).toBe(norm(value));
    for (const [key, value] of Object.entries(CONTROL)) expect(norm(cssVars.get(`--control-${kebab(key)}`) ?? ""), `CONTROL.${key}`).toBe(norm(value));
    expect(norm(cssVars.get("--link") ?? "")).toBe(norm(COLORS.link));
    expect(norm(cssVars.get("--status-derived") ?? "")).toBe(norm(COLORS.statusDerived));
    expect(norm(cssVars.get("--accent") ?? "")).toBe(norm(COLORS.accent));
  });
});
