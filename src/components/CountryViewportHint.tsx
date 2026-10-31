import { EyeOff } from "lucide-react";
import { countryDef, type CountryCode } from "../constants/countries";
import { useLocale } from "../state/localeStore";
import { COLORS, LIGHT } from "../styles/designTokens";
import { COVERAGE_AREAS } from "../data/layerCoverage";
import { LAYER_NAMES } from "./sidebar/layerCatalog";
import { localizeLayerName } from "../i18n/layerText";
import { formatZoom, type HintRow } from "../map/layerVisibilityHint";
import { CountryChip } from "./sidebar/CountryMenu";
import "./countryViewportHint.css";

const ZOOM_MARK = "\u0000";

export interface LayerHintSection {
  rows: HintRow[];
  more: number;
  total: number;
  onZoomIn: (row: HintRow) => void;
  onGoTo: (row: HintRow) => void;
  onDismiss: () => void;
}

/**
 * 右上視野提示卡（design-system §5.42）：同一張卡最多兩段，上下排列——
 * 1. 「視野在他國」（國家主體化 PR 3）：提示切換國家主體，只提示、不自動切換；判斷在 `hooks/useViewportCountry.ts`。
 * 2. 「圖層看不到」（§5.42.1，map-layers V-3）：開著的圖層要放大或要前往資料範圍才看得到；判斷在 `hooks/useLayerVisibilityHint.ts`。
 *
 * @param target 視野所在、要提示切換過去的國家；null＝不顯示第一段
 * @param current 目前國家主體（「保持〇〇」）
 * @param layers 第二段；null 或沒有列＝不顯示
 * @param rightOffset CSS `right`；Monitor split 時沿用 LoadingStatus 的偏移讓到 dock 左邊
 */
export function CountryViewportHint({
  target,
  current,
  onSwitch,
  onKeep,
  layers = null,
  isDarkTheme = true,
  top = 88,
  rightOffset = "16px",
}: {
  target: CountryCode | null;
  current: CountryCode;
  onSwitch: () => void;
  onKeep: () => void;
  layers?: LayerHintSection | null;
  isDarkTheme?: boolean;
  top?: number;
  rightOffset?: string;
}) {
  const i18n = useLocale();
  const { t } = i18n;
  const showLayers = !!layers && layers.rows.length > 0;
  if (!target && !showLayers) return null;
  const currentName = t(countryDef(current).labelKey);
  const areaName = (row: HintRow) => (row.area ? COVERAGE_AREAS[row.area].label[i18n.active === "zh-TW" ? "zh" : i18n.active] : "");
  const layerName = (key: string) => {
    const name = LAYER_NAMES[key as keyof typeof LAYER_NAMES];
    return name ? localizeLayerName(key, name, i18n).primary : key;
  };
  // 文案裡的 {zoom} 換成等寬字的 zN（FONT_DATA）；語序交給各語系字串
  const withZoom = (text: string, z: number) => {
    const [before, after = ""] = text.split(ZOOM_MARK);
    return <>{before}<span className="country-hint__z">z{formatZoom(z)}</span>{after}</>;
  };
  const whyText = (row: HintRow) => {
    if (row.kind === "zoom") return withZoom(t("layerHint.zoomReason", { zoom: ZOOM_MARK }), row.showZoom ?? row.targetZoom ?? 0);
    const area = areaName(row);
    return row.showZoom !== null
      ? withZoom(t("layerHint.onlyInZoom", { area, zoom: ZOOM_MARK }), row.showZoom)
      : t("layerHint.onlyIn", { area });
  };
  return (
    <section
      className={`country-hint${isDarkTheme ? "" : " country-hint--light"}`}
      style={{ top, right: rightOffset }}
      role="status"
      aria-live="polite"
      aria-label={t(target ? "countryHint.aria" : "layerHint.aria")}
    >
      {target && (
        <div className="country-hint__section">
          <div className="country-hint__head">
            <CountryChip code={target} color={isDarkTheme ? COLORS.textMuted : LIGHT.textMuted} />
            <p className="country-hint__title">{t("countryHint.title", { country: t(countryDef(target).labelKey) })}</p>
          </div>
          <p className="country-hint__detail">{t("countryHint.detail", { country: currentName })}</p>
          <div className="country-hint__actions">
            <button type="button" className="country-hint__btn country-hint__btn--primary" onClick={onSwitch}>
              {t("countryHint.switch", { country: t(countryDef(target).labelKey) })}
            </button>
            <button type="button" className="country-hint__btn" onClick={onKeep}>
              {t("countryHint.keep", { country: currentName })}
            </button>
          </div>
        </div>
      )}
      {showLayers && layers && (
        <div className="country-hint__section">
          <div className="country-hint__head">
            <EyeOff size={13} aria-hidden="true" className="country-hint__icon" />
            <p className="country-hint__title">{t("layerHint.title", { count: String(layers.total) })}</p>
          </div>
          <ul className="country-hint__rows">
            {layers.rows.map((row) => (
              <li key={row.id} className="country-hint__row">
                <span className="country-hint__row-text">
                  <span className="country-hint__name">{row.keys.map(layerName).join(i18n.active === "en" ? ", " : "、")}</span>
                  <span className="country-hint__why">{whyText(row)}</span>
                </span>
                {row.kind === "coverage" ? (
                  <button type="button" className="country-hint__btn country-hint__btn--sm" onClick={() => layers.onGoTo(row)}>
                    {t("layerHint.goTo", { area: areaName(row) })}
                  </button>
                ) : (
                  <button type="button" className="country-hint__btn country-hint__btn--sm" onClick={() => layers.onZoomIn(row)}>
                    {t("layerHint.zoomIn")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {layers.more > 0 && <p className="country-hint__more">{t("layerHint.more", { count: String(layers.more) })}</p>}
          <div className="country-hint__actions">
            <button type="button" className="country-hint__btn" onClick={layers.onDismiss}>{t("layerHint.dismiss")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
