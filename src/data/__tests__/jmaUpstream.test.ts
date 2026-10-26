import { describe, expect, it } from "vitest";
import {
  kosaOutOfRange, kosaStampMs, nearestKosaStamp, parseKosaList, parseRiskTargetTimes, pickFloodFrame,
  FLOOD_LIVE_MAX_STALE_MS,
} from "../jmaUpstreamLoaders";
import { GIBS_SNOW_PRODUCTS, gibsDateInRange, gibsSnowProduct, gibsSnowTileUrl, gibsUtcDate } from "../gibsSnowTypes";
import { JMA_FLOOD_SOURCE_ZOOMS, jmaFloodLineColorExpr, jmaFloodTileUrl, jmaKosaImageUrl } from "../jmaTypes";

const ELEMENTS = ["land", "inund", "flood_mesh", "rain_mesh", "flood", "designated_river"];

describe("洪水キキクル targetTimes", () => {
  // 2026-10-15 實測格式：最新在前、UTC、member immed0/1/2 → none
  const raw = [
    { basetime: "20261015180000", validtime: "20261015180000", member: "immed0", elements: ELEMENTS },
    { basetime: "20261015173000", validtime: "20261015173000", member: "none", elements: ELEMENTS },
    { basetime: "20261015120000", validtime: "20261015120000", member: "none", elements: ELEMENTS },
    { basetime: "20261015110000", validtime: "20261015110000", member: "none", elements: ["land"] },
    { basetime: "bad", validtime: "20261015100000", member: "none", elements: ELEMENTS },
  ];
  const frames = parseRiskTargetTimes(raw);

  it("只留有 flood 元素且時間合法的幀，由舊到新", () => {
    expect(frames.map((f) => f.validtime)).toEqual(["20261015120000", "20261015173000", "20261015180000"]);
    expect(frames[0]!.validMs).toBe(Date.UTC(2026, 9, 15, 12, 0, 0));
    expect(parseRiskTargetTimes({ not: "array" })).toEqual([]);
  });

  it("即時：選最晚的 ≤ now", () => {
    const now = Date.UTC(2026, 9, 15, 18, 5);
    const pick = pickFloodFrame(frames, now, true);
    expect(pick.kind === "frame" && pick.frame.member).toBe("immed0");
  });

  it("回放：保留範圍內照樣選幀；更早 → 只提供即時", () => {
    const pick = pickFloodFrame(frames, Date.UTC(2026, 9, 15, 17, 45), false);
    expect(pick.kind === "frame" && pick.frame.validtime).toBe("20261015173000");
    expect(pickFloodFrame(frames, Date.UTC(2026, 9, 14, 12), false)).toEqual({ kind: "uncovered", reason: "live_only" });
  });

  it("即時但上游停更 → stale；沒有幀 → no_frame", () => {
    expect(pickFloodFrame(frames, Date.UTC(2026, 9, 15, 18) + FLOOD_LIVE_MAX_STALE_MS + 1, true)).toEqual({ kind: "uncovered", reason: "stale" });
    expect(pickFloodFrame([], Date.now(), true)).toEqual({ kind: "uncovered", reason: "no_frame" });
  });

  it("圖磚 URL 與只有偶數 zoom 的 source 切分", () => {
    expect(jmaFloodTileUrl("20261015173000", "none", "20261015173000"))
      .toBe("https://www.jma.go.jp/bosai/jmatile/data/risk/20261015173000/none/20261015173000/surf/flood/{z}/{x}/{y}.pbf");
    expect(JMA_FLOOD_SOURCE_ZOOMS.every((z) => z % 2 === 0 && z >= 4 && z <= 14)).toBe(true);
    expect(jmaFloodLineColorExpr()).toEqual(["match", ["get", "level"], 1, "#f2e700", 2, "#ff2800", 3, "#aa00aa", 4, "#0c000c", "#3cffff"]);
  });
});

describe("黃砂予測清單", () => {
  const js = `var imgFcst = new Array();
var i = 0;
imgFcst[i++] = "202610182100";
imgFcst[i++] = "202610160300";
imgFcst[i++] = "202610160000";
imgFcst[i++] = "202610160000";
alert("x"); imgFcst[i++] = "notastamp";`;

  it("regex 解析（不 eval）、去重、由舊到新", () => {
    expect(parseKosaList(js)).toEqual(["202610160000", "202610160300", "202610182100"]);
    expect(parseKosaList("")).toEqual([]);
  });

  it("時刻是 JST", () => {
    expect(kosaStampMs("202610160900")).toBe(Date.UTC(2026, 9, 16, 0, 0));
    expect(kosaStampMs("2026101609")).toBeNull();
  });

  it("預設選最接近時間軸的時刻；範圍外標示", () => {
    const stamps = parseKosaList(js);
    expect(nearestKosaStamp(stamps, Date.UTC(2026, 9, 15, 19, 30))).toBe("202610160300"); // = 10/16 04:30 JST
    expect(nearestKosaStamp([], Date.now())).toBeNull();
    expect(kosaOutOfRange(stamps, Date.UTC(2026, 9, 15, 16))).toBe(false); // 10/16 01:00 JST
    expect(kosaOutOfRange(stamps, Date.UTC(2025, 1, 10))).toBe(true);
    expect(jmaKosaImageUrl("202610160300")).toBe("https://www.data.jma.go.jp/env/kosa/fcst/img/surf/jp/202610160300_kosafcst-s_jp_jp.png");
  });
});

describe("NASA GIBS 雪覆蓋", () => {
  it("tiles 模板保留 GIBS 的 {z}/{y}/{x} 順序", () => {
    expect(gibsSnowTileUrl("MODIS_Terra_NDSI_Snow_Cover", "2025-02-10"))
      .toBe("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default/2025-02-10/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png");
  });

  it("日期以 UTC 日界", () => {
    // 2026-10-16 07:30 台北 = 10-15 23:30 UTC
    expect(gibsUtcDate(Date.UTC(2026, 9, 15, 23, 30) / 1000)).toBe("2026-10-15");
  });

  it("範圍外（起始日前、未來）不請求", () => {
    const now = Date.UTC(2026, 9, 15, 18);
    const modis = gibsSnowProduct(0);
    const viirs = gibsSnowProduct(1);
    expect(gibsDateInRange("2025-02-10", modis, now)).toBe(true);
    expect(gibsDateInRange("2000-02-23", modis, now)).toBe(false);
    expect(gibsDateInRange("2017-12-31", viirs, now)).toBe(false);
    expect(gibsDateInRange("2026-10-16", modis, now)).toBe(false);
    // 上游 Dimension 分段之間的缺日 → 未涵蓋
    expect(gibsDateInRange("2022-10-10", modis, now)).toBe(true);
    expect(gibsDateInRange("2022-10-11", modis, now)).toBe(false);
    expect(gibsDateInRange("2022-10-22", modis, now)).toBe(false);
    expect(gibsDateInRange("2022-10-23", modis, now)).toBe(true);
    expect(gibsDateInRange("2018-02-23", viirs, now)).toBe(false);
    expect(gibsSnowProduct(99)).toBe(GIBS_SNOW_PRODUCTS[0]);
  });
});
