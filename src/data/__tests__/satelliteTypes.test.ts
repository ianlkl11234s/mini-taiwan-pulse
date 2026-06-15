import { describe, it, expect } from "vitest";
import {
  classifyChinaSatByName,
  CN_YAOGAN_RE,
  CN_JILIN_RE,
  CN_GAOFEN_RE,
  CN_TJS_RE,
  CN_BEIDOU_RE,
  CN_SHIYAN_RE,
  TW_NAME_RE,
  SATELLITE_TIER,
  SATELLITE_LAYER_KEY,
  SATELLITE_COLORS,
  SATELLITE_LABELS,
} from "../satelliteTypes";

describe("classifyChinaSatByName — 6 群分流", () => {
  it("YAOGAN-35 03A → china_yaogan", () => {
    expect(classifyChinaSatByName("YAOGAN-35 03A")).toBe("china_yaogan");
  });
  it("JILIN-1 04A → china_jilin", () => {
    expect(classifyChinaSatByName("JILIN-1 04A")).toBe("china_jilin");
  });
  it("GAOFEN-11 → china_gaofen", () => {
    expect(classifyChinaSatByName("GAOFEN-11")).toBe("china_gaofen");
  });
  it("TJS-10 → china_tjs", () => {
    expect(classifyChinaSatByName("TJS-10")).toBe("china_tjs");
  });
  it("BEIDOU-3 M1 → china_beidou", () => {
    expect(classifyChinaSatByName("BEIDOU-3 M1")).toBe("china_beidou");
  });
  it("BD-3 M9 → china_beidou", () => {
    expect(classifyChinaSatByName("BD-3 M9")).toBe("china_beidou");
  });
  it("SHIYAN-6 03 → china_shiyan", () => {
    expect(classifyChinaSatByName("SHIYAN-6 03")).toBe("china_shiyan");
  });
  it("SHIJIAN-20 → china_shiyan", () => {
    expect(classifyChinaSatByName("SHIJIAN-20")).toBe("china_shiyan");
  });
  it("不認識名稱（Ling Qiao）→ china_shiyan (catch-all)", () => {
    expect(classifyChinaSatByName("Ling Qiao")).toBe("china_shiyan");
  });
});

describe("regex — 6 群名稱前綴", () => {
  it("YAOGAN regex 不誤抓 JILIN/GAOFEN", () => {
    expect(CN_YAOGAN_RE.test("YAOGAN 12")).toBe(true);
    expect(CN_YAOGAN_RE.test("JILIN-1")).toBe(false);
    expect(CN_YAOGAN_RE.test("GAOFEN-3")).toBe(false);
  });
  it("JILIN regex 抓 JILIN-1 04A", () => {
    expect(CN_JILIN_RE.test("JILIN-1 04A")).toBe(true);
    expect(CN_JILIN_RE.test("JILIN-1 GF03")).toBe(true);
  });
  it("GAOFEN regex 抓 GAOFEN-3 / GAOFEN-11", () => {
    expect(CN_GAOFEN_RE.test("GAOFEN-3")).toBe(true);
    expect(CN_GAOFEN_RE.test("GAOFEN-11")).toBe(true);
  });
  it("TJS regex 抓 TJS-3 / TJSW", () => {
    expect(CN_TJS_RE.test("TJS-3")).toBe(true);
    expect(CN_TJS_RE.test("TJSW-1")).toBe(true);
  });
  it("BEIDOU regex 抓 BEIDOU / BD-", () => {
    expect(CN_BEIDOU_RE.test("BEIDOU-3 M1")).toBe(true);
    expect(CN_BEIDOU_RE.test("BD-3 IGSO")).toBe(true);
  });
  it("SHIYAN regex 抓 SHIYAN / SHIJIAN / TIANTUO", () => {
    expect(CN_SHIYAN_RE.test("SHIYAN-6 03")).toBe(true);
    expect(CN_SHIYAN_RE.test("SHIJIAN-20")).toBe(true);
    expect(CN_SHIYAN_RE.test("TIANTUO-3")).toBe(true);
  });
  it("TW regex 抓 FORMOSAT/TRITON/YUSHAN/IRIS-", () => {
    expect(TW_NAME_RE.test("FORMOSAT-7 #3")).toBe(true);
    expect(TW_NAME_RE.test("TRITON")).toBe(true);
    expect(TW_NAME_RE.test("YUSHAN")).toBe(true);
    expect(TW_NAME_RE.test("IRIS-C")).toBe(true);
    expect(TW_NAME_RE.test("YAOGAN 12")).toBe(false);
  });
});

describe("tier / layer key mapping", () => {
  it("每個 category 都有 tier 與 layerKey", () => {
    const cats = Object.keys(SATELLITE_COLORS) as Array<keyof typeof SATELLITE_COLORS>;
    expect(cats.length).toBe(7);
    for (const c of cats) {
      expect(SATELLITE_TIER[c]).toMatch(/^[SABC]$/);
      expect(SATELLITE_LAYER_KEY[c]).toMatch(/^satellites/);
      expect(SATELLITE_LABELS[c]).toBeTruthy();
    }
  });
  it("Yaogan / Jilin / Gaofen / TW 都是 S 級", () => {
    expect(SATELLITE_TIER.china_yaogan).toBe("S");
    expect(SATELLITE_TIER.china_jilin).toBe("S");
    expect(SATELLITE_TIER.china_gaofen).toBe("S");
    expect(SATELLITE_TIER.taiwan).toBe("S");
  });
  it("TJS=A, Beidou=B, Shiyan=C", () => {
    expect(SATELLITE_TIER.china_tjs).toBe("A");
    expect(SATELLITE_TIER.china_beidou).toBe("B");
    expect(SATELLITE_TIER.china_shiyan).toBe("C");
  });
});
