import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { BOUNDARY_GRAY } from "../../map/mapStyleScale";
import {
  LIQUEFACTION_SITE_COLOR, LIQUEFACTION_SITE_PRECISION_LABEL, LIQUEFACTION_SITE_STATUS_LABEL,
  SOIL_LIQUEFACTION_OFFICIAL_MAP_URL, SOIL_LIQUEFACTION_RIGHTS_TEXT, SOIL_LIQUEFACTION_SOURCE_ORG,
  SOIL_POTENTIAL_CLASSES, SOIL_POTENTIAL_NOT_INVESTIGATED, WEAK_SOIL_COLORS, WEAK_SOIL_DEPTH_LABEL,
  WEAK_SOIL_LAYER_SPEC, WEAK_SOIL_MATERIAL_LABEL, WEAK_SOIL_SPT_THRESHOLD, weakSoilField,
  type WeakSoilLayerKey, type WeakSoilMaterial,
} from "../../data/soilLiquefactionTypes";

/**
 * 土壤液化 owner-only popup（spec §5.2）。tile 沒有來源欄位 → panel 端補來源常數並自掛 SourceFooter
 * （FeatureInfoPanel `FOOTER_SELF_MANAGED_LAYER_TYPES`）。不印 release_id／source_feature_id（§6.3）。
 */
const str = (value: unknown): string => (value == null || value === "" ? "" : String(value));
const footerProps = (props: Record<string, unknown>) => ({
  ...props,
  source_org: SOIL_LIQUEFACTION_SOURCE_ORG,
  source_url: SOIL_LIQUEFACTION_OFFICIAL_MAP_URL,
  license: SOIL_LIQUEFACTION_RIGHTS_TEXT,
});

export function SoilLiquefactionPotentialPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const raw = str(props.potential_class);
  const known = SOIL_POTENTIAL_CLASSES.find((item) => item.value === raw);
  const notInvestigated = raw === SOIL_POTENTIAL_NOT_INVESTIGATED;
  const label = known ? enumLabel("soilPotentialClass", known.value, known.label, i18n) : notInvestigated ? t("popup.soilLiquefaction.notInvestigatedLabel") : t("popup.common.noData");
  return <>
    <Title color={known?.color ?? BOUNDARY_GRAY.dark}>{t("popup.soilLiquefaction.potentialTitle", { label })}</Title>
    <Row label={t("popup.soilLiquefaction.potentialClass")} value={label} />
    {known && <Row label={t("popup.soilLiquefaction.classMeaning")} value={t("popup.soilLiquefaction.classMeaningText")} />}
    {notInvestigated && <Row label={t("popup.soilLiquefaction.notInvestigatedLabel")} value={t("popup.soilLiquefaction.notInvestigatedText")} />}
    {!known && !notInvestigated && <Row field="dataLimits" value={t("popup.soilLiquefaction.noDataText")} />}
    <Row label={t("popup.soilLiquefaction.assessmentYear")} value={str(props.source_year)} mono />
    <Row label={t("popup.soilLiquefaction.usageLimits")} value={t("popup.soilLiquefaction.siteCaveat")} />
    <SourceFooter props={footerProps(props)} />
  </>;
}

function thicknessText(value: unknown, t: (key: "popup.soilLiquefaction.missing" | "popup.soilLiquefaction.noWeakLayer") => string, formatNumber: (n: number) => string): string {
  if (value == null || value === "") return t("popup.soilLiquefaction.missing");
  const number = Number(value);
  if (!Number.isFinite(number)) return t("popup.soilLiquefaction.missing");
  return number === 0 ? t("popup.soilLiquefaction.noWeakLayer") : `${formatNumber(number)} m`;
}

function makeWeakSoilPanel(key: WeakSoilLayerKey): FC<{ props: Record<string, unknown> }> {
  const { material, depth } = WEAK_SOIL_LAYER_SPEC[key];
  const depthLabel = WEAK_SOIL_DEPTH_LABEL[depth];
  const order: WeakSoilMaterial[] = material === "sand" ? ["sand", "clay"] : ["clay", "sand"];
  const Panel = ({ props }: { props: Record<string, unknown> }) => {
    const i18n = useLocale();
    const { t, formatNumber } = i18n;
    return <>
    <Title color={WEAK_SOIL_COLORS[material][3]}>{t("popup.soilLiquefaction.weakTitle", { depth: depthLabel })}</Title>
    {order.map((item) => (
      <Row key={item} label={t("popup.soilLiquefaction.materialRow", { material: enumLabel("soilWeakMaterial", item, WEAK_SOIL_MATERIAL_LABEL[item], i18n), threshold: WEAK_SOIL_SPT_THRESHOLD[item] })} value={thicknessText(props[weakSoilField(item, depth)], t, formatNumber)} />
    ))}
    <Row label={t("popup.soilLiquefaction.threshold")} value={t("popup.soilLiquefaction.thresholdText")} />
    <Row label={t("popup.soilLiquefaction.depthUse")} value={t("popup.soilLiquefaction.depthUseText")} />
    <Row label={t("popup.soilLiquefaction.usageLimits")} value={t("popup.soilLiquefaction.gridLimits", { caveat: t("popup.soilLiquefaction.siteCaveat") })} />
    <SourceFooter props={footerProps(props)} />
  </>;
  };
  Panel.displayName = `WeakSoilPanel(${key})`;
  return Panel;
}

export const WEAK_SOIL_PANELS = {
  weakSoilClay0To5: makeWeakSoilPanel("weakSoilClay0To5"),
  weakSoilSand0To5: makeWeakSoilPanel("weakSoilSand0To5"),
  weakSoilClay5To10: makeWeakSoilPanel("weakSoilClay5To10"),
  weakSoilSand5To10: makeWeakSoilPanel("weakSoilSand5To10"),
  weakSoilClay10To20: makeWeakSoilPanel("weakSoilClay10To20"),
  weakSoilSand10To20: makeWeakSoilPanel("weakSoilSand10To20"),
} as const satisfies Record<WeakSoilLayerKey, FC<{ props: Record<string, unknown> }>>;

export function LiquefactionMonitoringSitePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const status = str(props.status);
  const precision = str(props.precision);
  return <>
    <Title color={LIQUEFACTION_SITE_COLOR}>{str(props.name) || t("popup.soilLiquefaction.siteFallback")}</Title>
    <Row label={t("popup.soilLiquefaction.siteStatus")} value={enumLabel("soilSiteStatus", status, LIQUEFACTION_SITE_STATUS_LABEL[status] ?? status, i18n)} />
    <Row label={t("popup.soilLiquefaction.sitePrecision")} value={enumLabel("soilSitePrecision", precision, LIQUEFACTION_SITE_PRECISION_LABEL[precision] ?? precision, i18n)} />
    <Row field="dataLimits" value={t("popup.soilLiquefaction.siteLimits")} />
    <SourceFooter props={footerProps(props)} />
  </>;
}
