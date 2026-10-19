import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { activityCardVisible, completedActivityForOperation, scheduleAnalysisResultStyleRestore } from "../MainMapConnection";
import { ResearchActivity } from "../ResearchActivityCard";

describe("completedActivityForOperation", () => {
  it("keeps layer and dataset search candidates distinct from returned records", () => {
    expect(completedActivityForOperation("search_layers", { totalMatched: 22, returned: 20 })).toMatchObject({
      title: "已找到相關圖層", detail: "共找到 22 個候選圖層；本次回傳 20 個。",
    });
    expect(completedActivityForOperation("search_datasets", { totalMatched: 22, returned: 20 })).toMatchObject({
      title: "已找到相關資料集", detail: "共找到 22 個候選資料集；本次回傳 20 個。",
    });
    expect(completedActivityForOperation("query_records", { totalMatched: 22, returned: 1 })).toMatchObject({
      title: "資料紀錄已回傳", detail: "完整符合 22 筆資料紀錄；本次回傳 1 筆。",
    });
  });

  it("does not call one returned record a candidate layer", () => {
    const activity = completedActivityForOperation("query_records", { totalMatched: 1, returned: 1 });
    expect(activity.detail).toBe("完整符合 1 筆資料紀錄；本次回傳 1 筆。");
    expect(activity.detail).not.toContain("候選圖層");
  });

  it("retries a missing style-reset overlay once at idle, but not a ready or cancelled retry", () => {
    let idle: (() => void) | undefined;
    const map = {
      once: (_event: "idle", listener: () => void) => { idle = listener; },
      off: (_event: "idle", listener: () => void) => { if (idle === listener) idle = undefined; },
      isStyleLoaded: () => true,
    };
    let redraws = 0;
    const cancel = scheduleAnalysisResultStyleRestore(map, () => { redraws += 1; }, () => false);
    idle?.();
    expect(redraws).toBe(1);
    const cancelled = scheduleAnalysisResultStyleRestore(map, () => { redraws += 1; }, () => false);
    const queuedBeforeCancel = idle!;
    cancelled();
    queuedBeforeCancel();
    expect(redraws).toBe(1);
    cancel();
    expect(idle).toBeUndefined();
    scheduleAnalysisResultStyleRestore(map, () => { redraws += 1; }, () => true);
    idle?.();
    expect(redraws).toBe(1);
  });
});

describe("活動卡顯示條件（不受左側 Agent 面板互斥影響）", () => {
  const activity = { phase: "working" as const, title: "正在查詢圖層" };

  it("有活動就顯示，與左側面板開關無關；拍攝模式隱藏；沒有活動不顯示", () => {
    expect(activityCardVisible(activity, false)).toBe(true);
    expect(activityCardVisible(activity, undefined)).toBe(true);
    expect(activityCardVisible(activity, true)).toBe(false);
    expect(activityCardVisible(null, false)).toBe(false);
  });

  it("活動卡本身渲染「最新動作」與動作紀錄標籤", () => {
    const html = renderToStaticMarkup(createElement(ResearchActivity, { activity }));
    expect(html).toContain('aria-label="Agent 動作紀錄"');
    expect(html).toContain("最新動作");
    expect(html).toContain("正在查詢圖層");
  });

  it("活動卡掛在地圖容器（portal），不在左側面板（hidden 會跟著面板收起）之內", () => {
    // 元件需要真的地圖與 bridge 才能 render；改以 TSX AST 檢查 portal 的位置與顯示條件（不依賴排版）
    const file = fileURLToPath(new URL("../MainMapConnection.tsx", import.meta.url));
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const portals: ts.CallExpression[] = [];
    (function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText() === "createPortal" && node.arguments[0]?.getText().includes("research-activity-position")) portals.push(node);
      ts.forEachChild(node, visit);
    })(sf);
    expect(portals).toHaveLength(1);
    const portal = portals[0]!;
    const classOf = (el: ts.JsxOpeningLikeElement) => el.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "className")?.initializer?.getText() ?? "";
    for (let node: ts.Node | undefined = portal.parent; node; node = node.parent) {
      if (ts.isJsxElement(node)) expect(classOf(node.openingElement)).not.toContain("main-map-agent-panel");
    }
    const root = portal.arguments[0]!;
    const opening = ts.isJsxElement(root) ? root.openingElement : root as ts.JsxSelfClosingElement;
    const style = opening.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "style")!;
    const calls: string[] = [];
    const ids: string[] = [];
    (function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) calls.push(`${node.expression.getText()}(${node.arguments.map((a) => a.getText()).join(", ")})`);
      if (ts.isIdentifier(node)) ids.push(node.text);
      ts.forEachChild(node, visit);
    })(style);
    expect(calls).toContain("activityCardVisible(activity, props.uiHidden)");
    expect(ids).not.toContain("open");
    expect(ids).not.toContain("panelOpen");
  });
});

describe("Agent 光暈 A1", () => {
  it("忙碌時光暈加 --on；節點常駐，靠 CSS 淡入淡出", () => {
    const busy = renderToStaticMarkup(createElement(ResearchActivity, { activity: { phase: "working", title: "正在讀取資料" } }));
    expect(busy).toContain("research-activity__viewport-glow research-activity__viewport-glow--on");
    const idle = renderToStaticMarkup(createElement(ResearchActivity, { activity: { phase: "complete", title: "Agent 已完成這一步" } }));
    expect(idle).toContain('class="research-activity__viewport-glow"');
  });
});
