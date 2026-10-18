/**
 * Design system guard（ratchet）— CSS 部分。規範見 docs/design-system/spec.md §9。
 * TS／TSX 的規則改由 ESLint 檢查（npm run lint；eslint-rules/rules/design.js＋eslint-suppressions.json）。
 *
 * 失敗代表：某檔案某條規則的違規數比基準多，或新檔案出現違規。修程式碼，不要改基準。
 * 違規數變少時只提示，可執行 `npm run design:baseline` 把基準降下來。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTROL, COLORS, LIGHT, SLIDER } from "../designTokens";
import {
  BASELINE_RELATIVE_PATH,
  RULES,
  compareCounts,
  formatIncrease,
  ratchetDown,
  scanFiles,
  type GuardCounts,
} from "./designSystemGuardRules";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const rule = (id: string) => RULES.find((r) => r.id === id)!;
const hits = (id: string, text: string, path: string) =>
  rule(id).appliesTo(path) ? rule(id).count(text, path) : 0;

describe("design system guard（CSS）— 規則樣本", () => {
  const css = (id: string, text: string, path = "src/components/x.css") => hits(id, text, path);

  it("只掃樣式表：TS／TSX 的同名規則在 ESLint（eslint-rules/rules/design.js）", () => {
    expect(hits("web-font", `fontFamily: "Inter"`, "src/components/Example.tsx")).toBe(0);
    expect(hits("raw-z-index", `style={{ zIndex: 30 }}`, "src/components/Example.tsx")).toBe(0);
  });

  it("web-font：web font 載入與未載入的字族名", () => {
    expect(css("web-font", `@import url("https://fonts.googleapis.com/css2?family=Inter");`)).toBe(1);
    expect(css("web-font", `@font-face { font-family: X; }`)).toBe(1);
    expect(css("web-font", `font-family: Georgia, serif;`)).toBe(1);
    expect(css("web-font", `font-family: "Songti TC", serif;`)).toBe(1);
    expect(css("web-font", `font-family: JetBrains Mono, monospace;`)).toBe(1);
    expect(css("web-font", `font-family: Inter, sans-serif;`)).toBe(1);
    expect(css("web-font", `/* 不再用 Inter, 改 --font-cjk */`)).toBe(0);
    expect(css("web-font", `font-family: var(--font-cjk);`)).toBe(0);
  });

  it("hex-literal-in-ui-css：只看 UI 樣式表，排除 src/styles", () => {
    const sheet = `.a { color: #fff; background: #10101b; border-color: #0b6fd6cc; }`;
    expect(css("hex-literal-in-ui-css", sheet, "src/components/sidebar/x.css")).toBe(3);
    expect(css("hex-literal-in-ui-css", sheet, "src/research/research.css")).toBe(3);
    expect(css("hex-literal-in-ui-css", sheet, "src/research/deep/nested.css")).toBe(0);
    expect(css("hex-literal-in-ui-css", sheet, "src/styles/tokens.css")).toBe(0);
    expect(css("hex-literal-in-ui-css", `.a { color: var(--text-strong); } /* 原 #f3f4f6 */`)).toBe(0);
    expect(css("hex-literal-in-ui-css", `.a { background: url("data:image/svg+xml,%239ca3af"); }`)).toBe(0);
  });

  it("triangle-chevron：CSS content 的 ▶ ▼ 與其 escape", () => {
    expect(css("triangle-chevron", `.x::before { content: "▶"; }`)).toBe(1);
    expect(css("triangle-chevron", `.x::before { content: "\\u25B6"; }`)).toBe(1);
    expect(css("triangle-chevron", `/* ▶ 註解不算 */`)).toBe(0);
  });

  it("uppercase-eyebrow：text-transform: uppercase", () => {
    expect(css("uppercase-eyebrow", `.x { text-transform: uppercase; }`)).toBe(1);
    expect(css("uppercase-eyebrow", `.x { text-transform: none; }`)).toBe(0);
  });

  it("raw-z-index：≥10 的寫死層級數字，排除 src/styles", () => {
    expect(css("raw-z-index", `.x { z-index: 45; } .y{z-index:70}`)).toBe(2);
    expect(css("raw-z-index", `.x { z-index: 2; }`)).toBe(0);
    expect(css("raw-z-index", `.x { z-index: var(--z-modal); }`)).toBe(0);
    expect(css("raw-z-index", `--z-toast: 50; z-index: 50;`, "src/styles/tokens.css")).toBe(0);
  });
});

describe("design system guard — ratchet 比對", () => {
  it("增加與新檔案算 increase，減少算 decrease；ratchetDown 只往下", () => {
    const base: GuardCounts = { "web-font": { "a.tsx": 2, "b.tsx": 1 } };
    const cur: GuardCounts = { "web-font": { "a.tsx": 3, "c.tsx": 1 } };
    const { increases, decreases } = compareCounts(cur, base);
    expect(increases.map((d) => `${d.file}:${d.baseline}->${d.current}`).sort()).toEqual(["a.tsx:2->3", "c.tsx:0->1"]);
    expect(decreases.map((d) => `${d.file}:${d.baseline}->${d.current}`)).toEqual(["b.tsx:1->0"]);
    expect(ratchetDown(cur, base)["web-font"]).toEqual({ "a.tsx": 2 });
    expect(formatIncrease(increases[0]!)).toContain("docs/design-system/spec.md §4.1");
  });
});

describe("design system guard — 全站掃描", () => {
  const baseline = JSON.parse(readFileSync(join(root, BASELINE_RELATIVE_PATH), "utf8")) as GuardCounts;
  const current = scanFiles(root);

  it("基準涵蓋每一條規則", () => {
    expect(Object.keys(baseline).sort()).toEqual(RULES.map((r) => r.id).sort());
  });

  it("沒有任何檔案的違規數超過基準（修程式碼，不要改基準）", () => {
    const { increases, decreases } = compareCounts(current, baseline);
    const enforced = increases.filter((d) => rule(d.rule).enforce);
    const recorded = increases.filter((d) => !rule(d.rule).enforce);
    if (recorded.length > 0) {
      console.warn(`[design guard] 只記錄不擋的規則有新增：\n${recorded.map(formatIncrease).join("\n")}`);
    }
    if (decreases.length > 0) {
      console.info(
        `[design guard] ${decreases.length} 處違規減少了，可執行 npm run design:baseline 降低基準：\n` +
          decreases.map((d) => `  ↓ [${d.rule}] ${d.file}：${d.baseline} → ${d.current}`).join("\n"),
      );
    }
    expect(enforced.map(formatIncrease).join("\n\n")).toBe("");
  });
});

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
