// CSS 規則（@eslint/css）的 RuleTester 測試；樣本沿用原 designSystemGuard.test.ts 的 CSS 樣本。
import css from "@eslint/css";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import plugin from "../index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ plugins: { css }, language: "css/css" });
const rule = (id) => plugin.rules[id];
const ok = (...codes) => codes.map((code) => ({ code, filename: "x.css" }));
const bad = (pairs) =>
  pairs.map(([code, n]) => ({ code, filename: "x.css", errors: Array.from({ length: n }, () => ({ messageId: "banned" })) }));

tester.run("design-css-web-font", rule("design-css-web-font"), {
  valid: ok("/* 不再用 Inter, 改 --font-cjk */ .a { color: red; }", ".a { font-family: var(--font-cjk); }", ".a { --interval: 3; }"),
  invalid: bad([
    ['@import url("https://fonts.googleapis.com/css2?family=Inter");', 1],
    ["@font-face { font-family: X; src: local(X); }", 1],
    [".a { font-family: Georgia, serif; }", 1],
    ['.a { font-family: "Songti TC", serif; }', 1],
    [".a { font-family: JetBrains Mono, monospace; }", 1],
    [".a { font-family: Inter, sans-serif; }", 1],
    ['.a { --font-x: "Inter"; }', 1],
  ]),
});

tester.run("design-css-hex-literal", rule("design-css-hex-literal"), {
  valid: ok(
    ".a { color: var(--text-strong); } /* 原 #f3f4f6 */",
    '.a { background: url("data:image/svg+xml,%239ca3af"); }',
    "#abc { color: var(--text); }",
  ),
  invalid: bad([
    [".a { color: #fff; background: #10101b; border-color: #0b6fd6cc; }", 3],
    [".a { --c: #123456; }", 1],
    [".a { box-shadow: 0 0 0 1px #abcd; }", 1],
  ]),
});

tester.run("design-css-triangle-chevron", rule("design-css-triangle-chevron"), {
  valid: ok("/* ▶ 註解不算 */ .x { color: red; }", '.x::before { content: "▲ ▼"; }', '.x::before { content: "↗"; }'),
  invalid: bad([
    ['.x::before { content: "▶"; }', 1],
    ['.x::before { content: "\\25B6"; }', 1],
    ['.x::before { content: "\\u25B6"; }', 1],
    ['.x::after { content: "▼"; }', 1],
  ]),
});

tester.run("design-css-uppercase-eyebrow", rule("design-css-uppercase-eyebrow"), {
  valid: ok(".x { text-transform: none; }", "/* text-transform: uppercase */ .x { color: red; }"),
  invalid: bad([
    [".x { text-transform: uppercase; }", 1],
    [".x { TEXT-TRANSFORM: UPPERCASE; }", 1],
  ]),
});

tester.run("design-css-raw-z-index", rule("design-css-raw-z-index"), {
  valid: ok(".x { z-index: 2; }", ".x { z-index: var(--z-modal); }", "/* z-index: 45 */ .x { color: red; }"),
  invalid: bad([
    [".x { z-index: 45; } .y{z-index:70}", 2],
    [".x { --panel-z-index: 30; }", 1],
  ]),
});
