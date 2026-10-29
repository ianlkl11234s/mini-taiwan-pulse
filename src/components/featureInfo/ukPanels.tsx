// 英國圖層 popup（2026-10-29 第 0b 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import {
  GB_ADMIN_FETCHED_AT, GB_ADMIN_LAD_COLOR, GB_LAD_ATTRIBUTION, GB_LAD_SOURCE_URL, GB_LAD_VERSION, GB_LICENSE,
  GB_SMALL_AREA_COLOR, gbSmallAreaType,
} from "../../data/gbAdminTypes";
import {
  GB_MARITIME_ATTRIBUTION, GB_MARITIME_FETCHED_AT, GB_MARITIME_LAYER_COLOR, GB_MARITIME_LICENSE, GB_MARITIME_SOURCE_DATE, GB_MARITIME_SOURCE_URL,
  gbMaritimeLimitColor, gbMaritimeLimitType, type GbMaritimeLimitKind,
} from "../../data/gbMaritimeLimitTypes";
import {
  GB_BUILT_UP_COLOR, GB_BUILT_UP_SOURCE_URL, GB_GREENSPACE_CATEGORIES, GB_GREENSPACE_SOURCE_URL, GB_OS_ATTRIBUTION, GB_OS_FETCHED_AT, GB_OS_LICENSE,
  gbGreenspaceFunction, type GbGreenspaceFunctionId, type GbGreenspaceKey,
} from "../../data/gbOpenSpaceTypes";
import type { MessageKey } from "../../i18n/keys";

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const NATION_KEYS = {
  England: "popup.baseMap.gbNationEngland",
  Scotland: "popup.baseMap.gbNationScotland",
  Wales: "popup.baseMap.gbNationWales",
  "Northern Ireland": "popup.baseMap.gbNationNorthernIreland",
} as const;

const AREA_TYPE_KEYS = {
  LSOA21: "popup.baseMap.gbAreaTypeLSOA21",
  DZ22: "popup.baseMap.gbAreaTypeDZ22",
  DZ21: "popup.baseMap.gbAreaTypeDZ21",
  SDZ21: "popup.baseMap.gbAreaTypeSDZ21",
} as const;

function useNationLabel() {
  const { t } = useLocale();
  return (value: unknown) => {
    const nation = text(value);
    return nation in NATION_KEYS ? t(NATION_KEYS[nation as keyof typeof NATION_KEYS]) : nation;
  };
}

/** 英國地方政府區 LAD（ONS May 2026，361 區）：名稱（威爾斯並列威爾斯語）、GSS 代碼、所屬地區。 */
export function GbAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const name = text(props.lad_name);
  const nameCy = text(props.lad_name_cy);
  return <>
    <Title color={GB_ADMIN_LAD_COLOR}>{name || t("popup.baseMap.gbLad")}</Title>
    {nameCy && nameCy !== name ? <Row label={t("popup.baseMap.gbNameWelsh")} value={nameCy} /> : null}
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.lad_code)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbDataVersion")} value={GB_LAD_VERSION} />
    <SourceFooter props={{ source_org: GB_LAD_ATTRIBUTION, source_url: GB_LAD_SOURCE_URL, license: GB_LICENSE, fetched_at: GB_ADMIN_FETCHED_AT }} />
  </>;
}

/** 英國統計小區（LSOA21／DZ22／DZ21／SDZ21）：名稱、代碼、類型、所屬 LAD、所屬地區。 */
export function GbSmallAreaBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const type = gbSmallAreaType(props.area_type);
  const name = text(props.name);
  const nameCy = text(props.name_cy);
  const lad = [text(props.lad_name), text(props.lad_code)].filter(Boolean);
  return <>
    <Title color={GB_SMALL_AREA_COLOR}>{name || text(props.code) || t("popup.baseMap.gbSmallArea")}</Title>
    {nameCy && nameCy !== name ? <Row label={t("popup.baseMap.gbNameWelsh")} value={nameCy} /> : null}
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.code)} />
    <Row label={t("popup.baseMap.gbAreaType")} value={type ? t(AREA_TYPE_KEYS[type.value]) : text(props.area_type)} />
    <Row label={t("popup.baseMap.gbLad")} value={lad.join(" · ")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.baseMap.gbSmallAreaNote")} />
    {type ? <SourceFooter props={{ source_org: type.attribution, source_url: type.sourceUrl, license: GB_LICENSE, fetched_at: GB_ADMIN_FETCHED_AT }} /> : null}
  </>;
}

/** 切片 `neighbour` 實際出現的 9 個值（tilestats）；其他值原樣顯示。 */
const GB_NEIGHBOUR_KEYS: Partial<Record<string, MessageKey>> = {
  Belgium: "popup.baseMap.gbNeighbourBelgium", Denmark: "popup.baseMap.gbNeighbourDenmark", "Faroe Islands": "popup.baseMap.gbNeighbourFaroeIslands",
  France: "popup.baseMap.gbNeighbourFrance", Germany: "popup.baseMap.gbNeighbourGermany", Ireland: "popup.baseMap.gbNeighbourIreland",
  "Isle of Man": "popup.baseMap.gbNeighbourIsleofMan", Netherlands: "popup.baseMap.gbNeighbourNetherlands", Norway: "popup.baseMap.gbNeighbourNorway",
};

const GB_GREENSPACE_POPUP_FN_KEYS: Record<GbGreenspaceFunctionId, MessageKey> = {
  Park: "popup.baseMap.gbFnPark", Play: "popup.baseMap.gbFnPlay", Allotment: "popup.baseMap.gbFnAllotment",
  PlayingField: "popup.baseMap.gbFnPlayingField", OtherSports: "popup.baseMap.gbFnOtherSports", Tennis: "popup.baseMap.gbFnTennis",
  Bowling: "popup.baseMap.gbFnBowling", Golf: "popup.baseMap.gbFnGolf", Cemetery: "popup.baseMap.gbFnCemetery", Religious: "popup.baseMap.gbFnReligious",
};

const GB_MARITIME_POPUP_KEYS: Record<GbMaritimeLimitKind, MessageKey> = {
  baseline: "popup.baseMap.gbMaritimeBaseline",
  closing_line: "popup.baseMap.gbMaritimeClosingLine",
  six_nm: "popup.baseMap.gbMaritimeSixNm",
  territorial_sea: "popup.baseMap.gbMaritimeTerritorialSea",
  eez: "popup.baseMap.gbMaritimeEez",
  continental_shelf: "popup.baseMap.gbMaritimeContinentalShelf",
  boundary: "popup.baseMap.gbMaritimeBoundary",
  median_line: "popup.baseMap.gbMaritimeMedianLine",
  national_limit: "popup.baseMap.gbMaritimeNationalLimit",
};

/** 英國海域界線（UKHO）：界線類型、所屬、分界對象、資料日期、不可用於航行。 */
export function GbMaritimeLimitsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const type = gbMaritimeLimitType(props.limit_type);
  const state = text(props.state);
  const neighbour = text(props.neighbour);
  return <>
    <Title color={type ? gbMaritimeLimitColor(type, true) : GB_MARITIME_LAYER_COLOR}>{type ? t(GB_MARITIME_POPUP_KEYS[type.value]) : text(props.feature) || t("popup.baseMap.gbMaritimeLimit")}</Title>
    <Row label={t("popup.baseMap.gbMaritimeState")} value={state === "United Kingdom" ? t("popup.baseMap.gbUnitedKingdom") : nation(state)} />
    {neighbour ? <Row label={t("popup.baseMap.gbMaritimeNeighbour")} value={GB_NEIGHBOUR_KEYS[neighbour] ? t(GB_NEIGHBOUR_KEYS[neighbour]!) : neighbour} /> : null}
    <Row label={t("popup.baseMap.gbDataVersion")} value={`UKHO ${GB_MARITIME_SOURCE_DATE}`} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.baseMap.gbMaritimeIllustrative")} />
    <SourceFooter props={{ source_org: GB_MARITIME_ATTRIBUTION, source_url: GB_MARITIME_SOURCE_URL, license: GB_MARITIME_LICENSE, fetched_at: GB_MARITIME_FETCHED_AT }} />
  </>;
}

/** 英國建成區（OS Open Built Up Areas）：名稱（威爾斯語／蓋爾語並列英文）、面積、所屬 LAD、地區、GSS。 */
export function GbBuiltUpAreasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  const area = Number(props.area_ha);
  const lad = [text(props.lad_name), text(props.lad_code)].filter(Boolean);
  return <>
    <Title color={GB_BUILT_UP_COLOR}>{name || t("popup.baseMap.gbBuiltUp")}</Title>
    {nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameEnglish")} value={nameAlt} /> : null}
    {props.area_ha != null && Number.isFinite(area) ? <Row label={t("popup.baseMap.gbBuiltUpArea")} value={t("popup.baseMap.gbHectares", { value: area.toLocaleString(undefined, { maximumFractionDigits: 1 }) })} /> : null}
    <Row label={t("popup.baseMap.gbLad")} value={lad.join(" · ")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.gss_code)} />
    <SourceFooter props={{ source_org: GB_OS_ATTRIBUTION, source_url: GB_BUILT_UP_SOURCE_URL, license: GB_OS_LICENSE, fetched_at: GB_OS_FETCHED_AT }} />
  </>;
}

/** 英國綠地三層共用（OS Open Greenspace）：名稱（無名顯示類型）、類型、地區、LAD 代碼。 */
function GbGreenspacePanelBase({ props, layerKey }: { props: Record<string, unknown>; layerKey: GbGreenspaceKey }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const fn = gbGreenspaceFunction(props.function);
  const typeLabel = fn ? t(GB_GREENSPACE_POPUP_FN_KEYS[fn.id]) : text(props.function);
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  return <>
    <Title color={fn?.color ?? GB_GREENSPACE_CATEGORIES[layerKey].layerColor}>{name || typeLabel}</Title>
    {nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameAlt")} value={nameAlt} /> : null}
    <Row label={t("popup.baseMap.gbGreenspaceType")} value={typeLabel} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbLadCode")} value={text(props.lad_code)} />
    <SourceFooter props={{ source_org: GB_OS_ATTRIBUTION, source_url: GB_GREENSPACE_SOURCE_URL, license: GB_OS_LICENSE, fetched_at: GB_OS_FETCHED_AT }} />
  </>;
}

export const GbGreenspacePanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbGreenspace" />;
export const GbSportsFacilitiesPanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbSportsFacilities" />;
export const GbCemeteriesPanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbCemeteries" />;
