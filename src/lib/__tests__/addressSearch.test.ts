import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildAddressGazetteer, indexShardRoads, looksLikeAddress, normalizeAddressText, parseAddress,
  resolveShardTargets, searchShard, type AddressRoadsFile, type ShardRef,
} from "../addressSearch";
import type { PlaceIndexFile } from "../placeSearch";

const placeIndex = JSON.parse(readFileSync(new URL("../../data/placeSearchIndex.json", import.meta.url), "utf8")) as PlaceIndexFile;
const g = buildAddressGazetteer(placeIndex.places.map(([name, kind, parent]) => ({ name, kind, parent })));

/** 建置腳本（tw-address-geocoder pipelines/20 --emit-fixture）產生的同一份案例：兩邊解析必須一字不差 */
const fixture = JSON.parse(readFileSync(new URL("./fixtures/addressParseCases.json", import.meta.url), "utf8")) as {
  parse: { input: string; normalized: string; county: string | null; town: string | null; road: string; rest: string; complete: boolean }[];
  house_number: { input: string; key: string | null }[];
};

describe("與建置腳本共用的解析案例", () => {
  it.each(fixture.parse)("$input", (c) => {
    expect(normalizeAddressText(c.input)).toBe(c.normalized);
    expect(parseAddress(g, c.input)).toEqual({ county: c.county, town: c.town, road: c.road, rest: c.rest, complete: c.complete });
  });
});

describe("looksLikeAddress", () => {
  it("含路街段巷弄號或大道才算門牌查詢", () => {
    expect(looksLikeAddress("重慶南路一段")).toBe(true);
    expect(looksLikeAddress("縣民大道")).toBe(true);
    expect(looksLikeAddress("大安區")).toBe(false);
    expect(looksLikeAddress("台北車站")).toBe(false);
  });
});

const codeByKey = new Map([["台北市", "63000"], ["基隆市", "10017"], ["宜蘭縣", "10002"]]);
const SCALE = 100_000;
const shard = indexShardRoads({
  重慶南路一段: [["122號", 12151234, 2504000], ["122之1號", 12151240, 2504010], ["12號", 12151000, 2504500]],
  重慶南路二段: [["5號", 12151500, 2503000]],
});
const ref: ShardRef = { countyCode: "63000", county: "臺北市", town: "中正區", source: "gov", shard };

describe("searchShard", () => {
  it("完整門牌完全相符只回那一筆", () => {
    const hits = searchShard(ref, parseAddress(g, "臺北市中正區重慶南路１段122號5樓"), SCALE, 8);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "address", label: "臺北市中正區重慶南路一段122號", center: [121.51234, 25.04] });
  });

  it("門牌沒有時列出同號開頭的門牌，不猜座標", () => {
    const hits = searchShard(ref, parseAddress(g, "臺北市中正區重慶南路一段122之2號"), SCALE, 8);
    expect(hits).toEqual([]);
    const partial = searchShard(ref, parseAddress(g, "臺北市中正區重慶南路一段12"), SCALE, 8).map((h) => h.label);
    expect(partial).toEqual(["臺北市中正區重慶南路一段122號", "臺北市中正區重慶南路一段122之1號", "臺北市中正區重慶南路一段12號"]);
  });

  it("只打路名：回路段範圍（bbox），路名開頭相符的各段都列", () => {
    const hits = searchShard(ref, parseAddress(g, "臺北市中正區重慶南路"), SCALE, 8);
    expect(hits.map((h) => [h.kind, h.label])).toEqual([["road", "臺北市中正區重慶南路一段"], ["road", "臺北市中正區重慶南路二段"]]);
    expect(hits[0]!.bbox).toEqual([121.51, 25.04, 121.5124, 25.045]);
  });

  it("站主版保留來源標記", () => {
    const owner = indexShardRoads({ 重慶南路一段: [["9號", 12151000, 2504000, "t"]] });
    const hits = searchShard({ ...ref, source: "owner", shard: owner }, parseAddress(g, "臺北市中正區重慶南路一段9號"), SCALE, 8);
    expect(hits[0]).toMatchObject({ source: "owner", ownerTag: "t" });
  });
});

describe("resolveShardTargets", () => {
  it("縣市＋區齊全：直接一片", () => {
    const r = resolveShardTargets(g, "台北市中正區重慶南路一段122號", codeByKey, null, 4);
    expect(r.targets.map((t) => [t.countyCode, t.townKey])).toEqual([["63000", "中正區"]]);
  });

  it("沒寫縣市但有區名：同名區（臺北、基隆的中正區）都列", () => {
    const r = resolveShardTargets(g, "中正區重慶南路一段122號", codeByKey, null, 4);
    expect(r.targets.map((t) => t.countyCode).sort()).toEqual(["10017", "63000"]);
    expect(r.targets[0]!.parsed).toMatchObject({ road: "重慶南路1段", rest: "122號", complete: true });
  });

  it("只打路名：先要求路名索引，再依索引找區", () => {
    expect(resolveShardTargets(g, "重慶南路一段", codeByKey, null, 4)).toEqual({ targets: [], needsRoads: true });
    const roads: AddressRoadsFile = { v: 1, counties: { "63000": { 中正區: ["重慶南路一段"], 大安區: ["信義路三段"] }, "10002": { 宜蘭市: ["中山路"] } } };
    const r = resolveShardTargets(g, "重慶南路一段", codeByKey, roads, 4);
    expect(r.targets.map((t) => [t.countyCode, t.townKey])).toEqual([["63000", "中正區"]]);
  });
});
