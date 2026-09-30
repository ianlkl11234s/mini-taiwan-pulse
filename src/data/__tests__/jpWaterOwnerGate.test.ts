import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED } from "../../embed/embedWhitelist";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";
import { JP_WATER_PRIVATE_LAYER_KEYS } from "../jpWaterTypes";

// 2026-09-29 站主決定：日本水資源全國 8 層走站主限定（同土壤液化／BSS 橋梁），
// 不再列入連站主也鎖死的 RELEASE_HOLD_LAYERS；非站主仍由 GATED_LAYERS + 私人 Range API 擋下。
describe("日本水資源私人圖層：站主限定", () => {
  it("站主可解鎖：不在 RELEASE_HOLD_LAYERS", () => {
    expect(JP_WATER_PRIVATE_LAYER_KEYS.filter((key) => RELEASE_HOLD_LAYERS.has(key))).toEqual([]);
  });

  it("非站主上鎖：全部在 GATED_LAYERS，且不進 embed／URL 還原", () => {
    expect(JP_WATER_PRIVATE_LAYER_KEYS.filter((key) => !GATED_LAYERS.has(key))).toEqual([]);
    expect(JP_WATER_PRIVATE_LAYER_KEYS.filter((key) => EMBED_ALLOWED.has(key))).toEqual([]);
    for (const key of JP_WATER_PRIVATE_LAYER_KEYS) {
      expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${key}`).layers, key).toBeUndefined();
    }
  });

  it("manifest 標示 OWNER_ONLY 且只宣告私人資產", () => {
    for (const key of JP_WATER_PRIVATE_LAYER_KEYS) {
      const entry = LAYER_MANIFEST[key];
      expect(entry.topics, key).toContain("OWNER_ONLY");
      expect(entry.source.staticAssets?.every((asset) => asset.startsWith("PRIVATE_OWNER_ONLY:")), key).toBe(true);
    }
  });
});
