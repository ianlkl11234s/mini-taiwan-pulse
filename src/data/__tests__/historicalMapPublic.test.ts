import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS, THEMES } from "../../components/sidebar/layerCatalog";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";

// 古地圖（中研院臺灣百年歷史地圖）：2026-11-05 站主限定上線，2026-11-06 使用者決定改為公開。
// 圖磚本來就是公開外部來源，沒有私人 Range API；公開＝拿掉 manifest OWNER_ONLY（GATED_LAYERS 由它派生）。
const KEY = "historicalMapSinica" as const;
const THEME = "歷史底圖 Historical Basemaps";

describe("古地圖：公開", () => {
  it("不在 GATED_LAYERS／RELEASE_HOLD_LAYERS，manifest 沒有 OWNER_ONLY", () => {
    expect(GATED_LAYERS.has(KEY)).toBe(false);
    expect(RELEASE_HOLD_LAYERS.has(KEY)).toBe(false);
    expect(LAYER_MANIFEST[KEY].topics).not.toContain("OWNER_ONLY");
  });

  it("分享網址可還原", () => {
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY}`).layers).toEqual([KEY]);
  });

  it("歷史底圖主題對所有人顯示：古地圖（公開）＋1944 水域（站主限定，非站主上鎖）", () => {
    const theme = THEMES.find((t) => t.title === THEME)!;
    expect(theme.groups.flatMap((g) => g.layers.map((l) => l.key))).toEqual([KEY, "water1944Taipei"]);
  });
});
