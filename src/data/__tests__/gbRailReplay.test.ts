import { describe, expect, it } from "vitest";
import {
  GbRailSmoother, GbRailTickClock, buildGbRailReplayData, gbRailBuildTripPath, gbRailPathPoint, gbRailTripProgress, candidateTrips, gbRailDelayTier, gbRailReplayTime, londonMidnightUtc,
  type GbRailGeometry, type GbRailTrip,
} from "../gbRailReplay";

const geom: GbRailGeometry = {
  lines: [
    { id: "A>B", g: [[0, 51], [0, 51.01], [0.01, 51.01]], gm: [0, 1000, 1700], fb: false },
    { id: "B>C", g: [[0.01, 51.01], [0.01, 51.01]], gm: [0, 0], fb: false },
  ],
  tiplocs: { A: [0, 51, "A Rail Station"], B: [0.01, 51.01, "B Rail Station"], C: [0.01, 51.01, "C"] },
};
const T0 = Date.UTC(2026, 10, 21, 8, 0, 0) / 1000;
const trip: GbRailTrip = {
  rid: "r1", uid: "u", hc: "1A00", toc: "SN", cat: "OO", segs: [0, 1],
  pts: [["A", T0, T0, "aa", T0, T0, 0, 0], ["B", T0 + 170, T0 + 230, "ae", T0, T0, 3.5, 0], ["C", T0 + 300, T0 + 300, "ee", T0, T0, null, 0]],
};

describe("gbRailReplay 時間對應", () => {
  it("十一月英國＝UTC；台北 16:30 對應服務日英國 08:30", () => {
    expect(londonMidnightUtc("2026-11-21")).toBe(Date.UTC(2026, 10, 21) / 1000);
    const taipei1630 = Date.UTC(2026, 10, 25, 8, 30) / 1000; // 任一天英國 08:30
    expect(gbRailReplayTime(taipei1630, "2026-11-21")).toBe(Date.UTC(2026, 10, 21, 8, 30) / 1000);
  });
  it("英國 00:00–03:59 對應隔天凌晨", () => {
    const t = Date.UTC(2026, 10, 25, 1, 15) / 1000;
    expect(gbRailReplayTime(t, "2026-11-21")).toBe(Date.UTC(2026, 10, 22, 1, 15) / 1000);
  });
  it("夏令時間（BST）換算", () => {
    expect(londonMidnightUtc("2026-07-01")).toBe(Date.UTC(2026, 5, 30, 23) / 1000);
  });
});

describe("gbRailReplay 內插", () => {
  it("沿線依時間比例內插、停站停在站上、長度 0 路段不除以 0", () => {
    const path = gbRailBuildTripPath(trip, geom);
    const at = (t: number) => { const pr = gbRailTripProgress(trip, geom, t)!; return { pr, pt: gbRailPathPoint(path, pr.dist) }; };
    const mid = at(T0 + 85); // 路段一半 → 第一小段上
    expect(mid.pr.dwelling).toBe(false);
    expect(mid.pt.lng).toBeCloseTo(0);
    expect(mid.pt.lat).toBeCloseTo(51.0085);
    expect(mid.pt.bearing).toBeCloseTo(0);
    const dwell = at(T0 + 200);
    expect(dwell.pr.dwelling).toBe(true);
    expect([dwell.pt.lng, dwell.pt.lat]).toEqual([0.01, 51.01]);
    const zero = at(T0 + 260);
    expect(Number.isFinite(zero.pt.lng)).toBe(true);
    expect(gbRailTripProgress(trip, geom, T0 + 300 + 61)).toBeNull();
  });
  it("桶索引與誤點欄位偵測", () => {
    const data = buildGbRailReplayData(geom, { service_date: "2026-11-21", trips: [trip] });
    expect(data.hasDelay).toBe(true);
    expect(candidateTrips(data, T0 + 100)).toEqual([0]);
    expect(candidateTrips(data, T0 + 3600)).toEqual([]);
  });
  it("誤點分級", () => {
    expect(gbRailDelayTier(-1)).toBe("onTime");
    expect(gbRailDelayTier(3.5)).toBe("minor");
    expect(gbRailDelayTier(10)).toBe("moderate");
    expect(gbRailDelayTier(15)).toBe("severe");
    expect(gbRailDelayTier(null)).toBe("noData");
  });
});

describe("GbRailTickClock 每幀外推", () => {
  it("回放 60×（每幀一跳）不外推：直接用該幀 tick 值；播放中迴圈讓給訂閱端，暫停後迴圈接手", () => {
    const c = new GbRailTickClock();
    c.tick(1000, 0); c.tick(1000.96, 16); c.tick(1001.92, 32);
    expect(c.perFrame()).toBe(true);
    expect(c.now(40)).toBe(1001.92);
    expect(c.awaitingTick(48)).toBe(true);  // 下一幀 tick 還沒來
    expect(c.awaitingTick(32)).toBe(false); // 這一幀已 tick
    expect(c.awaitingTick(200)).toBe(false); // 很久沒 tick＝暫停
  });
  it("即時 1×（每秒一跳）也外推", () => {
    const c = new GbRailTickClock();
    c.tick(0, 0); c.tick(1, 1000); c.tick(2, 2000);
    expect(c.now(2500)).toBeCloseTo(2.5);
  });
  it("拖時間軸（大跳）不外推，直接停在新時刻", () => {
    const c = new GbRailTickClock();
    c.tick(1000, 0); c.tick(1000.96, 16); c.tick(5000, 32);
    expect(c.now(40)).toBe(5000);
    c.tick(4000, 48); // 倒退
    expect(c.now(56)).toBe(4000);
  });
});

describe("progress-based 與顯示平滑（比照公車）", () => {
  it("路徑距離連續、首站前淡入、終點後淡出", () => {
    const path = gbRailBuildTripPath(trip, geom);
    expect(path.cum[path.cum.length - 1]).toBeGreaterThan(1500);
    const a = gbRailTripProgress(trip, geom, T0 - 30)!;
    expect(a.alpha).toBeCloseTo(0.5);
    expect(a.dist).toBe(0);
    expect(gbRailTripProgress(trip, geom, T0 - 61)).toBeNull();
    const m1 = gbRailTripProgress(trip, geom, T0 + 84)!.dist;
    const m2 = gbRailTripProgress(trip, geom, T0 + 86)!.dist;
    expect(m2).toBeGreaterThan(m1);
    expect(gbRailTripProgress(trip, geom, T0 + 330)!.alpha).toBeCloseTo(0.5);
    const p = gbRailPathPoint(path, m1, 180);
    expect(p.tail!.length).toBeGreaterThanOrEqual(2);
  });
  it("目標跳動沿路徑滑過去（約 0.3 秒收斂），seek 直接跳", () => {
    const s = new GbRailSmoother();
    let f = s.beginFrame(100, 0);
    expect(s.displayDist("a", 1000, f)).toBe(1000);
    f = s.beginFrame(101, 16.7);
    const d1 = s.displayDist("a", 3000, f); // 一幀跳 2 km（1 模擬秒不可能）→ 吸收
    expect(d1).toBeGreaterThan(1000);
    expect(d1).toBeLessThan(1500);
    let d = d1;
    for (let i = 2; i <= 30; i++) { f = s.beginFrame(100 + i, i * 16.7); d = s.displayDist("a", 3000, f); }
    expect(Math.abs(d - 3000)).toBeLessThan(25); // 0.5 秒後剩 <1%
    f = s.beginFrame(5000, 600); // 拖時間軸
    expect(s.displayDist("a", 9000, f)).toBe(9000);
  });
  it("正常行駛（每幀合理前進）不加殘差", () => {
    const s = new GbRailSmoother();
    let f = s.beginFrame(0, 0); s.displayDist("a", 0, f);
    f = s.beginFrame(1, 16.7);
    expect(s.displayDist("a", 30, f)).toBe(30);
  });
});
