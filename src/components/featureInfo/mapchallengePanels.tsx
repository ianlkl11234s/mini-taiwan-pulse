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
import {
  MAPCHALLENGE_DAY06_STATUS_COLORS, MAPCHALLENGE_DAY06_TEMPLE_COLOR, mapchallengeDay06EraColor, mapchallengeDay06SurviveColor, type MapchallengeDay06Status,
} from "../../data/mapchallengeDay06Types";
import { MAPCHALLENGE_DAY06_ERA_KEYS, MAPCHALLENGE_DAY06_STATUS_KEYS, MAPCHALLENGE_DAY05_TIER_KEYS, MAPCHALLENGE_FACILITY_NAME_KEYS, MAPCHALLENGE_FACILITY_UNIT_KEYS, MAPCHALLENGE_HOTSPOT_CLASS_KEYS } from "../legend/mapchallengeLegends";
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

// ── Day 6 復古 ───────────────────────────────────────────────
function Day06Footer() {
  const { t } = useLocale();
  return <SourceFooter props={{ source: t("legend.mapchallenge.day06.sourceShort") }} />;
}

const eraOf = (v: unknown): 1 | 2 | 3 => (num(v) === 1 ? 1 : num(v) === 2 ? 2 : 3);

export function MapchallengeDay06CoastPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  if (props.kind === "place") {
    const latest = eraOf(props.latest);
    return <div>
      <Title color={mapchallengeDay06EraColor(latest, isDark)}>{str(props.name)}</Title>
      <Row label={t("popup.mapchallenge.day06.town")} value={str(props.town)} />
      <Row label={t("popup.mapchallenge.day06.westOf")} value={t(MAPCHALLENGE_DAY06_ERA_KEYS[latest])} color={mapchallengeDay06EraColor(latest, isDark)} />
      <Row label={t("popup.mapchallenge.day06.note")} value={t("popup.mapchallenge.day06.placeNote")} />
      <Day06Footer />
    </div>;
  }
  const era = eraOf(props.era);
  return <div>
    <Title color={mapchallengeDay06EraColor(era, isDark)}>{t("popup.mapchallenge.day06.coastTitle", { era: t(MAPCHALLENGE_DAY06_ERA_KEYS[era]) })}</Title>
    <Row label={t("popup.mapchallenge.day06.source")} value={t("popup.mapchallenge.day06.coastSource", { id: era === 1 ? 242 : era === 2 ? 244 : 243 })} />
    <Row label={t("popup.mapchallenge.day06.dCoast")} value={t("popup.mapchallenge.day06.km", { n: formatNumber(num(props.d_km)) })} mono />
    <Row label={t("popup.mapchallenge.day06.note")} value={t("popup.mapchallenge.day06.coastNote")} />
    <Day06Footer />
  </div>;
}

export function MapchallengeDay06Taipei1932Panel({ props }: Props) {
  const { t } = useLocale();
  const surv = num(props.survives) === 1;
  return <div>
    <Title color={mapchallengeDay06SurviveColor(surv ? 1 : 0)}>{str(props.name)}</Title>
    <Row label={t("popup.mapchallenge.day06.surviveRow")} value={surv ? t("popup.mapchallenge.day06.surviveYes", { villages: str(props.survive_villages) }) : t("popup.mapchallenge.day06.surviveNo")} color={mapchallengeDay06SurviveColor(surv ? 1 : 0)} />
    <Row label={t("popup.mapchallenge.day06.district")} value={str(props.district)} />
    <Row label={t("popup.mapchallenge.day06.mainVillages")} value={str(props.main_villages)} />
    <Row label={t("popup.mapchallenge.day06.area")} value={t("popup.mapchallenge.day06.km2", { n: String(props.area_km2 ?? "") })} mono />
    <Day06Footer />
  </div>;
}

export function MapchallengeDay06Temples1921Panel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const cont = num(props.cont) === 1;
  const color = cont ? MAPCHALLENGE_DAY06_TEMPLE_COLOR : MAPCHALLENGE_DAY04_ZERO_SWATCH;
  return <div>
    <Title color={color}>{str(props.name) || t("popup.mapchallenge.day06.templeUnnamed")}</Title>
    <Row label={t("popup.mapchallenge.day06.templeRow")} value={t(cont ? "popup.mapchallenge.day06.templeYes" : "popup.mapchallenge.day06.templeNo")} color={color} />
    <Row label={t("popup.mapchallenge.day06.nearest")} value={t("popup.mapchallenge.day06.nameDist", { name: str(props.nearest), n: formatNumber(num(props.d_m)) })} />
    {num(props.same) === 1 && <Row label={t("popup.mapchallenge.day06.sameName")} value={t("popup.mapchallenge.day06.nameDist", { name: str(props.same_name), n: formatNumber(num(props.same_d_m)) })} color={MAPCHALLENGE_DAY06_TEMPLE_COLOR} />}
    <Day06Footer />
  </div>;
}

export function MapchallengeDay06LighthousesPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const status = (["same", "moved", "none"].includes(str(props.status)) ? str(props.status) : "none") as MapchallengeDay06Status;
  const isToday = props.role === "today";
  const d = props.d_m;
  return <div>
    <Title color={MAPCHALLENGE_DAY06_STATUS_COLORS[status]}>{isToday ? str(props.today_name) : str(props.name)}</Title>
    <Row label={t("popup.mapchallenge.day06.point")} value={t(isToday ? "popup.mapchallenge.day06.pointToday" : "popup.mapchallenge.day06.pointHist")} />
    <Row label={t("popup.mapchallenge.day06.type")} value={t(props.type === "station" ? "popup.mapchallenge.day06.typeStation" : "popup.mapchallenge.day06.typeLighthouse")} />
    {isToday && <Row label={t("popup.mapchallenge.day06.histName")} value={str(props.name)} />}
    <Row label={t("popup.mapchallenge.day06.year")} value={str(props.year)} mono />
    <Row label={t("popup.mapchallenge.day06.histNote")} value={str(props.note)} />
    <Row label={t("popup.mapchallenge.day06.status")} value={t(MAPCHALLENGE_DAY06_STATUS_KEYS[status])} color={MAPCHALLENGE_DAY06_STATUS_COLORS[status]} />
    {!isToday && status !== "none" && <Row label={t("popup.mapchallenge.day06.todayName")} value={str(props.today_name)} />}
    {status !== "none" && d !== null && d !== undefined && <Row label={t("popup.mapchallenge.day06.dThenNow")} value={t("popup.mapchallenge.day06.meters", { n: formatNumber(num(d)) })} mono />}
    <Row label={t("popup.mapchallenge.day06.note")} value={str(props.remark)} />
    <Day06Footer />
  </div>;
}
