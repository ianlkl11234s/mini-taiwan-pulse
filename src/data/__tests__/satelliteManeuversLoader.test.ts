import { describe, it, expect } from "vitest";
import {
  formatManeuverDetail,
  formatRelTime,
  type ManeuverRow,
} from "../satelliteManeuversLoader";

function mkRow(overrides: Partial<ManeuverRow>): ManeuverRow {
  return {
    norad_id: 37875,
    name: "YAOGAN 12",
    country_operator: "China",
    cn_group: "YAOGAN",
    maneuver_type: "ALTITUDE_CHANGE",
    delta_inclination: 0,
    delta_eccentricity: 0,
    delta_period_min: 0,
    curr_inclination: 97.4,
    curr_eccentricity: 0.001,
    curr_period_min: 94.4,
    curr_fetched_at: new Date().toISOString(),
    prev_fetched_at: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
    curr_epoch: "26165.25",
    prev_epoch: "26158.18",
    ...overrides,
  };
}

describe("formatManeuverDetail", () => {
  it("PLANE_CHANGE 顯示傾角 ±X°", () => {
    expect(formatManeuverDetail(mkRow({ maneuver_type: "PLANE_CHANGE", delta_inclination: -0.01 })))
      .toBe("傾角 -0.01°");
    expect(formatManeuverDetail(mkRow({ maneuver_type: "PLANE_CHANGE", delta_inclination: 0.03 })))
      .toBe("傾角 +0.03°");
  });
  it("ALTITUDE_CHANGE 顯示週期 ±X min", () => {
    expect(formatManeuverDetail(mkRow({ maneuver_type: "ALTITUDE_CHANGE", delta_period_min: 0.09 })))
      .toBe("週期 +0.09 min");
    expect(formatManeuverDetail(mkRow({ maneuver_type: "ALTITUDE_CHANGE", delta_period_min: -0.06 })))
      .toBe("週期 -0.06 min");
  });
  it("SHAPE_CHANGE 顯示離心率指數形式", () => {
    const s = formatManeuverDetail(mkRow({ maneuver_type: "SHAPE_CHANGE", delta_eccentricity: 8e-4 }));
    expect(s).toContain("離心率");
    expect(s).toContain("+");
    expect(s.toLowerCase()).toContain("e-4");
  });
});

describe("formatRelTime", () => {
  it("< 1 分 → 剛剛", () => {
    expect(formatRelTime(new Date().toISOString())).toBe("剛剛");
  });
  it("14 分鐘前", () => {
    const t = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    expect(formatRelTime(t)).toBe("14 分鐘前");
  });
  it("2 小時前", () => {
    const t = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(formatRelTime(t)).toBe("2 小時前");
  });
  it("3 天前", () => {
    const t = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    expect(formatRelTime(t)).toBe("3 天前");
  });
});
