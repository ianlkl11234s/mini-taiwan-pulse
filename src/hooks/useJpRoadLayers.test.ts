import { describe, expect, it } from "vitest";
import {
  JP_EXPRESSWAY_COLOR_EXPRESSION, JP_ROAD_CLASSES, JP_ROAD_SORT_KEY, jpExpresswayFilter, jpRoadFilter,
} from "../data/jpRoadTypes";
import { jpRoadWidthExpression } from "./useJpMajorRoadsLayer";
import { LINE_WIDTH } from "../map/mapStyleScale";

describe("日本道路 PMTiles 契約", () => {
  it("主要道路：代碼 1/2/4；sort-key 高速 > 國道 > 縣道；線寬照 L-1 三階", () => {
    expect(JP_ROAD_CLASSES.map((c) => c.code).sort()).toEqual([1, 2, 4]);
    const sort = Object.fromEntries(JP_ROAD_CLASSES.map((c) => [c.code, c.sort]));
    expect(sort[4]).toBeGreaterThan(sort[1]!);
    expect(sort[1]).toBeGreaterThan(sort[2]!);
    expect(JP_ROAD_SORT_KEY.slice(0, 2)).toEqual(["match", ["get", "road_class_code"]]);
    const w = jpRoadWidthExpression() as unknown[];
    expect(w.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
    expect(w[4]).toEqual(["match", ["get", "road_class_code"], 4, LINE_WIDTH.emphasis[0], 1, LINE_WIDTH.standard[0], 2, LINE_WIDTH.thin[0], LINE_WIDTH.thin[0]]);
  });

  it("主要道路篩選：0 全部、1–3 等級、4 有料；無效 fail closed", () => {
    expect(jpRoadFilter(0)).toBeNull();
    expect(jpRoadFilter(1)).toEqual(["==", ["get", "road_class_code"], 4]);
    expect(jpRoadFilter(3)).toEqual(["==", ["get", "road_class_code"], 2]);
    expect(jpRoadFilter(4)).toEqual(["==", ["get", "toll"], true]);
    expect(jpRoadFilter(5)).toEqual(["literal", false]);
  });

  it("高速道路：暫定供用淡色（case），不用虛線；路線種別篩選", () => {
    expect(JP_EXPRESSWAY_COLOR_EXPRESSION.slice(0, 2)).toEqual(["case", ["==", ["get", "service_status_en"], "provisional"]]);
    expect(jpExpresswayFilter(0)).toBeNull();
    expect(jpExpresswayFilter(4)).toEqual(["==", ["get", "road_category_en"], "urban_expressway"]);
    expect(jpExpresswayFilter(6)).toEqual(["literal", false]);
  });
});
