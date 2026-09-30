import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED } from "../../embed/embedWhitelist";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";
import { SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS } from "../soilLiquefactionTypes";

// 土壤液化 8 層走站主限定（同日本水資源／BSS 橋梁）：站主可解鎖，
// 非站主由 GATED_LAYERS 上鎖（側欄鎖頭、URL／embed 不可還原）＋私人 Range API 擋資料。
describe("土壤液化私人圖層：站主限定", () => {
  it("站主可解鎖：不在 RELEASE_HOLD_LAYERS", () => {
    expect(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.filter((key) => RELEASE_HOLD_LAYERS.has(key))).toEqual([]);
  });

  it("非站主上鎖：全部在 GATED_LAYERS，且不進 embed／URL 還原", () => {
    expect(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.filter((key) => !GATED_LAYERS.has(key))).toEqual([]);
    expect(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.filter((key) => EMBED_ALLOWED.has(key))).toEqual([]);
    for (const key of SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS) {
      expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${key}`).layers, key).toBeUndefined();
    }
  });

  it("manifest 標示 OWNER_ONLY", () => {
    for (const key of SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS) {
      expect(LAYER_MANIFEST[key].topics, key).toContain("OWNER_ONLY");
    }
  });
});
