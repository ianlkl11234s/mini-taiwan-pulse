/**
 * 30 天地圖挑戰 Day 4 群聚說明框（4 層）：標題「{縣市}{鄉鎮}{村里}一帶」（中心在海上的格只有縣市），
 * 人口欄位＋依圖層列設施數／熱區分類。設施層讀目前選的設施（同圖例）。
 */
import { useLocale } from "../../state/localeStore";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import {
  MAPCHALLENGE_DAY04_COLOR, MAPCHALLENGE_DAY04_FACILITIES, MAPCHALLENGE_DAY04_ZERO_SWATCH,
  mapchallengeFacilityByKey, mapchallengeFacilitySwatch, mapchallengeHotspotClass, type MapchallengeFacility,
} from "../../data/mapchallengeDay04Types";
import {
  MAPCHALLENGE_DAY05_KIND_COLORS, MAPCHALLENGE_DAY05_VIADUCT_NOTE_PCT, mapchallengeDay05TierLabel, mapchallengeDay05TierSwatch,
} from "../../data/mapchallengeDay05Types";
import { MAPCHALLENGE_DAY05_TIER_KEYS, MAPCHALLENGE_FACILITY_NAME_KEYS, MAPCHALLENGE_FACILITY_UNIT_KEYS, MAPCHALLENGE_HOTSPOT_CLASS_KEYS } from "../legend/mapchallengeLegends";
import { Row, SourceFooter, Title } from "./shared";
import { LIGHT_FEATURE, useFeatureTheme } from "./featureTheme";

type Props = { props: Record<string, unknown> };

const str = (v: unknown) => (typeof v === "string" && v && v !== "null" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));

function usePlace(props: Record<string, unknown>): string {
  const { t } = useLocale();
  const county = str(props.county_name);
  const town = str(props.town);
  const place = town ? `${county}${town}${str(props.village)}` : county;
  return t("popup.mapchallenge.title", { place });
}

function PopulationRows({ props }: Props) {
  const { t, formatNumber } = useLocale();
  return <>
    <Row label={t("popup.mapchallenge.pop")} value={t("popup.mapchallenge.people", { n: formatNumber(num(props.pop)) })} mono />
    <Row label={t("popup.mapchallenge.pd")} value={t("popup.mapchallenge.perKm2", { n: formatNumber(num(props.pd)) })} mono />
  </>;
}

function FacilityRow({ f, props }: { f: MapchallengeFacility; props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  return <Row label={t(MAPCHALLENGE_FACILITY_NAME_KEYS[f.key])} value={`${formatNumber(num(props[f.key]))} ${t(MAPCHALLENGE_FACILITY_UNIT_KEYS[f.key])}`} mono />;
}

function ClassRow({ props, field }: { props: Record<string, unknown>; field: string }) {
  const { t } = useLocale();
  const c = mapchallengeHotspotClass(props[field]);
  return <Row label={t("popup.mapchallenge.class")} value={t(MAPCHALLENGE_HOTSPOT_CLASS_KEYS[c.value])} color={c.value === 0 ? MAPCHALLENGE_DAY04_ZERO_SWATCH : c.color} />;
}

function Footer() {
  const { t } = useLocale();
  return <SourceFooter props={{ source: t("legend.mapchallenge.source") }} />;
}

export function MapchallengeDay04PopulationPanel({ props }: Props) {
  const { t } = useLocale();
  return <div>
    <Title color={MAPCHALLENGE_DAY04_COLOR}>{usePlace(props)}</Title>
    <PopulationRows props={props} />
    <Row label={t("popup.mapchallenge.core")} value={t(num(props.core) === 1 ? "popup.mapchallenge.yes" : "popup.mapchallenge.no")} />
    {MAPCHALLENGE_DAY04_FACILITIES.map((f) => <FacilityRow key={f.key} f={f} props={props} />)}
    <Footer />
  </div>;
}

export function MapchallengeDay04FacilityPanel({ props }: Props) {
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const values = useLayerParams("mapchallengeDay04Facility");
  const f = mapchallengeFacilityByKey(paramStr(values, "mapchallengeDay04Facility", "mapchallengeDay04FacilityKind"));
  return <div>
    <Title color={mapchallengeFacilitySwatch(f, isDark)}>{usePlace(props)}</Title>
    <PopulationRows props={props} />
    <FacilityRow f={f} props={props} />
    <ClassRow props={props} field={`${f.key}_c`} />
    <Footer />
  </div>;
}

export function MapchallengeDay04OverlapPanel({ props }: Props) {
  const values = useLayerParams("mapchallengeDay04Overlap");
  const f = mapchallengeFacilityByKey(paramStr(values, "mapchallengeDay04Overlap", "mapchallengeDay04OverlapKind"));
  const c = mapchallengeHotspotClass(props[`${f.key}_c`]);
  return <div>
    <Title color={c.value === 0 ? MAPCHALLENGE_DAY04_ZERO_SWATCH : c.color}>{usePlace(props)}</Title>
    <PopulationRows props={props} />
    <FacilityRow f={f} props={props} />
    <ClassRow props={props} field={`${f.key}_c`} />
    <Footer />
  </div>;
}

export function MapchallengeDay04ScaleTcChPanel({ props }: Props) {
  const f = mapchallengeFacilityByKey("factory");
  const c = mapchallengeHotspotClass(props.factory_c);
  return <div>
    <Title color={c.value === 0 ? MAPCHALLENGE_DAY04_ZERO_SWATCH : c.color}>{usePlace(props)}</Title>
    <PopulationRows props={props} />
    <FacilityRow f={f} props={props} />
    <ClassRow props={props} field="factory_c" />
    <Footer />
  </div>;
}

// ── Day 5 視野 ───────────────────────────────────────────────
const KIND_KEYS = { rail: "popup.mapchallenge.day05.kindRail", road: "popup.mapchallenge.day05.kindRoad" } as const;

/** 路線＋名稱：「台2 北部濱海公路」；鐵路無路線號只有名稱；兩者皆空退回（未命名） */
function useRouteName(props: Record<string, unknown>): string {
  const { t } = useLocale();
  return [str(props.route), str(props.name)].filter(Boolean).join(" ") || t("popup.mapchallenge.day05.unnamed");
}

function Day05Footer() {
  const { t } = useLocale();
  return <SourceFooter props={{ source: t("legend.mapchallenge.day05.source") }} />;
}

export function MapchallengeDay05SeaViewPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const tier = mapchallengeDay05TierLabel(props.tier).value;
  const kind = props.kind === "rail" ? "rail" : "road";
  const sw = mapchallengeDay05TierSwatch(tier, isDark);
  return <div>
    <Title color={sw.color}>{useRouteName(props)}</Title>
    <Row label={t("popup.mapchallenge.day05.kind")} value={t(KIND_KEYS[kind])} />
    <Row label={t("popup.mapchallenge.day05.verdict")} value={t(MAPCHALLENGE_DAY05_TIER_KEYS[String(tier) as keyof typeof MAPCHALLENGE_DAY05_TIER_KEYS])} color={sw.color} />
    {(tier === 1 || tier === 2) && <Row label={t("popup.mapchallenge.day05.viewDeg")} value={t("popup.mapchallenge.day05.degrees", { n: formatNumber(num(props.view_deg)) })} mono />}
    {tier === 3 && <Row label={t("popup.mapchallenge.day05.note")} value={t("popup.mapchallenge.day05.treeNote", { n: formatNumber(num(props.view_deg)) })} />}
    <Row label={t("popup.mapchallenge.day05.dsea")} value={t("popup.mapchallenge.day05.meters", { n: formatNumber(num(props.dsea_m)) })} mono />
    <Day05Footer />
  </div>;
}

export function MapchallengeDay05SeaViewRunsPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const kind = props.kind === "rail" ? "rail" : "road";
  const viaduct = num(props.viaduct_pct);
  return <div>
    <Title color={MAPCHALLENGE_DAY05_KIND_COLORS[kind]}>{t("popup.mapchallenge.day05.rank", { rank: num(props.rank), kind: t(KIND_KEYS[kind]) })}</Title>
    <Row label={t("popup.mapchallenge.day05.route")} value={useRouteName(props)} />
    <Row label={t("popup.mapchallenge.day05.length")} value={t("popup.mapchallenge.day05.km", { n: formatNumber(num(props.length_km)) })} mono />
    <Row label={t("popup.mapchallenge.day05.span")} value={t("popup.mapchallenge.day05.spanValue", { from: str(props.from_town), to: str(props.to_town) })} />
    <Row label={t("popup.mapchallenge.day05.viewDeg")} value={t("popup.mapchallenge.day05.degrees", { n: formatNumber(num(props.view_deg)) })} mono />
    <Row label={t("popup.mapchallenge.day05.dseaMedian")} value={t("popup.mapchallenge.day05.meters", { n: formatNumber(num(props.dsea_m)) })} mono />
    <Row label={t("popup.mapchallenge.day05.viaduct")} value={t("popup.mapchallenge.day05.pct", { n: formatNumber(viaduct) })} mono />
    {viaduct >= MAPCHALLENGE_DAY05_VIADUCT_NOTE_PCT && <Row label={t("popup.mapchallenge.day05.note")} value={t("popup.mapchallenge.day05.viaductNote")} />}
    <Day05Footer />
  </div>;
}
