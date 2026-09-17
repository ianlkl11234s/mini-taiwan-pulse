import { Row } from "./shared";
import { COMPANY_INDUSTRY_MID_OPTIONS, companyGridAreaKm2, COMPANY_GRID_SCALES } from "../../data/businessRegistryTypes";
import {
  COMPANY_AGE_BINS, COMPANY_DEMOGRAPHICS_SCALES, COMPANY_INDUSTRY_GROUPS,
  companyIndustryFields, companyIndustryGroupLabels,
} from "../../data/businessDemographicsTypes";

function formatTwd(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString("zh-TW")} 元`
    : "";
}

/**
 * 只陳述同一門牌的登記聚合事實；不推論借址、空殼、違法或異常。
 * 公開契約為 address / n_companies / capital_sum / capital_median。
 */
export function CommonRegistrationAddressesPanel({ props }: { props: Record<string, unknown> }) {
  const nCompanies = typeof props.n_companies === "number" ? props.n_companies : null;
  return (
    <>
      <Row label="地址" value={String(props.address ?? "")} />
      <Row
        label="共同登記公司數"
        value={nCompanies == null ? "" : `${nCompanies.toLocaleString("zh-TW")} 家`}
      />
      <Row label="資本額總和" value={formatTwd(props.capital_sum)} />
      <Row label="資本額中位數" value={formatTwd(props.capital_median)} />
    </>
  );
}

function flag(value: unknown): string {
  return Number(value) === 1 ? "是" : Number(value) === 0 ? "否" : "";
}

export function CompanyPointsPanel({ props }: { props: Record<string, unknown> }) {
  const gridId = String(props.grid_id ?? "");
  const gridScale = gridId.startsWith("G1500_") ? COMPANY_GRID_SCALES[2]
    : gridId.startsWith("G450_") ? COMPANY_GRID_SCALES[1] : null;
  if (gridScale) {
    const companies = typeof props.n_companies === "number" && Number.isFinite(props.n_companies) && props.n_companies >= 0
      ? props.n_companies : null;
    const density = companies == null ? null : companies / companyGridAreaKm2(gridScale);
    return (
      <>
        <Row label="概覽網格尺度" value={gridScale.label} />
        <Row label="公司數" value={companies == null ? "缺值" : countLabel(companies)} />
        <Row label="公司密度" value={density == null ? "缺值" : `${density.toLocaleString("zh-TW", { maximumFractionDigits: 1 })} 家／km²`} />
        <Row label="快照" value="202608；未套用篩選條件的公司密度概覽，缺值不視為 0。" />
      </>
    );
  }
  if (props.n_companies != null || props.n_manufacturing != null) {
    return (
      <>
        <Row label="公司數" value={countLabel(props.n_companies)} />
        <Row label="製造業公司數" value={countLabel(props.n_manufacturing)} />
        <Row label="解讀" value="本格納入全部已定位 records；放大至 z12 可點擊個別公司。" />
      </>
    );
  }
  const industryCode = typeof props.industry_mid === "string" ? props.industry_mid : "";
  const industry = COMPANY_INDUSTRY_MID_OPTIONS.find((o) => o.value === industryCode);
  const year = Number(props.setup_year);
  const quantile = Number(props.capital_q);
  return (
    <>
      <Row label="公司名稱" value={String(props.company_name ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="資本額" value={formatTwd(props.capital_total) ? `${formatTwd(props.capital_total)}（202608 快照）` : ""} />
      <Row label="資本額分位" value={Number.isFinite(quantile) ? (quantile === 0 ? "缺值" : `Q${quantile}`) : ""} />
      <Row label="行業中類" value={industry ? industry.label : industryCode} />
      <Row label="設立年" value={Number.isFinite(year) ? String(year) : ""} />
      <Row label="來源群組" value={String(props.categories ?? "")} />
      <Row label="製造業" value={flag(props.is_manufacturing)} />
      <Row label="地址不一致" value={flag(props.addr_mismatch)} />
      <Row label="上市櫃" value={flag(props.is_listed)} />
      <Row label="有商標" value={flag(props.has_trademark)} />
    </>
  );
}

function countLabel(value: unknown): string {
  const count = typeof value === "number" ? value : NaN;
  return Number.isFinite(count) ? `${count.toLocaleString("zh-TW")} 家` : "";
}

function densityValue(value: unknown, unit: string): string {
  const density = typeof value === "number" ? value : NaN;
  return Number.isFinite(density) && density >= 0
    ? `${density.toLocaleString("zh-TW", { maximumFractionDigits: 1 })} ${unit}／km²`
    : "缺值";
}

function gridMeters(value: unknown): string {
  const meters = typeof value === "number" ? value : NaN;
  return Number.isFinite(meters) && meters > 0 ? `${meters.toLocaleString("zh-TW")} m` : "缺值";
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
  const records = typeof props.n_records === "number" && Number.isFinite(props.n_records) && props.n_records >= 0
    ? `${props.n_records.toLocaleString("zh-TW")} ${recordUnit}`
    : "缺值";
  return <>
    <Row label="網格 ID" value={String(props.grid_id ?? "") || "缺值"} />
    <Row label="網格尺度" value={gridMeters(props.grid_size_m)} />
    <Row label="格內筆數" value={records} />
    <Row label="密度" value={densityValue(props.density_per_km2, recordUnit)} />
    <Row label="快照與粒度" value={`${snapshot}；${grain}。`} />
  </>;
}

export function CompanyCapitalGridPanel({ props }: { props: Record<string, unknown> }) {
  const nCompanies = Number(props.n_companies);
  const gridId = String(props.grid_id ?? "");
  const scale = gridId.startsWith("G1500_") ? "1.5 km" : gridId.startsWith("G450_") ? "450 m" : "150 m";
  return (
    <>
      <Row label="網格尺度" value={scale} />
      <Row label="網格 ID" value={gridId} />
      <Row label="公司數" value={Number.isFinite(nCompanies) ? `${nCompanies.toLocaleString("zh-TW")} 家` : ""} />
      <Row label="資本額總和" value={formatTwd(props.capital_sum) ? `${formatTwd(props.capital_sum)}（202608 快照）` : ""} />
      <Row label="資本額中位數" value={formatTwd(props.capital_median) ? `${formatTwd(props.capital_median)}（202608 快照）` : "缺值"} />
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
  const params = props.__demographics_params as Record<string, number> | undefined;
  const midIdx = params?.companyIndustryDistributionMidIdx ?? 0;
  const midCode = midIdx > 0 ? COMPANY_INDUSTRY_MID_OPTIONS[midIdx - 1]?.value : undefined;
  const mask = params?.companyIndustryGroupsMask ?? 2047;
  const fields = companyIndustryFields(mask, midCode);
  const values = fields.map((field) => validCount(props[field]));
  const count = values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value!, 0) : null;
  const scale = demographicsScale(props);
  const density = count === null ? null : count / companyGridAreaKm2(scale.areaScale);
  const label = midCode ? COMPANY_INDUSTRY_MID_OPTIONS.find((option) => option.value === midCode)?.label ?? midCode : companyIndustryGroupLabels(mask).join("、") || "未選分類";
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
    <Row label="網格尺度" value={scale.label} />
    <Row label="選取分類" value={label} />
    <Row label="公司數" value={count === null ? "缺值" : `${count.toLocaleString("zh-TW")} 家`} />
    <Row label="公司密度" value={density === null ? "缺值" : `${density.toLocaleString("zh-TW", { maximumFractionDigits: 1 })} 家／km²`} />
    {groupRows.map(({ group, count: groupCount }) => {
      const isTop = topCount !== null && groupCount === topCount && groupCount > 0;
      const share = count !== null && groupCount !== null && count > 0 ? `（${(groupCount / count * 100).toFixed(1)}%）` : "";
      return <Row key={group.value} label={isTop ? "最多（含並列）" : "產業群組"} color={group.color} value={`${group.label}：${groupCount === null ? "缺值" : `${groupCount.toLocaleString("zh-TW")} 家${share}`}`} />;
    })}
    <Row label="解讀" value={(params?.companyIndustryDisplayIdx ?? 0) === 1 ? "顏色表示所選產業合計密度；下列占比以所選公司合計為分母。聚焦中類優先於群組。" : midCode ? "已聚焦單一行業中類，固定使用所屬群組色，優先於產業群組多選。登記第一順位行業中類不代表實際主營產業；缺值不視為 0。" : "顏色為已選群組中筆數最多者；最多不一定過半；占比以所選公司合計為分母，不代表實際主營產業。同量、真實 0 與必要欄位缺失另行呈現。"} />
  </>;
}

export function CompanyAgeStructurePanel({ props }: { props: Record<string, unknown> }) {
  const known = validCount(props.age_known);
  const recent = validCount(props.age_recent);
  const recentShare = known !== null && known > 0 && recent !== null ? recent / known : null;
  const median = typeof props.age_median === "number" && Number.isFinite(props.age_median) ? props.age_median : null;
  return <>
    <Row label="網格尺度" value={demographicsScale(props).label} />
    <Row label="已知設立年" value={known === null ? "缺值" : `${known.toLocaleString("zh-TW")} 家`} />
    <Row label="樣本提醒" value={known !== null && known < 20 ? "已知設立年少於 20 家，占比容易極端。" : ""} />
    <Row label="近 5 年設立" value={recentShare === null ? "缺值" : `${recent?.toLocaleString("zh-TW")} 家（${(recentShare * 100).toFixed(1)}%）`} />
    <Row label="年齡中位數" value={median === null ? "缺值" : `${median.toFixed(1)} 年`} />
    {COMPANY_AGE_BINS.map(([field, label]) => {
      const count = validCount(props[field]);
      return <Row key={field} label={label} value={count === null || known === null || known === 0 ? "缺值" : `${count.toLocaleString("zh-TW")} 家（${(count / known * 100).toFixed(1)}%）`} />;
    })}
    <Row label="缺失／無效年" value={`${validCount(props.age_missing) ?? "缺值"} ／ ${validCount(props.age_invalid) ?? "缺值"}`} />
    <Row label="快照" value="202608；年齡約為 2026 減設立年。近 5 年為 2022–2026，分母只含已知合法設立年。" />
  </>;
}

export function FactoryLocationsPanel({ props }: { props: Record<string, unknown> }) {
  if (props.n_factories != null) {
    return (
      <>
        <Row label="已定位工廠數" value={countLabel(props.n_factories)} />
        <Row label="解讀" value="本格納入全部已定位生產中工廠；放大至 z11 可點擊個別工廠。" />
      </>
    );
  }
  return (
    <>
      <Row label="工廠名稱" value={String(props.factory_name ?? "")} />
      <Row label="工廠編號" value={String(props.factory_id ?? "")} />
      <Row label="統編" value={String(props.uniform_no ?? "")} />
      <Row label="工廠地址" value={String(props.factory_address ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="組織型態" value={String(props.org_type ?? "")} />
      <Row label="登記核准日" value={String(props.registered_date ?? "")} />
      <Row label="產業類別" value={String(props.industry_categories ?? "")} />
      <Row label="主要產品" value={String(props.main_products ?? "")} />
      <Row label="定位精度" value={String(props.geocode_precision ?? "")} />
    </>
  );
}

export function RegulatedFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Row label="設施名稱" value={String(props.facility_name ?? "")} />
      <Row label="列管編號" value={String(props.emsno ?? "")} />
      <Row label="設施地址" value={String(props.facility_address ?? "")} />
      <Row label="行政區" value={[props.county, props.township].filter(Boolean).join(" ")} />
      <Row label="產業園區" value={String(props.industry_area_name ?? "")} />
      <Row label="行業" value={[props.industry_group, props.industry_name].filter(Boolean).join(" / ")} />
      <Row label="空氣列管" value={flag(props.isair)} />
      <Row label="水列管" value={flag(props.iswater)} />
      <Row label="廢棄物列管" value={flag(props.iswaste)} />
      <Row label="毒化物列管" value={flag(props.istoxic)} />
      <Row label="土壤列管" value={flag(props.issoil)} />
      <Row label="座標來源" value={String(props.coord_source ?? "")} />
      <Row label="公司串接" value={flag(props.company_joined)} />
      <Row label="公司名稱" value={String(props.company_name ?? "")} />
      <Row label="公司統編" value={String(props.uniform_no ?? "")} />
      <Row label="公司群組" value={String(props.company_categories ?? "")} />
      <Row label="公司行業碼" value={String(props.company_industry_code ?? "")} />
      <Row
        label="公司資本額"
        value={formatTwd(props.company_capital_total) ? `${formatTwd(props.company_capital_total)}（202608 快照）` : ""}
      />
    </>
  );
}

export function IndustrialParkBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const area = Number(props.area_ha);
  return (
    <>
      <Row label="園區名稱" value={String(props.park_name ?? "")} />
      <Row label="英文名稱" value={String(props.park_name_en ?? "")} />
      <Row label="園區 ID" value={String(props.park_id ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="管理單位" value={String(props.manage_unit ?? "")} />
      <Row label="開發狀態" value={String(props.dev_status ?? "")} />
      <Row label="用地類別" value={String(props.zone_grade ?? "")} />
      <Row label="產業負載" value={String(props.industry_load ?? "")} />
      <Row label="面積" value={Number.isFinite(area) ? `${area.toLocaleString("zh-TW")} 公頃` : ""} />
      <Row label="座標來源" value={String(props.coord_source ?? "")} />
      <Row label="來源數" value={String(props.n_sources ?? "")} />
      <Row label="官方園區 ID" value={String(props.official_park_id_80190 ?? "")} />
    </>
  );
}

export function IndustrialParkComparisonPanel({ props }: { props: Record<string, unknown> }) {
  const area = Number(props.area_ha);
  const factories = Number(props.factory_count);
  const companies = Number(props.company_count);
  const capitalRows = Number(props.company_capital_nonnull_count);
  return (
    <>
      <Row label="園區名稱" value={String(props.park_name ?? "")} />
      <Row label="園區 ID" value={String(props.park_id ?? "")} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="面積" value={Number.isFinite(area) ? `${area.toLocaleString("zh-TW")} 公頃` : ""} />
      <Row label="觀測工廠數" value={Number.isFinite(factories) ? `${factories.toLocaleString("zh-TW")} 家` : ""} />
      <Row label="觀測公司數" value={Number.isFinite(companies) ? `${companies.toLocaleString("zh-TW")} 家` : ""} />
      <Row
        label="公司資本額"
        value={formatTwd(props.company_capital_total_sum) ? `${formatTwd(props.company_capital_total_sum)}（202608 快照）` : ""}
      />
      <Row label="資本額有效筆數" value={Number.isFinite(capitalRows) ? capitalRows.toLocaleString("zh-TW") : ""} />
      <Row label="觀測限制" value="0 僅表示沒有具有效座標且被指派至此 polygon 的觀測實體，不代表實際不存在。" />
    </>
  );
}
