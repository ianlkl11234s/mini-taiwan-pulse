import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
import { COMPANY_INDUSTRY_MID_OPTIONS, companyGridAreaKm2, COMPANY_GRID_SCALES } from "../../data/businessRegistryTypes";
import {
  COMPANY_AGE_BINS, COMPANY_DEMOGRAPHICS_SCALES, COMPANY_INDUSTRY_GROUPS,
  companyIndustryFields, companyIndustryGroupLabels,
} from "../../data/businessDemographicsTypes";

type I18n = ReturnType<typeof useLocale>;

function formatTwd(value: unknown, { t, formatNumber }: I18n): string {
  return typeof value === "number" && Number.isFinite(value)
    ? t("popup.businessRegistry.yuan", { value: formatNumber(Math.round(value)) })
    : "";
}

/** 「{value}（202608 快照）」；金額為空時回傳空字串 */
function twdWithSnapshot(value: unknown, i18n: I18n): string {
  const twd = formatTwd(value, i18n);
  return twd ? i18n.t("popup.businessRegistry.withSnapshot", { value: twd }) : "";
}

function missing({ t }: I18n): string {
  return t("popup.common.missingValue");
}

function companiesLabel(count: number, { t, formatNumber }: I18n): string {
  return t("popup.businessRegistry.companyCount", { count, n: formatNumber(count) });
}

/**
 * 只陳述同一門牌的登記聚合事實；不推論借址、空殼、違法或異常。
 * 公開契約為 address / n_companies / capital_sum / capital_median。
 */
export function CommonRegistrationAddressesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const nCompanies = typeof props.n_companies === "number" ? props.n_companies : null;
  return (
    <>
      <Row field="address" value={String(props.address ?? "")} />
      <Row
        label={t("popup.businessRegistry.sharedCompanies")}
        value={nCompanies == null ? "" : companiesLabel(nCompanies, i18n)}
      />
      <Row label={t("popup.businessRegistry.capitalSum")} value={formatTwd(props.capital_sum, i18n)} />
      <Row label={t("popup.businessRegistry.capitalMedian")} value={formatTwd(props.capital_median, i18n)} />
    </>
  );
}

function flag(value: unknown, { t }: I18n): string {
  return Number(value) === 1 ? t("popup.common.yes") : Number(value) === 0 ? t("popup.common.no") : "";
}

export function CompanyPointsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const gridId = String(props.grid_id ?? "");
  const gridScale = gridId.startsWith("G1500_") ? COMPANY_GRID_SCALES[2]
    : gridId.startsWith("G450_") ? COMPANY_GRID_SCALES[1] : null;
  if (gridScale) {
    const companies = typeof props.n_companies === "number" && Number.isFinite(props.n_companies) && props.n_companies >= 0
      ? props.n_companies : null;
    const density = companies == null ? null : companies / companyGridAreaKm2(gridScale);
    return (
      <>
        <Row label={t("popup.businessRegistry.overviewScale")} value={gridScale.label} />
        <Row field="companyCount" value={companies == null ? missing(i18n) : countLabel(companies, i18n)} />
        <Row label={t("popup.businessRegistry.companyDensity")} value={density == null ? missing(i18n) : t("popup.businessRegistry.companyDensityValue", { value: i18n.formatNumber(density, { maximumFractionDigits: 1 }) })} />
        <Row field="snapshot" value={t("popup.businessRegistry.overviewNote")} />
      </>
    );
  }
  if (props.n_companies != null || props.n_manufacturing != null) {
    return (
      <>
        <Row field="companyCount" value={countLabel(props.n_companies, i18n)} />
        <Row label={t("popup.businessRegistry.mfgCount")} value={countLabel(props.n_manufacturing, i18n)} />
        <Row label={t("popup.businessRegistry.interpretation")} value={t("popup.businessRegistry.cellNoteCompany")} />
      </>
    );
  }
  const industryCode = typeof props.industry_mid === "string" ? props.industry_mid : "";
  const industry = COMPANY_INDUSTRY_MID_OPTIONS.find((o) => o.value === industryCode);
  const year = Number(props.setup_year);
  const quantile = Number(props.capital_q);
  return (
    <>
      <Row label={t("popup.businessRegistry.companyName")} value={String(props.company_name ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="capital" value={twdWithSnapshot(props.capital_total, i18n)} />
      <Row label={t("popup.businessRegistry.capitalQuantile")} value={Number.isFinite(quantile) ? (quantile === 0 ? missing(i18n) : `Q${quantile}`) : ""} />
      <Row label={t("popup.businessRegistry.industryMid")} value={industry ? industry.label : industryCode} />
      <Row label={t("popup.businessRegistry.setupYear")} value={Number.isFinite(year) ? String(year) : ""} />
      <Row label={t("popup.businessRegistry.sourceGroup")} value={String(props.categories ?? "")} />
      <Row label={t("popup.businessRegistry.manufacturing")} value={flag(props.is_manufacturing, i18n)} />
      <Row label={t("popup.businessRegistry.addrMismatch")} value={flag(props.addr_mismatch, i18n)} />
      <Row label={t("popup.businessRegistry.listed")} value={flag(props.is_listed, i18n)} />
      <Row label={t("popup.businessRegistry.hasTrademark")} value={flag(props.has_trademark, i18n)} />
    </>
  );
}

function countLabel(value: unknown, i18n: I18n): string {
  const count = typeof value === "number" ? value : NaN;
  return Number.isFinite(count) ? companiesLabel(count, i18n) : "";
}

function densityValue(value: unknown, unit: string, i18n: I18n): string {
  const density = typeof value === "number" ? value : NaN;
  return Number.isFinite(density) && density >= 0
    ? i18n.t("popup.businessRegistry.densityPerKm2", { value: i18n.formatNumber(density, { maximumFractionDigits: 1 }), unit })
    : missing(i18n);
}

function gridMeters(value: unknown, i18n: I18n): string {
  const meters = typeof value === "number" ? value : NaN;
  return Number.isFinite(meters) && meters > 0 ? `${i18n.formatNumber(meters)} m` : missing(i18n);
}

/** 三種工商密度格共用的欄位契約；快照與資料粒度由各圖層明確傳入。 */
export function IndustrialDensityGridPanel({
  props, snapshot, grain, recordUnit,
}: {
  props: Record<string, unknown>;
  snapshot: string;
  grain: string;
  recordUnit: string;
}) {
  const i18n = useLocale();
  const { t } = i18n;
  const records = typeof props.n_records === "number" && Number.isFinite(props.n_records) && props.n_records >= 0
    ? `${i18n.formatNumber(props.n_records)} ${recordUnit}`
    : missing(i18n);
  return <>
    <Row field="gridId" value={String(props.grid_id ?? "") || missing(i18n)} />
    <Row field="gridScale" value={gridMeters(props.grid_size_m, i18n)} />
    <Row label={t("popup.businessRegistry.recordsInCell")} value={records} />
    <Row label={t("popup.businessRegistry.density")} value={densityValue(props.density_per_km2, recordUnit, i18n)} />
    <Row label={t("popup.businessRegistry.snapshotGrain")} value={t("popup.businessRegistry.snapshotGrainValue", { snapshot, grain })} />
  </>;
}

export function CompanyCapitalGridPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const nCompanies = Number(props.n_companies);
  const gridId = String(props.grid_id ?? "");
  const scale = gridId.startsWith("G1500_") ? "1.5 km" : gridId.startsWith("G450_") ? "450 m" : "150 m";
  return (
    <>
      <Row field="gridScale" value={scale} />
      <Row field="gridId" value={gridId} />
      <Row field="companyCount" value={Number.isFinite(nCompanies) ? companiesLabel(nCompanies, i18n) : ""} />
      <Row label={t("popup.businessRegistry.capitalSum")} value={twdWithSnapshot(props.capital_sum, i18n)} />
      <Row label={t("popup.businessRegistry.capitalMedian")} value={twdWithSnapshot(props.capital_median, i18n) || missing(i18n)} />
    </>
  );
}

function validCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function demographicsScale(props: Record<string, unknown>) {
  return String(props.grid_id ?? "").startsWith("G1500_") ? COMPANY_DEMOGRAPHICS_SCALES[1] : COMPANY_DEMOGRAPHICS_SCALES[0];
}

export function CompanyIndustryDistributionPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const params = props.__demographics_params as Record<string, number> | undefined;
  const midIdx = params?.companyIndustryDistributionMidIdx ?? 0;
  const midCode = midIdx > 0 ? COMPANY_INDUSTRY_MID_OPTIONS[midIdx - 1]?.value : undefined;
  const mask = params?.companyIndustryGroupsMask ?? 2047;
  const fields = companyIndustryFields(mask, midCode);
  const values = fields.map((field) => validCount(props[field]));
  const count = values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value!, 0) : null;
  const scale = demographicsScale(props);
  const density = count === null ? null : count / companyGridAreaKm2(scale.areaScale);
  const label = midCode ? COMPANY_INDUSTRY_MID_OPTIONS.find((option) => option.value === midCode)?.label ?? midCode : companyIndustryGroupLabels(mask).join(t("popup.common.listSeparator")) || t("popup.businessRegistry.noneSelected");
  const groupRows = midCode ? [] : COMPANY_INDUSTRY_GROUPS.map((group, index) => {
    if ((mask & (1 << index)) === 0) return null;
    const groupValues = companyIndustryFields(1 << index).map((field) => validCount(props[field]));
    const groupCount = groupValues.every((value) => value !== null)
      ? groupValues.reduce((sum, value) => sum + value!, 0)
      : null;
    return { group, count: groupCount };
  }).filter((row): row is { group: (typeof COMPANY_INDUSTRY_GROUPS)[number]; count: number | null } => row !== null)
    .sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  const topCount = groupRows[0]?.count ?? null;
  return <>
    <Row field="gridScale" value={scale.label} />
    <Row label={t("popup.businessRegistry.selectedCategory")} value={label} />
    <Row field="companyCount" value={count === null ? missing(i18n) : companiesLabel(count, i18n)} />
    <Row label={t("popup.businessRegistry.companyDensity")} value={density === null ? missing(i18n) : t("popup.businessRegistry.companyDensityValue", { value: i18n.formatNumber(density, { maximumFractionDigits: 1 }) })} />
    {groupRows.map(({ group, count: groupCount }) => {
      const isTop = topCount !== null && groupCount === topCount && groupCount > 0;
      const groupText = groupCount === null ? missing(i18n)
        : count !== null && count > 0
          ? t("popup.businessRegistry.companyWithShare", { count: groupCount, n: i18n.formatNumber(groupCount), pct: (groupCount / count * 100).toFixed(1) })
          : companiesLabel(groupCount, i18n);
      return <Row key={group.value} label={t(isTop ? "popup.businessRegistry.mostTied" : "popup.businessRegistry.industryGroup")} color={group.color} value={t("popup.businessRegistry.groupLine", { group: group.label, value: groupText })} />;
    })}
    <Row label={t("popup.businessRegistry.interpretation")} value={t((params?.companyIndustryDisplayIdx ?? 0) === 1 ? "popup.businessRegistry.noteDisplayDensity" : midCode ? "popup.businessRegistry.noteMid" : "popup.businessRegistry.noteGroup")} />
  </>;
}

export function CompanyAgeStructurePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const known = validCount(props.age_known);
  const recent = validCount(props.age_recent);
  const recentShare = known !== null && known > 0 && recent !== null ? recent / known : null;
  const median = typeof props.age_median === "number" && Number.isFinite(props.age_median) ? props.age_median : null;
  return <>
    <Row field="gridScale" value={demographicsScale(props).label} />
    <Row label={t("popup.businessRegistry.knownSetup")} value={known === null ? missing(i18n) : companiesLabel(known, i18n)} />
    <Row label={t("popup.businessRegistry.sampleWarn")} value={known !== null && known < 20 ? t("popup.businessRegistry.sampleWarnText") : ""} />
    <Row label={t("popup.businessRegistry.recent5")} value={recentShare === null || recent === null ? missing(i18n) : t("popup.businessRegistry.companyWithShare", { count: recent, n: i18n.formatNumber(recent), pct: (recentShare * 100).toFixed(1) })} />
    <Row label={t("popup.businessRegistry.medianAge")} value={median === null ? missing(i18n) : t("popup.businessRegistry.yearsValue", { value: median.toFixed(1) })} />
    {COMPANY_AGE_BINS.map(([field, label]) => {
      const count = validCount(props[field]);
      return <Row key={field} label={label} value={count === null || known === null || known === 0 ? missing(i18n) : t("popup.businessRegistry.companyWithShare", { count, n: i18n.formatNumber(count), pct: (count / known * 100).toFixed(1) })} />;
    })}
    <Row label={t("popup.businessRegistry.missingInvalidYear")} value={t("popup.businessRegistry.pairSep", { a: validCount(props.age_missing) ?? missing(i18n), b: validCount(props.age_invalid) ?? missing(i18n) })} />
    <Row field="snapshot" value={t("popup.businessRegistry.ageNote")} />
  </>;
}

function factoryCountLabel(value: unknown, { t, formatNumber }: I18n): string {
  const count = typeof value === "number" ? value : NaN;
  return Number.isFinite(count) ? t("popup.businessRegistry.factoryCount", { count, n: formatNumber(count) }) : "";
}

export function FactoryLocationsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  if (props.n_factories != null) {
    return (
      <>
        <Row label={t("popup.businessRegistry.locatedFactories")} value={factoryCountLabel(props.n_factories, i18n)} />
        <Row label={t("popup.businessRegistry.interpretation")} value={t("popup.businessRegistry.cellNoteFactory")} />
      </>
    );
  }
  return (
    <>
      <Row label={t("popup.businessRegistry.factoryName")} value={String(props.factory_name ?? "")} />
      <Row label={t("popup.businessRegistry.factoryId")} value={String(props.factory_id ?? "")} />
      <Row label={t("popup.businessRegistry.uniformNo")} value={String(props.uniform_no ?? "")} />
      <Row label={t("popup.businessRegistry.factoryAddress")} value={String(props.factory_address ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row label={t("popup.businessRegistry.orgType")} value={String(props.org_type ?? "")} />
      <Row label={t("popup.businessRegistry.registeredDate")} value={String(props.registered_date ?? "")} />
      <Row label={t("popup.businessRegistry.industryCategories")} value={String(props.industry_categories ?? "")} />
      <Row label={t("popup.businessRegistry.mainProducts")} value={String(props.main_products ?? "")} />
      <Row field="positionAccuracy" value={String(props.geocode_precision ?? "")} />
    </>
  );
}

export function RegulatedFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  return (
    <>
      <Row field="facilityName" value={String(props.facility_name ?? "")} />
      <Row label={t("popup.businessRegistry.emsno")} value={String(props.emsno ?? "")} />
      <Row label={t("popup.businessRegistry.facilityAddress")} value={String(props.facility_address ?? "")} />
      <Row field="district" value={[placeName(String(props.county ?? ""), i18n), placeTown(String(props.county ?? ""), String(props.township ?? ""), i18n)].filter(Boolean).join(" ")} />
      <Row label={t("popup.businessRegistry.industryArea")} value={String(props.industry_area_name ?? "")} />
      <Row field="industry" value={[props.industry_group, props.industry_name].filter(Boolean).join(" / ")} />
      <Row label={t("popup.businessRegistry.regAir")} value={flag(props.isair, i18n)} />
      <Row label={t("popup.businessRegistry.regWater")} value={flag(props.iswater, i18n)} />
      <Row label={t("popup.businessRegistry.regWaste")} value={flag(props.iswaste, i18n)} />
      <Row label={t("popup.businessRegistry.regToxic")} value={flag(props.istoxic, i18n)} />
      <Row label={t("popup.businessRegistry.regSoil")} value={flag(props.issoil, i18n)} />
      <Row field="coordSource" value={String(props.coord_source ?? "")} />
      <Row label={t("popup.businessRegistry.companyJoined")} value={flag(props.company_joined, i18n)} />
      <Row label={t("popup.businessRegistry.companyName")} value={String(props.company_name ?? "")} />
      <Row label={t("popup.businessRegistry.companyUniformNo")} value={String(props.uniform_no ?? "")} />
      <Row label={t("popup.businessRegistry.companyGroup")} value={String(props.company_categories ?? "")} />
      <Row label={t("popup.businessRegistry.companyIndustryCode")} value={String(props.company_industry_code ?? "")} />
      <Row
        label={t("popup.businessRegistry.companyCapital")}
        value={twdWithSnapshot(props.company_capital_total, i18n)}
      />
    </>
  );
}

export function IndustrialParkBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const area = Number(props.area_ha);
  return (
    <>
      <Row label={t("popup.businessRegistry.parkName")} value={String(props.park_name ?? "")} />
      <Row label={t("popup.businessRegistry.parkNameEn")} value={String(props.park_name_en ?? "")} />
      <Row label={t("popup.businessRegistry.parkId")} value={String(props.park_id ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="managingAgency" value={String(props.manage_unit ?? "")} />
      <Row label={t("popup.businessRegistry.devStatus")} value={String(props.dev_status ?? "")} />
      <Row label={t("popup.businessRegistry.zoneGrade")} value={String(props.zone_grade ?? "")} />
      <Row label={t("popup.businessRegistry.industryLoad")} value={String(props.industry_load ?? "")} />
      <Row field="area" value={Number.isFinite(area) ? t("popup.businessRegistry.hectares", { value: i18n.formatNumber(area) }) : ""} />
      <Row field="coordSource" value={String(props.coord_source ?? "")} />
      <Row field="sourceCount" value={String(props.n_sources ?? "")} />
      <Row label={t("popup.businessRegistry.officialParkId")} value={String(props.official_park_id_80190 ?? "")} />
    </>
  );
}

export function IndustrialParkComparisonPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const area = Number(props.area_ha);
  const factories = Number(props.factory_count);
  const companies = Number(props.company_count);
  const capitalRows = Number(props.company_capital_nonnull_count);
  return (
    <>
      <Row label={t("popup.businessRegistry.parkName")} value={String(props.park_name ?? "")} />
      <Row label={t("popup.businessRegistry.parkId")} value={String(props.park_id ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="area" value={Number.isFinite(area) ? t("popup.businessRegistry.hectares", { value: i18n.formatNumber(area) }) : ""} />
      <Row label={t("popup.businessRegistry.observedFactories")} value={Number.isFinite(factories) ? t("popup.businessRegistry.factoryCount", { count: factories, n: i18n.formatNumber(factories) }) : ""} />
      <Row label={t("popup.businessRegistry.observedCompanies")} value={Number.isFinite(companies) ? companiesLabel(companies, i18n) : ""} />
      <Row
        label={t("popup.businessRegistry.companyCapital")}
        value={twdWithSnapshot(props.company_capital_total_sum, i18n)}
      />
      <Row label={t("popup.businessRegistry.capitalValidRows")} value={Number.isFinite(capitalRows) ? i18n.formatNumber(capitalRows) : ""} />
      <Row label={t("popup.businessRegistry.observationLimit")} value={t("popup.businessRegistry.observationLimitText")} />
    </>
  );
}
