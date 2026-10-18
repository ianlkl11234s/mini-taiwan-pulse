import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// R8-2：手機頂部時間軸條要跟隨底圖主題（#516 只修了底部面板）。
// App 沒有 render 測試環境，改以 TSX AST 檢查時間軸元件的 props，不依賴註解位置或排版。
const source = ts.createSourceFile("App.tsx", readFileSync("src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const TIMELINES = new Set(["LiveTimelineControls", "HistoricalTimeline"]);

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
const tags: JsxTag[] = [];
(function visit(node: ts.Node) {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && TIMELINES.has(node.tagName.getText())) tags.push(node);
  ts.forEachChild(node, visit);
})(source);

const attr = (tag: JsxTag, name: string) =>
  tag.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name);
const attrExpr = (tag: JsxTag, name: string) => {
  const init = attr(tag, name)?.initializer;
  return init && ts.isJsxExpression(init) ? init.expression : undefined;
};
const isMobile = (tag: JsxTag) => attrExpr(tag, "isMobile")?.kind === ts.SyntaxKind.TrueKeyword;

/** 往上找第一個帶 style={{ background }} 的外層 JSX 元素，回傳 background 的運算式。 */
function wrapperBackground(tag: JsxTag): ts.Expression | undefined {
  for (let node: ts.Node | undefined = tag.parent; node; node = node.parent) {
    if (!ts.isJsxElement(node)) continue;
    const style = attrExpr(node.openingElement, "style");
    if (style && ts.isObjectLiteralExpression(style)) {
      const bg = style.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === "background");
      if (bg) return bg.initializer;
    }
  }
  return undefined;
}

describe("手機時間軸條主題 (R8-2)", () => {
  const mobile = tags.filter(isMobile);

  it("Live／Historical 都有手機版時間軸", () => {
    expect(mobile.map((tag) => tag.tagName.getText()).sort()).toEqual(["HistoricalTimeline", "LiveTimelineControls"]);
  });

  it("每個時間軸都傳入實際主題，不寫死 true／false", () => {
    for (const tag of tags) {
      const expr = attrExpr(tag, "isDarkTheme");
      expect(expr && ts.isIdentifier(expr) ? expr.text : expr?.getText(), `${tag.tagName.getText()}@${source.getLineAndCharacterOfPosition(tag.pos).line + 1}`).toBe("isDarkTheme");
    }
  });

  it("手機時間軸外層背景依主題切換（淡色用 LIGHT token）", () => {
    for (const tag of mobile) {
      const bg = wrapperBackground(tag);
      expect(bg && ts.isConditionalExpression(bg), tag.tagName.getText()).toBe(true);
      const cond = bg as ts.ConditionalExpression;
      expect(cond.condition.getText()).toBe("isDarkTheme");
      expect(cond.whenFalse.getText()).toMatch(/^LIGHT\./);
    }
  });
});
