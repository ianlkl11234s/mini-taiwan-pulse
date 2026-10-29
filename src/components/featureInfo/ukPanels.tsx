// 英國圖層 popup（2026-10-29 第 0b 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import {
  GB_ADMIN_FETCHED_AT, GB_ADMIN_LAD_COLOR, GB_LAD_ATTRIBUTION, GB_LAD_SOURCE_URL, GB_LAD_VERSION, GB_LICENSE,
  GB_SMALL_AREA_COLOR, gbSmallAreaType,
} from "../../data/gbAdminTypes";

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
