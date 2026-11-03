/**
 * 地圖右鍵選單（design-system spec §5.44，B1 清單式）。
 * - 桌機：右鍵（沒拖曳的才算；右鍵拖曳仍是旋轉）。手機：長按 500 ms（移動 >8px 或多指取消）。
 * - 點的位置放一顆暫時藍點（DOM Marker），選單關閉就移除。
 * - 點外部、Esc、移動地圖都關閉。量測繪製中、拍攝模式（enabled=false）不開。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type MapMouseEvent } from "mapbox-gl";
import { Copy, Pentagon, Share2 } from "lucide-react";
import { useLocale } from "../state/localeStore";
import { formatLatLng, formatTwd97 } from "../map/coordinates";
import type { MeasureController } from "../map/measureController";
import { showTransientNotice } from "./TransientNotice";
import { LineSegmentIcon } from "./MeasureToolbar";
import "./mapMeasure.css";

interface Props {
  map: MapboxMap | null;
  measure: MeasureController;
  isDarkTheme: boolean;
  enabled: boolean;
  onShareLocation: (lng: number, lat: number) => void;
}

interface OpenState {
  lng: number;
  lat: number;
  /** 視窗座標（px） */
  x: number;
  y: number;
}

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;
const DRAG_PX = 4;
const MENU_OFFSET = 8;
const MENU_WIDTH = 264;

export function MapContextMenu({ map, measure, isDarkTheme, enabled, onShareLocation }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState<OpenState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const close = useCallback(() => setOpen(null), []);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // ── 開啟：右鍵（mapbox 已延到 mouseup 才發 contextmenu）與長按 ──
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    let rightDown: { x: number; y: number } | null = null;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number } | null = null;
    let longPressFired = false;

    const canOpen = () => enabledRef.current && !measure.getSnapshot().drawing;
    const openAt = (clientX: number, clientY: number) => {
      const rect = map.getCanvasContainer().getBoundingClientRect();
      const ll = map.unproject([clientX - rect.left, clientY - rect.top]);
      openedAt.current = performance.now();
      setOpen({ lng: ll.lng, lat: ll.lat, x: clientX, y: clientY });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) rightDown = { x: e.clientX, y: e.clientY };
    };
    const onContextMenu = (e: MapMouseEvent) => {
      const ev = e.originalEvent as MouseEvent;
      ev.preventDefault();
      cancelPress(); // Android 長按同時發 contextmenu：由這條路徑開，取消長按計時避免重開
      const down = rightDown;
      rightDown = null;
      // 右鍵拖曳旋轉：mouseup 位置離按下點太遠 → 不開
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > DRAG_PX) return;
      // Android 長按也會發 contextmenu：長按已開過就不重開
      if (performance.now() - openedAt.current < 800) return;
      if (!canOpen()) return;
      openAt(ev.clientX, ev.clientY);
    };

    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
    };
    const onTouchStart = (e: TouchEvent) => {
      cancelPress();
      longPressFired = false;
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) return;
      pressStart = { x: touch.clientX, y: touch.clientY };
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (!pressStart || !canOpen()) return;
        longPressFired = true;
        openAt(pressStart.x, pressStart.y);
      }, LONG_PRESS_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pressStart) return;
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch || Math.hypot(touch.clientX - pressStart.x, touch.clientY - pressStart.y) > MOVE_CANCEL_PX) cancelPress();
    };
    const onTouchEnd = (e: TouchEvent) => {
      cancelPress();
      // 長按開了選單：擋掉手指放開後補發的 click（避免觸發圖層 popup）
      if (longPressFired && e.cancelable) e.preventDefault();
      longPressFired = false;
    };

    container.addEventListener("mousedown", onMouseDown, true);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", cancelPress);
    map.on("contextmenu", onContextMenu);
    return () => {
      cancelPress();
      container.removeEventListener("mousedown", onMouseDown, true);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", cancelPress);
      map.off("contextmenu", onContextMenu);
    };
  }, [map, measure]);

  // 拍攝模式進入時關閉
  useEffect(() => {
    if (!enabled) close();
  }, [enabled, close]);

  // ── 開著時：藍點、關閉條件 ──
  useEffect(() => {
    if (!open || !map) return;
    const el = document.createElement("div");
    el.className = `map-ctx-pin${isDarkTheme ? "" : " map-ctx-pin--light"}`;
    const pin = new mapboxgl.Marker({ element: el }).setLngLat([open.lng, open.lat]).addTo(map);
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    map.on("movestart", close);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      pin.remove();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      map.off("movestart", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [open, map, isDarkTheme, close]);

  // ── 位置：點的右下 8px；超出視窗翻到左／上 ──
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const height = menuRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    // 手機 bottom sheet 蓋住畫面底部：可用高度扣掉它（--mobile-sheet-inset，由 MobileBottomSheet 寫入）
    const sheetInset = parseFloat(getComputedStyle(menuRef.current ?? document.documentElement).getPropertyValue("--mobile-sheet-inset")) || 0;
    const vh = window.innerHeight - sheetInset;
    let left = open.x + MENU_OFFSET;
    let top = open.y + MENU_OFFSET;
    if (left + MENU_WIDTH > vw - MENU_OFFSET) left = Math.max(MENU_OFFSET, open.x - MENU_OFFSET - MENU_WIDTH);
    if (top + height > vh - MENU_OFFSET) top = Math.max(MENU_OFFSET, open.y - MENU_OFFSET - height);
    setPos({ left, top });
  }, [open]);
  // 定位完成（visibility 由 hidden 轉 visible）後才把焦點放到第一項；hidden 時 focus 無效
  const placed = pos !== null;
  useEffect(() => {
    if (placed) menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus({ preventScroll: true });
  }, [placed, open]);

  if (!open) return null;

  const copy = async (text: string) => {
    close();
    try {
      await navigator.clipboard.writeText(text);
      showTransientNotice(t("contextMenu.copied"));
    } catch {
      showTransientNotice(t("contextMenu.copyFailed"));
    }
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
        : e.key === "ArrowDown" ? (i + 1) % items.length
          : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const point: [number, number] = [open.lng, open.lat];
  return (
    <div
      ref={menuRef}
      className={`map-ctx${isDarkTheme ? "" : " map-ctx--light"}`}
      role="menu"
      aria-label={t("contextMenu.label")}
      onKeyDown={onMenuKey}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos?.left ?? open.x + MENU_OFFSET, top: pos?.top ?? open.y + MENU_OFFSET, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="map-ctx__head">
        <span className="map-ctx__eyebrow">{t("contextMenu.thisLocation")}</span>
        <span className="map-ctx__coord">{formatLatLng(open.lat, open.lng)}</span>
      </div>
      <div className="map-ctx__sep" role="separator" />
      <button type="button" role="menuitem" className="map-ctx__item" onClick={() => copy(formatLatLng(open.lat, open.lng, 6))}>
        <Copy size={13} />{t("contextMenu.copyWgs84")}
      </button>
      <button type="button" role="menuitem" className="map-ctx__item" onClick={() => copy(formatTwd97(open.lng, open.lat))}>
        <Copy size={13} />{t("contextMenu.copyTwd97")}<span className="map-ctx__code">EPSG:3826</span>
      </button>
      <div className="map-ctx__sep" role="separator" />
      <button type="button" role="menuitem" className="map-ctx__item" onClick={run(() => measure.start("distance", point))}>
        <LineSegmentIcon size={13} />{t("contextMenu.measureDistance")}
      </button>
      <button type="button" role="menuitem" className="map-ctx__item" onClick={run(() => measure.start("area", point))}>
        <Pentagon size={13} />{t("contextMenu.measureArea")}
      </button>
      <div className="map-ctx__sep" role="separator" />
      <button type="button" role="menuitem" className="map-ctx__item" onClick={run(() => onShareLocation(open.lng, open.lat))}>
        <Share2 size={13} />{t("contextMenu.share")}
      </button>
    </div>
  );
}
