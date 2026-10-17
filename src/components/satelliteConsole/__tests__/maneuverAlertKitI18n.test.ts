/**
 * 外文介面靠解析資料層的中文輸出（formatRelTime／formatOperatingSince／formatManeuverDetail）換語系。
 * 這裡用真實 formatter 的輸出當輸入：資料層改字時這裡會紅，而不是畫面上悄悄退回中文。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { localeStore } from "../../../state/localeStore";
import { formatManeuverDetail, formatRelTime, type ManeuverRow } from "../../../data/satelliteManeuversLoader";
import { formatOperatingSince } from "../../../data/satelliteCatalogLoader";
import { localizeManeuverDetail, localizeOperatingSince, localizeRelTime } from "../maneuverAlertKit";

const CJK = /[㐀-鿿]/u;

describe("衛星主控台：資料層中文輸出 → 外文", () => {
  beforeAll(async () => { await localeStore.ready("en"); localeStore.set("en"); });

  it("formatRelTime 的每種輸出都能換成英文", () => {
    const en = localeStore.getSnapshot();
    for (const agoMs of [-1000, 10_000, 5 * 60_000, 3 * 3_600_000, 3 * 86_400_000]) {
      const zh = formatRelTime(new Date(Date.now() - agoMs).toISOString());
      expect(localizeRelTime(zh, en), zh).not.toMatch(CJK);
    }
  });

  it("formatOperatingSince 的每種輸出都能換成英文", () => {
    const en = localeStore.getSnapshot();
    const anchor = Date.parse("2026-10-01T00:00:00Z");
    for (const launch of ["2026-07-01", "2024-10-01", "2023-06-15", "2027-01-01"]) {
      const zh = formatOperatingSince(launch, anchor);
      expect(localizeOperatingSince(zh, en), zh).not.toMatch(CJK);
    }
  });

  it("formatManeuverDetail 三種變軌都能換成英文", () => {
    const en = localeStore.getSnapshot();
    const rows = [
      { maneuver_type: "PLANE_CHANGE", delta_inclination: 0.14 },
      { maneuver_type: "ALTITUDE_CHANGE", delta_period_min: -0.2 },
      { maneuver_type: "SHAPE_CHANGE", delta_eccentricity: 1e-4 },
    ] as unknown as ManeuverRow[];
    for (const row of rows) {
      const zh = formatManeuverDetail(row);
      expect(localizeManeuverDetail(zh, en), zh).not.toMatch(CJK);
    }
  });
});
