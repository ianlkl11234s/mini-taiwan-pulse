/**
 * 30 天地圖挑戰 Day 4 群聚說明框（4 層）：標題「{縣市}{鄉鎮}{村里}一帶」（中心在海上的格只有縣市），
 * 人口欄位＋依圖層列設施數／熱區分類。設施層讀目前選的設施（同圖例）。
 */
import { useLocale } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
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
import {
  MAPCHALLENGE_DAY08_ENTRANCE_KINDS, MAPCHALLENGE_DAY08_ENTRANCE_KIND_KEYS, mapchallengeDay08ParkColor, MAPCHALLENGE_DAY08_SITE_CLASSES, MAPCHALLENGE_DAY08_UNREACHABLE, mapchallengeDay08BinColor, mapchallengeDay08ScenarioByValue,
  mapchallengeDay08SiteColor, mapchallengeDay08TimeProp, mapchallengeDay08YiToBillion, MAPCHALLENGE_DAY08_COST_FORMAT, type MapchallengeDay08SiteClass,
} from "../../data/mapchallengeDay08Types";
import {
  MAPCHALLENGE_DAY09_FACILITIES, mapchallengeDay09FeatureColor, mapchallengeDay09MetricByKey,
} from "../../data/mapchallengeDay09Types";
import { MAPCHALLENGE_DAY09_METRIC_KEYS, MAPCHALLENGE_DAY09_QUINTILE_KEYS } from "../legend/mapchallengeLegends";
import {
  MAPCHALLENGE_DAY17_LOW_SWATCH, MAPCHALLENGE_DAY17_PROTECTED_TOTAL, MAPCHALLENGE_DAY17_TOP_RANK, mapchallengeDay17GlowColor, mapchallengeDay17ProtectedLineColor, mapchallengeDay17ZeroColor,
  mapchallengeDay17LedFeatureColor, mapchallengeDay17LedYearByKey,
} from "../../data/mapchallengeDay17Types";
import {
  MAPCHALLENGE_DAY19_CATEGORIES, mapchallengeDay19CategoryByKey, mapchallengeDay19CompassIdx, mapchallengeDay19DensBin, mapchallengeDay19PeriodByKey,
  type MapchallengeDay19Category,
} from "../../data/mapchallengeDay19Types";
import {
  mapchallengeDay19CategoryColor, mapchallengeDay19DumpingColor, mapchallengeDay19FacilityColor, mapchallengeDay19RatioColor, mapchallengeDay19WindColor,
} from "../../data/mapchallengeDay19Style";
import { MAPCHALLENGE_DAY19_CATEGORY_KEYS, MAPCHALLENGE_DAY19_FACILITY_KEYS, MAPCHALLENGE_DAY19_PERIOD_KEYS } from "../legend/mapchallengeLegends";
import { FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { MAPCHALLENGE_DAY08_SCENARIO_KEYS, MAPCHALLENGE_DAY08_SITE_CLASS_KEYS, MAPCHALLENGE_DAY08_SPEED_KEYS, MAPCHALLENGE_DAY06_ERA_KEYS, MAPCHALLENGE_DAY06_STATUS_KEYS, MAPCHALLENGE_DAY05_TIER_KEYS, MAPCHALLENGE_FACILITY_NAME_KEYS, MAPCHALLENGE_FACILITY_UNIT_KEYS, MAPCHALLENGE_HOTSPOT_CLASS_KEYS } from "../legend/mapchallengeLegends";
import { MAPCHALLENGE_DAY21_YEAR_MIN, mapchallengeDay21ClassOf, mapchallengeDay21YearColor } from "../../data/mapchallengeDay21Types";
import { MAPCHALLENGE_DAY21_CLASS_KEYS } from "../legend/mapchallengeLegends";
import { LinkRow } from "./atlasPanels";
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

// ── Day 8 烏托邦 ─────────────────────────────────────────────
/** historical：方案 D／Dfull 的用地由 1955 計畫圖數化而來，來源要帶上該圖與 CC BY-NC 授權（不依賴另開原圖層） */
function Day08Footer({ historical = false }: { historical?: boolean }) {
  const { t, active } = useLocale();
  const source = historical
    ? `${t("legend.mapchallenge.day08.source")}${active === "en" ? "; " : "；"}${t("legend.mapchallenge.day08.planLicense")}`
    : t("legend.mapchallenge.day08.source");
  return <>
    <Row label={t("popup.mapchallenge.day08.caveatLabel")} value={t("legend.mapchallenge.day08.caveat")} />
    <SourceFooter props={{ source }} />
  </>;
}

function Day08ParksFooter() {
  const { t } = useLocale();
  return <>
    <Row label={t("popup.mapchallenge.day08.caveatLabel")} value={t("legend.mapchallenge.day08.caveat")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day08.parksSource") }} />
  </>;
}

/** 缺值回 null（不顯示為 0） */
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(num(v)) ? num(v) : null);

export function MapchallengeDay08AccessPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const values = useLayerParams("mapchallengeDay08Access");
  const scenario = mapchallengeDay08ScenarioByValue(paramStr(values, "mapchallengeDay08Access", "mapchallengeDay08Scenario")).value;
  const speed = paramStr(values, "mapchallengeDay08Access", "mapchallengeDay08AccessSpeed") === "slow" ? "slow" : "normal";
  const before = numOrNull(props[mapchallengeDay08TimeProp("base", speed)]);
  const after = numOrNull(props[mapchallengeDay08TimeProp(scenario, speed)]);
  const mins = (m: number | null) => (m === null ? "" : m >= MAPCHALLENGE_DAY08_UNREACHABLE
    ? t("popup.mapchallenge.day08.unreachable") : t("popup.mapchallenge.day08.minutes", { n: formatNumber(m) }));
  const shown = scenario === "base" ? before : after;
  const pop = numOrNull(props.pop);
  const vul = numOrNull(props.vul);
  return <div>
    <Title color={shown === null ? MAPCHALLENGE_DAY04_ZERO_SWATCH : mapchallengeDay08BinColor(shown, isDark)}>{t("popup.mapchallenge.day08.accessTitle", { town: str(props.town) })}</Title>
    {pop !== null && <Row label={t("popup.mapchallenge.day08.pop")} value={t("popup.mapchallenge.day08.people", { n: formatNumber(pop) })} mono />}
    {vul !== null && <Row label={t("popup.mapchallenge.day08.vul")} value={t("popup.mapchallenge.day08.people", { n: formatNumber(vul) })} mono />}
    <Row label={t("popup.mapchallenge.day08.speed")} value={t(MAPCHALLENGE_DAY08_SPEED_KEYS[speed])} />
    {scenario === "base"
      ? <Row label={t(MAPCHALLENGE_DAY08_SCENARIO_KEYS.base)} value={mins(before)} mono />
      : <Row label={t("popup.mapchallenge.day08.beforeAfter", { scenario: t(MAPCHALLENGE_DAY08_SCENARIO_KEYS[scenario]) })}
          value={t("popup.mapchallenge.day08.arrow", { a: mins(before), b: mins(after) })} mono />}
    <Day08Footer historical={scenario === "D" || scenario === "Dfull"} />
  </div>;
}

export function MapchallengeDay08ParksPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  if (props.cls === "entrance") {
    const kind = MAPCHALLENGE_DAY08_ENTRANCE_KINDS.find((k) => k === str(props.kind)) ?? "bridge";
    const color = mapchallengeDay08ParkColor("entrance", isDark);
    return <div>
      <Title color={color}>{t("popup.mapchallenge.day08.entranceTitle")}</Title>
      <Row label={t("popup.mapchallenge.day08.entranceKind")} value={t(MAPCHALLENGE_DAY08_ENTRANCE_KIND_KEYS[kind])} color={color} />
      {str(props.way_name) && <Row label={t("popup.mapchallenge.day08.wayName")} value={str(props.way_name)} />}
      {str(props.park_name) && <Row label={t("popup.mapchallenge.day08.belongsPark")} value={str(props.park_name)} />}
      <Row label={t("popup.mapchallenge.day08.entranceNote")} value={t("legend.mapchallenge.day08.entranceRule")} />
      <Day08ParksFooter />
    </div>;
  }
  const riverside = props.cls === "riverside";
  const color = mapchallengeDay08ParkColor(riverside ? "riverside" : "park", isDark);
  const area = numOrNull(props.area_ha);
  return <div>
    <Title color={color}>{str(props.name) || t(riverside ? "popup.mapchallenge.day08.unnamedRiverside" : "popup.mapchallenge.day08.unnamedPark")}</Title>
    <Row label={t("popup.mapchallenge.day08.cls")} value={t(riverside ? "legend.mapchallenge.day08.parkCls.riverside" : "legend.mapchallenge.day08.parkCls.park")} color={color} />
    {area !== null && <Row label={t("popup.mapchallenge.day08.area")} value={t("popup.mapchallenge.day08.ha", { n: formatNumber(area) })} mono />}
    <Row label={t("popup.mapchallenge.day08.isRiverside")} value={t(riverside ? "popup.mapchallenge.day08.riversideYes" : "popup.mapchallenge.day08.riversideNo")} />
    {riverside && <Row label={t("popup.mapchallenge.day08.entranceNote")} value={t("legend.mapchallenge.day08.entranceRule")} />}
    <Day08ParksFooter />
  </div>;
}

export function MapchallengeDay08SitesPanel({ props }: Props) {
  const { t, formatNumber, active } = useLocale();
  const yi = (v: number) => formatNumber(active === "en" ? mapchallengeDay08YiToBillion(v) : v, MAPCHALLENGE_DAY08_COST_FORMAT);
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const cls = (MAPCHALLENGE_DAY08_SITE_CLASSES.some((c) => c.value === props.cls) ? props.cls : "T3") as MapchallengeDay08SiteClass;
  const historical = cls === "park" || cls === "greenbelt";
  const color = mapchallengeDay08SiteColor(cls, isDark);
  const area = numOrNull(props.area_m2);
  const newPop = numOrNull(props.new_pop);
  const newVul = numOrNull(props.new_vul);
  const popLow = numOrNull(props.pop_low);
  const popHigh = numOrNull(props.pop_high);
  const [cLow, cBase, cHigh] = [numOrNull(props.cost_low), numOrNull(props.cost_base), numOrNull(props.cost_high)];
  const still = numOrNull(props.still_park_pct);
  const scenario = mapchallengeDay08ScenarioByValue(str(props.scenario)).value;
  return <div>
    <Title color={color}>{historical && str(props.label) ? t("popup.mapchallenge.day08.histTitle", { label: str(props.label) }) : t(MAPCHALLENGE_DAY08_SITE_CLASS_KEYS[cls])}</Title>
    <Row label={t("popup.mapchallenge.day08.cls")} value={t(MAPCHALLENGE_DAY08_SITE_CLASS_KEYS[cls])} color={color} />
    <Row label={t("popup.mapchallenge.day08.scenario")} value={t(MAPCHALLENGE_DAY08_SCENARIO_KEYS[scenario])} />
    {!historical && numOrNull(props.step) !== null && <Row label={t("popup.mapchallenge.day08.step")} value={t("popup.mapchallenge.day08.stepN", { n: formatNumber(num(props.step)) })} />}
    {!historical && str(props.zone) && <Row label={t("popup.mapchallenge.day08.zone")} value={str(props.zone)} />}
    {area !== null && <Row label={t("popup.mapchallenge.day08.area")} value={t("popup.mapchallenge.day08.ha", { n: formatNumber(Math.round(area / 100) / 100) })} mono />}
    {still !== null && <Row label={t("popup.mapchallenge.day08.stillPark")} value={t("popup.mapchallenge.day08.pct", { n: formatNumber(still) })} mono color={color} />}
    {newPop !== null && <Row label={t("popup.mapchallenge.day08.newPop")} value={t("popup.mapchallenge.day08.people", { n: formatNumber(newPop) })} mono />}
    {newVul !== null && <Row label={t("popup.mapchallenge.day08.newVul")} value={t("popup.mapchallenge.day08.people", { n: formatNumber(newVul) })} mono />}
    {popLow !== null && popHigh !== null && <Row label={t("popup.mapchallenge.day08.residents")} value={t("popup.mapchallenge.day08.peopleRange", { low: formatNumber(popLow), high: formatNumber(popHigh) })} mono />}
    {cLow !== null && cBase !== null && cHigh !== null && <Row label={t("popup.mapchallenge.day08.cost")} value={t("popup.mapchallenge.day08.costValue", {
      low: yi(cLow), base: yi(cBase), high: yi(cHigh),
    })} mono />}
    <Day08Footer historical={historical} />
  </div>;
}

// ── Day 9 城鄉 ───────────────────────────────────────────────
export function MapchallengeDay09UrbanRuralPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay09UrbanRural");
  const metric = mapchallengeDay09MetricByKey(paramStr(values, "mapchallengeDay09UrbanRural", "mapchallengeDay09UrbanRuralMetric"));
  const pop = num(props.pop);
  const q = Math.min(4, Math.max(0, Math.trunc(num(props.q)) || 0));
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  return <div>
    <Title color={mapchallengeDay09FeatureColor(metric, props, isDark)}>{str(props.name)}</Title>
    <Row label={t("popup.mapchallenge.day09.pop")} value={t("popup.mapchallenge.day09.people", { n: formatNumber(pop) })} mono />
    <Row label={t("popup.mapchallenge.day09.density")} value={t("popup.mapchallenge.day09.perKm2", { n: formatNumber(num(props.density)) })} mono />
    <Row label={t("popup.mapchallenge.day09.group")} value={t(MAPCHALLENGE_DAY09_QUINTILE_KEYS[q]!)} />
    {MAPCHALLENGE_DAY09_FACILITIES.map((f) => {
      const c = num(props[`c_${f.key}`]);
      const per = pop > 0 ? (c / pop) * 1e4 : 0;
      return <Row key={f.key} label={t(MAPCHALLENGE_DAY09_METRIC_KEYS[f.key])}
        value={t("popup.mapchallenge.day09.countPer", { n: formatNumber(c), per: per.toFixed(2) })}
        color={f.key === metric ? mapchallengeDay09FeatureColor(metric, props, isDark) : undefined} mono />;
    })}
    <SourceFooter props={{ source: t("legend.mapchallenge.day09.source") }} />
  </div>;
}

// ── Day 17 光與暗 ─────────────────────────────────────────────
/** 天空推估相對值：小數 2 位有效數字（0.00001 這種地板值也看得出量級） */
const relText = (v: unknown) => (Number.isFinite(num(v)) ? Number(num(v).toPrecision(2)).toString() : "");

export function MapchallengeDay17DarkSkyPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const darkest = props.darkest_class_pct;
  const hasLand = darkest !== null && darkest !== undefined && darkest !== "" && Number.isFinite(num(darkest));
  const landPct = num(props.land_pixel_pct);
  return <div>
    <Title color={mapchallengeDay17ProtectedLineColor(isDark)}>{str(props.name)}</Title>
    <Row label={t("popup.mapchallenge.day17.category")} value={str(props.category)} />
    <Row label={t("popup.mapchallenge.day17.rank")} value={t("popup.mapchallenge.day17.rankValue", { rank: num(props.rank_all), total: MAPCHALLENGE_DAY17_PROTECTED_TOTAL })} mono />
    <Row label={t("popup.mapchallenge.day17.skyMean")} value={t("popup.mapchallenge.day17.relValue", { n: relText(props.sky_rel_mean) })} mono />
    <Row label={t("popup.mapchallenge.day17.darkestPct")} value={hasLand ? t("popup.mapchallenge.day17.pct", { n: formatNumber(num(darkest)) }) : t("popup.mapchallenge.day17.noLand")} mono={hasLand} />
    <Row label={t("popup.mapchallenge.day17.groundMax")} value={t("popup.mapchallenge.day17.nw", { n: formatNumber(num(props.ground_max_nw)) })} mono />
    {Number.isFinite(landPct) && landPct < 50 && <Row label={t("popup.mapchallenge.day17.note")} value={t("popup.mapchallenge.day17.mostlySea", { n: formatNumber(landPct) })} />}
    <SourceFooter props={{ source: t("legend.mapchallenge.day17.source") }} />
  </div>;
}

export function MapchallengeDay17DarkRoadsPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const route = [str(props.route), str(props.name)].filter(Boolean).join(" ") || t("popup.mapchallenge.day17.unnamed");
  const isRun = Number.isFinite(num(props.rank)) && props.rank !== undefined;
  if (isRun) {
    const rank = num(props.rank);
    const from = str(props.from_town);
    const to = str(props.to_town);
    const tunnel = num(props.tunnel_km);
    return <div>
      <Title color={rank <= MAPCHALLENGE_DAY17_TOP_RANK ? mapchallengeDay17GlowColor(isDark) : mapchallengeDay17ZeroColor(isDark)}>{route}</Title>
      <Row label={t("popup.mapchallenge.day17.runRank")} value={t("popup.mapchallenge.day17.runRankValue", { rank })} mono />
      <Row label={t("popup.mapchallenge.day17.darkKm")} value={t("popup.mapchallenge.day17.km", { n: formatNumber(num(props.dark_km)) })} mono />
      {tunnel > 0 && <Row label={t("popup.mapchallenge.day17.span")} value={t("popup.mapchallenge.day17.spanValue", { n: formatNumber(num(props.span_km)), tunnel: formatNumber(tunnel) })} mono />}
      {from && <Row label={t("popup.mapchallenge.day17.fromTo")} value={from === to || !to ? from : t("popup.mapchallenge.day17.fromToValue", { from, to })} />}
      <Row label={t("popup.mapchallenge.day17.zero24")} value={t("popup.mapchallenge.day17.pct", { n: formatNumber(num(props.zero24_pct)) })} mono />
      <Row label={t("popup.mapchallenge.day17.note")} value={t("popup.mapchallenge.day17.pixelNote")} />
      <SourceFooter props={{ source: t("legend.mapchallenge.day17.roadsSource") }} />
    </div>;
  }
  const zero = str(props.cls) === "0";
  return <div>
    <Title color={zero ? mapchallengeDay17ZeroColor(isDark) : MAPCHALLENGE_DAY17_LOW_SWATCH}>{route}</Title>
    <Row label={t("popup.mapchallenge.day17.cls")} value={t(zero ? "popup.mapchallenge.day17.clsZero" : "popup.mapchallenge.day17.clsLow")} />
    <Row label={t("popup.mapchallenge.day17.segKm")} value={t("popup.mapchallenge.day17.km", { n: formatNumber(num(props.length_km)) })} mono />
    {!zero && <Row label={t("popup.mapchallenge.day17.rad25")} value={t("popup.mapchallenge.day17.nw", { n: formatNumber(num(props.rad25_mean)) })} mono />}
    <Row label={t("popup.mapchallenge.day17.note")} value={t(zero ? "popup.mapchallenge.day17.pixelNote" : "popup.mapchallenge.day17.lowNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day17.roadsSource") }} />
  </div>;
}

export function MapchallengeDay17LedSharePanel({ props }: Props) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const values = useLayerParams("mapchallengeDay17LedShare");
  const year = mapchallengeDay17LedYearByKey(paramStr(values, "mapchallengeDay17LedShare", "mapchallengeDay17LedShareYear"));
  const share = props[`led_share_${year}`];
  const has = (v: unknown) => v !== null && v !== undefined && v !== "" && Number.isFinite(num(v));
  const fmt = (v: unknown) => (has(v) ? formatNumber(num(v)) : t("popup.mapchallenge.day17.ledNoData"));
  return <div>
    <Title color={mapchallengeDay17LedFeatureColor(has(share) ? num(share) : null, isDark)}>{placeName(str(props.county), i18n, str(props.code) || null)}</Title>
    <Row label={t("popup.mapchallenge.day17.ledShare", { year })} value={has(share) ? `${(num(share) * 100).toFixed(1)}%` : t("popup.mapchallenge.day17.ledNoData")} mono />
    <Row label={t("popup.mapchallenge.day17.ledKwh")} value={t("popup.mapchallenge.day17.ledOfTotal", { a: fmt(props[`led_kwh_${year}`]), b: fmt(props[`total_kwh_${year}`]), unit: "kWh" })} mono />
    <Row label={t("popup.mapchallenge.day17.ledAccounts")} value={t("popup.mapchallenge.day17.ledOfTotal", { a: fmt(props[`led_count_${year}`]), b: fmt(props[`total_${year}`]), unit: t("popup.mapchallenge.day17.ledAcctUnit") })} mono />
    <Row label={t("popup.mapchallenge.day17.note")} value={t("popup.mapchallenge.day17.ledNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day17.ledSource") }} />
  </div>;
}

// ── Day 19 氣味 ───────────────────────────────────────────────
const MAPCHALLENGE_DAY19_LEVEL_KEYS = { 9: "popup.mapchallenge.day19.lvl9", 8: "popup.mapchallenge.day19.lvl8", 7: "popup.mapchallenge.day19.lvl7" } as const;
const MAPCHALLENGE_DAY19_DIR_KEYS = [
  "popup.mapchallenge.day19.dir0", "popup.mapchallenge.day19.dir1", "popup.mapchallenge.day19.dir2", "popup.mapchallenge.day19.dir3",
  "popup.mapchallenge.day19.dir4", "popup.mapchallenge.day19.dir5", "popup.mapchallenge.day19.dir6", "popup.mapchallenge.day19.dir7",
  "popup.mapchallenge.day19.dir8", "popup.mapchallenge.day19.dir9", "popup.mapchallenge.day19.dir10", "popup.mapchallenge.day19.dir11",
  "popup.mapchallenge.day19.dir12", "popup.mapchallenge.day19.dir13", "popup.mapchallenge.day19.dir14", "popup.mapchallenge.day19.dir15",
] as const;
const isCategory = (v: string): v is MapchallengeDay19Category => MAPCHALLENGE_DAY19_CATEGORIES.some((c) => c.key === v);

export function MapchallengeDay19ComplaintsPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const theme = useFeatureTheme();
  const isDark = theme !== LIGHT_FEATURE;
  const values = useLayerParams("mapchallengeDay19Complaints");
  const period = mapchallengeDay19PeriodByKey(paramStr(values, "mapchallengeDay19Complaints", "mapchallengeDay19ComplaintsPeriod"));
  const selected = mapchallengeDay19CategoryByKey(paramStr(values, "mapchallengeDay19Complaints", "mapchallengeDay19ComplaintsCategory"));
  const total = num(props.n);
  const top = str(props.top);
  const lvl = num(props.lvl);
  const levelKey = MAPCHALLENGE_DAY19_LEVEL_KEYS[lvl as 9 | 8 | 7];
  // area＝實際畫出的面積（父格扣掉已單獨畫的子格），件數 ÷ area＝每 km² 件數，三個數字才對得起來
  const area = num(props.area);
  const counts = MAPCHALLENGE_DAY19_CATEGORIES.map((c) => ({ key: c.key, n: Number.isFinite(num(props[c.key])) ? num(props[c.key]) : 0 }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const titleColor = selected !== "all" ? mapchallengeDay19CategoryColor(selected, isDark) : isCategory(top) ? mapchallengeDay19CategoryColor(top, isDark) : mapchallengeDay19CategoryColor("other", isDark);
  return <div>
    <Title color={titleColor}>{t("popup.mapchallenge.day19.complaintsTitle")}</Title>
    <Row label={t("popup.mapchallenge.day19.period")} value={t(MAPCHALLENGE_DAY19_PERIOD_KEYS[period])} />
    {levelKey && <Row label={t("popup.mapchallenge.day19.grid")} value={t(levelKey, { area: Number.isFinite(area) ? formatNumber(area >= 1 ? Math.round(area * 10) / 10 : Math.round(area * 100) / 100) : "—" })} />}
    <Row label={t("popup.mapchallenge.day19.cases")} value={t("popup.mapchallenge.day19.casesValue", { n: formatNumber(total) })} mono />
    <Row label={t("popup.mapchallenge.day19.dens")} value={t("popup.mapchallenge.day19.densValue", { n: formatNumber(num(props.dens)), bin: mapchallengeDay19DensBin(num(props.dens)) + 1 })} mono />
    {isCategory(top) && <Row label={t("popup.mapchallenge.day19.top")} value={t(MAPCHALLENGE_DAY19_CATEGORY_KEYS[top])} color={mapchallengeDay19CategoryColor(top, isDark)} />}
    <div style={{ marginTop: 4 }}>
      {counts.map((c) => <div key={c.key} style={{ display: "grid", gridTemplateColumns: "76px 1fr 36px", alignItems: "center", columnGap: 6, padding: "2px 0", fontSize: FONT_SIZE.sm }}>
        <span style={{ color: selected === c.key ? theme.textStrong : theme.textMuted }}>{t(MAPCHALLENGE_DAY19_CATEGORY_KEYS[c.key])}</span>
        <span role="img" aria-label={t("popup.mapchallenge.day19.barAria", { name: t(MAPCHALLENGE_DAY19_CATEGORY_KEYS[c.key]), n: c.n })} style={{ height: 6, borderRadius: RADIUS.pill, background: theme.bgStrong, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(c.n / max) * 100}%`, background: mapchallengeDay19CategoryColor(c.key, isDark), borderRadius: RADIUS.pill }} />
        </span>
        <span style={{ color: theme.textStrong, textAlign: "right", fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{formatNumber(c.n)}</span>
      </div>)}
    </div>
    <Row label={t("popup.mapchallenge.day19.note")} value={t("popup.mapchallenge.day19.complaintsNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day19.complaintsSource") }} />
  </div>;
}

export function MapchallengeDay19PotentialPanel({ props }: Props) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  if (str(props.season)) {
    const winter = str(props.season) === "winter";
    const from = num(props.from);
    return <div>
      <Title color={mapchallengeDay19WindColor(isDark)}>{t(winter ? "popup.mapchallenge.day19.windWinter" : "popup.mapchallenge.day19.windSummer")}</Title>
      <Row label={t("popup.mapchallenge.day19.windFrom")} value={Number.isFinite(from) ? t("popup.mapchallenge.day19.windFromValue", { dir: t(MAPCHALLENGE_DAY19_DIR_KEYS[mapchallengeDay19CompassIdx(from)]!), deg: Math.round(from) }) : ""} />
      <Row label={t("popup.mapchallenge.day19.windSpeed")} value={t("popup.mapchallenge.day19.ms", { n: formatNumber(num(props.spd)) })} mono />
      <Row label={t("popup.mapchallenge.day19.calm")} value={t("popup.mapchallenge.day19.pct", { n: formatNumber(Math.round(num(props.calm) * 1000) / 10) })} mono />
      <Row label={t("popup.mapchallenge.day19.note")} value={t("popup.mapchallenge.day19.windNote")} />
      <SourceFooter props={{ source: t("popup.mapchallenge.day19.windSource") }} />
    </div>;
  }
  if (str(props.soilwater) || str(props.dist)) {
    return <div>
      <Title color={mapchallengeDay19DumpingColor(isDark)}>{t("popup.mapchallenge.day19.dumpingTitle")}</Title>
      <Row label={t("popup.mapchallenge.day19.county")} value={[placeName(str(props.county), i18n), str(props.dist) ? placeTown(str(props.county), str(props.dist), i18n) : ""].filter(Boolean).join(" ")} />
      <Row label={t("popup.mapchallenge.day19.wasteKind")} value={str(props.kind) || t("popup.mapchallenge.day19.unknown")} />
      <Row label={t("popup.mapchallenge.day19.updated")} value={str(props.updated)} mono />
      <Row label={t("popup.mapchallenge.day19.soilwater")} value={str(props.soilwater)} />
      <SourceFooter props={{ source: t("popup.mapchallenge.day19.dumpingSource") }} />
    </div>;
  }
  const kind = str(props.kind) as keyof typeof MAPCHALLENGE_DAY19_FACILITY_KEYS;
  const kindKey = MAPCHALLENGE_DAY19_FACILITY_KEYS[kind];
  return <div>
    <Title color={mapchallengeDay19FacilityColor(kind, isDark)}>{str(props.name) || (kindKey ? t(kindKey) : "")}</Title>
    <Row label={t("popup.mapchallenge.day19.facKind")} value={kindKey ? t(kindKey) : str(props.label)} />
    <Row label={t("popup.mapchallenge.day19.note")} value={t("popup.mapchallenge.day19.facNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day19.potentialSource") }} />
  </div>;
}

export function MapchallengeDay19PenaltiesPanel({ props }: Props) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const ratio = props.max_ratio;
  const hasRatio = typeof ratio === "number" && Number.isFinite(ratio);
  const y0 = num(props.y0);
  const y1 = num(props.y1);
  const money = num(props.money);
  return <div>
    <Title color={mapchallengeDay19RatioColor(hasRatio ? ratio : null, isDark)}>{str(props.fac)}</Title>
    <Row label={t("popup.mapchallenge.day19.county")} value={placeName(str(props.county), i18n)} />
    <Row label={t("popup.mapchallenge.day19.penaltyCount")} value={t("popup.mapchallenge.day19.penaltyCountValue", { n: formatNumber(num(props.n)), d: formatNumber(num(props.n_days)) })} mono />
    {Number.isFinite(y0) && <Row label={t("popup.mapchallenge.day19.years")} value={y0 === y1 || !Number.isFinite(y1) ? String(y0) : `${y0}–${y1}`} mono />}
    <Row label={t("popup.mapchallenge.day19.maxRatio")} value={hasRatio ? t("popup.mapchallenge.day19.ratioValue", { n: formatNumber(ratio) }) : t("popup.mapchallenge.day19.ratioNull")} mono={hasRatio} />
    {Number.isFinite(money) && <Row label={t("popup.mapchallenge.day19.money")} value={t("popup.mapchallenge.day19.moneyValue", { n: formatNumber(money) })} mono />}
    <Row label={t("popup.mapchallenge.day19.note")} value={t("popup.mapchallenge.day19.penaltiesNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day19.penaltiesSource") }} />
  </div>;
}

// ── Day 21 OSM ────────────────────────────────────────────────
export function MapchallengeDay21OsmRoadsPanel({ props }: Props) {
  const { t, formatNumber } = useLocale();
  const year = num(props.year);
  const hw = str(props.highway);
  const osmId = str(props.osm_id);
  const yearText = year === MAPCHALLENGE_DAY21_YEAR_MIN ? t("legend.mapchallenge.day21.before", { year }) : String(year);
  return <div>
    <Title color={mapchallengeDay21YearColor(year)}>{str(props.name) || t("popup.mapchallenge.day21.unnamed")}</Title>
    <Row label={t("popup.mapchallenge.day21.year")} value={yearText} mono />
    <Row label={t("popup.mapchallenge.day21.class")} value={hw ? `${t(MAPCHALLENGE_DAY21_CLASS_KEYS[mapchallengeDay21ClassOf(hw)])}（${hw}）` : t("popup.mapchallenge.day21.noClass")} />
    {Number.isFinite(num(props.len_m)) && <Row label={t("popup.mapchallenge.day21.length")} value={t("popup.mapchallenge.day21.meters", { n: formatNumber(num(props.len_m)) })} mono />}
    {/^(way|node|relation)\/\d+$/.test(osmId) && <LinkRow label="OSM" url={`https://www.openstreetmap.org/${osmId}`} />}
    <Row label={t("popup.mapchallenge.day21.note")} value={t("popup.mapchallenge.day21.yearNote")} />
    <SourceFooter props={{ source: t("legend.mapchallenge.day21.source") }} />
  </div>;
}
