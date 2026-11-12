/**
 * W6-5 點選查詢工具：開關、放／移接收點、關面板不關圖層、點擊仲裁（畫路線 > 點選查詢 > 其他 popup）、
 * 各族格子 popup 已停用、網格範圍外。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { layerVisibilityStore } from "../../state/layerVisibilityStore";
import { placeSoundReceiverAt, setSoundQueryTool, startRouteDrawing } from "../soundAtlasActions";
import { soundAtlasStore } from "../soundAtlasStore";
import { pointCellInfos } from "../grid/pointQuery";
import { LAYER_MANIFEST } from "../../data/layerManifest";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("點選查詢工具", () => {
  it("預設開；關掉只關工具，不動任何圖層開關、不清接收點", () => {
    soundAtlasStore.reset();
    expect(soundAtlasStore.get().queryTool).toBe(true);
    layerVisibilityStore.setBulk({ soundRain: true, soundComposite: true });
    placeSoundReceiverAt(121.5, 25.04);
    const before = JSON.stringify(layerVisibilityStore.getAll());
    setSoundQueryTool(false);
    expect(soundAtlasStore.get().queryTool).toBe(false);
    expect(JSON.stringify(layerVisibilityStore.getAll())).toBe(before);
    expect(soundAtlasStore.get().receiver).not.toBeNull();
    layerVisibilityStore.setBulk({ soundRain: false, soundComposite: false });
  });

  it("點地圖＝放／移接收點（高度沿用）；開工具會結束畫路線", () => {
    soundAtlasStore.reset();
    placeSoundReceiverAt(121.5, 25.04);
    soundAtlasStore.set({ receiver: { ...soundAtlasStore.get().receiver!, heightM: 4 } });
    placeSoundReceiverAt(121.6, 25.1);
    const r = soundAtlasStore.get().receiver!;
    expect([r.longitude, r.latitude, r.heightM]).toEqual([121.6, 25.1, 4]);
    setSoundQueryTool(false);
    startRouteDrawing();
    expect(soundAtlasStore.get().route.drawing).toBe(true);
    setSoundQueryTool(true);
    expect(soundAtlasStore.get().route.drawing).toBe(false);
  });

  it("面板的關閉鈕只呼叫 setSoundQueryTool(false)，不寫圖層開關（修正舊 closeAll）", () => {
    const code = strip(readFileSync("src/components/sound/SoundReceiverPanel.tsx", "utf8"));
    expect(code).not.toMatch(/layerVisibilityStore\.(setBulk|setVisibility)/);
    expect(code).toMatch(/onClose=\{closeTool\}/);
    expect(code).toMatch(/closeTool = \(\) => \{ setSoundQueryTool\(false\); setCollapsed\(true\); \}/);
    // 關掉後仍有「開啟點選查詢」可按
    expect(code).toMatch(/soundAtlas\.tool\.reopen/);
  });

  it("點擊仲裁：畫路線先、點選查詢次之；各族格子 picker 已移除", () => {
    const code = strip(readFileSync("src/hooks/useMapInteraction.ts", "utf8"));
    const iRoute = code.indexOf("sa.route.drawing) return");
    const iTool = code.indexOf("sa.queryTool && getSoundAtlasMap() === map");
    const iOther = code.indexOf("historicalFlightTrailsModule.get()");
    expect(iRoute).toBeGreaterThan(0);
    expect(iTool).toBeGreaterThan(iRoute);
    expect(iOther).toBeGreaterThan(iTool);
    expect(code).not.toMatch(/pickRainCell|pickRoadCell|pickPotentialCell|soundRainCell|soundRoadCell|soundPotentialCell/);
  });

  it("聲景網格圖層的 popup 都指向點選查詢（沒有 null 豁免）", () => {
    for (const k of ["soundComposite", "soundRain", "soundRoadTraffic", "soundAviation", "soundRail", "soundWindFoliage", "soundCoastalWave", "soundRiverWater"] as const) {
      const p = LAYER_MANIFEST[k].popup;
      expect(p, k).not.toBeNull();
      expect(([] as string[]).concat(p as string | string[]), k).toContain("soundPointQuery");
    }
  });

  it("沒有載入任何族 → 沒有格資訊（不畫成 0）", () => {
    expect(pointCellInfos({}, {}, 0, 0, null, 121.5, 25.04)).toEqual({});
  });
});
