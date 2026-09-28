/**
 * 開站畫面（W2 城市脈動＋M2 機關展開）的時間與版面規格。規格見 docs/design-system.md §5.33。
 *
 * 流程：loading（地圖未就緒）→ done（顯示「✓ 完成」停 doneHoldMs）→ leaving（遮罩淡出 fadeMs，
 * 同時 <html data-boot="enter"> 讓側欄／工具列／時間軸／標題從邊界彈入）→ 過 enterMs 後移除 data-boot。
 */
import { BOOT_CITIES, TAIWAN_OUTLINE } from "./taiwanOutline";

export type BootPhase = "loading" | "done" | "leaving" | "gone";

export const BOOT_TIMING = {
  /** 開頭台灣淡入的時間；城市脈動在這之後才開始 */
  introMs: 700,
  doneHoldMs: 400,
  fadeMs: 450,
  /** 元件彈入（0.85s）＋最後一個 rail 圖示延遲 0.7s（2026-09-29 使用者要求比初版慢約 0.5s） */
  enterMs: 1600,
} as const;

/** 使用者 2026-09-29 以調整工具定案的數值（docs/features/ui-consistency-audit-20260927/boot-w2-tuner.html） */
export const BOOT_LAYOUT = {
  /** 本島高度佔視窗高度（vh） */
  mainIslandVh: 19,
  /** 本島外框中心相對視窗中心的位移（vw／vh，正值往右／往下） */
  offsetXVw: 0,
  offsetYVh: -4.5,
  /** 城市點直徑，以 900px 高的視窗為準（隨視窗高度等比） */
  cityDotPxAt900: 5.8,
  rippleScale: 6,
  cycleS: 2.2,
  /** 品牌字與狀態列：本島下緣再往下的距離（vh） */
  footGapVh: 3.5,
} as const;

export interface BootGeometry {
  viewBox: string;
  svg: { left: string; top: string; width: string; height: string };
  footTop: string;
  footLeft: string;
  cityRadius: number;
}

/** 把本島外框中心放到（50vw + X, 50vh + Y），整組依本島高度等比縮放。 */
export function bootGeometry(layout = BOOT_LAYOUT): BootGeometry {
  const [x0, y0, x1, y1] = TAIWAN_OUTLINE.main;
  const mainH = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const pad = { x: 8, y: 4 };
  const u = layout.mainIslandVh / mainH; // 1 個 viewBox 單位 = u vh
  const centerY = 50 + layout.offsetYVh;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    viewBox: `${-pad.x} ${-pad.y} ${TAIWAN_OUTLINE.width + pad.x * 2} ${TAIWAN_OUTLINE.height + pad.y * 2}`,
    svg: {
      left: `calc(${50 + layout.offsetXVw}vw - ${r((cx + pad.x) * u)}vh)`,
      top: `${r(centerY - (cy + pad.y) * u)}vh`,
      width: `${r((TAIWAN_OUTLINE.width + pad.x * 2) * u)}vh`,
      height: `${r((TAIWAN_OUTLINE.height + pad.y * 2) * u)}vh`,
    },
    footTop: `${r(centerY + (TAIWAN_OUTLINE.height - cy) * u + layout.footGapVh)}vh`,
    footLeft: `${50 + layout.offsetXVw}vw`,
    // 900px 視窗時 1vh = 9px
    cityRadius: r(layout.cityDotPxAt900 / 2 / (u * 9)),
  };
}

export { BOOT_CITIES };

/** 開站元件進場狀態掛在 <html data-boot>，讓各元件只需標 data-boot-part，不必各自接 props。 */
export function setBootAttr(value: "wait" | "enter" | null): void {
  if (typeof document === "undefined") return;
  if (value) document.documentElement.dataset.boot = value;
  else delete document.documentElement.dataset.boot;
}
