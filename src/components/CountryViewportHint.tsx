import { countryDef, type CountryCode } from "../constants/countries";
import { useLocale } from "../state/localeStore";
import { COLORS, LIGHT } from "../styles/designTokens";
import { CountryChip } from "./sidebar/CountryMenu";
import "./countryViewportHint.css";

/**
 * 右上視野提示卡（design-system §5.42，國家主體化 PR 3）：視野停在他國時提示切換國家主體。
 * 只提示、不自動切換；判斷與關閉規則在 `hooks/useViewportCountry.ts`。
 *
 * @param target 視野所在、要提示切換過去的國家
 * @param current 目前國家主體（「保持〇〇」）
 * @param rightOffset CSS `right`；Monitor split 時沿用 LoadingStatus 的偏移讓到 dock 左邊
 */
export function CountryViewportHint({
  target,
  current,
  onSwitch,
  onKeep,
  isDarkTheme = true,
  top = 88,
  rightOffset = "16px",
}: {
  target: CountryCode;
  current: CountryCode;
  onSwitch: () => void;
  onKeep: () => void;
  isDarkTheme?: boolean;
  top?: number;
  rightOffset?: string;
}) {
  const { t } = useLocale();
  const targetName = t(countryDef(target).labelKey);
  const currentName = t(countryDef(current).labelKey);
  return (
    <section
      className={`country-hint${isDarkTheme ? "" : " country-hint--light"}`}
      style={{ top, right: rightOffset }}
      role="status"
      aria-live="polite"
      aria-label={t("countryHint.aria")}
    >
      <div className="country-hint__head">
        <CountryChip code={target} color={isDarkTheme ? COLORS.textMuted : LIGHT.textMuted} />
        <p className="country-hint__title">{t("countryHint.title", { country: targetName })}</p>
      </div>
      <p className="country-hint__detail">{t("countryHint.detail", { country: currentName })}</p>
      <div className="country-hint__actions">
        <button type="button" className="country-hint__btn country-hint__btn--primary" onClick={onSwitch}>
          {t("countryHint.switch", { country: targetName })}
        </button>
        <button type="button" className="country-hint__btn" onClick={onKeep}>
          {t("countryHint.keep", { country: currentName })}
        </button>
      </div>
    </section>
  );
}
