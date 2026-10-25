import { describe, expect, it } from "vitest";
import {
  JP_BUS_STOP_CLASSES,
  JP_BUS_STOP_CLASS_COLOR_EXPRESSION,
  JP_PREFECTURE_NAMES,
} from "../data/jpBusStopTypes";

describe("日本公車站 PMTiles 契約", () => {
  it("5 種 bus_class 分色，筆數合計 278,515", () => {
    expect(JP_BUS_STOP_CLASSES.map((c) => c.value)).toEqual(["route_private", "community", "route_public", "other", "mixed"]);
    expect(JP_BUS_STOP_CLASSES.reduce((n, c) => n + c.count, 0)).toBe(278_515);
    expect(JP_BUS_STOP_CLASS_COLOR_EXPRESSION).toEqual(expect.arrayContaining(["match", ["get", "bus_class"]]));
  });

  it("pref_code 對照 47 都道府縣", () => {
    expect(Object.keys(JP_PREFECTURE_NAMES)).toHaveLength(47);
    expect(JP_PREFECTURE_NAMES["13"]).toBe("東京都");
    expect(JP_PREFECTURE_NAMES["47"]).toBe("沖縄県");
  });
});
