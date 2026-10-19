// 自訂 ESLint 規則共用工具（見 docs/development-rules.md「自訂 ESLint 規則」）。

/** 物件屬性的名稱（`a: 1`、`"a": 1`）；computed key 回傳 null。 */
export function propName(node) {
  if (!node || node.type !== "Property" || node.computed) return null;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal") return String(node.key.value);
  return null;
}

/** 走訪子樹（不含 parent），fn 回傳 false 時不往下走。 */
export function walk(node, fn) {
  if (!node || typeof node.type !== "string") return;
  if (fn(node) === false) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "range" || key === "loc") continue;
    const value = node[key];
    if (Array.isArray(value)) for (const child of value) walk(child, fn);
    else if (value && typeof value.type === "string") walk(value, fn);
  }
}

export function someNode(root, pred) {
  let found = false;
  walk(root, (n) => {
    if (found) return false;
    if (pred(n)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * 原始碼裡「寫出來的文字」：字串字面值、模板片段、JSX 文字。
 * 回傳 listener，對每段呼叫 fn(node, raw)；raw 是原始寫法（escape 未解碼）。
 * 註解不算（ESLint 本來就不把註解當節點）。
 */
export function onWrittenText(context, fn) {
  const sourceCode = context.sourceCode;
  return {
    Literal(node) {
      if (typeof node.value === "string") fn(node, sourceCode.getText(node).slice(1, -1));
    },
    TemplateElement(node) {
      fn(node, node.value.raw);
    },
    JSXText(node) {
      fn(node, node.raw ?? node.value);
    },
  };
}

export function countMatches(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  return text.match(g)?.length ?? 0;
}

/** 以 esquery selector 定義的簡單禁用規則；每個規則有自己的 id（訊息精準、bulk suppressions 分開計數）。 */
export function selectorRule({ description, message, selectors }) {
  return {
    meta: { type: "problem", docs: { description }, schema: [], messages: { banned: message } },
    create(context) {
      return Object.fromEntries(selectors.map((s) => [s, (node) => context.report({ node, messageId: "banned" })]));
    },
  };
}
