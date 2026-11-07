import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED } from "../../embed/embedWhitelist";
import { isLayerLocked } from "../../lib/layerGates";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";

// 1944 水域（臺北盆地）站主限定：衍生自 CC BY-NC 古地圖，靜態 GeoJSON；只擋介面與網址還原。
const KEY = "water1944Taipei" as const;

describe("1944 水域：站主限定", () => {
  it("manifest 標示 OWNER_ONLY，派生進 GATED_LAYERS；不在 RELEASE_HOLD（站主可開）", () => {
    expect(LAYER_MANIFEST[KEY].topics).toContain("OWNER_ONLY");
    expect(GATED_LAYERS.has(KEY)).toBe(true);
    expect(RELEASE_HOLD_LAYERS.has(KEY)).toBe(false);
  });

  it("非站主（未登入、一般會員、insider）上鎖，站主解鎖；動態名單尚未登記此層時仍鎖", () => {
    expect(isLayerLocked(KEY, null, null)).toBe(true);
    expect(isLayerLocked(KEY, "member", null)).toBe(true);
    expect(isLayerLocked(KEY, "insider", new Map())).toBe(true);
    expect(isLayerLocked(KEY, "owner", null)).toBe(false);
  });

  it("不能從分享網址還原、不進 embed", () => {
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY}`).layers).toBeUndefined();
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY},tourHeritage`).layers).toEqual(["tourHeritage"]);
    expect(EMBED_ALLOWED.has(KEY)).toBe(false);
  });
});
