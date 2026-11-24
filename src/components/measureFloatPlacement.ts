/**
 * 桌機浮動量測條（design-system spec §5.44）的擺放：以「地圖可用區」（`.measure-float` 容器，
 * 左＝側欄右緣、右＝右上元件共用的 right，Monitor split 時已扣掉 dock）為準，避開右上提示卡、popup、
 * AI 對話框、載入狀態條、Agent 活動卡與珊瑚警示等浮動卡片的實際外框。
 *
 * 規則（2026-11-23 站主拍板）：
 * 1. 品牌列下方那一列放得下單行量測條（避開卡片後）→ 盡量置中（擠時往左讓）。
 * 2. 放不下 → 往下排到擋住它的卡片下方，仍維持單行、完整文字。
 * 3. 連可用區全寬都放不下單行時才折行。
 */
import { useEffect, type RefObject } from "react";

export interface Box { left: number; top: number; right: number; bottom: number }

/** 要避開的浮動卡片；新增會疊在地圖上方的卡片時加 `data-measure-avoid` 屬性即可 */
export const MEASURE_AVOID_SELECTOR = ".country-hint, .loading-status, .research-activity, [data-measure-avoid]";

/** 與卡片保留的間距（px） */
const GAP = 12;

/**
 * 回傳量測條左上角（與 frame 同一座標系）。frame.top 是預設上緣；width／height 是量測條單行尺寸。
 * 找不到不重疊的位置時退回預設上緣置中（理論上不會發生：最後一個候選是所有卡片下方）。
 */
export function placeMeasureBar(frame: Box, width: number, height: number, obstacles: Box[]): { x: number; y: number } {
  const ideal = frame.left + (frame.right - frame.left - width) / 2;
  const minX = frame.left;
  const maxX = Math.max(frame.left, frame.right - width);
  const tops = [frame.top, ...obstacles.map((o) => o.bottom + GAP).filter((t) => t > frame.top)].sort((a, b) => a - b);
  for (const y of tops) {
    const blocked = obstacles
      .filter((o) => o.top < y + height + GAP && o.bottom + GAP > y && o.right > frame.left && o.left < frame.right)
      .map((o) => [o.left - GAP, o.right + GAP] as const);
    const candidates = [ideal, ...blocked.flatMap(([l, r]) => [l - width, r])]
      .map((x) => Math.min(maxX, Math.max(minX, x)));
    const free = candidates.filter((x) => blocked.every(([l, r]) => x + width <= l || x >= r));
    if (free.length) {
      const x = free.reduce((best, cur) => (Math.abs(cur - ideal) < Math.abs(best - ideal) ? cur : best));
      return { x, y };
    }
  }
  return { x: ideal, y: frame.top };
}

function boxOf(el: Element): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/**
 * 掛在 App 的 `.measure-float` 容器與其中的定位槽上：直接改 DOM（不觸發 App 重繪）。
 * 容器、量測條、卡片尺寸變動或卡片出現／消失時（rAF 節流）重算。
 */
export function useMeasureFloatPlacement(frameRef: RefObject<HTMLDivElement | null>, slotRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const frameEl = frameRef.current;
    const slot = slotRef.current;
    if (!enabled || !frameEl || !slot || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const observed = new Set<Element>();
    const resize = new ResizeObserver(() => schedule());
    const mutation = new MutationObserver(() => schedule());
    const observe = (el: Element) => { if (!observed.has(el)) { observed.add(el); resize.observe(el); } };

    function layout() {
      raf = 0;
      if (!frameEl || !slot) return;
      const bar = slot.firstElementChild as HTMLElement | null;
      if (!bar) { slot.style.visibility = "hidden"; return; }
      observe(frameEl);
      observe(bar);
      const frame = frameEl.getBoundingClientRect();
      // 先量單行寬度：取消折行，量完再決定要不要折
      slot.classList.remove("measure-float__slot--wrap");
      slot.style.maxWidth = "";
      const width = bar.offsetWidth;
      const available = frame.right - frame.left;
      const wrap = width > available;
      if (wrap) {
        slot.classList.add("measure-float__slot--wrap");
        slot.style.maxWidth = `${available}px`;
      }
      const obstacles: Box[] = [];
      document.querySelectorAll(MEASURE_AVOID_SELECTOR).forEach((el) => {
        if (slot.contains(el)) return;
        observe(el);
        const box = boxOf(el);
        if (box) obstacles.push(box);
      });
      const { x, y } = placeMeasureBar(
        { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom },
        Math.min(width, available),
        bar.offsetHeight,
        obstacles,
      );
      slot.style.left = `${Math.round(x - frame.left)}px`;
      slot.style.top = `${Math.round(y - frame.top)}px`;
      slot.style.visibility = "visible";
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(layout); }

    mutation.observe(document.body, { childList: true, subtree: true });
    layout();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [frameRef, slotRef, enabled]);
}
