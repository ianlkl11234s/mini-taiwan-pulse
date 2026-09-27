import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeatureInfoPanel } from "../../FeatureInfoPanel";
import type { FeatureInfo } from "../../../types";

/**
 * Phase B/D 的核心邏輯（eyebrow「群組 · 圖層名」對照表、中央 SourceFooter 白名單）
 * 只在 FeatureInfoPanel 這層組裝，其他測試都是直接 render 個別 *Panels.tsx 元件，
 * 從未真的載入過 FeatureInfoPanel.tsx（也連帶沒驗證過 layerCatalog 的 import chain
 * 能不能在測試環境正常載入）。這裡直接補三個 renderToStaticMarkup 案例。
 */
function renderPanel(feature: FeatureInfo) {
  return renderToStaticMarkup(
    createElement(FeatureInfoPanel, { feature, onClose: () => {} }),
  );
}

describe("FeatureInfoPanel", () => {
  it("一般已註冊圖層：eyebrow 顯示「群組 · 圖層名」，內容後掛中央 SourceFooter", () => {
    const html = renderPanel({
      layerType: "religionTemples",
      properties: {
        name: "測試宮廟",
        source_org: "內政部民政司",
        source_tier: 2,
        source_url: "https://example.test/temple.zip",
      },
    } as FeatureInfo);

    // religionTemples 在 layerCatalog 屬於「宗教 Religion」主題底下的「點位」子群組，
    // HEADER_LABELS.religionTemples = "寺廟" → eyebrow 應為「宗教 · 寺廟」。
    expect(html).toContain("宗教 · 寺廟");
    expect(html).toContain("測試宮廟");
    expect(html).toContain("內政部民政司");
    expect(html).toContain("原始下載頁");
    expect(html).not.toContain("來源資訊待補");
  });

  it("chatHighlight（AI 助手標記）：不掛任何 SourceFooter", () => {
    const html = renderPanel({
      layerType: "chatHighlight",
      properties: { label: "測試標記", lng: 121.5, lat: 25.05 },
    } as FeatureInfo);

    expect(html).toContain("測試標記");
    expect(html).not.toContain("來源");
  });

  it("osmBridgeCarriers（networkStructuresPanels 自訂 SourceRows）：中央版略過，不誤判成無來源", () => {
    const html = renderPanel({
      layerType: "osmBridgeCarriers",
      properties: {
        name: "測試承載線",
        osm_type: "way",
        osm_id: "123",
        geometry_role: "carrier_segment",
      },
    } as FeatureInfo);

    expect(html).toContain("測試承載線");
    expect(html).not.toContain("來源資訊待補");
  });
});
