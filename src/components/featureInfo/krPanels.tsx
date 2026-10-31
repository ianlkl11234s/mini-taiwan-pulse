// 南韓圖層 popup（2026-10-31 第 0 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { KR_DATA_SPECS, KR_UNMEASURED, KR_UNNAMED, pickL3, type KrField, type KrLayerSpec } from "../../data/krDataLayers";
import type { KrDataKey } from "../../data/krDataKeys";
import type { MessageKey } from "../../i18n/keys";
import { useLocale } from "../../state/localeStore";
import {
  KR_ADMIN_ATTRIBUTION, KR_ADMIN_COLOR, KR_ADMIN_FETCHED_AT, KR_ADMIN_LICENSE, KR_ADMIN_SOURCE_URL, KR_ADMIN_VERSION,
} from "../../data/krAdminTypes";
import {
  KR_AIRPORT_COLOR, KR_AIRPORTS_ATTRIBUTION, KR_AIRPORTS_URL, KR_BUS_STOPS_ATTRIBUTION, KR_BUS_STOPS_COLOR, KR_BUS_STOPS_URL, KR_FETCHED_AT,
  KR_FUEL_STATIONS_ATTRIBUTION, KR_FUEL_STATIONS_COLOR, KR_FUEL_STATIONS_URL, KR_NATIONAL_ROAD_COLOR, KR_NATIONAL_ROADS_ATTRIBUTION,
  KR_NATIONAL_ROADS_URL, KR_OIL_GAS_COLOR, KR_OSM_ATTRIBUTION, KR_OSM_LICENSE, KR_OSM_URL, KR_PIPELINE_COLORS, KR_PORT_COLOR as KR_PORT, KR_PORTAL_LICENSE, KR_PORTS_ATTRIBUTION, KR_PORTS_URL, KR_POWER_LINES_COLOR, KR_POWER_PLANTS_COLOR,
  KR_RAIL_LINES_COLOR, KR_RAIL_STATIONS_ATTRIBUTION, KR_RAIL_STATIONS_COLOR, KR_RAIL_STATIONS_URL, KR_RENEWABLES_COLOR,
  KR_SUBSTATIONS_COLOR, KR_TOWERS_COLOR, krFuelGroup, krFuelType, krNum, krOilGasType, krRailLineClass, krRailNetwork, krText, krVoltageClass,
} from "../../data/krInfraTypes";
import { KR_FUEL_GROUP_KEYS, KR_FUEL_TYPE_KEYS, KR_OIL_GAS_TYPE_KEYS, KR_RAIL_CLASS_KEYS, KR_RAIL_NETWORK_KEYS } from "../legend/krLegends";

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const LEVEL_KEYS = {
  sido: "popup.baseMap.krLevelSido",
  sgg: "popup.baseMap.krLevelSgg",
  emd: "popup.baseMap.krLevelEmd",
} as const;

/**
 * 南韓行政邊界（admdongkor ver20261001）：名稱、層級、所屬上級、行政安全部代碼與統計廳代碼並列。
 * 三個 tile layer 欄位不同：sido（sido_*）、sgg（sgg_*＋sido_*）、emd（emd_*＋sgg_*＋sido_*）。
 */
export function KrAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const level = text(props.level) as keyof typeof LEVEL_KEYS;
  const sido = [text(props.sido_name), text(props.sido_name_en)].filter(Boolean).join(" · ");
  const name = level === "emd" ? text(props.emd_name) : level === "sgg" ? text(props.sgg_name) : text(props.sido_name);
  const code = level === "emd" ? text(props.emd_code) : level === "sgg" ? text(props.sgg_code) : text(props.sido_code);
  const kostat = level === "emd" ? text(props.emd_code_kostat) : level === "sgg" ? text(props.sgg_code_kostat) : text(props.sido_code_kostat);
  return <>
    <Title color={KR_ADMIN_COLOR}>{name || t("popup.baseMap.krAdmin")}</Title>
    {level in LEVEL_KEYS ? <Row label={t("popup.baseMap.krLevel")} value={t(LEVEL_KEYS[level])} /> : null}
    {level === "sido" && text(props.sido_name_en) ? <Row label={t("popup.baseMap.krNameEnglish")} value={text(props.sido_name_en)} /> : null}
    {level !== "sido" ? <Row label={t("popup.baseMap.krSido")} value={sido} /> : null}
    {level === "emd" ? <Row label={t("popup.baseMap.krSgg")} value={[text(props.sgg_name), text(props.sgg_code)].filter(Boolean).join(" · ")} /> : null}
    <Row label={t("popup.baseMap.krMoisCode")} value={code} />
    {kostat ? <Row label={t("popup.baseMap.krKostatCode")} value={kostat} /> : null}
    <Row label={t("popup.baseMap.gbDataVersion")} value={KR_ADMIN_VERSION} />
    <SourceFooter props={{ source_org: KR_ADMIN_ATTRIBUTION, source_url: KR_ADMIN_SOURCE_URL, license: KR_ADMIN_LICENSE, fetched_at: KR_ADMIN_FETCHED_AT }} />
  </>;
}

// ─────────────────────────── 第 1 波（國土基礎）：交通＋能源 ───────────────────────────

const footer = (org: string, url: string, license: string) =>
  <SourceFooter props={{ source_org: org, source_url: url, license, fetched_at: KR_FETCHED_AT }} />;
const osmFooter = () => footer(KR_OSM_ATTRIBUTION, KR_OSM_URL, KR_OSM_LICENSE);
const portalFooter = (org: string, url: string) => footer(org, url, KR_PORTAL_LICENSE);
const place = (props: Record<string, unknown>) => [krText(props.sido), krText(props.sigungu)].filter(Boolean).join(" · ");
function useMw() {
  const { t } = useLocale();
  return (value: unknown) => {
    const n = krNum(value);
    return n != null ? t("popup.energy.gbMw", { value: n.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : "";
  };
}
function useKv() {
  const { t } = useLocale();
  return (props: Record<string, unknown>) => {
    const raw = krText(props.voltage);
    if (!raw) return t("popup.energy.gbVoltageUntagged");
    const kv = raw.split(";").map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0).map((n) => (n / 1000).toLocaleString());
    return kv.length ? `${[...new Set(kv)].join(" / ")} kV` : raw;
  };
}

/** 南韓公車站：站名、站號、行動簡碼、管理自治體（BIS）、所在市郡區。 */
export function KrBusStopsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return <>
    <Title color={KR_BUS_STOPS_COLOR}>{krText(props.name) || t("popup.transport.krBusTitle")}</Title>
    <Row label={t("popup.transport.krStopId")} value={krText(props.stop_id)} mono />
    <Row label={t("popup.transport.krMobileId")} value={krText(props.mobile_id)} mono />
    <Row label={t("popup.transport.krBisCity")} value={[krText(props.city_name), krText(props.bis)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.transport.krCollected")} value={krText(props.collected)} mono />
    {portalFooter(KR_BUS_STOPS_ATTRIBUTION, KR_BUS_STOPS_URL)}
  </>;
}

/** 南韓鐵道車站：站名、營運網（KORAIL／都市鐵道／兩者）、路線、營運者、出入口數。 */
export function KrRailStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const net = krRailNetwork(props.network);
  const exits = krNum(props.exits);
  return <>
    <Title color={net?.color ?? KR_RAIL_STATIONS_COLOR}>{krText(props.name) || t("popup.transport.krRailTitle")}</Title>
    <Row label={t("popup.transport.krNameEn")} value={krText(props.name_en)} />
    <Row label={t("popup.transport.krNetwork")} value={net ? t(KR_RAIL_NETWORK_KEYS[net.value]) : ""} />
    <Row label={t("popup.transport.krRoutes")} value={krText(props.routes)} />
    <Row label={t("popup.transport.krOperators")} value={krText(props.operators)} />
    <Row label={t("popup.transport.krKorailRegion")} value={krText(props.korail_region)} />
    <Row label={t("popup.transport.krExits")} value={exits != null ? String(exits) : ""} mono />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.transport.krRefDate")} value={krText(props.ref_date)} mono />
    {portalFooter(KR_RAIL_STATIONS_ATTRIBUTION, KR_RAIL_STATIONS_URL)}
  </>;
}

/** 南韓機場：KAC 14 座（官方）＋仁川（OSM 補缺）。 */
export function KrAirportsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const osm = krText(props.source) === "osm";
  return <>
    <Title color={KR_AIRPORT_COLOR}>{krText(props.name) || t("popup.transport.krAirportTitle")}</Title>
    <Row label="ICAO" value={krText(props.icao)} mono />
    <Row label="IATA" value={krText(props.iata)} mono />
    <Row label={t("popup.transport.krAddress")} value={krText(props.address)} />
    <Row label={t("popup.transport.krOperator")} value={krText(props.operator)} />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.transport.krDataSource")} value={osm ? t("legend.transport.krAirportOsm") : "한국공항공사"} />
    {osm ? osmFooter() : portalFooter(KR_AIRPORTS_ATTRIBUTION, KR_AIRPORTS_URL)}
  </>;
}

/** 南韓港灣區：港名（韓／英）、ENC 編號、面積。 */
export function KrPortsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const area = krNum(props.area_km2);
  return <>
    <Title color={KR_PORT}>{krText(props.name) || t("popup.transport.krPortTitle")}</Title>
    <Row label={t("popup.transport.krNameEn")} value={krText(props.name_en)} />
    <Row label={t("popup.transport.krEncNo")} value={krText(props.enc_no)} mono />
    <Row label={t("popup.transport.krArea")} value={area != null ? t("popup.transport.krKm2", { value: area.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : ""} />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbDataVersion")} value={krText(props.updated)} mono />
    {portalFooter(KR_PORTS_ATTRIBUTION, KR_PORTS_URL)}
  </>;
}

/** 南韓一般國道：路線號、維護機關、路段長度；只含一般國道。 */
export function KrNationalRoadsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const len = krNum(props.length_m);
  return <>
    <Title color={KR_NATIONAL_ROAD_COLOR}>{krText(props.route_no) ? t("popup.transport.krRoadTitle", { n: krText(props.route_no) }) : t("popup.transport.krRoadUntitled")}</Title>
    <Row label={t("popup.transport.krRoadAgency")} value={krText(props.agency)} />
    <Row label={t("popup.transport.krRoadDelegated")} value={krText(props.delegated)} />
    <Row label={t("popup.energy.gbLength")} value={len != null ? t("popup.energy.gbKm", { value: (len / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : ""} />
    <Row label={t("popup.transport.krRoadStartYear")} value={krText(props.start_year)} mono />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={krText(props.note)} />
    {portalFooter(KR_NATIONAL_ROADS_ATTRIBUTION, KR_NATIONAL_ROADS_URL)}
  </>;
}

/** 南韓鐵道線（OSM 補缺）：名稱、類別、營運者、電氣化、軌距、隧道／橋。 */
export function KrRailLinesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const cls = krRailLineClass(props.line_class);
  const tunnel = krText(props.tunnel);
  const bridge = krText(props.bridge);
  return <>
    <Title color={cls?.color ?? KR_RAIL_LINES_COLOR}>{krText(props.name) || t("popup.transport.krRailLineTitle")}</Title>
    <Row label={t("popup.transport.krRailClass")} value={cls ? t(KR_RAIL_CLASS_KEYS[cls.value]) : krText(props.line_class)} />
    <Row label={t("popup.transport.krOperators")} value={krText(props.operator)} />
    <Row label={t("popup.transport.krElectrified")} value={krText(props.electrified)} />
    <Row label={t("popup.transport.krGauge")} value={krText(props.gauge)} mono />
    <Row label={t("popup.transport.krStructure")} value={[tunnel && tunnel !== "no" ? t("popup.transport.krTunnel") : "", bridge && bridge !== "no" ? t("popup.transport.krBridge") : ""].filter(Boolean).join(" · ")} />
    <Row label={t("popup.transport.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.transport.krOsmSupplement")} />
    {osmFooter()}
  </>;
}

/** 南韓燃料／充電站：站名、類型（EV／LPG／氫／CNG·LNG）、地址、細類、充電機數。 */
export function KrFuelStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const ft = krFuelType(props.fuel_type);
  const chargers = krNum(props.chargers);
  return <>
    <Title color={ft?.color ?? KR_FUEL_STATIONS_COLOR}>{krText(props.name) || t("popup.energy.krFuelTitle")}</Title>
    <Row label={t("popup.energy.krFuelType")} value={ft ? t(KR_FUEL_TYPE_KEYS[ft.value]) : krText(props.fuel_type)} />
    <Row label={t("popup.energy.krAddress")} value={krText(props.address)} />
    <Row label={t("popup.energy.krSubtype")} value={krText(props.subtype)} />
    <Row label={t("popup.energy.krSupply")} value={krText(props.supply)} />
    <Row label={t("popup.energy.krUsage")} value={krText(props.usage)} />
    <Row label={t("popup.energy.krChargers")} value={chargers != null ? String(chargers) : ""} mono />
    <Row label={t("popup.energy.krBuildYear")} value={krText(props.build_year)} mono />
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    <Row label={t("popup.energy.krDataDate")} value={krText(props.data_date)} mono />
    {portalFooter(KR_FUEL_STATIONS_ATTRIBUTION, KR_FUEL_STATIONS_URL)}
  </>;
}

const SUBSTANCE_KEYS: Record<string, MessageKey> = {
  gas: "popup.energy.krSubstance_gas", oil: "popup.energy.krSubstance_oil", hydrocarbons: "popup.energy.krSubstance_hydrocarbons",
};
const KIND_KEYS = { plant: "popup.energy.krKindPlant", unit: "popup.energy.krKindUnit", generator: "popup.energy.krKindGenerator" } as const;

function KrOsmGeneration({ props, title, color, note }: { props: Record<string, unknown>; title: string; color: string; note: string }) {
  const { t } = useLocale();
  const mw = useMw();
  const g = krFuelGroup(props.fuel_group);
  const kind = KIND_KEYS[krText(props.kind) as keyof typeof KIND_KEYS];
  const area = krNum(props.area_m2);
  const height = krNum(props.height_m);
  const rotor = krNum(props.rotor_diameter_m);
  return <>
    <Title color={g?.color ?? color}>{krText(props.name) || krText(props.name_en) || title}</Title>
    <Row label={t("popup.energy.krNameEn")} value={krText(props.name) ? krText(props.name_en) : ""} />
    <Row label={t("popup.energy.krKind")} value={kind ? t(kind) : ""} />
    <Row label={t("popup.energy.gbFuel")} value={g ? t(KR_FUEL_GROUP_KEYS[g.value]) : t("popup.energy.gbUnstated")} />
    <Row label={t("popup.energy.krMethod")} value={krText(props.method)} />
    <Row label={t("popup.energy.gbCapacity")} value={mw(props.capacity_mw) || t("popup.energy.krCapacityUntagged")} />
    <Row label={t("popup.energy.krGenType")} value={krText(props.gen_type)} />
    <Row label={t("popup.energy.krHeight")} value={height != null ? t("popup.energy.gbMeters", { value: height.toLocaleString() }) : ""} />
    <Row label={t("popup.energy.krRotor")} value={rotor != null ? t("popup.energy.gbMeters", { value: rotor.toLocaleString() }) : ""} />
    <Row label={t("popup.energy.krArea")} value={area != null ? t("popup.energy.krM2", { value: area.toLocaleString(undefined, { maximumFractionDigits: 0 }) }) : ""} />
    <Row label={t("popup.energy.gbOperator")} value={krText(props.operator)} />
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={note} />
    {osmFooter()}
  </>;
}

/** 南韓電廠（OSM 補缺）：名稱、燃料、容量（未標≠0）、營運者；註明小型設施覆蓋不足。 */
export function KrPowerPlantsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return <KrOsmGeneration props={props} title={t("popup.energy.krPlantTitle")} color={KR_POWER_PLANTS_COLOR} note={t("legend.energy.krPlantsCoverage")} />;
}

/** 南韓再生能源設施點（OSM 補缺）：風機、太陽能陣列、水力、生質。 */
export function KrRenewablesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return <KrOsmGeneration props={props} title={t("popup.energy.krRenewTitle")} color={KR_RENEWABLES_COLOR} note={t("legend.energy.krRenewCoverage")} />;
}

/** 南韓輸配電線（OSM 補缺）：名稱、電壓、類型（架空／地下／海底）、營運者、線長。 */
export function KrPowerLinesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const kv = useKv();
  const v = krVoltageClass(props.voltage_class);
  const loc = krText(props.location);
  const cable = props.kind === "cable";
  const km = krNum(props.length_km);
  return <>
    <Title color={v?.color ?? KR_POWER_LINES_COLOR}>{krText(props.name) || t("popup.energy.gbLineUnnamed")}</Title>
    <Row label={t("popup.energy.gbVoltage")} value={kv(props)} />
    <Row label={t("popup.energy.gbLineKind")} value={cable || loc === "underground" || loc === "underwater" ? t(loc === "underwater" ? "popup.energy.gbCableSubsea" : "popup.energy.gbCableUnderground") : t("popup.energy.gbOverhead")} />
    <Row label={t("popup.energy.krCircuits")} value={krText(props.circuits)} mono />
    <Row label={t("popup.energy.gbOperator")} value={krText(props.operator)} />
    <Row label={t("popup.energy.gbLength")} value={km != null ? (km < 0.1 ? t("popup.energy.gbKmUnder") : t("popup.energy.gbKm", { value: km.toLocaleString(undefined, { maximumFractionDigits: 1 }) })) : ""} />
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.energy.krGridNote")} />
    {osmFooter()}
  </>;
}

/** 南韓變電所（OSM 補缺）：名稱、電壓、類型、營運者。 */
export function KrSubstationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const kv = useKv();
  const v = krVoltageClass(props.voltage_class);
  const type = krText(props.substation);
  const area = krNum(props.area_m2);
  return <>
    <Title color={v?.color ?? KR_SUBSTATIONS_COLOR}>{krText(props.name) || krText(props.name_en) || t("popup.energy.gbSubstationUnnamed")}</Title>
    <Row label={t("popup.energy.gbVoltage")} value={kv(props)} />
    <Row label={t("popup.energy.gbSubstationType")} value={/^yes$/i.test(type) ? "" : type.replace(/_/g, " ")} />
    <Row label={t("popup.energy.gbOperator")} value={krText(props.operator)} />
    <Row label={t("popup.energy.krArea")} value={area != null ? t("popup.energy.krM2", { value: area.toLocaleString(undefined, { maximumFractionDigits: 0 }) }) : ""} />
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.energy.krGridNote")} />
    {osmFooter()}
  </>;
}

/** 南韓高壓鐵塔（OSM 補缺）。 */
export function KrPowerTowersPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const kv = krNum(props.voltage_max_kv);
  return <>
    <Title color={KR_TOWERS_COLOR}>{krText(props.ref) || t("popup.energy.krTowerTitle")}</Title>
    <Row label={t("popup.energy.gbVoltage")} value={kv != null ? `${kv.toLocaleString()} kV` : ""} />
    <Row label={t("popup.energy.krDesign")} value={krText(props.design)} />
    <Row label={t("popup.energy.krStructure")} value={krText(props.structure)} />
    <Row label={t("popup.energy.gbOperator")} value={krText(props.operator)} />
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    {osmFooter()}
  </>;
}

/** 南韓油氣設施與管線（OSM 補缺，覆蓋稀疏）：設施類型／儲存內容；管線輸送物質。 */
export function KrOilGasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const isPipe = krText(props.substance) !== "";
  const type = krOilGasType(props.facility_type);
  const area = krNum(props.area_m2);
  const km = krNum(props.length_km);
  const substance = krText(props.substance) as keyof typeof KR_PIPELINE_COLORS;
  return <>
    <Title color={isPipe ? (KR_PIPELINE_COLORS[substance] ?? KR_OIL_GAS_COLOR) : (type?.color ?? KR_OIL_GAS_COLOR)}>
      {krText(props.name) || krText(props.name_en) || t(isPipe ? "popup.energy.krPipeTitle" : "popup.energy.krOilGasTitle")}
    </Title>
    {isPipe ? <>
      <Row label={t("popup.energy.krSubstance")} value={t(SUBSTANCE_KEYS[substance] ?? "popup.energy.krSubstance")} />
      <Row label={t("popup.energy.krPipeLocation")} value={krText(props.location)} />
      <Row label={t("popup.energy.krDiameter")} value={krText(props.diameter)} />
      <Row label={t("popup.energy.gbLength")} value={km != null ? t("popup.energy.gbKm", { value: km.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : ""} />
    </> : <>
      <Row label={t("popup.energy.krOgType")} value={type ? t(KR_OIL_GAS_TYPE_KEYS[type.value]) : krText(props.facility_type)} />
      <Row label={t("popup.energy.krContent")} value={krText(props.content)} />
      <Row label={t("popup.energy.krBasis")} value={t(krText(props.basis) === "name" ? "popup.energy.krBasisName" : "popup.energy.krBasisTag")} />
      <Row label={t("popup.energy.gbOperator")} value={krText(props.operator)} />
      <Row label={t("popup.energy.krArea")} value={area != null ? t("popup.energy.krM2", { value: area.toLocaleString(undefined, { maximumFractionDigits: 0 }) }) : ""} />
    </>}
    <Row label={t("popup.energy.krLocation")} value={place(props)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.energy.krOgSparse")} />
    {osmFooter()}
  </>;
}

// ───────── 南韓第 3–5 波 18 層：規格驅動的共用 popup（規格見 data/krDataLayers.ts）─────────
const PEAK_DIR = { up: { zh: "上行", en: "up", ja: "上り" }, down: { zh: "下行", en: "down", ja: "下り" }, inner: { zh: "內環", en: "inner loop", ja: "内回り" }, outer: { zh: "外環", en: "outer loop", ja: "外回り" } } as const;

/** 標題色：分類層取該筆分類色（與地圖一致），否則用圖層主色。 */
function catColor(spec: KrLayerSpec, props: Record<string, unknown>): string {
  if (spec.key === "krSeoulSubwayCongestion") {
    const v = Number(props.peak_wkd);
    const cats = spec.cats!;
    return !Number.isFinite(v) ? spec.color : v < 34 ? cats[0]!.color : v < 80 ? cats[1]!.color : v < 130 ? cats[2]!.color : cats[3]!.color;
  }
  if (!spec.cats || !spec.catProp) return spec.color;
  const v = text(props[spec.catProp]);
  return spec.cats.find((c) => c.values.includes(v))?.color ?? spec.otherColor ?? spec.color;
}

function formatField(f: KrField, props: Record<string, unknown>, locale: string, fmt: (n: number, digits?: number) => string): string {
  const raw = props[f.prop];
  if (f.kind === "peak") {
    const v = Number(raw);
    if (raw == null || !Number.isFinite(v)) return "";
    const dir = text(props[`${f.prop}_dir`]) as keyof typeof PEAK_DIR;
    return `${fmt(v, 0)}% · ${text(props[`${f.prop}_slot`])} · ${PEAK_DIR[dir] ? pickL3(PEAK_DIR[dir], locale) : dir}`;
  }
  if (f.kind === "measure") {
    const v = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(v)) return pickL3(KR_UNMEASURED, locale);
    return `${fmt(v, f.digits ?? 2)}${f.unit ? ` ${f.unit}` : ""}`;
  }
  if (f.kind === "num") {
    const v = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(v)) return "";
    return `${fmt(v, f.digits ?? 0)}${f.unit ? ` ${f.unit}` : ""}`;
  }
  const s = text(raw);
  if (!s) return "";
  if (f.map?.[s]) return pickL3(f.map[s]!, locale);
  return s.replace(/\|/g, "、");
}

function makePanel(spec: KrLayerSpec): FC<{ props: Record<string, unknown> }> {
  return function KrDataPanel({ props }) {
    const i18n = useLocale();
    const locale = i18n.locale;
    const fmt = (n: number, digits = 0) => i18n.formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: digits });
    const title = spec.title.props.map((p) => text(props[p])).find(Boolean) || pickL3(spec.title.fallback ?? KR_UNNAMED, locale);
    const measuredNone = spec.key === "krWaterQualityStations" && props.measured === false;
    return <>
      <Title color={catColor(spec, props)}>{title}</Title>
      {spec.fields.map((f) => {
        const value = measuredNone && f.kind === "measure" ? pickL3(KR_UNMEASURED, locale) : formatField(f, props, locale, fmt);
        return <Row key={f.prop} label={pickL3(f.label, locale)} value={value} mono={f.kind === "code"} />;
      })}
      {spec.popupNotes.map((n, i) => <Row key={i} label={locale === "en" ? "Note" : locale === "ja" ? "備考" : "備註"} value={pickL3(n, locale)} />)}
      <SourceFooter props={{ source_org: spec.sourceOrg, source_url: spec.sourceUrl, license: spec.license, fetched_at: spec.fetchedAt }} />
    </>;
  };
}

export const KR_DATA_PANELS = Object.fromEntries(KR_DATA_SPECS.map((s) => [s.key, makePanel(s)])) as Record<KrDataKey, FC<{ props: Record<string, unknown> }>>;
