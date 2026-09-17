import { describe, expect, it } from "vitest";
import { activityForOperation, appendActivity, type Activity } from "../researchActivity";

describe("activityForOperation", () => {
  it("keeps readback operations silent so a response does not flash progress", () => {
    expect(activityForOperation("map_context", {})).toBeNull();
    expect(activityForOperation("get_analysis_result", {})).toBeNull();
    expect(activityForOperation("list_results", {})).toBeNull();
  });

  it("uses bounded natural copy for exploration, spatial work, and aggregation", () => {
    expect(activityForOperation("explore_data", {})).toMatchObject({ phase: "working", title: "正在探索可用資料" });
    expect(activityForOperation("spatial_query", { predicate: "nearest" })).toMatchObject({ detail: "正在找出接近的紀錄。" });
    expect(activityForOperation("aggregate_records", {})).toMatchObject({ title: "正在彙整已取得的資料" });
  });

  it("marks presentation and explicit terminal signals without invented percentages", () => {
    expect(activityForOperation("present_result", {})).toMatchObject({ phase: "presenting" });
    expect(activityForOperation("research_complete", {})).toMatchObject({ phase: "complete" });
    expect(activityForOperation("something_unregistered", {})).toBeNull();
  });
});


it("retains six recent actions, deduplicates polling and clears on disconnect", () => {
  let history: Activity[] = [];
  for (let i = 0; i < 9; i++) history = appendActivity(history, { phase: "complete", title: `Action ${i}` });
  expect(history.map(entry => entry.title)).toEqual(["Action 8", "Action 7", "Action 6", "Action 5", "Action 4", "Action 3"]);
  expect(appendActivity(history, { ...history[0]! })).toBe(history);
  expect(appendActivity(history, null)).toEqual([]);
});
