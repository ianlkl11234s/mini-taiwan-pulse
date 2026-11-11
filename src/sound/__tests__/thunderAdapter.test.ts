import { describe, expect, it } from "vitest";
import type { LightningSource, LightningStrike } from "../../data/lightningLoader";
import { dedupeAndLinkStrikes, loadThunder } from "../sourceAdapters/thunderAdapter";
import { queryFamilyInterval } from "../engines/receiverQuery";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

const T = DAY_START + 15 * 3600;
const strike = (event_id: number, ts: number, lat: number, lon = RECV.longitude): LightningStrike => ({
  event_id,
  strike_ts: ts,
  intensity_ka: 12,
  strike_type: 0,
  lon,
  lat,
});

const fetcherOf =
  (data: Partial<Record<LightningSource, LightningStrike[] | Error>>) =>
  async (_date: string, source: LightningSource): Promise<LightningStrike[]> => {
    const v = data[source];
    if (v instanceof Error) throw v;
    return v ?? [];
  };

describe("thunderAdapter", () => {
  it("預設讀 cwa＋taipower 兩源，每源各自 source_health", async () => {
    const calls: string[] = [];
    const set = await loadThunder({ date: DATE }, async (d, s) => {
      calls.push(`${s}|${d}`);
      return s === "taipower" ? [strike(1, T, latNorth(343))] : [];
    });
    expect(calls.sort()).toEqual([`cwa|${DATE}`, `taipower|${DATE}`]);
    expect(set.coverage.map((c) => `${c.provider}:${c.status}`).sort()).toEqual(["cwa:empty", "taipower:ok"]);
  });

  it("T07：所有來源皆空 → unknown（不是「無雷」）", async () => {
    const set = await loadThunder({ date: DATE }, fetcherOf({}));
    const r = queryFamilyInterval("thunder", [set], RECV, T, T);
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.reason).toContain("cwa:empty");
    expect(r.reason).toContain("taipower:empty");
  });

  it("查今天：現在之後的時段 unavailable，不是「無雷」", async () => {
    const set = await loadThunder({ date: DATE, nowUnix: T }, fetcherOf({ cwa: [strike(1, T - 7200, latNorth(343))] }));
    expect(queryFamilyInterval("thunder", [set], RECV, T - 60, T - 60).status).toBe("inactive");
    const later = queryFamilyInterval("thunder", [set], RECV, T + 3600, T + 3600);
    expect(later.status).toBe("unavailable");
    expect(later.relativePotential).toBeNull();
  });

  it("T07：一源錯誤、另一源健康 → 以健康源判斷並標 degraded", async () => {
    const set = await loadThunder({ date: DATE }, fetcherOf({ cwa: new Error("boom"), taipower: [strike(9, T - 3600, latNorth(50_000))] }));
    const r = queryFamilyInterval("thunder", [set], RECV, T, T);
    expect(r.status).toBe("inactive");
    expect(r.notes).toContain("degraded_source:cwa:error");
  });

  it("T06：343 m 的落雷，閃光後 ~1 秒才聽到、持續數秒", async () => {
    const set = await loadThunder({ date: DATE }, fetcherOf({ cwa: [strike(1, T, latNorth(343))] }));
    expect(queryFamilyInterval("thunder", [set], RECV, T + 0.5, T + 0.5).status).toBe("inactive");
    const r = queryFamilyInterval("thunder", [set], RECV, T + 1.5, T + 1.5);
    expect(r.status).toBe("active");
    const timing = r.contributions[0]!.thunderTiming!;
    expect(timing.flashTime).toBe(T);
    expect(timing.perceivedArrivalTime - T).toBeCloseTo(1, 1);
    expect(timing.propagationApproximation).toBe("2d");
    expect(queryFamilyInterval("thunder", [set], RECV, T + 5, T + 5).status).toBe("active");
    expect(r.contributions[0]!.modeledDbA).toBeNull();
  });

  it("T08：同源 event_id 去重；跨源 ±1 s、<1 km 建 possible-link 只計一次", () => {
    const recs = dedupeAndLinkStrikes([
      { source: "cwa", strikes: [strike(1, T, latNorth(343)), strike(1, T, latNorth(343))] },
      {
        source: "taipower",
        strikes: [
          strike(77, T + 0.4, latNorth(343 + 200)), // 同一事件
          strike(78, T + 30, latNorth(343)), // 時間差太大 → 另一事件
        ],
      },
    ]);
    expect(recs.map((r) => r.id)).toEqual(["thunder:cwa:1", "thunder:taipower:78"]);
    expect(recs[0]!.payload.linkedRecordIds).toEqual(["thunder:taipower:77"]);
  });

  it("T08：連結後接收者只看到一筆貢獻（不雙倍計算）", async () => {
    const set = await loadThunder(
      { date: DATE },
      fetcherOf({ cwa: [strike(1, T, latNorth(343))], taipower: [strike(77, T + 0.4, latNorth(500))] }),
    );
    const r = queryFamilyInterval("thunder", [set], RECV, T + 2, T + 2);
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0]!.notes.join(" ")).toContain("possible_link:thunder:taipower:77");
  });
});
