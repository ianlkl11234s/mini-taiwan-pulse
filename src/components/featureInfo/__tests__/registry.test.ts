import { describe, it, expect } from "vitest";
import { PANEL_REGISTRY, HEADER_LABELS } from "../registry";

/**
 * popup registry 完整性 ratchet：
 * HEADER_LABELS 是 Record<FeatureInfo["layerType"], string>（型別強制全 key），
 * 用它當 layerType 全集，驗證 PANEL_REGISTRY 覆蓋。
 */

/** 自始沒有專屬 panel 的 layerType（popup 只顯示 header；維持歷史行為） */
const BASELINE_NO_PANEL = new Set(["groundwaterWell", "iotWraRiver", "iotWraStructure"]);

describe("featureInfo registry", () => {
  const allTypes = Object.keys(HEADER_LABELS);

  it("covers every layerType except the known baseline", () => {
    const missing = allTypes.filter(
      (t) => !(t in PANEL_REGISTRY) && !BASELINE_NO_PANEL.has(t),
    );
    expect(
      missing,
      `這些 layerType 沒有 popup panel：${missing.join(", ")} — 去對應 domain 檔寫 panel + registry 加一行`,
    ).toEqual([]);
  });

  it("baseline entries stay un-wired (ratchet 只進不退)", () => {
    const wired = [...BASELINE_NO_PANEL].filter((t) => t in PANEL_REGISTRY);
    expect(
      wired,
      `這些已接上 panel，請從 baseline 移除：${wired.join(", ")}`,
    ).toEqual([]);
  });

  it("every registry entry is a component (function)", () => {
    for (const [key, comp] of Object.entries(PANEL_REGISTRY)) {
      expect(typeof comp, `${key} 的 panel 不是函式元件`).toBe("function");
    }
  });
});
