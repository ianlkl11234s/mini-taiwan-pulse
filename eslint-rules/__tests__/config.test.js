// eslint.config.js 的套用範圍（files／ignores）：RuleTester 測不到這層，這裡用真正的 config 釘住。
// 樣本檔盡量挑 eslint-suppressions.json 沒登記的檔（layerParamsSpec.ts 是 english-control-label 唯一範圍，例外）；
// lintText 目前不套用 suppressions。
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd, allowInlineConfig: false });

async function rulesAt(filePath, code) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe("eslint.config.js 套用範圍", () => {
  it.each([
    ["src/components/Example.tsx", '<input type="range" />', "pulse/design-native-range", true],
    ["src/components/controls/Slider.tsx", '<input type="range" />', "pulse/design-native-range", false],
    ["src/components/sidebar/LayerParamControls.tsx", '<input type="range" />', "pulse/design-native-range", true],
    ["src/components/Example.tsx", "<b style={{ zIndex: 30 }} />", "pulse/design-raw-z-index", true],
    ["src/styles/designTokens.ts", "const Z = { zIndex: 30 };", "pulse/design-raw-z-index", false],
    ["src/data/layerParamsSpec.ts", 'const c = { labelPrefix: "Opacity" };', "pulse/design-english-control-label", true],
    ["src/components/Other.tsx", 'const c = { labelPrefix: "Opacity" };', "pulse/design-english-control-label", false],
    ["src/x.ts", "const a = { fontFamily: FONT_DATA };", "pulse/design-font-data-on-cjk", false],
    ["src/hooks/useFooLayer.ts", "useEffect(() => {}, [mapRef]);", "pulse/map-ready-tick-deps", true],
    ["src/hooks/factories/timelineSliceLayer.ts", "useEffect(() => {}, [mapRef]);", "pulse/map-ready-tick-deps", true],
    ["src/hooks/useMapReadyTick.ts", "useEffect(() => {}, [mapRef]);", "pulse/map-ready-tick-deps", false],
    ["src/hooks/useFooLayer.ts", 'const p = { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2] };', "pulse/no-zoom-circle-radius", true],
    ["src/map/overlayRegistry.ts", 'const p = { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2] };', "pulse/no-zoom-circle-radius", false],
    ["src/map/pointSpec.ts", "const o = Math.min(1, POINT_STROKE.opacity * f);", "pulse/no-hand-rolled-stroke-opacity", false],
    ["src/hooks/useFooLayer.ts", "const o = Math.min(1, POINT_STROKE.opacity * f);", "pulse/no-hand-rolled-stroke-opacity", true],
    ["src/hooks/useFooLayer.ts", "const r = scaledRadius(3);", "pulse/no-legacy-radius-helper", true],
    ["src/hooks/useFloodSensorLayer.ts", "const r = scaledRadius(3);", "pulse/no-legacy-radius-helper", false],
    ["src/hooks/useFooLayer.ts", 'const p = { "fill-outline-color": "#fff" };', "pulse/no-fill-outline-color", true],
    ["src/components/intel/monitor/ERCard.tsx", "setInterval(tick, 1000);", "pulse/monitor-no-manual-polling", true],
    ["src/components/intel/IntelPanel.tsx", "setInterval(tick, 1000);", "pulse/monitor-no-manual-polling", false],
    ["src/components/LegendPanel.tsx", "<b style={{ letterSpacing: 1 }} />", "pulse/legend-no-letter-spacing", true],
    ["src/components/legend/waterLegends.tsx", "<b style={{ width: 8, height: 8 }} />", "pulse/legend-no-hand-sized-swatch", true],
    ["src/components/legend/legendKit.tsx", "<b style={{ width: 8, height: 8 }} />", "pulse/legend-no-hand-sized-swatch", false],
    ["src/lib/dayPrefetch.ts", "useEffect(() => {}, [currentTime]);", "pulse/no-current-time-deps", true],
    ["src/hooks/useCwaImageryLayer.ts", 'import { subscribePrefetchWindow } from "../lib/dayPrefetch";', "no-restricted-imports", true],
    ["src/hooks/useHazardLayer.ts", 'import { subscribePrefetchWindow } from "../lib/dayPrefetch";', "no-restricted-imports", false],
    ["src/components/sidebar/x.css", ".a { color: #fff; }", "pulse/design-css-hex-literal", true],
    ["src/research/x.css", ".a { color: #fff; }", "pulse/design-css-hex-literal", true],
    ["src/research/jev-layer-screening/x.css", ".a { color: #fff; }", "pulse/design-css-hex-literal", false],
    ["src/styles/tokens.css", ".a { color: #fff; }", "pulse/design-css-hex-literal", false],
    ["src/card/card.css", ".a { color: #fff; }", "pulse/design-css-hex-literal", false],
    ["src/card/card.css", ".a { z-index: 45; }", "pulse/design-css-raw-z-index", true],
    ["src/styles/tokens.css", ".a { z-index: 45; }", "pulse/design-css-raw-z-index", false],
    ["src/styles/tokens.css", ".a { text-transform: uppercase; }", "pulse/design-css-uppercase-eyebrow", true],
    ["src/map/x.css", "@font-face { font-family: X; }", "pulse/design-css-web-font", true],
    ["src/map/x.css", '.x::before { content: "▶"; }', "pulse/design-css-triangle-chevron", true],
  ])("%s：%s → %s %s", async (filePath, code, ruleId, expected) => {
    expect((await rulesAt(filePath, code)).includes(ruleId)).toBe(expected);
  });

  it("測試檔與 fixture 不掃", async () => {
    expect(await eslint.isPathIgnored("src/components/__tests__/x.test.tsx")).toBe(true);
    expect(await eslint.isPathIgnored("src/components/Example.test.tsx")).toBe(true);
    expect(await eslint.isPathIgnored("src/data/fixtures/sample.ts")).toBe(true);
    expect(await eslint.isPathIgnored("src/components/Example.tsx")).toBe(false);
  });

  it("沒有開 recommended 之類的規則集：只啟用 pulse/* 與指定的內建規則", async () => {
    const config = await eslint.calculateConfigForFile("src/hooks/useCwaImageryLayer.ts");
    const enabled = Object.entries(config.rules ?? {})
      .filter(([, v]) => (Array.isArray(v) ? v[0] : v) !== 0 && (Array.isArray(v) ? v[0] : v) !== "off")
      .map(([k]) => k);
    expect(enabled.filter((k) => !k.startsWith("pulse/"))).toEqual(["no-restricted-imports"]);
    const cssConfig = await eslint.calculateConfigForFile("src/components/sidebar/layerRow.css");
    const cssEnabled = Object.entries(cssConfig.rules ?? {}).filter(([, v]) => ![0, "off"].includes(Array.isArray(v) ? v[0] : v));
    expect(cssEnabled.map(([k]) => k).filter((k) => !k.startsWith("pulse/"))).toEqual([]);
  });

  it("CSS 測試檔與 fixture 不掃", async () => {
    expect(await eslint.isPathIgnored("src/styles/__tests__/x.css")).toBe(true);
    expect(await eslint.isPathIgnored("src/styles/tokens.css")).toBe(false);
  });
});
