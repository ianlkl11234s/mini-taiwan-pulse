/**
 * 工具列「比較」入口（design-system §5.45；站主 2026-11-24 決定 3：同一個入口，打開後選模式）。
 * 選單依 `COMPARE_MODES` 順序列出各種比較方式（之後新增的模式加在 compareStore，這裡自動多一列）；
 * 比較開著時最下面多一列「結束比較」。
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { Columns2 } from "lucide-react";
import { FONT_CJK, FONT_SIZE, RADIUS, Z_INDEX } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { COMPARE_MODES, compareStore, useCompareSelector, type CompareMode } from "../../state/compareStore";
import { ToolbarButton } from "./ToolbarButton";
import { getToolbarPalette } from "./toolbarTheme";

const MODE_TEXT = {
  slider: { label: "compare.modeSlider", hint: "compare.modeSliderHint" },
  countries: { label: "compare.modeCountries", hint: "compare.modeCountriesHint" },
} as const satisfies Record<CompareMode, { label: string; hint: string }>;

/** 點外面或按 Esc 關閉浮出選單 */
export function usePopoverDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref]);
}

export function CompareMenu({ isDarkTheme, onOpenMode }: {
  isDarkTheme: boolean;
  /** 選了某個模式（App 在這裡補齊並排的右側國家） */
  onOpenMode: (mode: CompareMode) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const palette = getToolbarPalette(isDarkTheme);
  const enabled = useCompareSelector((s) => s.enabled);
  const mode = useCompareSelector((s) => s.mode);
  usePopoverDismiss(containerRef, open, () => setOpen(false));

  const itemStyle = {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%",
    padding: "6px 10px", background: "transparent", border: "none", borderRadius: RADIUS.md,
    cursor: "pointer", fontFamily: FONT_CJK, textAlign: "left",
  } as const;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <ToolbarButton
        palette={palette}
        icon
        pressed={enabled}
        title={t(enabled ? "compare.toolbarOn" : "compare.toolbar")}
        onClick={() => setOpen((v) => !v)}
      >
        <Columns2 size={13} />
      </ToolbarButton>
      {open && (
        <div
          role="menu"
          aria-label={t("compare.modeMenu")}
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: Z_INDEX.popover, width: 232,
            background: palette.popupBg, border: `1px solid ${palette.popupBorder}`, borderRadius: RADIUS.xl,
            boxShadow: palette.shadow, padding: 4, fontFamily: FONT_CJK,
          }}
        >
          {COMPARE_MODES.map((option) => {
            const checked = enabled && mode === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => { onOpenMode(option); setOpen(false); }}
                style={{ ...itemStyle, background: checked ? palette.accentFaint : "transparent" }}
              >
                <span style={{ fontSize: FONT_SIZE.sm, fontWeight: 600, color: checked ? palette.accent : palette.textStrong }}>{t(MODE_TEXT[option].label)}</span>
                <span style={{ fontSize: FONT_SIZE.xs, color: palette.textMuted, lineHeight: 1.4 }}>{t(MODE_TEXT[option].hint)}</span>
              </button>
            );
          })}
          {enabled && (
            <>
              <div style={{ height: 1, background: palette.controlBorder, margin: "4px 2px" }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => { compareStore.setEnabled(false); setOpen(false); }}
                style={{ ...itemStyle, fontSize: FONT_SIZE.sm, color: palette.textStrong }}
              >
                {t("compare.close")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
