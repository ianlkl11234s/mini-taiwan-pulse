// Design system guard（TS／TSX 部分）— 規範 docs/design-system/spec.md §9。
// 既有違規記在 eslint-suppressions.json（只能往下降）；CSS 部分在 rules/css.js。
import { countMatches, onWrittenText, propName, someNode, walk } from "../utils.js";

const SPEC = "docs/design-system/spec.md";
const CJK = /[㐀-䶿一-鿿豈-﫿　-〿＀-￯]/;

function rule(description, message, create) {
  return { meta: { type: "problem", docs: { description }, schema: [], messages: { banned: message } }, create };
}

const report = (context, node, times = 1) => {
  for (let i = 0; i < times; i++) context.report({ node, messageId: "banned" });
};

const stringValue = (node) =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node?.type === "TemplateLiteral" && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : null;

const WEB_FONT = /fonts\.googleapis|@font-face|\bJetBrains Mono\b|(?:^|["'`])Inter(?=["'`]|$)|\bInter\s*,|\bGeorgia\b|\bSongti\b/;

export const webFont = rule(
  "不載入 web font，也不引用未載入的字族名",
  `不載入 web font、不用 Inter／JetBrains Mono／Georgia／宋體；中文用 FONT_CJK，數字用 FONT_DATA（${SPEC} §4.1）`,
  (context) => onWrittenText(context, (node, raw) => report(context, node, countMatches(raw, WEB_FONT))),
);

export const nativeRange = rule(
  "原生 range 只能出現在共用滑桿元件本體",
  `不要用原生 <input type="range">，改用 src/components/controls/Slider.tsx 的 <Slider>（${SPEC} §5.13）`,
  (context) => ({
    JSXAttribute(node) {
      if (node.name.name !== "type" || !node.value) return;
      const v = node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
      if (stringValue(v) === "range") report(context, node);
    },
    Property(node) {
      if (propName(node) === "type" && stringValue(node.value) === "range") report(context, node);
    },
  }),
);

const RIGHT = /▶|&#x25[bB]6;|&#9654;|\\u25[bB]6/;
const DOWN = /▼|&#x25[bB][cC];|&#9660;|\\u25[bB][cC]/;
const UP = /▲|\\u25[bB]2/;

export const triangleChevron = rule(
  "展開／收合不用 ▶ ▼ 三角字元",
  `不用 ▶ ▼ 當 chevron，改 lucide-react 的 <ChevronRight size={12} />（展開時 rotate(90deg)）；播放鍵用 Play（${SPEC} §5.16）`,
  (context) =>
    onWrittenText(context, (node, raw) => {
      // 與 ▲ 同一行的 ▼ 是升降趨勢（資料語意），不算 chevron。
      const line = context.sourceCode.lines[node.loc.start.line - 1] ?? "";
      report(context, node, countMatches(raw, RIGHT) + (UP.test(line) ? 0 : countMatches(raw, DOWN)));
    }),
);

export const englishControlLabel = rule(
  "圖層控制項標籤 labelPrefix 一律中文開頭",
  `labelPrefix 要中文開頭；英文代碼放 labelSuffix 或說明文字（${SPEC} §6.1）`,
  (context) => ({
    Property(node) {
      if (propName(node) === "labelPrefix" && /^[A-Za-z]/.test(stringValue(node.value) ?? "")) report(context, node);
    },
  }),
);

export const uppercaseEyebrow = rule(
  "不用 text-transform: uppercase",
  `不轉大寫：eyebrow 寫中文（例「交通 · 公車」），9px var(--text-dim)（${SPEC} §6.1）`,
  (context) => ({
    Property(node) {
      if (propName(node) === "textTransform" && stringValue(node.value) === "uppercase") report(context, node);
    },
    ...onWrittenText(context, (node, raw) => report(context, node, countMatches(raw, /text-transform\s*:\s*uppercase/))),
  }),
);

const directText = (child) => {
  if (child.type === "JSXText") return child.value;
  if (child.type !== "JSXExpressionContainer") return "";
  let out = "";
  walk(child.expression, (n) => {
    if (n.type === "JSXElement" || n.type === "JSXFragment") return false;
    if (n.type === "Literal" && typeof n.value === "string") out += n.value;
    if (n.type === "TemplateElement") out += n.value.cooked ?? "";
    return true;
  });
  return out;
};

export const fontDataOnCjk = rule(
  "套 FONT_DATA 的 JSX 元素，直接文字含中文",
  `FONT_DATA 是數字用的等寬字：把數字包成獨立的 FONT_DATA <span>，中文留在外層 FONT_CJK 節點（${SPEC} §4.1）`,
  (context) => ({
    JSXElement(node) {
      const style = node.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "style");
      if (!style?.value || !someNode(style.value, (n) => n.type === "Identifier" && n.name === "FONT_DATA")) return;
      if (node.children.some((c) => CJK.test(directText(c)))) report(context, node.openingElement);
    },
  }),
);

const zValue = (node) => {
  if (node?.type === "Literal" && typeof node.value === "number") return node.value;
  const s = stringValue(node);
  return s != null && /^\d+$/.test(s.trim()) ? Number(s) : null;
};

export const rawZIndex = rule(
  "不寫死 ≥10 的 z-index 數字",
  `不寫死 ≥10 的 z-index；改用 designTokens.ts 的 Z_INDEX.<層>（CSS 用 var(--z-*)），特例要登記在 ${SPEC} §5.25`,
  (context) => ({
    Property(node) {
      const name = propName(node);
      if ((name === "zIndex" || name === "z-index") && (zValue(node.value) ?? 0) >= 10) report(context, node);
    },
    ...onWrittenText(context, (node, raw) => {
      for (const m of raw.matchAll(/\bz-index\s*:\s*(\d+)\b/g)) if (Number(m[1]) >= 10) report(context, node);
    }),
  }),
);

const DATASET_ID = /^dataset_?[iI]d$/;
const isDatasetId = (n) => n.type === "Identifier" && DATASET_ID.test(n.name);
/** 子樹裡有沒有 datasetId（不算當函式參數傳進去，例 labelFor(datasetId)）。 */
const showsDatasetId = (root) => {
  let hit = false;
  walk(root, (n) => {
    if (hit || n.type === "CallExpression") return false;
    if (isDatasetId(n)) hit = true;
    return !hit;
  });
  return hit;
};

export const internalIdDisplay = rule(
  "（啟發式，只記錄）datasetId 直接放進 JSX 文字或 title／label 欄位",
  `不要直接顯示 datasetId；先過人類可讀映射（例 describeDataset(datasetId).label），查不到顯示「未命名資料集」（${SPEC} §6.3）`,
  (context) => ({
    JSXExpressionContainer(node) {
      if ((node.parent.type === "JSXElement" || node.parent.type === "JSXFragment") && showsDatasetId(node.expression)) report(context, node);
    },
    Property(node) {
      if (["title", "label", "desc", "text"].includes(propName(node) ?? "") && showsDatasetId(node.value)) report(context, node);
    },
  }),
);
