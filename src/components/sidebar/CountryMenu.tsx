import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { COUNTRIES, countryDef, type CountryCode } from "../../constants/countries";
import { useLocale } from "../../state/localeStore";
import { useRailTheme } from "./railTheme";

/** 兩字國碼 chip（spec §5.41：沿用 §5.21 `chipOutline`，不另立公式）。 */
export function CountryChip({ code, color }: { code: CountryCode; color: string }) {
  return (
    <span
      aria-hidden
      style={{
        ...chipOutline(color),
        fontSize: FONT_SIZE.sm,
        fontFamily: FONT_DATA,
        fontWeight: 600,
        lineHeight: 1.2,
        padding: "2px 5px",
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      {countryDef(code).chip}
    </span>
  );
}

/**
 * 圖層／統計面板頂部的國家選單（spec §5.41，2026-10-28 國家主體化）。
 * 觸發列＝chip＋國名＋chevron；彈出層沿用 §5.19 popover 的外殼與互動（點外部或 Esc 關閉、menuitemradio）。
 * 選國家才 flyTo（`onSelect` 由呼叫端決定）；國家狀態本身在 `countryStore`。
 */
export function CountryMenu({ country, onSelect }: { country: CountryCode; onSelect: (code: CountryCode) => void }) {
  const { COLOR_SCHEME, PANEL_BORDER, ALLOFF_BG, ALLOFF_BORDER, TEXT_STRONG, DIM, INACTIVE_TEXT, ROW_HOVER, ROW_ACTIVE } = useRailTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<CountryCode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const countryName = t(countryDef(country).labelKey);

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
    <div ref={containerRef} style={{ position: "relative", padding: "4px 12px 0" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("country.menuAria", { country: countryName })}
        title={t("country.menuAria", { country: countryName })}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "5px 8px",
          background: ALLOFF_BG,
          border: `1px solid ${ALLOFF_BORDER}`,
          borderRadius: RADIUS.lg,
          color: TEXT_STRONG,
          fontSize: FONT_SIZE.md,
          fontWeight: 600,
          fontFamily: FONT_CJK,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <CountryChip code={country} color={INACTIVE_TEXT} />
        <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{countryName}</span>
        <ChevronDown size={12} color={DIM} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("country.menuAria", { country: countryName })}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 12,
            right: 12,
            zIndex: Z_INDEX.popover,
            // 不透明底：面板本身半透明，彈出層再疊半透明會讓下方「全部關閉」、搜尋框的字透出來
            background: COLOR_SCHEME === "dark" ? SURFACE.app : LIGHT.surfaceSolid,
            border: `1px solid ${PANEL_BORDER}`,
            borderRadius: RADIUS.xl,
            boxShadow: ELEVATION.lg,
            padding: 4,
            fontFamily: FONT_CJK,
          }}
        >
          {COUNTRIES.map(({ code, labelKey }) => {
            const selected = code === country;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onSelect(code);
                }}
                onMouseEnter={() => setHover(code)}
                onMouseLeave={() => setHover((current) => (current === code ? null : current))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 8px",
                  border: "none",
                  borderRadius: RADIUS.md,
                  background: selected ? ROW_ACTIVE : hover === code ? ROW_HOVER : "transparent",
                  color: TEXT_STRONG,
                  fontFamily: FONT_CJK,
                  fontSize: FONT_SIZE.md,
                  fontWeight: selected ? 600 : 400,
                  textAlign: "left",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <CountryChip code={code} color={selected ? TEXT_STRONG : INACTIVE_TEXT} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
