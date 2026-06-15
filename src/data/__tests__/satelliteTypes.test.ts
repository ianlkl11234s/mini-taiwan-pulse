import { describe, it, expect } from "vitest";
import {
  classifyByCountryName,
  CN_YAOGAN_RE,
  CN_JILIN_RE,
  CN_GAOFEN_RE,
  CN_TJS_RE,
  CN_BEIDOU_RE,
  CN_SHIYAN_RE,
  TW_NAME_RE,
  JP_NAME_RE,
  RU_NAME_RE,
  IN_NAME_RE,
  FR_NAME_RE,
  DE_NAME_RE,
  IL_NAME_RE,
  KR_NAME_RE,
  IT_NAME_RE,
  SATELLITE_TIER,
  SATELLITE_LAYER_KEY,
  SATELLITE_COLORS,
  SATELLITE_LABELS,
  GROUP_KEY_TO_CATEGORY,
} from "../satelliteTypes";

// 為了 backward compat 把舊測試的 classifyChinaSatByName 包成輔助
const classifyChinaSatByName = (name: string) => classifyByCountryName(null, name) ?? "china_shiyan";

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
  it("16 個 category 都有 tier 與 layerKey", () => {
    const cats = Object.keys(SATELLITE_COLORS) as Array<keyof typeof SATELLITE_COLORS>;
    expect(cats.length).toBe(16); // CN 6 + TW 1 + 9 國
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
  it("USA/Japan/Russia 為 S, 歐韓 A, 印度 B", () => {
    expect(SATELLITE_TIER.usa).toBe("S");
    expect(SATELLITE_TIER.japan).toBe("S");
    expect(SATELLITE_TIER.russia).toBe("S");
    expect(SATELLITE_TIER.france).toBe("A");
    expect(SATELLITE_TIER.korea).toBe("A");
    expect(SATELLITE_TIER.india).toBe("B");
  });
});

describe("9 國 regex 與 classifyByCountryName", () => {
  it("IGS-OPTICAL → japan", () => {
    expect(classifyByCountryName(null, "IGS-OPTICAL 8")).toBe("japan");
    expect(JP_NAME_RE.test("IGS-RADAR 7")).toBe(true);
  });
  it("CARTOSAT / RISAT → india", () => {
    expect(classifyByCountryName(null, "CARTOSAT 3")).toBe("india");
    expect(IN_NAME_RE.test("RISat-2B")).toBe(true);
  });
  it("OFEQ → israel", () => {
    expect(classifyByCountryName(null, "OFEQ 16")).toBe("israel");
    expect(IL_NAME_RE.test("EROS B")).toBe(true);
  });
  it("KOMPSAT → korea", () => {
    expect(classifyByCountryName(null, "KOMPSAT 7")).toBe("korea");
    expect(KR_NAME_RE.test("KOMPSAT-3A")).toBe(true);
  });
  it("CSO / PLEIADES → france", () => {
    expect(classifyByCountryName(null, "CSO-3")).toBe("france");
    expect(FR_NAME_RE.test("PLEIADES NEO 5")).toBe(true);
  });
  it("SAR-LUPE / TERRASAR → germany", () => {
    expect(classifyByCountryName(null, "SAR-LUPE 3")).toBe("germany");
    expect(DE_NAME_RE.test("TerraSAR-X 1")).toBe(true);
  });
  it("COSMO-SKYMED → italy", () => {
    expect(classifyByCountryName(null, "COSMO-SKYMED 5")).toBe("italy");
    expect(IT_NAME_RE.test("COSMO-SkyMed 4")).toBe(true);
  });
  it("PERSONA → russia", () => {
    expect(classifyByCountryName(null, "PERSONA 3")).toBe("russia");
    expect(RU_NAME_RE.test("RESURS-DK 2")).toBe(true);
  });
  it("依 country 落點", () => {
    expect(classifyByCountryName("USA", "USA-313")).toBe("usa");
    expect(classifyByCountryName("Japan", "Random Japan Sat")).toBe("japan");
    expect(classifyByCountryName("Russia", "Cosmos 2580")).toBe("russia");
  });
  it("不認識 name 又無 country → null", () => {
    expect(classifyByCountryName(null, "Unknown XYZ")).toBeNull();
  });
});

describe("GROUP_KEY_TO_CATEGORY", () => {
  it("16 group key 全有對映", () => {
    expect(GROUP_KEY_TO_CATEGORY.YAOGAN).toBe("china_yaogan");
    expect(GROUP_KEY_TO_CATEGORY.TAIWAN).toBe("taiwan");
    expect(GROUP_KEY_TO_CATEGORY.USA).toBe("usa");
    expect(GROUP_KEY_TO_CATEGORY.JAPAN).toBe("japan");
    expect(GROUP_KEY_TO_CATEGORY.ISRAEL).toBe("israel");
    expect(GROUP_KEY_TO_CATEGORY.OTHER).toBe("other");
  });
});
