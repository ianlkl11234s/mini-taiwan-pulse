/**
 * Design system guard（ratchet）— 規範見 docs/design-system/spec.md §9。
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
  countFontDataOnCjk,
  formatIncrease,
  ratchetDown,
  scanFiles,
  type GuardCounts,
} from "./designSystemGuardRules";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const rule = (id: string) => RULES.find((r) => r.id === id)!;
const hits = (id: string, text: string, path = "src/components/Example.tsx") =>
  rule(id).appliesTo(path) ? rule(id).count(text, path) : 0;

describe("design system guard — 規則樣本", () => {
  it("web-font：web font 載入與未載入的字族名", () => {
    expect(hits("web-font", `@import url("https://fonts.googleapis.com/css2?family=Inter");`)).toBe(1);
    expect(hits("web-font", `@font-face { font-family: X; }`)).toBe(1);
    expect(hits("web-font", `fontFamily: '"JetBrains Mono", monospace'`)).toBe(1);
    expect(hits("web-font", `fontFamily: "Inter, system-ui, sans-serif"`)).toBe(1);
    expect(hits("web-font", `font-family: Georgia, serif;`)).toBe(1);
    expect(hits("web-font", `font-family: "Songti TC", serif;`)).toBe(1);
    expect(hits("web-font", `fontFamily: FONT_CJK`)).toBe(0);
    expect(hits("web-font", `const interval = 3; // Interval, not Inter`)).toBe(0);
    expect(hits("web-font", `/* 不再用 Inter, 改 --font-cjk */`)).toBe(0);
  });

  it("hex-literal-in-ui-css：只看 UI 樣式表，排除 src/styles", () => {
    const css = `.a { color: #fff; background: #10101b; border-color: #0b6fd6cc; }`;
    expect(hits("hex-literal-in-ui-css", css, "src/components/sidebar/x.css")).toBe(3);
    expect(hits("hex-literal-in-ui-css", css, "src/research/research.css")).toBe(3);
    expect(hits("hex-literal-in-ui-css", css, "src/research/deep/nested.css")).toBe(0);
    expect(hits("hex-literal-in-ui-css", css, "src/styles/tokens.css")).toBe(0);
    expect(hits("hex-literal-in-ui-css", `.a { color: var(--text-strong); } /* 原 #f3f4f6 */`, "src/components/x.css")).toBe(0);
    expect(hits("hex-literal-in-ui-css", `.a { background: url("data:image/svg+xml,%239ca3af"); }`, "src/components/x.css")).toBe(0);
  });

  it("native-range：共用滑桿元件以外不得出現", () => {
    expect(hits("native-range", `<input type="range" min={0} />`)).toBe(1);
    expect(hits("native-range", `<input type={"range"} />`)).toBe(1);
    expect(hits("native-range", `el.setAttribute("x", 1); const cfg = { type: "range" };`)).toBe(1);
    // 白名單只有共用滑桿本體；LayerParamControls 已改用 <Slider>（Phase Q），不再豁免
    expect(hits("native-range", `<input type="range" />`, "src/components/controls/Slider.tsx")).toBe(0);
    expect(hits("native-range", `<input type="range" />`, "src/components/sidebar/LayerParamControls.tsx")).toBe(1);
    expect(hits("native-range", `<input type="checkbox" />`)).toBe(0);
    expect(hits("native-range", `const t = { type: "rangeStart" }`)).toBe(0);
  });

  it("triangle-chevron：▶ ▼ 與其 escape", () => {
    expect(hits("triangle-chevron", `<span>▶</span>`)).toBe(1);
    expect(hits("triangle-chevron", `{open ? "▼" : "▶"}`)).toBe(2);
    expect(hits("triangle-chevron", `"&#x25B6;"`)).toBe(1);
    expect(hits("triangle-chevron", `const t = "\\u25B6";`)).toBe(1);
    expect(hits("triangle-chevron", `<ChevronRight size={12} />`)).toBe(0);
    expect(hits("triangle-chevron", `"↗"`)).toBe(0);
    expect(hits("triangle-chevron", `{up ? "▲" : "▼"} {delta}`)).toBe(0);
    expect(hits("triangle-chevron", `// 歷史模式按 ▶ 只前進一格`)).toBe(0);
  });

  it("english-control-label：只看 layerParamsSpec.ts 的 labelPrefix", () => {
    const spec = "src/data/layerParamsSpec.ts";
    expect(hits("english-control-label", `labelPrefix: "Opacity",`, spec)).toBe(1);
    expect(hits("english-control-label", `labelPrefix: "Bloom 高樓門檻 ≥",`, spec)).toBe(1);
    expect(hits("english-control-label", `labelPrefix: "透明度",`, spec)).toBe(0);
    expect(hits("english-control-label", `labelPrefix: "3D 高度 ×",`, spec)).toBe(0);
    expect(hits("english-control-label", `labelPrefix: "Opacity",`, "src/components/Other.tsx")).toBe(0);
  });

  it("uppercase-eyebrow：TS 與 CSS 寫法", () => {
    expect(hits("uppercase-eyebrow", `style={{ textTransform: "uppercase" }}`)).toBe(1);
    expect(hits("uppercase-eyebrow", `.x { text-transform: uppercase; }`, "src/components/x.css")).toBe(1);
    expect(hits("uppercase-eyebrow", `style={{ textTransform: "none" }}`)).toBe(0);
  });

  it("font-data-on-cjk：FONT_DATA 元素的直接文字含中文才算", () => {
    expect(countFontDataOnCjk(`<b style={{ fontFamily: FONT_DATA }}>RIPE 歷史量測</b>`)).toBe(1);
    expect(countFontDataOnCjk(`<div style={{ fontFamily: FONT_DATA, fontSize: 9 }}>資料不足</div>`)).toBe(1);
    // 正確寫法：中文在外、數字在 FONT_DATA span 內
    expect(countFontDataOnCjk(`更新 <span style={{ fontFamily: FONT_DATA }}>{clockTime(ts)}</span> 筆`)).toBe(0);
    expect(countFontDataOnCjk(`<span style={{ fontFamily: FONT_DATA }}>{count}</span>`)).toBe(0);
    expect(countFontDataOnCjk(`// 註解：FONT_DATA 只給數字>中文`)).toBe(0);
    expect(hits("font-data-on-cjk", `<b style={{ fontFamily: FONT_DATA }}>中文</b>`, "src/x.ts")).toBe(0);
  });

  it("raw-z-index：≥10 的寫死層級數字（TS 與 CSS），排除 src/styles 與元件內部小值", () => {
    expect(hits("raw-z-index", `style={{ zIndex: 30 }}`)).toBe(1);
    expect(hits("raw-z-index", `.x { z-index: 45; } .y{z-index:70}`, "src/components/x.css")).toBe(2);
    expect(hits("raw-z-index", `zIndex: 3000, padding: 4`)).toBe(1);
    expect(hits("raw-z-index", `zIndex: "20"`)).toBe(1);
    expect(hits("raw-z-index", `style={{ zIndex: 2 }}`)).toBe(0);
    expect(hits("raw-z-index", `zIndex: Z_INDEX.modal`)).toBe(0);
    expect(hits("raw-z-index", `.x { z-index: var(--z-modal); }`, "src/components/x.css")).toBe(0);
    expect(hits("raw-z-index", `zIndex: -1`)).toBe(0);
    expect(hits("raw-z-index", `// 以前是 zIndex: 200`)).toBe(0);
    expect(hits("raw-z-index", `--z-toast: 50; z-index: 50;`, "src/styles/tokens.css")).toBe(0);
  });

  it("web-font：涵蓋 Inter 字族寫法", () => {
    expect(hits("web-font", `fontFamily: "Inter, system-ui, sans-serif"`)).toBe(1);
    expect(hits("web-font", `font-family: Inter, sans-serif;`, "src/components/x.css")).toBe(1);
  });

  it("internal-id-display：datasetId 進 JSX 文字或 title／label 欄位（只記錄）", () => {
    expect(rule("internal-id-display").enforce).toBe(false);
    expect(hits("internal-id-display", `<dd>{props.datasetId}</dd>`)).toBe(1);
    expect(hits("internal-id-display", `({ title: e.title ?? e.datasetId, desc })`)).toBe(1);
    expect(hits("internal-id-display", `const label = describeDataset(datasetId).label;`)).toBe(0);
    expect(hits("internal-id-display", `({ datasetId: recipe.dataset_id, label: recipe.label })`)).toBe(0);
    expect(hits("internal-id-display", `{ label: labelFor(datasetId) }`)).toBe(0);
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
