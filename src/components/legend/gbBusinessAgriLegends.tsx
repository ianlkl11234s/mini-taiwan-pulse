// 英國第 12 波 5 層圖例（2026-10-29）。色票與署名 SSOT 在 data/gbBusinessAgriTypes.ts。
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchHatch, SwatchSquare, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_AQUACULTURE_ATTRIBUTION, GB_AQUACULTURE_KINDS, GB_AQUACULTURE_STATUSES, GB_COMPANIES_ATTRIBUTION, GB_COMPANIES_BUCKETS, GB_COMPANIES_COLOR,
  GB_COMPANIES_DISTRICTS, GB_COMPANIES_SNAPSHOT, GB_COMPANIES_TOTAL, GB_FUNERAL_ATTRIBUTION, GB_FUNERAL_BY_NATION, GB_FUNERAL_KINDS,
  GB_FUNERAL_OSM_TIME, GB_MANUFACTURING_BUCKETS, GB_MANUFACTURING_COLOR, GB_MANUFACTURING_DISTRICTS, GB_MANUFACTURING_TOTAL,
  GB_SOIL_ATTRIBUTION, GB_SOIL_DEPTHS, GB_SOIL_NA_COUNT, GB_W12_FALLBACK_COLOR, GB_W12_HOLLOW_STROKE, gbSoilDepthColors,
  type GbAquacultureKind, type GbAquacultureStatus, type GbCountBucket, type GbFuneralKind, type GbSicSection, type GbSoilDepth,
} from "../../data/gbBusinessAgriTypes";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export const GB_SIC_SECTION_KEYS: Record<GbSicSection, MessageKey> = {
  A: "popup.businessRegistry.gbSicA",
  B: "popup.businessRegistry.gbSicB",
  C: "popup.businessRegistry.gbSicC",
  D: "popup.businessRegistry.gbSicD",
  E: "popup.businessRegistry.gbSicE",
  F: "popup.businessRegistry.gbSicF",
  G: "popup.businessRegistry.gbSicG",
  H: "popup.businessRegistry.gbSicH",
  I: "popup.businessRegistry.gbSicI",
  J: "popup.businessRegistry.gbSicJ",
  K: "popup.businessRegistry.gbSicK",
  L: "popup.businessRegistry.gbSicL",
  M: "popup.businessRegistry.gbSicM",
  N: "popup.businessRegistry.gbSicN",
  O: "popup.businessRegistry.gbSicO",
  P: "popup.businessRegistry.gbSicP",
  Q: "popup.businessRegistry.gbSicQ",
  R: "popup.businessRegistry.gbSicR",
  S: "popup.businessRegistry.gbSicS",
  T: "popup.businessRegistry.gbSicT",
  U: "popup.businessRegistry.gbSicU",
};
export const GB_FUNERAL_KIND_KEYS: Record<GbFuneralKind, MessageKey> = {
  crematorium: "legend.culture.gbFunCrematorium",
  funeral_directors: "legend.culture.gbFunDirectors",
};
export const GB_AQUACULTURE_KIND_KEYS: Record<GbAquacultureKind, MessageKey> = {
  finfish: "legend.agri.gbAqFinfish",
  shellfish: "legend.agri.gbAqShellfish",
  fishery_site: "legend.agri.gbAqFishery",
  shellfish_licence: "legend.agri.gbAqNiLicence",
};
export const GB_AQUACULTURE_STATUS_KEYS: Record<GbAquacultureStatus, MessageKey> = {
  active: "legend.agri.gbAqStCurrent",
  licensed: "legend.agri.gbAqStCurrent",
  inactive: "legend.agri.gbAqStInactive",
  deregistered: "legend.agri.gbAqStDeregistered",
};
export const GB_SOIL_DEPTH_KEYS: Record<GbSoilDepth, MessageKey> = {
  SHALLOW: "legend.agri.gbSoilShallow",
  "INTERMEDIATE-SHALLOW": "legend.agri.gbSoilIntShallow",
  INTERMEDIATE: "legend.agri.gbSoilIntermediate",
  "DEEP-INTERMEDIATE": "legend.agri.gbSoilDeepInt",
  DEEP: "legend.agri.gbSoilDeep",
};

/** 級距標籤：<b1、b1–b2、…、≥bn（純數字，不需翻譯）。 */
function bucketItems(buckets: readonly GbCountBucket[], i18n: I18n) {
  const n = (v: number) => i18n.formatNumber(v);
  return buckets.map((b, i) => {
    const next = buckets[i + 1];
    const label = i === 0 ? (b.min <= 1 ? `${n(b.min)}–${n(next!.min - 1)}` : `<${n(next!.min)}`) : next ? `${n(b.min)}–${n(next.min - 1)}` : `≥${n(b.min)}`;
    return { r: b.radius, label };
  });
}

function CompanyNotes({ i18n }: { i18n: I18n }) {
  return <>
    <LegendNote>{i18n.t("legend.registry.gbCoAgentNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.registry.gbCoNiNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.registry.gbCoLicenceNote", { date: GB_COMPANIES_SNAPSHOT })}</LegendNote>
    <LegendNote>{GB_COMPANIES_ATTRIBUTION}</LegendNote>
  </>;
}

/** 公司登記：郵遞區號 district 聚合點，依公司總數分 5 級半徑。 */
export function GbCompaniesLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbCompanies", i18n)} en="Registered Companies" />
    <LegendSizeRow title={i18n.t("legend.registry.gbCoSizeTitle")} items={bucketItems(GB_COMPANIES_BUCKETS, i18n)} fill={GB_COMPANIES_COLOR} />
    <LegendNote>{i18n.t("legend.registry.gbCoDistrictNote", { n: n(GB_COMPANIES_DISTRICTS), total: n(GB_COMPANIES_TOTAL) })}</LegendNote>
    <CompanyNotes i18n={i18n} />
  </div>;
}

/** 製造業：同一檔，依 c_C（SIC section C）家數分 5 級半徑；0 家不畫。 */
export function GbManufacturingLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbManufacturing", i18n)} en="Manufacturing Companies" />
    <LegendSizeRow title={i18n.t("legend.registry.gbMfgSizeTitle")} items={bucketItems(GB_MANUFACTURING_BUCKETS, i18n)} fill={GB_MANUFACTURING_COLOR} />
    <LegendNote>{i18n.t("legend.registry.gbMfgNote", { total: n(GB_MANUFACTURING_TOTAL) })}</LegendNote>
    <LegendNote>{i18n.t("legend.registry.gbCoDistrictNote", { n: n(GB_MANUFACTURING_DISTRICTS), total: n(GB_MANUFACTURING_TOTAL) })}</LegendNote>
    <CompanyNotes i18n={i18n} />
  </div>;
}

/** 殯葬設施：火葬場／葬儀社兩類；全層來自 OSM（圖例另列 OSM 補缺）。 */
export function GbFuneralLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbFuneral", i18n)} en="Crematoria and Funeral Directors (OSM)" />
    {GB_FUNERAL_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>
        {i18n.t("legend.culture.gbFunRow", { label: i18n.t(GB_FUNERAL_KIND_KEYS[k.value]), n: n(k.count), z: k.minzoom })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.culture.gbFunOsmNote", { time: GB_FUNERAL_OSM_TIME })}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbFunNations", { e: n(GB_FUNERAL_BY_NATION.England), s: n(GB_FUNERAL_BY_NATION.Scotland), w: n(GB_FUNERAL_BY_NATION.Wales), ni: n(GB_FUNERAL_BY_NATION["Northern Ireland"]) })}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbFunCemNote")}</LegendNote>
    <LegendNote>{GB_FUNERAL_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 養殖場：依類別分色；狀態以外框區分（現役實心、暫停同色空心、已註銷灰色空心）。 */
export function GbAquacultureLegend() {
  const i18n = useLocale();
  const n = (v: number) => i18n.formatNumber(v);
  const statusRows = [
    { key: "current", status: GB_AQUACULTURE_STATUSES[0]!, count: GB_AQUACULTURE_STATUSES[0]!.count + GB_AQUACULTURE_STATUSES[1]!.count },
    { key: "inactive", status: GB_AQUACULTURE_STATUSES[2]!, count: GB_AQUACULTURE_STATUSES[2]!.count },
    { key: "deregistered", status: GB_AQUACULTURE_STATUSES[3]!, count: GB_AQUACULTURE_STATUSES[3]!.count },
  ];
  const sample = GB_AQUACULTURE_KINDS[0]!.color;
  return <div>
    <LegendTitle zh={layerTitle("gbAquaculture", i18n)} en="Aquaculture Sites" />
    {GB_AQUACULTURE_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>
        {i18n.t("legend.agri.gbAqRow", { label: i18n.t(GB_AQUACULTURE_KIND_KEYS[k.value]), n: n(k.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.agri.gbAqStatusTitle")}</LegendNote>
    {statusRows.map(({ key, status, count }) => (
      <LegendRow key={key} swatch={<SwatchDot
        color={status.hollow ? "transparent" : sample} opacity={1}
        {...(status.hollow ? { stroke: status.neutral ? GB_W12_FALLBACK_COLOR : sample, strokeWidth: GB_W12_HOLLOW_STROKE } : {})}
      />}>
        {i18n.t("legend.agri.gbAqRow", { label: i18n.t(GB_AQUACULTURE_STATUS_KEYS[status.value]), n: n(count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.agri.gbAqStatusNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.agri.gbAqCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.agri.gbAqNiNote")}</LegendNote>
    <LegendNote>{GB_AQUACULTURE_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 土壤母質：依土層深度 5 級序列色；未分類（NA）＝缺值斜線。 */
export function GbSoilParentMaterialLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const colors = gbSoilDepthColors(t.isDark);
  const n = (v: number) => i18n.formatNumber(v);
  return <div>
    <LegendTitle zh={layerTitle("gbSoilParentMaterial", i18n)} en="Soil Parent Material" />
    <LegendNote>{i18n.t("legend.agri.gbSoilDepthTitle")}</LegendNote>
    {GB_SOIL_DEPTHS.map((d, i) => (
      <LegendRow key={d.value} swatch={<SwatchSquare color={colors[i]!} />}>
        {i18n.t("legend.agri.gbSoilRow", { label: i18n.t(GB_SOIL_DEPTH_KEYS[d.value]), n: n(d.count) })}
      </LegendRow>
    ))}
    <LegendRow swatch={<SwatchHatch />}>{i18n.t("legend.agri.gbSoilRow", { label: i18n.t("legend.agri.gbSoilNa"), n: n(GB_SOIL_NA_COUNT) })}</LegendRow>
    <LegendNote>{i18n.t("legend.agri.gbSoilModelNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.agri.gbSoilCoverage")}</LegendNote>
    <LegendNote>{GB_SOIL_ATTRIBUTION}</LegendNote>
  </div>;
}
