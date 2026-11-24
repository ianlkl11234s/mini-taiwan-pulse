import { describe, expect, it } from "vitest";
import { parseSiteStudyMeta, prepareSiteStudyFeatures } from "../siteStudyMLoader";
import { SITE_STUDY_M_NEUTRAL, siteStudyColor } from "../siteStudyMTypes";
import { mergeSiteStudyFeatures } from "../../hooks/useSiteStudyMLayer";
import { siteStudyOtherNames } from "../../components/featureInfo/siteStudyPanels";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

// 測試資料全部自編（類型甲／類型乙），不含任何實際資料內容。
const square: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[121, 25], [121.01, 25], [121.01, 25.01], [121, 25.01], [121, 25]]] };
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

describe("設施研究 M：檔案內容正規化", () => {
  it("顏色只接受 hex，其餘退回中性灰", () => {
    expect(siteStudyColor("#1a2b3c")).toBe("#1a2b3c");
    expect(siteStudyColor("#abc")).toBe("#abc");
    for (const bad of ["red", "url(x)", "", null, undefined, 12]) expect(siteStudyColor(bad)).toBe(SITE_STUDY_M_NEUTRAL);
  });

  it("meta.legend 逐欄檢查：沒有 label 的列略過、count 不是數字記為 null", () => {
    const meta = parseSiteStudyMeta({
      title: "標題", built: "2026-01-01", note: 5,
      legend: [{ key: "a", label: "類型甲", color: "#112233", count: 3 }, { key: "b", label: "類型乙", color: "bad", count: "7" }, { key: "c" }, null],
    });
    expect(meta).toEqual({
      title: "標題", built: "2026-01-01", note: "",
      legend: [{ key: "a", label: "類型甲", color: "#112233", count: 3 }, { key: "b", label: "類型乙", color: SITE_STUDY_M_NEUTRAL, count: null }],
    });
    expect(parseSiteStudyMeta(undefined).legend).toEqual([]);
  });

  it("面另外產生落在面內的代表點；點與線不產生；沒有幾何的略過", () => {
    const out = prepareSiteStudyFeatures(fc([
      { type: "Feature", geometry: square, properties: { name: "甲地", color: "#112233" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25.05] }, properties: { name: "乙地" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[121, 25], [121.1, 25.1]] }, properties: null },
      { type: "Feature", geometry: null as unknown as GeoJSON.Geometry, properties: { name: "無座標" } },
    ]), "sites");
    expect(out.map((f) => [f.geometry.type, f.properties?._rep ?? 0, f.properties?._part])).toEqual([
      ["Polygon", 0, "sites"], ["Point", 1, "sites"], ["Point", 0, "sites"], ["LineString", 0, "sites"],
    ]);
    const rep = out[1]!;
    expect(rep.properties).toMatchObject({ name: "甲地", color: "#112233" });
    const [lng, lat] = (rep.geometry as GeoJSON.Point).coordinates as [number, number];
    expect(lng).toBeGreaterThan(121); expect(lng).toBeLessThan(121.01);
    expect(lat).toBeGreaterThan(25); expect(lat).toBeLessThan(25.01);
    expect(out[2]!.properties?.color).toBe(SITE_STUDY_M_NEUTRAL);
  });

  it("併成同一個 source 時參考資料排前面（畫在主資料下方）；沒開參考資料就不帶", () => {
    const sites = prepareSiteStudyFeatures(fc([{ type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: {} }]), "sites");
    const overlays = prepareSiteStudyFeatures(fc([{ type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: {} }]), "overlays");
    expect(mergeSiteStudyFeatures(sites, overlays).features.map((f) => f.properties?._part)).toEqual(["overlays", "sites"]);
    expect(mergeSiteStudyFeatures(sites, null).features.map((f) => f.properties?._part)).toEqual(["sites"]);
  });

  it("其他名稱：去掉與標題相同者與重複，其餘用頓號接", () => {
    expect(siteStudyOtherNames("甲地|甲地舊名| 甲地別名 |甲地舊名", "甲地")).toBe("甲地舊名、甲地別名");
    expect(siteStudyOtherNames("甲地", "甲地")).toBe("");
    expect(siteStudyOtherNames(null, "甲地")).toBe("");
  });
});

describe("設施研究 M：overlayRegistry 樣式只讀 color 與 _part", () => {
  const config = OVERLAY_REGISTRY.find((c) => c.id === "siteStudyM")!;

  it("四個子圖層；代表點只畫到 z11", () => {
    expect(config.dynamicData).toBe(true);
    expect(config.layers.map((l) => [l.suffix, l.type, l.maxzoom ?? null])).toEqual([
      ["fill", "fill", null], ["outline", "line", null], ["rep", "circle", 11], ["circle", "circle", null],
    ]);
  });

  it("paint 與 filter 引用的資料欄位只有 color／_part／_rep（沒有寫死任何類別值）", () => {
    const fields = new Set<string>();
    const walk = (v: unknown) => {
      if (!Array.isArray(v)) return;
      if (v[0] === "get" && typeof v[1] === "string") fields.add(v[1]);
      v.forEach(walk);
    };
    for (const layer of config.layers) {
      for (const isDark of [true, false]) Object.values(layer.paint(isDark, undefined)).forEach(walk);
      walk(typeof layer.filter === "function" ? layer.filter(undefined) : layer.filter);
    }
    expect([...fields].sort()).toEqual(["_part", "_rep", "color"]);
  });

  it("參考資料比主資料淡，透明度滑桿同時作用在兩者", () => {
    const fill = config.layers.find((l) => l.suffix === "fill")!;
    const at = (v: number) => fill.paint(false, { siteStudyMOpacity: v })["fill-opacity"] as [string, unknown, number, number];
    const [, , reference, main] = at(0.85);
    expect(reference).toBeLessThan(main);
    expect(at(0.425)[3]).toBeCloseTo(main / 2);
    expect(at(0.425)[2]).toBeCloseTo(reference / 2);
  });
});
