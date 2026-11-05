/**
 * 日本第二輪（2026-11-06）四層說明框：自然公園地域 2015、国立公園（環境省）、国指定鳥獣保護区、人口集中地区 DID。
 * 缺值顯示「未提供」，不補 0；license_note 非空才顯示。
 */
import { useLocale } from "../../state/localeStore";
import {
  JP_NATURAL_PARK_LEVELS, JP_NATURAL_PARK_AREAS_ATTRIBUTION, JP_NATURAL_PARK_AREAS_SOURCE_URL, JP_NATURAL_PARK_AREAS_LICENSE,
  JP_NATURAL_PARK_AREAS_COLOR, JP_NATURAL_PARK_AREAS_DATA_AS_OF,
  JP_NATIONAL_PARK_ZONES, JP_NATIONAL_PARKS_MOE_ATTRIBUTION, JP_NATIONAL_PARKS_MOE_SOURCE_URL, JP_NATIONAL_PARKS_MOE_COLOR,
  JP_MOE_GIS_LICENSE, JP_MOE_GIS_DATA_AS_OF,
  JP_WILDLIFE_CATEGORIES, JP_WILDLIFE_MOE_ATTRIBUTION, JP_WILDLIFE_MOE_SOURCE_URL, JP_WILDLIFE_MOE_COLOR,
  JP_DID_COLOR, JP_DID_SOURCE_URL, JP_DID_LICENSE, jpDidAttribution,
} from "../../data/jpNatureR2Types";
import { JP_NATIONAL_PARK_ZONE_KEYS, JP_NATURAL_PARK_LEVEL_KEYS, JP_WILDLIFE_CATEGORY_KEYS } from "../legend/jpNatureR2Legends";
import { Row, SourceFooter, Title } from "./shared";

type Props = { props: Record<string, unknown> };
const text = (v: unknown): string => (v == null || v === "null" || v === "undefined" ? "" : String(v).trim());
const numOrNull = (v: unknown): number | null => {
  const s = text(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function JpNaturalParkAreas2015Panel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const na = t("popup.common.notProvided");
  const lv = JP_NATURAL_PARK_LEVELS.find((l) => l.value === text(props.level));
  const area = numOrNull(props.area_ha);
  const note = text(props.license_note);
  return <>
    <Title color={lv?.color ?? JP_NATURAL_PARK_AREAS_COLOR}>{lv ? t(JP_NATURAL_PARK_LEVEL_KEYS[lv.value]) : t("popup.jpNature.parkAreaDefault")}</Title>
    <Row label={t("popup.jpNature.parkName")} value={t("popup.jpNature.parkNameMissing")} />
    <Row label={t("popup.jpNature.prefecture")} value={text(props.prefecture_code) || na} mono />
    <Row label={t("popup.jpNature.areaHa")} value={area === null ? na : `${formatNumber(area, { maximumFractionDigits: 1 })} ha`} mono />
    <Row label={t("popup.jpNature.sourceYear")} value={text(props.fis_year) || na} mono />
    {note ? <Row label={t("popup.jpNature.licenseNote")} value={note} /> : null}
    <Row label={t("popup.jpNature.notes")} value={t("popup.jpNature.parkAreasAccuracy")} />
    <SourceFooter props={{ source_org: JP_NATURAL_PARK_AREAS_ATTRIBUTION, source_url: JP_NATURAL_PARK_AREAS_SOURCE_URL, license: JP_NATURAL_PARK_AREAS_LICENSE, fetched_at: JP_NATURAL_PARK_AREAS_DATA_AS_OF }} />
  </>;
}

export function JpNationalParksMoePanel({ props }: Props) {
  const { t } = useLocale();
  const na = t("popup.common.notProvided");
  const zone = JP_NATIONAL_PARK_ZONES.find((z) => z.value === text(props.zone));
  return <>
    <Title color={zone?.color ?? JP_NATIONAL_PARKS_MOE_COLOR}>{text(props.park_name) || t("popup.jpNature.nationalParkDefault")}</Title>
    <Row label={t("popup.jpNature.zone")} value={zone ? t(JP_NATIONAL_PARK_ZONE_KEYS[zone.value]) : text(props.zone) || na} color={zone?.color} />
    <Row label={t("popup.jpNature.licenseNote")} value={text(props.license_note)} />
    <SourceFooter props={{ source_org: JP_NATIONAL_PARKS_MOE_ATTRIBUTION, source_url: JP_NATIONAL_PARKS_MOE_SOURCE_URL, license: JP_MOE_GIS_LICENSE, fetched_at: JP_MOE_GIS_DATA_AS_OF }} />
  </>;
}

export function JpWildlifeProtectionMoePanel({ props }: Props) {
  const { t } = useLocale();
  const na = t("popup.common.notProvided");
  const cat = JP_WILDLIFE_CATEGORIES.find((c) => c.value === text(props.category));
  return <>
    <Title color={cat?.color ?? JP_WILDLIFE_MOE_COLOR}>{text(props.area_name) || t("popup.jpNature.wildlifeDefault")}</Title>
    <Row label={t("popup.jpNature.wildlifeCategory")} value={cat ? t(JP_WILDLIFE_CATEGORY_KEYS[cat.value]) : na} color={cat?.color} />
    <Row label={t("popup.jpNature.protectionClass")} value={text(props.protection_class) || na} />
    <Row label={t("popup.jpNature.designated")} value={text(props.designated) || na} />
    <Row label={t("popup.jpNature.duration")} value={text(props.duration) || na} />
    <Row label={t("popup.jpNature.licenseNote")} value={text(props.license_note)} />
    <SourceFooter props={{ source_org: JP_WILDLIFE_MOE_ATTRIBUTION, source_url: JP_WILDLIFE_MOE_SOURCE_URL, license: JP_MOE_GIS_LICENSE, fetched_at: JP_MOE_GIS_DATA_AS_OF }} />
  </>;
}

export function JpDidPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const na = t("popup.common.notProvided");
  const pop = numOrNull(props.population);
  const area = numOrNull(props.area_km2);
  const prevPop = numOrNull(props.prev_population);
  const prevArea = numOrNull(props.prev_area_km2);
  const share = numOrNull(props.pop_share_pct);
  const year = text(props.year);
  const density = pop !== null && area ? Math.round(pop / area) : null;
  return <>
    <Title color={JP_DID_COLOR}>{t("popup.jpNature.didTitle", { name: text(props.municipality) || na, year })}</Title>
    <Row label={t("popup.jpNature.didPopulation")} value={pop === null ? na : t("popup.jpNature.people", { n: formatNumber(pop) })} mono />
    <Row label={t("popup.jpNature.didArea")} value={area === null ? na : `${formatNumber(area, { maximumFractionDigits: 2 })} km²`} mono />
    <Row label={t("popup.jpNature.didDensity")} value={density === null ? na : t("popup.jpNature.perKm2", { n: formatNumber(density) })} mono />
    <Row label={t("popup.jpNature.didPrev")} value={prevPop === null ? t("popup.jpNature.didPrevMissing") : `${t("popup.jpNature.people", { n: formatNumber(prevPop) })} · ${prevArea === null ? na : `${formatNumber(prevArea, { maximumFractionDigits: 2 })} km²`}`} mono />
    <Row label={t("popup.jpNature.didShare")} value={share === null ? na : `${share}%`} mono />
    <SourceFooter props={{ source_org: jpDidAttribution(year || "2015"), source_url: JP_DID_SOURCE_URL, license: JP_DID_LICENSE, fetched_at: year }} />
  </>;
}
