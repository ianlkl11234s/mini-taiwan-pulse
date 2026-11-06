import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS, THEMES } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED } from "../../embed/embedWhitelist";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";

// 古地圖（中研院臺灣百年歷史地圖）站主限定：圖磚是公開外部來源，只擋介面與網址還原，不需私人 Range API。
const KEY = "historicalMapSinica" as const;
const THEME = "歷史底圖 Historical Basemaps";

describe("古地圖：站主限定", () => {
  it("站主可解鎖：不在 RELEASE_HOLD_LAYERS；非站主上鎖：在 GATED_LAYERS，不進 embed／URL 還原", () => {
    expect(RELEASE_HOLD_LAYERS.has(KEY)).toBe(false);
    expect(GATED_LAYERS.has(KEY)).toBe(true);
    expect(EMBED_ALLOWED.has(KEY)).toBe(false);
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY}`).layers).toBeUndefined();
  });

  it("manifest 標示 OWNER_ONLY", () => {
    expect(LAYER_MANIFEST[KEY].topics).toContain("OWNER_ONLY");
  });

  it("歷史底圖主題只有這一層；主題對所有人顯示，非站主由列鎖頭擋（2026-11-06 起不再整個隱藏）", () => {
    const theme = THEMES.find((t) => t.title === THEME)!;
    expect(theme.groups.flatMap((g) => g.layers.map((l) => l.key))).toEqual([KEY]);
  });
});
