// 英國第 11 波環境與規劃 6 層圖例（2026-10-29）。色票與署名 SSOT 在 data/gbEnvPlanningTypes.ts。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_BROWNFIELD_ATTRIBUTION, GB_BROWNFIELD_COLOR, GB_BROWNFIELD_STATUSES, GB_CONSERVATION_BY_NATION, GB_ENV_FALLBACK_COLOR,
  GB_ENV_HOLLOW_STROKE, GB_NOISE_ATTRIBUTION, GB_NOISE_BANDS, GB_NOISE_SOURCE_COUNTS, GB_PLANNING_ATTRIBUTION, GB_PLANNING_CONSTRAINTS,
  GB_POLLUTION_ATTRIBUTION, GB_POLLUTION_COLOR, GB_POLLUTION_COUNTS, GB_POLLUTION_YEAR, GB_RECYCLING_ATTRIBUTION, GB_RECYCLING_BY_NATION,
  GB_RECYCLING_CENTRE_MINZOOM, GB_RECYCLING_CONTAINER_MINZOOM, GB_RECYCLING_KINDS, GB_RECYCLING_OSM_TIME, GB_WASTE_AUTHORITIES,
  GB_WASTE_PERMITS_ATTRIBUTION, GB_WASTE_PERMITS_COLOR, type GbBrownfieldStatus, type GbPlanningConstraint, type GbRecyclingKind,
} from "../../data/gbEnvPlanningTypes";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}
const mix = (color: string, fill: number) => `color-mix(in srgb, ${color} ${fill * 100}%, transparent)`;

export const GB_PLANNING_CONSTRAINT_KEYS: Record<GbPlanningConstraint, MessageKey> = {
  conservation_area: "popup.environmentLayer.gbPlanConservation",
  article_4: "popup.environmentLayer.gbPlanArticle4",
  green_belt: "popup.environmentLayer.gbPlanGreenBelt",
};
export const GB_BROWNFIELD_STATUS_KEYS: Record<GbBrownfieldStatus, MessageKey> = {
  permissioned: "popup.environmentLayer.gbBfStPermissioned",
  pending: "popup.environmentLayer.gbBfStPending",
  not_permissioned: "popup.environmentLayer.gbBfStNotPermissioned",
  completed: "popup.environmentLayer.gbBfStCompleted",
  other: "popup.environmentLayer.gbBfStOther",
};
export const GB_RECYCLING_KIND_KEYS: Record<GbRecyclingKind, MessageKey> = {
  centre: "popup.environmentLayer.gbRecCentre",
  container: "popup.environmentLayer.gbRecContainer",
};

/** 規劃限制區：三類分色（綠帶淡填色）；預設只顯示保育區。 */
export function GbPlanningConstraintsLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbPlanningConstraints", i18n)} en="Planning Constraints" />
    {GB_PLANNING_CONSTRAINTS.map((c) => (
      <LegendRow key={c.value} swatch={<SwatchSquare color={c.color} opacity={c.fill < 1 ? 0.35 : 0.85} stroke={c.color} />}>
        {i18n.t("legend.environment.gbPlanRow", { label: i18n.t(GB_PLANNING_CONSTRAINT_KEYS[c.value]), n: n(c.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.environment.gbPlanViewNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPlanConservationNations", { e: n(GB_CONSERVATION_BY_NATION.England), s: n(GB_CONSERVATION_BY_NATION.Scotland), w: n(GB_CONSERVATION_BY_NATION.Wales) })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPlanEnglandOnly")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPlanCoverage")}</LegendNote>
    <LegendNote>{GB_PLANNING_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 棕地登記冊：同色、填色強度依許可進度；未許可同色空心、已完成／其他灰色空心。 */
export function GbBrownfieldLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbBrownfield", i18n)} en="Brownfield Land Register" />
    {GB_BROWNFIELD_STATUSES.map((s) => {
      const stroke = s.hollow ? { stroke: s.neutral ? GB_ENV_FALLBACK_COLOR : GB_BROWNFIELD_COLOR, strokeWidth: GB_ENV_HOLLOW_STROKE } : {};
      return (
        <LegendRow key={s.value} swatch={<SwatchDot color={s.fill > 0 ? mix(GB_BROWNFIELD_COLOR, s.fill) : "transparent"} opacity={1} {...stroke} />}>
          {i18n.t(s.hollow ? "legend.environment.gbRowHollow" : "legend.environment.gbRow", { label: i18n.t(GB_BROWNFIELD_STATUS_KEYS[s.value]), n: i18n.formatNumber(s.count) })}
        </LegendRow>
      );
    })}
    <DenseHeatmapLegendRow layers={["gbBrownfield"]} />
    <LegendNote>{i18n.t("legend.environment.gbBfNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbBfCoverage")}</LegendNote>
    <LegendNote>{GB_BROWNFIELD_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 回收點：回收中心／回收桶兩類；全層來自 OSM（圖例另列 OSM 補缺）。 */
export function GbRecyclingCentresLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  const zoom = { centre: GB_RECYCLING_CENTRE_MINZOOM, container: GB_RECYCLING_CONTAINER_MINZOOM } as const;
  return <div>
    <LegendTitle zh={layerTitle("gbRecyclingCentres", i18n)} en="Recycling Points (OSM)" />
    {GB_RECYCLING_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>
        {i18n.t("legend.environment.gbRecRow", { label: i18n.t(GB_RECYCLING_KIND_KEYS[k.value]), n: n(k.count), zoom: zoom[k.value] })}
      </LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["gbRecyclingCentres"]} />
    <LegendNote>{i18n.t("legend.environment.gbRecHeatNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbRecOsm")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbRecCoverage", { e: n(GB_RECYCLING_BY_NATION.England), s: n(GB_RECYCLING_BY_NATION.Scotland), w: n(GB_RECYCLING_BY_NATION.Wales), ni: n(GB_RECYCLING_BY_NATION["Northern Ireland"]) })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbRecTime", { time: GB_RECYCLING_OSM_TIME })}</LegendNote>
    <LegendNote>{GB_RECYCLING_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 廢棄物處理許可：單色，主管機關用選單篩選；威爾斯未涵蓋。 */
export function GbWastePermitsLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  const [ea, sepa, niea] = GB_WASTE_AUTHORITIES.map((a) => n(a.count));
  return <div>
    <LegendTitle zh={layerTitle("gbWastePermits", i18n)} en="Waste Permits" />
    <LegendRow swatch={<SwatchDot color={GB_WASTE_PERMITS_COLOR} />}>
      {i18n.t("legend.environment.gbWasteRow", { n: n(GB_WASTE_AUTHORITIES.reduce((sum, a) => sum + a.count, 0)) })}
    </LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbWasteAuthorities", { ea: ea!, sepa: sepa!, niea: niea! })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbWasteWales")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbWasteNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbWastePersonal")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbWasteEaLicence")}</LegendNote>
    <LegendNote>{GB_WASTE_PERMITS_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 污染排放申報：只有蘇格蘭；有申報排放實心、申報皆無空心。 */
export function GbPollutionInventoryLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbPollutionInventory", i18n)} en="Pollution Release Sites (SEPA)" />
    <LegendRow swatch={<SwatchDot color={GB_POLLUTION_COLOR} />}>{i18n.t("legend.environment.gbPolReleased", { n: n(GB_POLLUTION_COUNTS.released) })}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_POLLUTION_COLOR} strokeWidth={GB_ENV_HOLLOW_STROKE} />}>{i18n.t("legend.environment.gbPolNone", { n: n(GB_POLLUTION_COUNTS.none) })}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.gbPolScotland", { year: GB_POLLUTION_YEAR, n: n(GB_POLLUTION_COUNTS.total) })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPolEngland")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbPolUncovered")}</LegendNote>
    <LegendNote>{GB_POLLUTION_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 策略噪音：Lden 五帶（台灣噪音格網 dB 色階）；道路／鐵路用選單切換。 */
export function GbNoiseLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbNoise", i18n)} en="Strategic Noise Map (Lden)" />
    {GB_NOISE_BANDS.map((b) => (
      <LegendRow key={b.min} swatch={<SwatchSquare color={b.color} />}>{`${b.label} dB(A) Lden`}</LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.environment.gbNoiseSourceNote", { road: i18n.formatNumber(GB_NOISE_SOURCE_COUNTS.road), rail: i18n.formatNumber(GB_NOISE_SOURCE_COUNTS.rail) })}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbNoiseNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbNoiseCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.environment.gbNoiseRounds")}</LegendNote>
    <LegendNote>{GB_NOISE_ATTRIBUTION}</LegendNote>
  </div>;
}
