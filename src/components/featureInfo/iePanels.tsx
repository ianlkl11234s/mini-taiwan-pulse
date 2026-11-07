// 愛爾蘭圖層 popup（第 0 波：行政邊界）。字串與署名 SSOT 在 data/ieAdminTypes.ts；
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import { IE_ADMIN_COLOR, IE_ADMIN_LEVEL_LABELS, IE_ADMIN_SOURCE, IE_FETCHED_AT, IE_NO_DATA, pickL3, type L3 } from "../../data/ieAdminTypes";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const n = typeof v === "number" ? v : Number(caText(v));
  return Number.isFinite(n) && caText(v) !== "" ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

/** 行政邊界：名稱（英／愛爾蘭語）、層級、所屬地方政府與選舉分區、2022 人口（無資料不寫 0）、面積、代碼。 */
export function IeAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const level = caText(props.level) as keyof typeof IE_ADMIN_LEVEL_LABELS;
  const name = caText(props.name);
  const nameGa = caText(props.name_ga);
  const popAvailable = props.pop_available === true || props.pop_available === "true";
  const pop = popAvailable ? fmtNum(props.population) : "";
  const area = fmtNum(props.area_km2, 2);
  return <>
    <Title color={IE_ADMIN_COLOR}>{name || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    {IE_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(IE_ADMIN_LEVEL_LABELS[level])} /> : null}
    {nameGa && nameGa !== name ? <Row label={pick({ zh: "愛爾蘭語名", en: "Irish name", ja: "アイルランド語名" })} value={nameGa} /> : null}
    {level !== "la" && caText(props.la_name) ? <Row label={pick({ zh: "所屬地方政府", en: "Local authority", ja: "所属自治体" })} value={caText(props.la_name)} /> : null}
    {level === "sa" && caText(props.ed_name) ? <Row label={pick({ zh: "所屬選舉分區", en: "Electoral division", ja: "所属選挙区" })} value={caText(props.ed_name)} /> : null}
    {level === "sa" && caText(props.urban_area) ? <Row label={pick({ zh: "都市區", en: "Urban area", ja: "都市域" })} value={caText(props.urban_area)} /> : null}
    <Row label={pick({ zh: "2022 人口", en: "Population 2022", ja: "2022 年人口" })} value={pop || pick(IE_NO_DATA)} />
    {area ? <Row label={pick({ zh: "面積", en: "Area", ja: "面積" })} value={`${area} km²`} /> : null}
    {caText(props.code) ? <Row label={pick({ zh: "代碼", en: "Code", ja: "コード" })} value={caText(props.code)} mono /> : null}
    <SourceFooter props={{ source_org: IE_ADMIN_SOURCE.org, source_url: IE_ADMIN_SOURCE.url, license: IE_ADMIN_SOURCE.license, fetched_at: IE_FETCHED_AT }} />
  </>;
}
