/**
 * 色盤選單（R7，spec.md §5「色盤選單」）：圖層控制區裡一列色條，點開浮出 kepler 式長清單。
 *
 * - 清單用 portal 浮在 body 上（`--z-popover`），不在面板內展開 —— 面板有高度上限，
 *   行內展開會被面板底緣裁掉（原型稽核 design-audit §2）。下方空間不夠時改往上開。
 * - 主題：清單不在 `.lpc-theme` 底下，開啟時讀按鈕所在面板是否為淡色，套同一組 class。
 * - 色條同時畫暗／淡兩版，由 CSS 依主題顯示其中一版（色值是資料色，來自 `src/map/palettes.ts`）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import type { PaletteConfig, PaletteOption } from "../../state/layerParamsControls";
import { paletteById } from "../../map/palettes";
import "./paletteControl.css";

const GAP = 4;
const EDGE = 8;
const LIST_MAX_HEIGHT = 360;
const LIST_MIN_WIDTH = 220;

interface Placement {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

function gradient(colors: readonly string[]): string {
  return `linear-gradient(90deg, ${colors.join(", ")})`;
}

/** 暗／淡兩版色條；CSS 依 `.lpc-theme--light` 只顯示其中一版 */
function Ramp({ option }: { option: PaletteOption }) {
  const palette = paletteById(option.value);
  if (!palette) return null;
  return (
    <span className="pal-ramp" aria-hidden="true">
      <span className="pal-ramp-dark" style={{ background: gradient(palette.dark) }} />
      <span className="pal-ramp-light" style={{ background: gradient(palette.light) }} />
    </span>
  );
}

/**
 * 按鈕所在的容器若比彈出層高（手機底部抽屜 MobileBottomSheet 是 40），清單改用 modal 層，
 * 否則會被抽屜蓋住。同層靠 DOM 順序：portal 最後掛到 body，蓋在抽屜上。
 */
function inHighLayer(button: HTMLElement): boolean {
  const popover = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--z-popover"), 10) || 30;
  for (let el: HTMLElement | null = button.parentElement; el; el = el.parentElement) {
    const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
    if (Number.isFinite(z) && z > popover) return true;
  }
  return false;
}

function place(button: HTMLElement): Placement {
  const r = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(r.width, LIST_MIN_WIDTH), vw - EDGE * 2);
  const left = Math.min(Math.max(EDGE, r.left), vw - EDGE - width);
  const below = vh - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  if (below >= Math.min(LIST_MAX_HEIGHT, 240) || below >= above) {
    return { left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX_HEIGHT, below) };
  }
  return { left, width, bottom: vh - r.top + GAP, maxHeight: Math.min(LIST_MAX_HEIGHT, above) };
}

export function PaletteControl({ ctrl }: { ctrl: PaletteConfig }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [light, setLight] = useState(false);
  const [high, setHigh] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = ctrl.options.find((o) => o.value === ctrl.value) ?? ctrl.options[0];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const reposition = useCallback(() => {
    if (buttonRef.current) setPlacement(place(buttonRef.current));
  }, []);

  const toggle = () => {
    if (open) { close(false); return; }
    const button = buttonRef.current;
    if (!button) return;
    setLight(Boolean(button.closest(".lpc-theme--light")));
    setHigh(inHighLayer(button));
    setPlacement(place(button));
    setOpen(true);
  };

  // 開啟後把焦點放在目前選取的那一列
  useLayoutEffect(() => {
    if (!open) return;
    const selected = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? listRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // 點外面、捲動面板、改視窗大小：關閉或跟著按鈕移動
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      reposition();
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, close, reposition]);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (e.key === "Tab") { close(false); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)));
    items[next]?.focus();
  };

  const pick = (value: string) => {
    ctrl.onChange(value);
    close(true);
  };

  if (!current) return null;
  const isDefault = ctrl.value === ctrl.defaultValue;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="pal-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ctrl.label}：${current.label}`}
        title={`${ctrl.label}：${current.label}`}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); toggle(); } }}
      >
        <Ramp option={current} />
        <span className="pal-btn-name">{current.label}</span>
        <ChevronDown className="pal-btn-chev" size={12} strokeWidth={2} aria-hidden="true" data-open={open} />
      </button>
      {open && placement && createPortal(
        <div
          ref={listRef}
          className={`lpc-theme${light ? " lpc-theme--light" : ""} pal-pop${high ? " pal-pop--high" : ""}`}
          style={{ left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight }}
          onKeyDown={onListKey}
        >
          <div className="pal-list" role="listbox" aria-label={ctrl.label}>
            {ctrl.options.map((option) => {
              const selected = option.value === ctrl.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="pal-opt"
                  onClick={() => pick(option.value)}
                >
                  <Ramp option={option} />
                  <span className="pal-opt-name">
                    {option.label}
                    {option.value === ctrl.defaultValue && <span className="pal-opt-note">預設</span>}
                  </span>
                  <span className="pal-opt-mark" aria-hidden="true">
                    {selected && <Check size={12} strokeWidth={2.25} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pal-foot">
            <button
              type="button"
              className="lpc-btn"
              disabled={isDefault}
              onClick={() => pick(ctrl.defaultValue)}
            >
              <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
              還原預設
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
