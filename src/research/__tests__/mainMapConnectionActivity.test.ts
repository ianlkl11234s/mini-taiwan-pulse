import { describe, expect, it } from "vitest";

import { completedActivityForOperation, scheduleAnalysisResultStyleRestore } from "../MainMapConnection";

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
