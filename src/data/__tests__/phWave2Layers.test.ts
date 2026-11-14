/**
 * 菲律賓第 2 波補充（2026-11-14）：ph_stations 濾掉 LRT／MRT 重複站（甲案）、LRT／MRT 機廠軌不畫、高速公路收費分類。
 * 用 Mapbox style-spec 的 featureFilter／expression 實際評估規格裡的表達式，驗到的就是送進 Mapbox 的東西。
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { expression, featureFilter } from "mapbox-gl/dist/style-spec/index.cjs";
import { PH_SPEC_BY_KEY, PH_STATIONS_NOT_OPEN_SRC_IDS, PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS, phCatOf } from "../phDataLayers";

type Props = Record<string, unknown>;
const passes = (filter: unknown, properties: Props) =>
  featureFilter(filter).filter({ zoom: 14 }, { type: 1, properties, geometry: [] }) as boolean;
const evalStr = (expr: unknown, properties: Props) => {
  const parsed = expression.createExpression(expr);
  expect(parsed.result).toBe("success");
  return parsed.value.evaluate({ zoom: 14 }, { type: 1, properties, geometry: [] }) as string;
};

describe("phStations：濾掉 LRT／MRT 重複站（第 2 波甲案）", () => {
  const part = PH_SPEC_BY_KEY.phStations.parts[0]!;

  it("清單是 49 個 OSM 鐵路站、不重複、不含 PNR 官方站", () => {
    expect(PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS).toHaveLength(49);
    expect(new Set(PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS).size).toBe(49);
    for (const id of PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS) expect(id).toMatch(/^osm:(node|way|relation)\/\d+$/);
  });

  it("filter 排除清單內的站，保留 PNR 官方站、其他 OSM 鐵路站與渡輪碼頭", () => {
    expect(part.filter).toBeDefined();
    // LRT-1 Fernando Poe Jr.（way/402882918）、MRT-3 North Avenue（way/222628892）
    expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id: "osm:way/402882918" })).toBe(false);
    expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id: "osm:way/222628892" })).toBe(false);
    // PNR 官方 Blumentritt（距 LRT-1 Blumentritt 96 m，仍保留）
    expect(passes(part.filter, { kind: "rail_station", source: "official", src_id: "pnrstation_20210201.6" })).toBe(true);
    // OSM 的 PNR 南線車站（Lucena）、渡輪碼頭
    expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id: "osm:node/11328817170" })).toBe(true);
    expect(passes(part.filter, { kind: "ferry_terminal", source: "osm", src_id: "osm:node/1" })).toBe(true);
  });

  it("未通車 37 站（analytics #390＋#391）全部被擋掉，與重複站清單只交集 Anonas 1 站", () => {
    expect(PH_STATIONS_NOT_OPEN_SRC_IDS).toHaveLength(37);
    expect(new Set(PH_STATIONS_NOT_OPEN_SRC_IDS).size).toBe(37);
    for (const src_id of PH_STATIONS_NOT_OPEN_SRC_IDS) {
      expect(src_id).toMatch(/^osm:(node|way|relation)\/\d+$/);
      expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id })).toBe(false);
    }
    const dup = new Set<string>(PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS);
    expect(PH_STATIONS_NOT_OPEN_SRC_IDS.filter((id) => dup.has(id))).toEqual(["osm:node/13478815690"]);
  });

  it("NSCR 北段 10 站（Valenzuela–San Fernando，analytics #391）被擋掉", () => {
    const nscr = ["osm:way/801909052", "osm:way/992204947", "osm:way/801909044", "osm:way/802086692", "osm:way/802086688",
      "osm:way/802086682", "osm:way/802086678", "osm:way/1488753262", "osm:way/1521984289", "osm:node/10542991478"];
    for (const src_id of nscr) {
      expect(PH_STATIONS_NOT_OPEN_SRC_IDS as readonly string[]).toContain(src_id);
      expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id })).toBe(false);
    }
  });

  it("PNR 官方站不受影響", () => {
    for (const n of [1, 6, 9, 16, 31]) {
      expect(passes(part.filter, { kind: "rail_station", source: "official", src_id: `pnrstation_20210201.${n}` })).toBe(true);
    }
  });

  it("圖層筆數＝562 − 兩份清單聯集（49＋37−1＝85）＝477", () => {
    const union = new Set<string>([...PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS, ...PH_STATIONS_NOT_OPEN_SRC_IDS]);
    expect(union.size).toBe(85);
    expect(PH_SPEC_BY_KEY.phStations.count).toBe(562 - union.size);
  });
});

describe("phUrbanRail：機廠軌不畫、依線別分色", () => {
  const spec = PH_SPEC_BY_KEY.phUrbanRail;
  const tracks = spec.parts.find((p) => p.sourceLayer === "tracks")!;

  it("service=yard 的軌道被濾掉，營運線與渡線保留", () => {
    expect(passes(tracks.filter, { name: "LRT Line 1", service: "yard" })).toBe(false);
    expect(passes(tracks.filter, { service: "yard" })).toBe(false);
    expect(passes(tracks.filter, { name: "LRT Line 1" })).toBe(true);
    expect(passes(tracks.filter, { service: "crossover" })).toBe(true);
  });

  it("不畫 routes（與軌道重疊）", () => {
    expect(spec.parts.map((p) => p.sourceLayer).sort()).toEqual(["stations", "tracks"]);
  });

  it("軌道用 name、車站用 line_name 分色；表達式與 JS 版一致", () => {
    const station = { name: "Recto", line_name: "LRT Line 2" };
    const track = { name: "MRT Line 3" };
    expect(evalStr(tracks.cat.expr, station)).toBe("LRT Line 2");
    expect(evalStr(tracks.cat.expr, track)).toBe("MRT Line 3");
    expect(phCatOf(spec, station)?.id).toBe("lrt2");
    expect(phCatOf(spec, track)?.id).toBe("mrt3");
    expect(phCatOf(spec, { service: "crossover" })).toBeUndefined();
  });
});

describe("phExpressways：toll 未標≠免費", () => {
  const spec = PH_SPEC_BY_KEY.phExpressways;
  const part = spec.parts[0]!;

  it("toll yes／no／未標 三類，表達式與 JS 版一致", () => {
    for (const [props, id] of [[{ toll: "yes" }, "toll"], [{ toll: "no" }, "free"], [{}, "untagged"]] as const) {
      expect(evalStr(part.cat.expr, props)).toBe(part.cat.js(props));
      expect(phCatOf(spec, props)?.id).toBe(id);
    }
  });

  it("toll 未標時彈窗補一句「不等於免費」，路線編號是第一個欄位", () => {
    expect(spec.popupNotes.filter((n) => n.when?.({}))).toHaveLength(1);
    expect(spec.popupNotes.filter((n) => n.when?.({ toll: "yes" }))).toHaveLength(0);
    expect(spec.fields[0]!.prop).toBe("ref");
  });
});
