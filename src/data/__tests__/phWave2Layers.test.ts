/**
 * 菲律賓第 2 波補充（2026-11-14）：ph_stations 濾掉 LRT／MRT 重複站（甲案）、v2 檔營運狀態、LRT／MRT 機廠軌不畫、高速公路收費分類。
 * 用 Mapbox style-spec 的 featureFilter／expression 實際評估規格裡的表達式，驗到的就是送進 Mapbox 的東西。
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { expression, featureFilter } from "mapbox-gl/dist/style-spec/index.cjs";
import { readFileSync } from "node:fs";
import { PH_SPEC_BY_KEY, PH_STATION_STATUS, PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS, phCatOf } from "../phDataLayers";
import v2Index from "./__fixtures__/ph-stations-v2-index.json";

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

  it("PNR 官方站不受影響", () => {
    for (const n of [1, 6, 9, 16, 31]) {
      expect(passes(part.filter, { kind: "rail_station", source: "official", src_id: `pnrstation_20210201.${n}` })).toBe(true);
    }
  });
});

describe("phStations v2 檔（analytics #393）：未通車與誤標已在資料端排除、營運狀態", () => {
  const spec = PH_SPEC_BY_KEY.phStations;
  const part = spec.parts[0]!;
  type Row = { src_id: string; kind: string; source: string; status: string; region_code: string };
  const rows: Row[] = (v2Index.rows as string[][]).map(([src_id, kind, source, status, region_code]) => ({ src_id: src_id!, kind: kind!, source: source!, status: status!, region_code: region_code! }));
  const ids = new Set(rows.map((r) => r.src_id));
  // 未通車 37 站（analytics #390＋#391：Subway 15、MRT-7 10、NSCR 10、North Triangle Common 1、DOST 1）＋誤標 Mapaya
  const NOT_OPEN = [
    "osm:node/10542991478", "osm:node/12752311664", "osm:node/13478815689", "osm:node/13478815690", "osm:node/13564626500", "osm:node/13564639203",
    "osm:node/13564783062", "osm:node/13564783063", "osm:node/13564783064", "osm:node/13565942041", "osm:node/13565942044", "osm:node/13565942045",
    "osm:node/13571995040", "osm:node/13571995042", "osm:node/13571995044", "osm:node/13571995050", "osm:node/13571995052", "osm:node/13571995054",
    "osm:node/13571995056", "osm:node/13571995058", "osm:node/13571995062", "osm:node/13686694948", "osm:node/5285111766", "osm:node/5525578965",
    "osm:node/5728168799", "osm:node/6313750523", "osm:way/1109949377", "osm:way/1488753262", "osm:way/1521984289", "osm:way/564479403",
    "osm:way/801909044", "osm:way/801909052", "osm:way/802086678", "osm:way/802086682", "osm:way/802086688", "osm:way/802086692",
    "osm:way/992204947",
  ];
  const MAPAYA = "osm:node/14038418143";

  it("前端讀 v2 檔，fixture 與 lock 的 sha256 一致", () => {
    expect(spec.file).toBe("ph_stations_v2.pmtiles");
    const lock = JSON.parse(readFileSync("deploy/public-assets.lock.json", "utf8")) as { entries: { path: string; sha256: string }[] };
    expect(lock.entries.find((e) => e.path === v2Index.pmtiles)?.sha256).toBe(v2Index.pmtiles_sha256);
  });

  it("v2 不含未通車 37 站與 Mapaya", () => {
    expect(new Set(NOT_OPEN).size).toBe(37);
    expect(rows).toHaveLength(524);
    for (const id of [...NOT_OPEN, MAPAYA]) expect(ids.has(id)).toBe(false);
  });

  it("畫面筆數＝524 − 重複站 48（Anonas 已不在 v2）＝476；status 只有三種值", () => {
    const shown = rows.filter((r) => passes(part.filter, r));
    expect(PH_STATIONS_URBAN_RAIL_DUP_SRC_IDS.filter((id) => ids.has(id))).toHaveLength(48);
    expect(shown).toHaveLength(476);
    expect(spec.count).toBe(shown.length);
    const by = (st: string) => shown.filter((r) => r.status === st).length;
    expect([by("operating"), by("suspended"), by("unverified")]).toEqual([0, 32, 444]);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(Object.keys(PH_STATION_STATUS)));
    // 鐵路站涵蓋 3/18：NCR（13）、CALABARZON（04）、Bicol（05）
    expect([...new Set(shown.filter((r) => r.kind === "rail_station").map((r) => r.region_code))].sort()).toEqual(["04", "05", "13"]);
  });

  it("停駛站另成灰色一類；未查證不會被歸為停駛", () => {
    expect(evalStr(part.cat.expr, { kind: "rail_station", source: "official", status: "suspended" })).toBe("suspended");
    expect(phCatOf(spec, { kind: "rail_station", source: "official", status: "suspended" })?.id).toBe("suspended");
    expect(phCatOf(spec, { kind: "rail_station", source: "official", status: "unverified" })?.id).toBe("rail_official");
    expect(phCatOf(spec, { kind: "ferry_terminal", source: "osm", status: "unverified" })?.id).toBe("ferry_osm");
    expect(PH_STATION_STATUS.unverified!.zh).toBe("營運狀態未查證");
    expect(spec.fields.map((f) => f.prop)).toEqual(expect.arrayContaining(["status", "status_basis"]));
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
