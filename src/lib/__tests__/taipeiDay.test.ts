import { describe, it, expect } from "vitest";
import { padTaipeiDaily } from "../taipeiDay";

const rows = [{ d: "2026-10-01" }, { d: "2026-10-02" }];
const toDay = (key: string, r: { d: string } | undefined) => ({ key, has: r != null });
const get = (r: { d: string }) => r.d;

describe("padTaipeiDaily", () => {
  it("預設錨在最後一列（行為不變）", () => {
    const out = padTaipeiDaily(rows, 3, get, toDay);
    expect(out.map((x) => x.key)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("anchor today：最後一筆之後的天出現，由 toDay 對缺列給值", () => {
    const nowMs = Date.parse("2026-10-04T10:00:00+08:00");
    const out = padTaipeiDaily(rows, 4, get, toDay, { anchor: "today", nowMs });
    expect(out.map((x) => x.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(out.map((x) => x.has)).toEqual([true, true, false, false]);
  });

  it("rows 為空回 []", () => {
    expect(padTaipeiDaily([], 3, get, toDay, { anchor: "today" })).toEqual([]);
  });
});
