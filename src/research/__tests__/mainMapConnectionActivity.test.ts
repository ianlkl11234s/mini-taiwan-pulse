import { describe, expect, it } from "vitest";

import { completedActivityForOperation } from "../MainMapConnection";

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
});
