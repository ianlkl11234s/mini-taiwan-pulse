import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { FONT_CJK, RADIUS, Z_INDEX } from "../../styles/designTokens";
import { LOCALES, SUPPORTED_LOCALES, type Locale } from "../../i18n/locales";
import { localeStore, useLocale } from "../../state/localeStore";
import { ToolbarButton } from "./ToolbarButton";
import { getToolbarPalette, type ToolbarPalette } from "./toolbarTheme";

interface Props {
  isDarkTheme: boolean;
}

/**
 * 桌機工具列的語言選單：單顆圖示鈕（照 BasemapMenu 的 popover 做法）＋ 中文／EN／日本語。
 * 位置在帳號前、底圖之後的右側群組（spec §5.17 新增項）；手機改用 `LanguageSegmented`（收進 ⋯ 選單）。
 */
export function LanguageMenu({ isDarkTheme }: Props) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const palette = getToolbarPalette(isDarkTheme);

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
      <ToolbarButton palette={palette} icon title={t("language.label")} onClick={() => setOpen((v) => !v)}>
        <Languages size={13} />
      </ToolbarButton>
      {open && (
        <div
          role="menu"
          aria-label={t("language.label")}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: Z_INDEX.popover,
            minWidth: 96,
            background: palette.popupBg,
            border: `1px solid ${palette.popupBorder}`,
            borderRadius: RADIUS.xl,
            boxShadow: palette.shadow,
            padding: 4,
            fontFamily: FONT_CJK,
          }}
        >
          {SUPPORTED_LOCALES.map((code) => (
            <LocaleOption
              key={code}
              code={code}
              selected={code === locale}
              palette={palette}
              onSelect={() => {
                localeStore.set(code);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LocaleOption({ code, selected, palette, onSelect }: { code: Locale; selected: boolean; palette: ToolbarPalette; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      lang={LOCALES[code].htmlLang}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "6px 10px",
        border: "none",
        borderRadius: RADIUS.md,
        background: selected ? palette.accentFaint : hover ? palette.controlBgHover : "transparent",
        color: selected ? palette.accent : palette.textStrong,
        fontFamily: FONT_CJK,
        fontSize: 11,
        fontWeight: selected ? 600 : 400,
        textAlign: "left",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {LOCALES[code].label}
    </button>
  );
}

/**
 * 分段控制版（spec §5.8 工具列版：高 26、padding 2、gap 2、圓角 5；3 個互斥選項）。
 * 手機 ⋯ 選單使用；各按鈕等寬，避免切換時寬度跳動（§5.27）。
 */
export function LanguageSegmented({ palette }: { palette: ToolbarPalette }) {
  const { locale, t } = useLocale();
  return (
    <div role="group" aria-label={t("language.label")} style={{ display: "flex", height: 26, padding: 2, gap: 2, borderRadius: 5, background: palette.controlBg, fontFamily: FONT_CJK }}>
      {SUPPORTED_LOCALES.map((code) => {
        const selected = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            lang={LOCALES[code].htmlLang}
            onClick={() => localeStore.set(code)}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              borderRadius: 3,
              padding: "0 6px",
              background: selected ? palette.accentFaint : "transparent",
              color: selected ? palette.accent : palette.textMuted,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: selected ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {LOCALES[code].label}
          </button>
        );
      })}
    </div>
  );
}
