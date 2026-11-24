/**
 * 兩國並排的畫面外框（design-system §5.45「兩國並排」；G2-1）：
 * - 中間分隔線固定 50%、不可拖（沿用拉桿的線樣式，不畫圓鈕與熱區）。
 * - 分隔線頂端一列：左側國家 chip（可選任何國家，＝圖層面板的目前國家）｜比例尺同步開關｜右側國家 chip 列
 *   （只列釘選的外國，另有「其他國家…」選單可選任何外國）。
 * - 下面一列左右各一條比例尺（各量各的地圖，比例尺同步開著時兩條代表的距離相同）。
 */
import { useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import { FONT_CJK, FONT_SIZE, RADIUS, Z_INDEX } from "../../styles/designTokens";
import { countryDef, type CountryCode } from "../../constants/countries";
import { usePinnedCountries, useVisibleCountries, type CountryFlyMode } from "../../state/countryStore";
import { compareStore, useCompareSelector } from "../../state/compareStore";
import { compareRightMap } from "../../map/compareRightMap";
import { useLocale } from "../../state/localeStore";
import { CountryChip } from "../sidebar/CountryMenu";
import { MapScaleBar } from "../MapScaleBar";
import { getToolbarPalette, type ToolbarPalette } from "../toolbar/toolbarTheme";
import { usePopoverDismiss } from "../toolbar/CompareMenu";
import type { Map as MapboxMap } from "mapbox-gl";
import "./compareDivider.css";

interface Props {
  isDarkTheme: boolean;
  captureMode: boolean;
  mainMap: MapboxMap | null;
  leftCountry: CountryCode;
  rightCountry: CountryCode;
  /** 左側換國家（同圖層面板選國家）：App 切 countryStore 並飛到該國上次的鏡頭 */
  onLeftCountry: (code: CountryCode, mode?: CountryFlyMode) => void;
}

/** 國家選單（左側：任何國家；右側：其他外國）。觸發鈕由呼叫端給 */
function CountryPicker({ palette, label, options, current, onPick, trigger }: {
  palette: ToolbarPalette;
  label: string;
  options: readonly CountryCode[];
  current: CountryCode | null;
  onPick: (code: CountryCode) => void;
  trigger: (open: () => void, expanded: boolean) => React.ReactNode;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && (
        <div
          role="menu"
          aria-label={label}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", zIndex: Z_INDEX.popover,
            minWidth: 168, maxHeight: 320, overflowY: "auto", background: palette.popupBg, border: `1px solid ${palette.popupBorder}`,
            borderRadius: RADIUS.xl, boxShadow: palette.shadow, padding: 4, fontFamily: FONT_CJK,
          }}
        >
          {options.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === current}
              onClick={() => { onPick(code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "5px 8px", border: "none", borderRadius: RADIUS.md,
                background: code === current ? palette.accentFaint : "transparent", color: code === current ? palette.accent : palette.textStrong,
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, cursor: "pointer", textAlign: "left",
              }}
            >
              <CountryChip code={code} color={code === current ? palette.accent : palette.textMuted} />
              {t(countryDef(code).labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CountryCompareChrome({ isDarkTheme, captureMode, mainMap, leftCountry, rightCountry, onLeftCountry }: Props) {
  const { t } = useLocale();
  const palette = getToolbarPalette(isDarkTheme);
  const scaleLocked = useCompareSelector((s) => s.scaleLocked);
  const rightMap = useSyncExternalStore(compareRightMap.subscribe, compareRightMap.get, compareRightMap.get);
  const visible = useVisibleCountries().map((c) => c.code);
  const pinned = usePinnedCountries().filter((code) => visible.includes(code));
  const foreign = visible.filter((code) => code !== "TW" && code !== leftCountry);
  const pinnedForeign = pinned.filter((code) => foreign.includes(code));
  const leftOptions = visible.filter((code) => code !== rightCountry);

  const surface = {
    display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 8px", boxSizing: "border-box",
    background: palette.surfaceBg, border: `1px solid ${palette.borderPanel}`, borderRadius: RADIUS.lg,
    boxShadow: palette.shadow, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
    fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: palette.textStrong, cursor: "pointer",
  } as const;
  const chipButton = (code: CountryCode, active: boolean, onClick: () => void) => (
    <button
      key={code}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={t(countryDef(code).labelKey)}
      style={{ ...surface, borderColor: active ? palette.accent : palette.borderPanel, color: active ? palette.accent : palette.textStrong }}
    >
      <CountryChip code={code} color={active ? palette.accent : palette.textMuted} />
      {active && <span>{t(countryDef(code).labelKey)}</span>}
    </button>
  );

  return (
    <>
      <div className={`compare-divider ${isDarkTheme ? "" : "compare-divider--light"} ${captureMode ? "compare-divider--capture" : ""}`} style={{ left: "50%" }}>
        <div className="compare-divider__line" />
      </div>
      {!captureMode && (
        <div style={{ position: "absolute", top: 48, left: 0, right: 0, zIndex: Z_INDEX.mapOverlay, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "start", columnGap: 8, pointerEvents: "none" }}>
          {/* 左：國家 chip（下拉）＋比例尺，靠分隔線 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ pointerEvents: "auto" }}>
              <CountryPicker
                palette={palette}
                label={t("compare.leftCountry")}
                options={leftOptions}
                current={leftCountry}
                onPick={(code) => onLeftCountry(code, "remembered")}
                trigger={(toggle, expanded) => (
                  <button type="button" aria-haspopup="menu" aria-expanded={expanded} aria-label={`${t("compare.leftCountry")}：${t(countryDef(leftCountry).labelKey)}`} onClick={toggle} style={surface}>
                    <CountryChip code={leftCountry} color={palette.accent} />
                    {t(countryDef(leftCountry).labelKey)}
                    <ChevronDown size={12} aria-hidden />
                  </button>
                )}
              />
            </div>
            <MapScaleBar map={mainMap} isDarkTheme={isDarkTheme} variant="desktop" style={{ width: 224 }} />
          </div>
          {/* 中：比例尺同步開關 */}
          <button
            type="button"
            aria-pressed={scaleLocked}
            title={t(scaleLocked ? "compare.scaleLockOnHint" : "compare.scaleLockOffHint")}
            onClick={() => compareStore.setScaleLocked(!scaleLocked)}
            style={{ ...surface, pointerEvents: "auto", background: scaleLocked ? palette.accentFaint : palette.surfaceBg, borderColor: scaleLocked ? palette.accent : palette.borderPanel, color: scaleLocked ? palette.accent : palette.textMuted }}
          >
            <Ruler size={13} aria-hidden />
            {t("compare.scaleLock")}
          </button>
          {/* 右：釘選外國 chip 列＋其他國家，下面比例尺 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <div role="group" aria-label={t("compare.rightCountry")} style={{ display: "flex", gap: 4, pointerEvents: "auto" }}>
              {(pinnedForeign.includes(rightCountry) ? pinnedForeign : [rightCountry, ...pinnedForeign]).map((code) =>
                chipButton(code, code === rightCountry, () => compareStore.setRightCountry(code)))}
              <CountryPicker
                palette={palette}
                label={t("compare.rightCountry")}
                options={foreign}
                current={rightCountry}
                onPick={(code) => compareStore.setRightCountry(code)}
                trigger={(toggle, expanded) => (
                  <button type="button" aria-haspopup="menu" aria-expanded={expanded} onClick={toggle} style={{ ...surface, color: palette.textMuted }}>
                    {t("compare.rightMore")}
                    <ChevronDown size={12} aria-hidden />
                  </button>
                )}
              />
            </div>
            <MapScaleBar map={rightMap} isDarkTheme={isDarkTheme} variant="desktop" style={{ width: 224 }} />
          </div>
        </div>
      )}
    </>
  );
}
