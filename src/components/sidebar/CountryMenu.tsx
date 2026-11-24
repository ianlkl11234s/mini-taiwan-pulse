import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Pin, PinOff } from "lucide-react";
import { ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { countryDef, type CountryCode } from "../../constants/countries";
import { MAX_PINNED, pinnedCountries, useVisibleCountries, usePinnedCountries, type CountryFlyMode } from "../../state/countryStore";
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
 * `trailing`：同一列右側的按鈕（面板的「全部關閉」），省一列高度。
 * 釘選（G1-a）：選單每國右側有圖釘切換（最多 3 國）；觸發列上方一排釘選 chip，點了切換國家並飛到該國上次的鏡頭。
 */
export function CountryMenu({ country, onSelect, trailing }: { country: CountryCode; onSelect: (code: CountryCode, mode?: CountryFlyMode) => void; trailing?: ReactNode }) {
  const { COLOR_SCHEME, PANEL_BORDER, ALLOFF_BG, ALLOFF_BORDER, TEXT_STRONG, DIM, INACTIVE_TEXT, ROW_HOVER, ROW_ACTIVE } = useRailTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<CountryCode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const countryName = t(countryDef(country).labelKey);
  // 站主限定國家（中國）只對站主列出
  const countries = useVisibleCountries();
  const pinnedAll = usePinnedCountries();
  // 站主限定國家對非站主不列（釘過的站主降級後也不顯示）
  const pinned = pinnedAll.filter((code) => countries.some((c) => c.code === code));
  const pinFull = pinned.length >= MAX_PINNED;

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
    <div ref={containerRef} style={{ position: "relative", padding: "4px 12px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
      {pinned.length > 0 && (
        <div role="group" aria-label={t("country.pinnedAria")} style={{ display: "flex", gap: 4, minWidth: 0 }}>
          {pinned.map((code) => {
            const active = code === country;
            const name = t(countryDef(code).labelKey);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                aria-label={t("country.pinnedChipAria", { country: name })}
                title={t("country.pinnedChipAria", { country: name })}
                onClick={() => onSelect(code, "remembered")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  // 目前國家顯示國名（吃剩餘寬度），其餘只留國碼 chip，免得「United Kingdom」被截成「Unite…」
                  flex: active ? "1 1 0" : "0 0 auto",
                  minWidth: 0,
                  padding: "4px 6px",
                  background: active ? ROW_ACTIVE : "transparent",
                  border: `1px solid ${active ? TEXT_STRONG : ALLOFF_BORDER}`,
                  borderRadius: RADIUS.lg,
                  color: active ? TEXT_STRONG : INACTIVE_TEXT,
                  fontSize: FONT_SIZE.base,
                  fontWeight: active ? 600 : 400,
                  fontFamily: FONT_CJK,
                  cursor: "pointer",
                }}
              >
                <CountryChip code={code} color={active ? TEXT_STRONG : INACTIVE_TEXT} />
                {active && <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
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
          flex: 1,
          minWidth: 0,
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
      {trailing}
      </div>
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
          {countries.map(({ code, labelKey }) => {
            const selected = code === country;
            const isPinned = pinned.includes(code);
            const pinDisabled = !isPinned && pinFull;
            const pinLabel = isPinned ? t("country.unpin", { country: t(labelKey) }) : pinDisabled ? t("country.pinFull", { max: MAX_PINNED }) : t("country.pin", { country: t(labelKey) });
            return (
              <div key={code} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setOpen(false);
                  // 選同一國也交給呼叫端（重新飛回該國，VPB-5）；countryStore.set 同值不會通知
                  onSelect(code);
                }}
                onMouseEnter={() => setHover(code)}
                onMouseLeave={() => setHover((current) => (current === code ? null : current))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
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
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isPinned}
                aria-disabled={pinDisabled}
                aria-label={pinLabel}
                title={pinLabel}
                onClick={() => { if (!pinDisabled) pinnedCountries.toggle(code); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  border: "none",
                  borderRadius: RADIUS.md,
                  background: "transparent",
                  color: isPinned ? TEXT_STRONG : DIM,
                  opacity: pinDisabled ? 0.4 : 1,
                  cursor: pinDisabled ? "not-allowed" : "pointer",
                }}
              >
                {isPinned ? <Pin size={14} fill="currentColor" aria-hidden /> : <PinOff size={14} aria-hidden />}
              </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
