import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
    const source = readFileSync(fileURLToPath(new URL("../MainMapConnection.tsx", import.meta.url)), "utf8");
    const portal = source.indexOf("createPortal(<div className={`research-activity-position");
    const panel = source.indexOf('className="main-map-agent-panel"');
    expect(portal).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(portal);
    const portalLine = source.slice(portal, source.indexOf("\n", portal));
    expect(portalLine).toContain("activityCardVisible(activity, props.uiHidden)");
    expect(portalLine).not.toMatch(/\bopen\b|panelOpen/);
  });
});
