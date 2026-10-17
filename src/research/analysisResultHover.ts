// I1 滑過（H1）：分析結果 feature 的游標旁一行提示「名稱＋主要數值」。
// 描邊由 analysisResultOverlay 的 feature-state `hover` 負責；這裡只有文字與 DOM。
import { researchResultPopupFacts, researchResultPopupTitle } from "./researchResultPopup";

export type AnalysisHoverLabel = { name: string; value: string | null };

/** Name + the first popup fact (style fact → 原始值 …), already unit-formatted via formatVizNumber. */
export function analysisHoverLabel(properties: Record<string, unknown>): AnalysisHoverLabel {
  const name = researchResultPopupTitle(properties);
  const value = researchResultPopupFacts(properties)[0]?.value ?? null;
  return { name, value };
}

/** Touch-first devices get no tooltip (spec I1). Without matchMedia (tests/SSR) assume a mouse. */
export function supportsAnalysisHover(win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== "function") return true;
  return win.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

const OFFSET_PX = 12;
/** Flip to the cursor's left/top side when the tip would overflow the map container. */
export function analysisHoverTipPosition(point: { x: number; y: number }, tip: { width: number; height: number }, container: { width: number; height: number }): { left: number; top: number } {
  const right = point.x + OFFSET_PX + tip.width > container.width;
  const below = point.y + OFFSET_PX + tip.height > container.height;
  return {
    left: Math.max(0, right ? point.x - OFFSET_PX - tip.width : point.x + OFFSET_PX),
    top: Math.max(0, below ? point.y - OFFSET_PX - tip.height : point.y + OFFSET_PX),
  };
}

export type AnalysisHoverTip = {
  show(point: { x: number; y: number }, label: AnalysisHoverLabel, light: boolean): void;
  hide(): void;
  destroy(): void;
};

/** Imperative DOM (not React state): mousemove must not re-render the connection panel. */
export function createAnalysisHoverTip(container: HTMLElement): AnalysisHoverTip {
  const root = document.createElement("div");
  root.className = "analysis-hover-tip";
  root.setAttribute("role", "tooltip");
  root.hidden = true;
  const name = document.createElement("span");
  name.className = "analysis-hover-tip__name";
  const value = document.createElement("span");
  value.className = "analysis-hover-tip__value";
  root.append(name, value);
  container.appendChild(root);
  return {
    show(point, label, light) {
      name.textContent = label.name;
      value.textContent = label.value ?? "";
      value.hidden = !label.value;
      root.classList.toggle("analysis-hover-tip--light", light);
      root.hidden = false;
      const position = analysisHoverTipPosition(point, { width: root.offsetWidth, height: root.offsetHeight }, { width: container.clientWidth, height: container.clientHeight });
      root.style.transform = `translate(${Math.round(position.left)}px, ${Math.round(position.top)}px)`;
    },
    hide() { root.hidden = true; },
    destroy() { root.remove(); },
  };
}
