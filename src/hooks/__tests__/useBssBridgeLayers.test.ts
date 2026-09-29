import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only validator.
import { featureFilter, validate } from "mapbox-gl/dist/style-spec/index.cjs";
import {
  BSS_BRIDGE_LINE_ROLES, BSS_BRIDGE_POINT_LAYER_ID, BSS_BRIDGE_PRIVATE_ENDPOINT, BSS_BRIDGE_PRIVATE_LAYER_KEYS,
  BSS_BRIDGE_SOURCE_ID, isBssBridgePrivateLayer,
} from "../../data/bssBridgeTypes";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { pointRadius } from "../../map/mapStyleScale";
import { buildBssBridgeLayers } from "../useBssBridgeLayers";

const HOOK_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../useBssBridgeLayers.ts");
const passes = (filter: unknown, properties: Record<string, unknown>) =>
  featureFilter(filter).filter({ zoom: 10 }, { type: 2, properties });

const STATE = {
  visibility: { bssNationalBridgePreview: true, bssNationalBridgePointsPreview: true },
  opacity: { bssNationalBridgePreview: 0.7, bssNationalBridgePointsPreview: 0.6 },
  controls: { lineClass: 0, lineQuality: 0, pointQuality: 0, pointScale: 1 },
  isDark: true,
};

describe("BSS 橋梁研究 owner-only PMTiles 契約", () => {
  it("只讀同源私人 endpoint，兩個 key 都是站主限定", () => {
    expect(BSS_BRIDGE_PRIVATE_ENDPOINT).toBe("/api/private-research/bss-bridge/tiles");
    expect(BSS_BRIDGE_PRIVATE_LAYER_KEYS.every((key) => GATED_LAYERS.has(key) && isBssBridgePrivateLayer(key))).toBe(true);
    const source = fs.readFileSync(HOOK_FILE, "utf8");
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toContain("import.meta.env");
  });

  it("11 個 style layer 通過 style-spec 驗證，且點擊接線涵蓋每個 layer id", () => {
    const layers = buildBssBridgeLayers(STATE);
    expect(layers).toHaveLength(BSS_BRIDGE_LINE_ROLES.length + 1);
    const errors = validate({ version: 8, sources: { [BSS_BRIDGE_SOURCE_ID]: { type: "vector", url: "mapbox://bss.test" } }, layers });
    expect(errors).toEqual([]);
    const clickable = new Set(GIS_LAYERS.flatMap((entry) => entry.layers));
    for (const layer of layers) expect(clickable.has(layer.id), layer.id).toBe(true);
  });

  it("點層固定 S 階半徑並跟大小滑桿，透明度與線層各自獨立", () => {
    const layers = buildBssBridgeLayers({ ...STATE, controls: { ...STATE.controls, pointScale: 2 } });
    const point = layers.find((layer) => layer.id === BSS_BRIDGE_POINT_LAYER_ID)!;
    expect((point.paint as Record<string, unknown>)["circle-radius"]).toBe(pointRadius("S", 2));
    expect((point.paint as Record<string, unknown>)["circle-opacity"]).toBe(0.6);
    for (const layer of layers.filter((item) => item.type === "line")) expect((layer.paint as Record<string, unknown>)["line-opacity"]).toBe(0.7);
  });

  it("品質與類別篩選以 filter 求值：預設全部、支持只放綁定 release 的紀錄", () => {
    const supported = { geometry_role: "point", stage1_status: "supported", stage1_release_id: "r1", feature_id: "a" };
    const pending = { geometry_role: "point", stage1_status: "unresolved", stage1_release_id: "r1", feature_id: "b" };
    const noRelease = { geometry_role: "point", stage1_status: "supported", stage1_release_id: "", feature_id: "c" };
    const at = (pointQuality: number) => buildBssBridgeLayers({ ...STATE, controls: { ...STATE.controls, pointQuality } }).find((layer) => layer.id === BSS_BRIDGE_POINT_LAYER_ID)!.filter;
    expect([supported, pending, noRelease].map((p) => passes(at(0), p))).toEqual([true, true, true]);
    expect([supported, pending, noRelease].map((p) => passes(at(1), p))).toEqual([true, false, false]);
    expect([supported, pending, noRelease].map((p) => passes(at(2), p))).toEqual([false, true, true]);
    const original = buildBssBridgeLayers({ ...STATE, controls: { ...STATE.controls, lineClass: 2 } }).find((layer) => layer.id === "bss-national-bridge-preview-original-direction-line")!.filter;
    expect(passes(original, { geometry_role: "original_direction_line", facility_class_candidate: "road_elevated_or_expressway_review" })).toBe(true);
    expect(passes(original, { geometry_role: "original_direction_line", facility_class_candidate: "road_unresolved" })).toBe(false);
  });
});
