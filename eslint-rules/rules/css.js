// Design system guard（CSS 部分）— 規範 docs/design-system/spec.md §9。語言 @eslint/css（css-tree AST）。
// 既有違規記在 eslint-suppressions.json（只能往下降）。註解不算違規（@eslint/css 把註解放在 AST 外）。
const SPEC = "docs/design-system/spec.md";

function rule(description, message, create) {
  return {
    meta: { type: "problem", languages: ["css/css"], docs: { description }, schema: [], messages: { banned: message } },
    create,
  };
}

/** 對 node 的原始文字跑 re，每個命中各報一次（位置精準到命中處）。 */
function reportMatches(context, node, re, text = context.sourceCode.getText(node)) {
  const { sourceCode } = context;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  const base = node.loc.start.offset;
  for (const m of text.matchAll(g)) {
    context.report({
      loc: { start: sourceCode.getLocFromIndex(base + m.index), end: sourceCode.getLocFromIndex(base + m.index + m[0].length) },
      messageId: "banned",
    });
  }
}

const WEB_FONT = /fonts\.googleapis|\bJetBrains Mono\b|["'`]Inter["'`]|\bInter\s*,|\bGeorgia\b|\bSongti\b/;

export const webFont = rule(
  "樣式表不載入 web font，也不引用未載入的字族名",
  `不載入 web font（@font-face、Google Fonts）、不用 Inter／JetBrains Mono／Georgia／宋體；中文用 var(--font-cjk)，數字、時間、座標用 var(--font-data)（${SPEC} §4.1）`,
  (context) => ({
    Atrule(node) {
      if (node.name.toLowerCase() === "font-face") {
        context.report({ loc: node.loc, messageId: "banned" });
      } else if (node.prelude) {
        reportMatches(context, node.prelude, WEB_FONT);
      }
    },
    Declaration(node) {
      reportMatches(context, node, WEB_FONT);
    },
  }),
);

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;

export const hexLiteral = rule(
  "UI 樣式表不寫 hex 色碼字面值",
  `UI 樣式表不要寫 hex 色碼，改用 src/styles/tokens.css 的 var(--...)；淡色用 --light-*；圖層資料色屬例外需在 PR 說明（${SPEC} §3）`,
  (context) => ({
    Declaration(node) {
      reportMatches(context, node.value, HEX);
    },
  }),
);

// CSS 的 escape 是 \25B6；舊 JS 寫法 ▶ 與 HTML entity 也一併擋。
const RIGHT = /▶|&#x25[bB]6;|&#9654;|\\u25[bB]6|\\0*25[bB]6/;
const DOWN = /▼|&#x25[bB][cC];|&#9660;|\\u25[bB][cC]|\\0*25[bB][cC]/;
const UP = /▲|\\u25[bB]2|\\0*25[bB]2/;

export const triangleChevron = rule(
  "樣式表的展開／收合不用 ▶ ▼ 三角字元",
  `展開／收合不要用 ▶ ▼ 三角字元，改用 lucide-react 的 <ChevronRight size={12} />，展開時 rotate(90deg)（${SPEC} §5.16）`,
  (context) => ({
    Declaration(node) {
      reportMatches(context, node.value, RIGHT);
      // 與 ▲ 同一個宣告的 ▼ 是升降趨勢符號（資料語意），不算 chevron。
      if (!UP.test(context.sourceCode.getText(node.value))) reportMatches(context, node.value, DOWN);
    },
  }),
);

export const uppercaseEyebrow = rule(
  "不用 text-transform: uppercase",
  `不要用 text-transform: uppercase；eyebrow 寫中文（例「交通 · 公車」），9px var(--text-dim)，不轉大寫（${SPEC} §6.1）`,
  (context) => ({
    Declaration(node) {
      if (node.property.toLowerCase() === "text-transform") reportMatches(context, node.value, /\buppercase\b/i);
    },
  }),
);

export const rawZIndex = rule(
  "樣式表不寫死 ≥10 的 z-index 數字",
  `不要寫死 ≥10 的 z-index，改用 var(--z-*)（定義在 src/styles/tokens.css，與 designTokens.ts 的 Z_INDEX 同值）；同層前後靠 DOM 順序。確屬特例要寫進 ${SPEC} §5.25 特例表`,
  (context) => ({
    Declaration(node) {
      // 含 --*-z-index 這類自訂屬性（舊 regex 也會命中）；元件內 <10 的小值只排兄弟順序，不算全站層級。
      if (!/(?:^|-)z-index$/i.test(node.property)) return;
      const m = /^\s*["']?(\d+)\b/.exec(context.sourceCode.getText(node.value));
      if (m && Number(m[1]) >= 10) context.report({ loc: node.value.loc, messageId: "banned" });
    },
  }),
);
