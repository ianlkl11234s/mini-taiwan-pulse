import { useEffect, useRef, useState } from "react";
import { FONT_CJK, RADIUS } from "../../styles/designTokens";
import { MAP_STYLES } from "../StyleSelector";
import { ToolbarButton } from "./ToolbarButton";
import { getToolbarPalette, type ToolbarPalette } from "./toolbarTheme";

// 中文名稱與縮圖漸層只用於這顆按鈕的視覺展示；實際套用的底圖 URL 仍出自
// StyleSelector.tsx 的 MAP_STYLES（單一事實來源），這裡只是依 id 疊一層中文標籤。
const CN_LABEL: Record<string, string> = {
  black: "純黑",
  dark: "暗色",
  light: "淡色",
  satellite: "衛星",
  "satellite-streets": "衛星街道",
  "nav-night": "夜間導航",
  streets: "街道",
};

const GRADIENT: Record<string, string> = {
  black: "linear-gradient(135deg,#000 0 60%,#111 60%)",
  dark: "linear-gradient(135deg,#262a33 0 55%,#3a3f4b 55% 58%,#262a33 58%)",
  light: "linear-gradient(135deg,#eef0f3 0 55%,#d5d9df 55% 58%,#eef0f3 58%)",
  satellite: "radial-gradient(circle at 30% 40%,#3f5a36,#27361f 60%,#1d3040)",
  "satellite-streets":
    "linear-gradient(90deg,transparent 46%,#f5d77a 46% 54%,transparent 54%),radial-gradient(circle at 30% 40%,#3f5a36,#27361f 60%,#1d3040)",
  "nav-night": "linear-gradient(135deg,#0e1a2b 0 55%,#2c5a8a 55% 58%,#0e1a2b 58%)",
  streets: "linear-gradient(135deg,#f4efe6 0 55%,#f7c96b 55% 58%,#f4efe6 58%)",
};

const OPTIONS = MAP_STYLES.map((s) => ({
  id: s.id,
  label: CN_LABEL[s.id] ?? s.name,
  gradient: GRADIENT[s.id] ?? "linear-gradient(135deg,#333,#555)",
}));

interface Props {
  selected: string;
  onChange: (id: string) => void;
  isDarkTheme: boolean;
  showLabels: boolean;
  onToggleLabels: () => void;
}

/** T2 工具列的底圖控制（B3：純圖示 + 色點，展開為 7 格縮圖 + 顯示地名開關）。 */
export function BasemapMenu({ selected, onChange, isDarkTheme, showLabels, onToggleLabels }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const palette = getToolbarPalette(isDarkTheme);
  const current = OPTIONS.find((o) => o.id === selected) ?? OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <ToolbarButton palette={palette} icon title={`底圖：${current.label}`} onClick={() => setOpen((v) => !v)}>
        <span style={{ position: "relative", display: "inline-flex", width: 13, height: 13 }}>
          <MapGlyph />
          <span
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              width: 7,
              height: 7,
              borderRadius: RADIUS.sm,
              border: `1px solid ${palette.surfaceBg}`,
              background: current.gradient,
            }}
          />
        </span>
      </ToolbarButton>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 30,
            background: palette.popupBg,
            border: `1px solid ${palette.popupBorder}`,
            borderRadius: RADIUS.xl,
            boxShadow: palette.shadow,
            padding: 4,
            fontFamily: FONT_CJK,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 52px)", gap: 6, padding: 6 }}>
            {OPTIONS.map((o) => {
              const isSelected = o.id === selected;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT_CJK,
                    fontSize: 9.5,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? palette.accent : palette.textMuted,
                  }}
                >
                  <i
                    style={{
                      display: "block",
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 5,
                      border: `1px solid ${palette.controlBorder}`,
                      outline: isSelected ? `2px solid ${palette.accent}` : "none",
                      outlineOffset: 1,
                      background: o.gradient,
                    }}
                  />
                  {o.label}
                </button>
              );
            })}
          </div>
          <div style={{ height: 1, background: palette.controlBorder, margin: "4px 2px" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "5px 8px",
              fontSize: 11,
              color: palette.textStrong,
            }}
          >
            顯示地名
            <MiniSwitch on={showLabels} onToggle={onToggleLabels} palette={palette} />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniSwitch({ on, onToggle, palette }: { on: boolean; onToggle: () => void; palette: ToolbarPalette }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="顯示地名"
      onClick={onToggle}
      style={{
        position: "relative",
        width: 20,
        height: 11,
        borderRadius: RADIUS.pill,
        border: "none",
        cursor: "pointer",
        padding: 0,
        background: on ? palette.accent : palette.controlBorder,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 1,
          left: on ? 10 : 1,
          width: 9,
          height: 9,
          borderRadius: RADIUS.full,
          background: on ? "#fff" : palette.textStrong,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function MapGlyph() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
