// 本地 ESLint 規則的 RuleTester 測試（樣本沿用原本 regex 守門測試）。
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vitest";
import plugin from "../index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});
const rule = (id) => plugin.rules[id];
const errs = (n) => Array.from({ length: n }, () => ({ messageId: "banned" }));
const ok = (...codes) => codes.map((code) => ({ code, filename: "x.tsx" }));
const bad = (pairs) => pairs.map(([code, n]) => ({ code, filename: "x.tsx", errors: errs(n) }));

tester.run("design-web-font", rule("design-web-font"), {
  valid: ok(
    "const s = { fontFamily: FONT_CJK };",
    "const interval = 3; // Interval, not Inter",
    "/* 不再用 Inter, 改 --font-cjk */ const a = 1;",
    'const internal = "Interval";',
  ),
  invalid: bad([
    ['const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");`;', 1],
    ['const css = "@font-face { font-family: X; }";', 1],
    [`const s = { fontFamily: '"JetBrains Mono", monospace' };`, 1],
    ['const s = { fontFamily: "Inter, system-ui, sans-serif" };', 1],
    ['const s = { fontFamily: "Inter" };', 1],
    ["const s = { fontFamily: `Inter` };", 1],
    ['const s = "font-family: Georgia, serif;";', 1],
    ['const s = "font-family: \\"Songti TC\\", serif;";', 1],
  ]),
});

tester.run("design-native-range", rule("design-native-range"), {
  valid: ok('<input type="checkbox" />', 'const t = { type: "rangeStart" };'),
  invalid: bad([
    ['<input type="range" min={0} />', 1],
    ['<input type={"range"} />', 1],
    ['el.setAttribute("x", 1); const cfg = { type: "range" };', 1],
  ]),
});

tester.run("design-triangle-chevron", rule("design-triangle-chevron"), {
  valid: ok("<ChevronRight size={12} />", 'const a = "↗";', '<b>{up ? "▲" : "▼"} {delta}</b>', "// 歷史模式按 ▶ 只前進一格\nconst a = 1;"),
  invalid: bad([
    ["<span>▶</span>", 1],
    ['const a = open ? "▼" : "▶";', 2],
    ['<i>&#x25B6;</i>', 1],
    ['const t = "\\u25B6";', 1],
  ]),
});

tester.run("design-english-control-label", rule("design-english-control-label"), {
  valid: ok('const c = { labelPrefix: "透明度" };', 'const c = { labelPrefix: "3D 高度 ×" };'),
  invalid: bad([
    ['const c = { labelPrefix: "Opacity" };', 1],
    ['const c = { labelPrefix: "Bloom 高樓門檻 ≥" };', 1],
  ]),
});

tester.run("design-uppercase-eyebrow", rule("design-uppercase-eyebrow"), {
  valid: ok('<b style={{ textTransform: "none" }} />'),
  invalid: bad([
    ['<b style={{ textTransform: "uppercase" }} />', 1],
    ["const css = `.x { text-transform: uppercase; }`;", 1],
  ]),
});

tester.run("design-font-data-on-cjk", rule("design-font-data-on-cjk"), {
  valid: ok(
    "<p>更新 <span style={{ fontFamily: FONT_DATA }}>{clockTime(ts)}</span> 筆</p>",
    "<span style={{ fontFamily: FONT_DATA }}>{count}</span>",
    "// 註解：FONT_DATA 只給數字>中文\nconst a = 1;",
    "<b style={{ fontFamily: FONT_DATA }}><i>中文在子元素</i></b>",
  ),
  invalid: bad([
    ["<b style={{ fontFamily: FONT_DATA }}>RIPE 歷史量測</b>", 1],
    ["<div style={{ fontFamily: FONT_DATA, fontSize: 9 }}>資料不足</div>", 1],
    // 原 regex 只看同一行；跨行也要抓
    ['<button\n  style={{\n    fontFamily: FONT_DATA,\n  }}\n>\n  地名：{visible ? "開" : "關"}\n</button>', 1],
  ]),
});

tester.run("design-raw-z-index", rule("design-raw-z-index"), {
  valid: ok(
    "<b style={{ zIndex: 2 }} />",
    "const s = { zIndex: Z_INDEX.modal };",
    "const css = `.x { z-index: var(--z-modal); }`;",
    "const s = { zIndex: -1 };",
    "// 以前是 zIndex: 200\nconst a = 1;",
  ),
  invalid: bad([
    ["<b style={{ zIndex: 30 }} />", 1],
    ["const css = `.x { z-index: 45; } .y{z-index:70}`;", 2],
    ["const s = { zIndex: 3000, padding: 4 };", 1],
    ['const s = { zIndex: "20" };', 1],
  ]),
});

tester.run("design-internal-id-display", rule("design-internal-id-display"), {
  valid: ok(
    "const label = describeDataset(datasetId).label;",
    "const r = { datasetId: recipe.dataset_id, label: recipe.label };",
    "const r = { label: labelFor(datasetId) };",
  ),
  invalid: bad([
    ["<dd>{props.datasetId}</dd>", 1],
    ["const r = ({ title: e.title ?? e.datasetId, desc });", 1],
  ]),
});

const MISSING = [{ messageId: "missing" }];
tester.run("map-ready-tick-deps", rule("map-ready-tick-deps"), {
  valid: [
    "useEffect(() => { build(); }, [visible, mapRef, mapTick]);",
    "useEffect(() => { build(); }, [visible, mapRef.current, mapRetry]);",
    "useEffect(() => { build(); }, [visible]);",
    "const cb = useCallback(() => { mapRef.current?.getLayer(id); }, [ensureLayers, mapRef]);",
  ],
  invalid: [
    { code: "useEffect(() => { build(); }, [visible, mapRef]);", errors: MISSING },
    { code: "useMemo(() => build(), [\n  visible,\n  mapRef,\n]);", errors: MISSING },
    { code: "useLayoutEffect(function () { build(); }, [mapRef.current]);", errors: MISSING },
  ],
});

tester.run("no-zoom-circle-radius", rule("no-zoom-circle-radius"), {
  valid: [
    'const p = { "circle-radius": pointRadius("M") };',
    'map.setPaintProperty(id, "circle-radius", pointRadius("S"));',
    'const p = { "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 8, 1] };',
  ],
  invalid: [
    { code: 'const p = { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 6] };', errors: errs(1) },
    { code: 'map.setPaintProperty(id, "circle-radius", ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 6]);', errors: errs(1) },
  ],
});

tester.run("no-hand-rolled-stroke-opacity", rule("no-hand-rolled-stroke-opacity"), {
  valid: ["const o = pointStrokePaint(isDark, f);", "const o = Math.min(1, opacity * 2);"],
  invalid: [
    { code: "const o = Math.min(1, POINT_STROKE.opacity * f);", errors: errs(1) },
    { code: "const o = Math.min(1,POINT_STROKE.opacity);", errors: errs(1) },
  ],
});

tester.run("no-legacy-radius-helper", rule("no-legacy-radius-helper"), {
  valid: ['const r = pointRadius("M");', "const scaledRadiusX = 1;"],
  invalid: [
    { code: 'import { scaledRadius } from "./x";', errors: errs(2) }, // imported + local
    { code: "const p = { r: CIRCLE_RADIUS };", errors: errs(1) },
  ],
});

tester.run("no-fill-outline-color", rule("no-fill-outline-color"), {
  valid: ['const p = { "fill-color": "#fff" };', "// 不用 fill-outline-color\nconst a = 1;"],
  invalid: [{ code: 'const p = { "fill-outline-color": "#fff" };', errors: errs(1) }],
});

tester.run("monitor-no-manual-polling", rule("monitor-no-manual-polling"), {
  valid: ok("const r = useMonitorResource({ queryKey: 'x' });", "// 原本 setInterval(70ms)\nconst a = 1;", "const cancelled = false;"),
  invalid: bad([
    ["setInterval(tick, 1000);", 1],
    ["const id = window.setInterval(tick, 1000);", 1],
    ["useEffect(() => { let cancelled = false; return () => { cancelled = true; }; }, []);", 1],
  ]),
});

tester.run("legend-no-letter-spacing", rule("legend-no-letter-spacing"), {
  valid: ok("<b style={{ letterSpacing: 0.5 }} />", "<b style={{ letterSpacing: 10 }} />"),
  invalid: bad([
    ["<b style={{ letterSpacing: 1 }} />", 1],
    ["<b style={{ letterSpacing: 1.5 }} />", 1],
  ]),
});

tester.run("legend-no-hand-sized-swatch", rule("legend-no-hand-sized-swatch"), {
  valid: ok("<SwatchDot color={c} />", "<b style={{ width: 10, background: c, height: 10 }} />", "<b style={{ width: w, height: 10 }} />"),
  invalid: bad([
    ["<b style={{ width: 10, height: 10, background: c }} />", 1],
    ["<b style={{\n  width: 24, height: 8,\n}} />", 1],
  ]),
});

tester.run("no-current-time-deps", rule("no-current-time-deps"), {
  valid: ["useEffect(() => { timeStore.subscribeDate(f); }, [f]);", "const t = state.currentTime;"],
  invalid: [
    { code: "useEffect(() => { load(currentTime); }, [currentTime]);", errors: errs(1) },
    { code: "useEffect(() => {}, [visible, props.currentTime]);", errors: errs(1) },
  ],
});
