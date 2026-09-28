import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { COLORS, FONT_CJK, FONT_SIZE, LIGHT, RADIUS, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { ToolbarButton } from "./ToolbarButton";
import type { ToolbarPalette } from "./toolbarTheme";

export interface MobileMoreMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** 開關類項目目前是否開啟（accent 字色 + aria-pressed） */
  active?: boolean;
  /** 右側附註（例：目前 3D／2D） */
  trailing?: ReactNode;
}

interface Props {
  palette: ToolbarPalette;
  isDarkTheme: boolean;
  items: readonly MobileMoreMenuItem[];
  /** 30×30 圖示按鈕樣式（手機標頭 M1） */
  buttonStyle: CSSProperties;
}

/** 手機標頭 M1 的「⋯ 更多」選單：向下靠右展開，點外面或 Esc 關閉。 */
export function MobileMoreMenu({ palette, isDarkTheme, items, buttonStyle }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <ToolbarButton palette={palette} icon title="更多" onClick={() => setOpen((v) => !v)} style={buttonStyle}>
        <MoreHorizontal size={16} />
      </ToolbarButton>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: Z_INDEX.popover,
            width: 190,
            padding: 4,
            background: isDarkTheme ? SURFACE.solid : LIGHT.surfaceSolid,
            border: `1px solid ${palette.borderPanel}`,
            borderRadius: RADIUS.xl,
            boxShadow: palette.shadow,
            fontFamily: FONT_CJK,
          }}
        >
          {items.map((item) => (
            <MenuRow key={item.key} item={item} palette={palette} textColor={isDarkTheme ? COLORS.textDefault : LIGHT.textDefault} onDone={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ item, palette, textColor, onDone }: { item: MobileMoreMenuItem; palette: ToolbarPalette; textColor: string; onDone: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      aria-pressed={item.active}
      onClick={() => {
        onDone();
        item.onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "7px 8px",
        border: "none",
        borderRadius: RADIUS.md,
        background: hover ? palette.controlBgHover : "transparent",
        color: item.active ? palette.accent : textColor,
        fontFamily: FONT_CJK,
        fontSize: FONT_SIZE.md,
        fontWeight: item.active ? 600 : 400,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {item.icon}
      <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      {item.trailing}
    </button>
  );
}
