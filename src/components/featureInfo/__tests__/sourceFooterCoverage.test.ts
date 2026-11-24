import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeatureInfoPanel } from "../../FeatureInfoPanel";
import { HEADER_LABELS } from "../registry";
import type { FeatureInfo } from "../../../types";
import baseline from "./sourceFooterPendingBaseline.json";

/**
 * popup 來源列 ratchet：每個 layerType 以「空屬性」渲染 FeatureInfoPanel，
 * 抓會顯示「來源資訊待補」的層。
 *
 * ⚠️ 空屬性 ≠ 正式站真的待補：多數層的 feature 自帶 source_org／source_url，
 * 實際點擊會顯示來源。基準清單的意思是「面板本身不補固定出處，全靠 feature 欄位」，
 * 其中哪些在正式資料也缺來源欄、真的待補，需逐層看資料確認（待修）。
 *
 * 2026-11-23 起圖層側（src/data/layerSourceInfo.ts）已有機關＋授權的 layerType，popup 不再掛來源列，
 * 只剩圖層側補不到的（popupSourceMode = full）會顯示「來源資訊待補」。
 *
 * 新增 layerType 出現在掃描結果時，兩條出路：
 *  1. 在 src/data/layerSourceInfo.data.ts 補該圖層的機關＋授權（首選）；
 *  2. 確認 feature 自帶 source_org／source_url 等欄位 → 加進 sourceFooterPendingBaseline.json。
 */

/** SSR 無法渲染（useSyncExternalStore 缺 getServerSnapshot）的面板，不納入掃描 */
const SSR_UNRENDERABLE = new Set(["busCrowdingSim", "busCrowdingSimVehicle", "freewayTdcsSim", "transitAccessGrid"]);
const PENDING = "來源資訊待補";

function render(layerType: string) {
  return renderToStaticMarkup(
    createElement(FeatureInfoPanel, { feature: { layerType, properties: {} } as FeatureInfo, onClose: () => {} }),
  );
}

describe("popup 來源列 ratchet", () => {
  const types = Object.keys(HEADER_LABELS).filter((t) => !SSR_UNRENDERABLE.has(t));
  const pending = types.filter((t) => render(t).includes(PENDING));
  const known = new Set<string>(baseline.pending);

  it("新增的 layerType 不得以空屬性顯示「來源資訊待補」", () => {
    const fresh = pending.filter((t) => !known.has(t));
    expect(fresh, `這些 layerType 會顯示「${PENDING}」：${fresh.join(", ")}（解法見本檔開頭註解）`).toEqual([]);
  });

  it("已修好的層要從基準移除（只進不退）", () => {
    const hit = new Set(pending);
    const fixed = [...known].filter((t) => !hit.has(t));
    expect(fixed, `這些已不再顯示待補，請從 sourceFooterPendingBaseline.json 移除：${fixed.join(", ")}`).toEqual([]);
  });

  it.each(["popCount", "h3Population", "jpMedicalAreasPrimary", "jpMedicalAreasSecondary", "jpMedicalAreasTertiary", "jpPopulationMesh1km", "fireIsochrone"])(
    "%s：固定出處已搬到圖層側，popup 不掛來源列",
    (layerType) => {
      const html = render(layerType);
      expect(html).not.toContain(PENDING);
      expect(html).not.toContain("fi-footer");
    },
  );
});
