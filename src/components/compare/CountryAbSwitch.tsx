/**
 * 手機「兩國 A／B 切換」鈕（design-system §5.45.1「手機」；G2-2）：
 * 一次只開一張地圖，這顆分段鈕在 A、B 兩國之間切換；點另一段就飛到那一國上次的鏡頭。
 * 兩段各 ≥44px 高，目前顯示的那一國 accentFaint 底＋accent 外框。
 */
import { FONT_CJK, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { countryDef, type CountryCode } from "../../constants/countries";
import { useLocale } from "../../state/localeStore";
import type { CountryAb } from "../../state/countryAbStore";
import { CountryChip } from "../sidebar/CountryMenu";
import { getToolbarPalette } from "../toolbar/toolbarTheme";

interface Props {
  isDarkTheme: boolean;
  ab: CountryAb;
  /** 目前顯示的國家 */
  current: CountryCode;
  onSwitch: (target: CountryCode) => void;
  /** 距畫面頂端（呼叫端放在時間軸列裡，用 calc(100% + …)） */
  top: number | string;
}

export function CountryAbSwitch({ isDarkTheme, ab, current, onSwitch, top }: Props) {
  const { t } = useLocale();
  const palette = getToolbarPalette(isDarkTheme);
  const segment = (code: CountryCode, slot: "A" | "B") => {
    const active = code === current;
    return (
      <button
        key={slot}
        type="button"
        aria-pressed={active}
        aria-label={`${slot}：${t(countryDef(code).labelKey)}`}
        onClick={() => { if (!active) onSwitch(code); }}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 72, minHeight: 44, padding: "0 12px",
          boxSizing: "border-box", border: "none", borderRadius: RADIUS.lg, cursor: active ? "default" : "pointer",
          background: active ? palette.accentFaint : "transparent", color: active ? palette.accent : palette.textMuted,
          boxShadow: active ? `inset 0 0 0 1px ${palette.accent}` : "none",
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: active ? 600 : 400,
        }}
      >
        <CountryChip code={code} color={active ? palette.accent : palette.textMuted} />
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={t("compare.abSwitch")}
      style={{
        position: "absolute", top, left: 12, display: "inline-flex", gap: 2, padding: 2,
        background: palette.surfaceBg, border: `1px solid ${palette.borderPanel}`, borderRadius: RADIUS.xl,
        boxShadow: palette.shadow, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {segment(ab.a, "A")}
      {segment(ab.b, "B")}
    </div>
  );
}
