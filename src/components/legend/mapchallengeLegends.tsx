/**
 * 30 天地圖挑戰 Day 4 群聚圖例（模擬面板）。色、級距、重疊率全部讀 `data/mapchallengeDay04Types.ts`。
 * - 人口密度：magma 5 級。
 * - 設施群聚：每種設施一組色階；標題旁放該色階代表色（第 4 階），切設施時標題、色塊、級距一起換。
 * - 熱區重疊（r7 與臺中彰化 r8）：四類固定色＋大字重疊率。
 */
import { LEGEND_SWATCH, LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, LegendSizeRow, useLegendTheme } from "./legendKit";
import { normalizeColor } from "../../map/colorContrast";
import { liftedColorMap } from "../../map/darkContrast";
import { paramBool, paramNum, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import {
  MAPCHALLENGE_DAY21_TOTAL_KM, MAPCHALLENGE_DAY21_YEAR_MAX, MAPCHALLENGE_DAY21_YEAR_MIN, MAPCHALLENGE_DAY21_YEARS, mapchallengeDay21YearAt, mapchallengeDay21YearColor,
} from "../../data/mapchallengeDay21Types";
import { MAPCHALLENGE_DAY21_WIDTH } from "../../data/mapchallengeDay21Style";
import {
  MAPCHALLENGE_DAY23_BASE_STORES, MAPCHALLENGE_DAY23_TERMS, MAPCHALLENGE_DAY23_VARIANT_GROUPS,
  mapchallengeDay23GroupById, mapchallengeDay23Radius, mapchallengeDay23TermById, mapchallengeDay23TermColor,
  MAPCHALLENGE_DAY23_ARC, MAPCHALLENGE_DAY23_FOREIGN, MAPCHALLENGE_DAY23_FOREIGN_DOMINANT, MAPCHALLENGE_DAY23_ORIGIN, MAPCHALLENGE_DAY23_PLACES,
  mapchallengeDay23ArcWidth, mapchallengeDay23ForeignById, mapchallengeDay23PlaceById,
  type MapchallengeDay23ForeignId, type MapchallengeDay23PlaceId, type MapchallengeDay23TermId,
  MAPCHALLENGE_DAY23_CELL_KM2, mapchallengeDay23IntlByKey, mapchallengeDay23IntlTermById,
  type MapchallengeDay23IntlCountry, type MapchallengeDay23IntlKey, type MapchallengeDay23IntlTerm,
} from "../../data/mapchallengeDay23Types";
import { useLocale } from "../../state/localeStore";
import type { StaticMessageKey } from "../../i18n/keys";
import { FONT_DATA, FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";
import {
  MAPCHALLENGE_DAY04_HOTSPOT_CLASSES, MAPCHALLENGE_DAY04_PD_LABELS, MAPCHALLENGE_DAY04_TC_CH_OVERLAP,
  MAPCHALLENGE_DAY04_ZERO_SWATCH, MAPCHALLENGE_DAY04_ZERO_SWATCH_OPACITY,
  mapchallengeFacilityByKey, mapchallengeFacilityLabels, mapchallengeFacilityRamp, mapchallengeFacilitySwatch,
  mapchallengePopulationRamp, type MapchallengeFacilityKey,
} from "../../data/mapchallengeDay04Types";
import {
  MAPCHALLENGE_DAY05_KIND_COLORS, MAPCHALLENGE_DAY05_SCOPES, MAPCHALLENGE_DAY05_TIERS,
  mapchallengeDay05TierSwatch,
} from "../../data/mapchallengeDay05Types";
import {
  MAPCHALLENGE_DAY06_ERAS, MAPCHALLENGE_DAY06_LINK_DASH, MAPCHALLENGE_DAY06_STATUSES, MAPCHALLENGE_DAY06_STATUS_COLORS, MAPCHALLENGE_DAY06_SURVIVE, MAPCHALLENGE_DAY06_TAIPEI_COUNTS,
  MAPCHALLENGE_DAY06_TEMPLE_CLASSES, MAPCHALLENGE_DAY06_TEMPLE_STATS, MAPCHALLENGE_DAY06_ZONE_FILL_OPACITY,
  MAPCHALLENGE_DAY06_OLDEST_WIDTH_MUL, MAPCHALLENGE_DAY06_SAME_RING,
  mapchallengeDay06EraColor, mapchallengeDay06SurviveColor, mapchallengeDay06TempleColor, mapchallengeDay06TodayColor,
} from "../../data/mapchallengeDay06Types";
import {
  MAPCHALLENGE_DAY08_ENTRANCE_KINDS, MAPCHALLENGE_DAY08_ENTRANCE_KIND_KEYS, MAPCHALLENGE_DAY08_PARK_FILL_OPACITY, mapchallengeDay08ParkColor, MAPCHALLENGE_DAY08_SCENARIOS, MAPCHALLENGE_DAY08_SITE_CLASSES, MAPCHALLENGE_DAY08_SITE_FILL_OPACITY,
  mapchallengeDay08BinColors, mapchallengeDay08ScenarioByValue, mapchallengeDay08SiteColor, mapchallengeDay08SiteOutline, mapchallengeDay08YiToBillion, MAPCHALLENGE_DAY08_COST_FORMAT,
  type MapchallengeDay08Scenario, type MapchallengeDay08SiteClass,
} from "../../data/mapchallengeDay08Types";
import {
  mapchallengeDay09DensityColors, MAPCHALLENGE_DAY09_DENSITY_RANGES, mapchallengeDay09RatioColors, MAPCHALLENGE_DAY09_ZERO_COLOR,
  mapchallengeDay09Facility, mapchallengeDay09MetricByKey, type MapchallengeDay09Metric,
} from "../../data/mapchallengeDay09Types";
import {
  MAPCHALLENGE_DAY17_GROUND_MAX_NW, MAPCHALLENGE_DAY17_INFERNO, MAPCHALLENGE_DAY17_LOW_OPACITY, MAPCHALLENGE_DAY17_LOW_SWATCH, MAPCHALLENGE_DAY17_MAGMA, MAPCHALLENGE_DAY17_PRODUCTS,
  MAPCHALLENGE_DAY17_SKY_BREAKS, mapchallengeDay17Gradient, mapchallengeDay17GlowColor, mapchallengeDay17ProtectedLineColor, mapchallengeDay17SkyPos, mapchallengeDay17ZeroColor,
  MAPCHALLENGE_DAY17_LED_NATIONAL, mapchallengeDay17LedColors, mapchallengeDay17LedYearByKey,
} from "../../data/mapchallengeDay17Types";
import {
  MAPCHALLENGE_DAY19_CATEGORIES, MAPCHALLENGE_DAY19_DENS_CUTS, MAPCHALLENGE_DAY19_DENS_OPACITY, MAPCHALLENGE_DAY19_FACILITY_KINDS, MAPCHALLENGE_DAY19_PENALTY_TOTALS,
  MAPCHALLENGE_DAY19_PERIOD_STATS, MAPCHALLENGE_DAY19_POTENTIAL_CLASSES, mapchallengeDay19CategoryByKey, mapchallengeDay19PenaltyRadius, mapchallengeDay19PeriodByKey,
  MAPCHALLENGE_DAY19_WINDS, type MapchallengeDay19Category,
} from "../../data/mapchallengeDay19Types";
import {
  MAPCHALLENGE_DAY19_RATIO_NULL_COLOR, mapchallengeDay19CategoryColor, mapchallengeDay19DumpingColor, mapchallengeDay19FacilityColor, mapchallengeDay19RatioColors,
  mapchallengeDay19WindColor,
} from "../../data/mapchallengeDay19Style";
import { RADIUS } from "../../styles/designTokens";

/** i18n key 寫成字面值（localeParity 靠字面值判斷 key 有沒有人用） */
export const MAPCHALLENGE_FACILITY_NAME_KEYS: Record<MapchallengeFacilityKey, `legend.mapchallenge.facility.${MapchallengeFacilityKey}`> = {
  convenience: "legend.mapchallenge.facility.convenience",
  cram: "legend.mapchallenge.facility.cram",
  clinic: "legend.mapchallenge.facility.clinic",
  factory: "legend.mapchallenge.facility.factory",
  temple: "legend.mapchallenge.facility.temple",
  school: "legend.mapchallenge.facility.school",
};
export const MAPCHALLENGE_FACILITY_UNIT_KEYS: Record<MapchallengeFacilityKey, `legend.mapchallenge.unit.${MapchallengeFacilityKey}`> = {
  convenience: "legend.mapchallenge.unit.convenience",
  cram: "legend.mapchallenge.unit.cram",
  clinic: "legend.mapchallenge.unit.clinic",
  factory: "legend.mapchallenge.unit.factory",
  temple: "legend.mapchallenge.unit.temple",
  school: "legend.mapchallenge.unit.school",
};
export const MAPCHALLENGE_HOTSPOT_CLASS_KEYS = {
  3: "legend.mapchallenge.class.both",
  1: "legend.mapchallenge.class.population",
  2: "legend.mapchallenge.class.facility",
  0: "legend.mapchallenge.class.neither",
} as const;

function Swatch({ color, zero }: { color: string; zero?: boolean }) {
  const theme = useLegendTheme();
  return zero
    ? <SwatchSquare color={MAPCHALLENGE_DAY04_ZERO_SWATCH} opacity={MAPCHALLENGE_DAY04_ZERO_SWATCH_OPACITY} />
    : <SwatchSquare color={color} opacity={0.9} stroke={theme.seam} />;
}

function OverlapRate({ children }: { children: string }) {
  const theme = useLegendTheme();
  return <div style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: theme.textStrong, margin: "2px 0 4px" }}>{children}</div>;
}

function HotspotRows() {
  const { t } = useLocale();
  return <>
    {MAPCHALLENGE_DAY04_HOTSPOT_CLASSES.map((c) => <LegendRow key={c.value} swatch={<Swatch color={c.color} zero={c.value === 0} />}>
      {t(MAPCHALLENGE_HOTSPOT_CLASS_KEYS[c.value])}
    </LegendRow>)}
  </>;
}

export function MapchallengePopulationLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const ramp = mapchallengePopulationRamp(isDark);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.populationTitle")} />
    {[...MAPCHALLENGE_DAY04_PD_LABELS].reverse().map((label, i) => (
      <LegendRow key={label} swatch={<Swatch color={ramp[ramp.length - 1 - i]!} />}><LegendNum>{label}</LegendNum></LegendRow>
    ))}
    <LegendNote>{t("legend.mapchallenge.populationNote")}</LegendNote>
  </div>;
}

export function MapchallengeFacilityLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay04Facility");
  const f = mapchallengeFacilityByKey(paramStr(values, "mapchallengeDay04Facility", "mapchallengeDay04FacilityKind"));
  const ramp = mapchallengeFacilityRamp(f, isDark);
  const labels = mapchallengeFacilityLabels(f);
  return <div>
    <LegendTitle zh={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Swatch color={mapchallengeFacilitySwatch(f, isDark)} />
      {t("legend.mapchallenge.facilityTitle", { name: t(MAPCHALLENGE_FACILITY_NAME_KEYS[f.key]), unit: t(MAPCHALLENGE_FACILITY_UNIT_KEYS[f.key]) })}
    </span>} />
    {[...labels].reverse().map((label, i) => (
      <LegendRow key={label} swatch={<Swatch color={ramp[ramp.length - 1 - i]!} />}><LegendNum>{label}</LegendNum></LegendRow>
    ))}
    <LegendRow swatch={<Swatch color={MAPCHALLENGE_DAY04_ZERO_SWATCH} zero />}>{t("legend.mapchallenge.zero")}</LegendRow>
    <LegendNote>{t("legend.mapchallenge.facilityNote")}</LegendNote>
  </div>;
}

export function MapchallengeOverlapLegend() {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay04Overlap");
  const f = mapchallengeFacilityByKey(paramStr(values, "mapchallengeDay04Overlap", "mapchallengeDay04OverlapKind"));
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.overlapTitle", { name: t(MAPCHALLENGE_FACILITY_NAME_KEYS[f.key]) })} />
    <OverlapRate>{t("legend.mapchallenge.overlapRate", { pct: f.overlapPct })}</OverlapRate>
    <HotspotRows />
    <LegendNote>{t("legend.mapchallenge.overlapNote")}</LegendNote>
  </div>;
}

export function MapchallengeScaleTcChLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.tcchTitle")} />
    <OverlapRate>{t("legend.mapchallenge.tcchRate", { tc: MAPCHALLENGE_DAY04_TC_CH_OVERLAP.taichung, ch: MAPCHALLENGE_DAY04_TC_CH_OVERLAP.changhua })}</OverlapRate>
    <HotspotRows />
    <LegendNote>{t("legend.mapchallenge.tcchNote")}</LegendNote>
  </div>;
}

// ── Day 5 視野：海景路段／最長連續海景 ─────────────────────────
/** i18n key 寫成字面值（同上） */
export const MAPCHALLENGE_DAY05_TIER_KEYS = {
  2: "legend.mapchallenge.day05.tier2",
  1: "legend.mapchallenge.day05.tier1",
  3: "legend.mapchallenge.day05.tier3",
  0: "legend.mapchallenge.day05.tier0",
  "-1": "legend.mapchallenge.day05.tierTunnel",
} as const;

const MAPCHALLENGE_DAY05_SCOPE_KEYS = {
  all: "legend.mapchallenge.day05.scope.all",
  d200: "legend.mapchallenge.day05.scope.d200",
  d100: "legend.mapchallenge.day05.scope.d100",
} as const;

function Day05Footer() {
  const { t } = useLocale();
  return <>
    <LegendNote>{t("legend.mapchallenge.day05.method")}</LegendNote>
  </>;
}

/** LG-4 線型：寬度取 L-1 z14 值等比縮小（道路強 2、弱 1） */
export function MapchallengeSeaViewLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day05.seaViewTitle")} />
    {MAPCHALLENGE_DAY05_TIERS.map((tier) => {
      const sw = mapchallengeDay05TierSwatch(tier.value, isDark);
      return <LegendRow key={tier.value} swatch={<SwatchLine color={sw.color} opacity={sw.opacity} width={tier.value >= 1 ? 2 : 1} />}>
        {t(MAPCHALLENGE_DAY05_TIER_KEYS[String(tier.value) as keyof typeof MAPCHALLENGE_DAY05_TIER_KEYS])}
      </LegendRow>;
    })}
    <LegendNote>{t("legend.mapchallenge.day05.seaViewNote")}</LegendNote>
    <Day05Footer />
  </div>;
}

export function MapchallengeSeaViewRunsLegend() {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay05SeaViewRuns");
  const scope = MAPCHALLENGE_DAY05_SCOPES.find((s) => s.value === paramStr(values, "mapchallengeDay05SeaViewRuns", "mapchallengeDay05SeaViewRunsScope")) ?? MAPCHALLENGE_DAY05_SCOPES[0];
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day05.runsTitle")} />
    <LegendNote>{t("legend.mapchallenge.day05.runsScope", { scope: t(MAPCHALLENGE_DAY05_SCOPE_KEYS[scope.value]) })}</LegendNote>
    <LegendRow swatch={<SwatchLine color={MAPCHALLENGE_DAY05_KIND_COLORS.rail} width={2} />}>{t("legend.mapchallenge.day05.rail")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={MAPCHALLENGE_DAY05_KIND_COLORS.road} width={2} />}>{t("legend.mapchallenge.day05.road")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={MAPCHALLENGE_DAY05_KIND_COLORS.rail} width={3} />}>{t("legend.mapchallenge.day05.top3")}</LegendRow>
    <Day05Footer />
  </div>;
}

// ── Day 6 復古：海岸線三代／1932 町界／1921 祠廟／燈塔測候所 ─────────────
/** i18n key 寫成字面值（同上） */
export const MAPCHALLENGE_DAY06_ERA_KEYS = {
  1: "legend.mapchallenge.day06.era1",
  2: "legend.mapchallenge.day06.era2",
  3: "legend.mapchallenge.day06.era3",
} as const;
const MAPCHALLENGE_DAY06_SURVIVE_KEYS = { 1: "legend.mapchallenge.day06.surviveYes", 0: "legend.mapchallenge.day06.surviveNo" } as const;
const MAPCHALLENGE_DAY06_TEMPLE_KEYS = { 1: "legend.mapchallenge.day06.templeYes", 0: "legend.mapchallenge.day06.templeNo" } as const;
export const MAPCHALLENGE_DAY06_STATUS_KEYS = {
  same: "legend.mapchallenge.day06.statusSame",
  moved: "legend.mapchallenge.day06.statusMoved",
  none: "legend.mapchallenge.day06.statusNone",
} as const;


export function MapchallengeDay06CoastLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day06.coastTitle")} />
    {MAPCHALLENGE_DAY06_ERAS.map((e) => <LegendRow key={e.value} swatch={<SwatchLine color={mapchallengeDay06EraColor(e.value, isDark)} width={e.value === 1 ? 3 * MAPCHALLENGE_DAY06_OLDEST_WIDTH_MUL : 3} />}>
      {t(MAPCHALLENGE_DAY06_ERA_KEYS[e.value])}
    </LegendRow>)}
    <LegendRow swatch={<SwatchDot color={mapchallengeDay06EraColor(1, isDark)} />}>{t("legend.mapchallenge.day06.places")}</LegendRow>
    <LegendNote>{t("legend.mapchallenge.day06.coastNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day06.coastToday")}</LegendNote>
  </div>;
}

export function MapchallengeDay06Taipei1932Legend() {
  const { t } = useLocale();
  const theme = useLegendTheme();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day06.taipeiTitle")} />
    {MAPCHALLENGE_DAY06_SURVIVE.map((c) => <LegendRow key={c.value} swatch={<SwatchSquare color={mapchallengeDay06SurviveColor(c.value)} opacity={MAPCHALLENGE_DAY06_ZONE_FILL_OPACITY * 2} stroke={theme.seam} />}>
      {t(MAPCHALLENGE_DAY06_SURVIVE_KEYS[c.value], { n: c.value === 1 ? MAPCHALLENGE_DAY06_TAIPEI_COUNTS.survives : MAPCHALLENGE_DAY06_TAIPEI_COUNTS.total - MAPCHALLENGE_DAY06_TAIPEI_COUNTS.survives })}
    </LegendRow>)}
    <LegendNote>{t("legend.mapchallenge.day06.taipeiNote")}</LegendNote>
  </div>;
}

export function MapchallengeDay06Temples1921Legend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day06.templeTitle")} />
    <OverlapRate>{t("legend.mapchallenge.day06.templeRate", { pct: MAPCHALLENGE_DAY06_TEMPLE_STATS.contPct, control: MAPCHALLENGE_DAY06_TEMPLE_STATS.controlPct })}</OverlapRate>
    {MAPCHALLENGE_DAY06_TEMPLE_CLASSES.map((c) => <LegendRow key={c.value} swatch={<SwatchDot color={mapchallengeDay06TempleColor(c.value)} />}>
      {t(MAPCHALLENGE_DAY06_TEMPLE_KEYS[c.value])}
    </LegendRow>)}
    <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={mapchallengeDay06TodayColor(isDark)} strokeWidth={MAPCHALLENGE_DAY06_SAME_RING.strokeWidth} />}>
      {t("legend.mapchallenge.day06.templeSame", { n: MAPCHALLENGE_DAY06_TEMPLE_STATS.sameName })}
    </LegendRow>
    <LegendNote>{t("legend.mapchallenge.day06.templeNote", { n: MAPCHALLENGE_DAY06_TEMPLE_STATS.sameName })}</LegendNote>
  </div>;
}

export function MapchallengeDay06LighthousesLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day06.lighthouseTitle")} />
    {MAPCHALLENGE_DAY06_STATUSES.map((s) => <LegendRow key={s.value} swatch={<SwatchDot color={MAPCHALLENGE_DAY06_STATUS_COLORS[s.value]} />}>
      {t(MAPCHALLENGE_DAY06_STATUS_KEYS[s.value])}
    </LegendRow>)}
    <LegendRow swatch={<SwatchDot color={mapchallengeDay06TodayColor(isDark)} />}>{t("legend.mapchallenge.day06.today")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={MAPCHALLENGE_DAY06_STATUS_COLORS.moved} width={2} dash={MAPCHALLENGE_DAY06_LINK_DASH} />}>{t("legend.mapchallenge.day06.link")}</LegendRow>
    <LegendNote>{t("legend.mapchallenge.day06.lighthouseNote")}</LegendNote>
  </div>;
}

// ── Day 8 烏托邦：步行可及／選址／1955 計畫圖 ─────────────────────
/** i18n key 寫成字面值（同上） */
export const MAPCHALLENGE_DAY08_SCENARIO_KEYS: Record<MapchallengeDay08Scenario, `legend.mapchallenge.day08.scenario.${MapchallengeDay08Scenario}`> = {
  base: "legend.mapchallenge.day08.scenario.base",
  A: "legend.mapchallenge.day08.scenario.A",
  B: "legend.mapchallenge.day08.scenario.B",
  B2: "legend.mapchallenge.day08.scenario.B2",
  C: "legend.mapchallenge.day08.scenario.C",
  D: "legend.mapchallenge.day08.scenario.D",
  Dfull: "legend.mapchallenge.day08.scenario.Dfull",
};
export const MAPCHALLENGE_DAY08_SPEED_KEYS = {
  normal: "legend.mapchallenge.day08.speed.normal",
  slow: "legend.mapchallenge.day08.speed.slow",
} as const;
export const MAPCHALLENGE_DAY08_SITE_CLASS_KEYS: Record<MapchallengeDay08SiteClass, `legend.mapchallenge.day08.cls.${MapchallengeDay08SiteClass}`> = {
  T1: "legend.mapchallenge.day08.cls.T1",
  T2: "legend.mapchallenge.day08.cls.T2",
  T3: "legend.mapchallenge.day08.cls.T3",
  park: "legend.mapchallenge.day08.cls.park",
  greenbelt: "legend.mapchallenge.day08.cls.greenbelt",
};
const MAPCHALLENGE_DAY08_BIN_KEYS = [
  "legend.mapchallenge.day08.bin0", "legend.mapchallenge.day08.bin1", "legend.mapchallenge.day08.bin2", "legend.mapchallenge.day08.bin3",
] as const;

/** historical：方案 D／Dfull 的用地由 1955 計畫圖數化而來，補列該圖來源與 CC BY-NC 授權 */
function Day08Footer({ historical = false }: { historical?: boolean }) {
  const { t } = useLocale();
  return <>
    <LegendNote>{t("legend.mapchallenge.day08.caveat")}</LegendNote>
    {historical && <LegendNote>{t("legend.mapchallenge.day08.planLicense")}</LegendNote>}
  </>;
}

export function MapchallengeDay08AccessLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay08Access");
  const scenario = mapchallengeDay08ScenarioByValue(paramStr(values, "mapchallengeDay08Access", "mapchallengeDay08Scenario"));
  const speed = paramStr(values, "mapchallengeDay08Access", "mapchallengeDay08AccessSpeed") === "slow" ? "slow" : "normal";
  const base = MAPCHALLENGE_DAY08_SCENARIOS[0];
  const pct = speed === "slow" ? scenario.vulCovered : scenario.covered;
  const basePct = speed === "slow" ? base.vulCovered : base.covered;
  const colors = mapchallengeDay08BinColors(isDark);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day08.accessTitle")} />
    <LegendNote>{t("legend.mapchallenge.day08.accessSub", { scenario: t(MAPCHALLENGE_DAY08_SCENARIO_KEYS[scenario.value]), speed: t(MAPCHALLENGE_DAY08_SPEED_KEYS[speed]) })}</LegendNote>
    <OverlapRate>{scenario.value === "base"
      ? t(speed === "slow" ? "legend.mapchallenge.day08.coveredNowSlow" : "legend.mapchallenge.day08.coveredNow", { pct })
      : t(speed === "slow" ? "legend.mapchallenge.day08.coveredRateSlow" : "legend.mapchallenge.day08.coveredRate", { pct, base: basePct })}</OverlapRate>
    {MAPCHALLENGE_DAY08_BIN_KEYS.map((k, i) => <LegendRow key={k} swatch={<SwatchSquare color={colors[i]!} />}>{t(k)}</LegendRow>)}
    <LegendNote>{t("legend.mapchallenge.day08.accessNote")}</LegendNote>
    <Day08Footer historical={scenario.value === "D" || scenario.value === "Dfull"} />
  </div>;
}

export function MapchallengeDay08ParksLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const outline = (cls: "park" | "riverside") => mapchallengeDay08ParkColor(cls, isDark);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day08.parksTitle")} />
    <LegendRow swatch={<SwatchSquare color={outline("park")} opacity={MAPCHALLENGE_DAY08_PARK_FILL_OPACITY} stroke={outline("park")} />}>{t("legend.mapchallenge.day08.parkCls.park")}</LegendRow>
    <LegendRow swatch={<SwatchSquare color={outline("riverside")} opacity={MAPCHALLENGE_DAY08_PARK_FILL_OPACITY} stroke={outline("riverside")} />}>{t("legend.mapchallenge.day08.parkCls.riverside")}</LegendRow>
    <LegendRow swatch={<SwatchDot color={mapchallengeDay08ParkColor("entrance", isDark)} />}>{t("legend.mapchallenge.day08.parkCls.entrance")}</LegendRow>
    <LegendNote>{MAPCHALLENGE_DAY08_ENTRANCE_KINDS.map((k) => t(MAPCHALLENGE_DAY08_ENTRANCE_KIND_KEYS[k])).join("、")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day08.entranceRule")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day08.caveat")}</LegendNote>
  </div>;
}

export function MapchallengeDay08SitesLegend({ isDark }: { isDark: boolean }) {
  const { t, formatNumber, active } = useLocale();
  const values = useLayerParams("mapchallengeDay08Sites");
  // 英文以十億（B）表示，其餘語系維持億元；三語共用同一組插值變數
  const yi = (v: number) => formatNumber(active === "en" ? mapchallengeDay08YiToBillion(v) : v, MAPCHALLENGE_DAY08_COST_FORMAT);
  const scenario = mapchallengeDay08ScenarioByValue(paramStr(values, "mapchallengeDay08Sites", "mapchallengeDay08Scenario"));
  const historical = scenario.value === "D" || scenario.value === "Dfull";
  // 只列當下方案實際有的類別（A、B2 只有 T3 等；現況沒有用地）
  const shown = MAPCHALLENGE_DAY08_SITE_CLASSES.filter((c) => (scenario.classes as readonly string[]).includes(c.value));
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day08.sitesTitle")} />
    <LegendNote>{t(MAPCHALLENGE_DAY08_SCENARIO_KEYS[scenario.value])}</LegendNote>
    {scenario.costYi && <OverlapRate>{t("legend.mapchallenge.day08.sitesCost", {
      base: yi(scenario.costYi.base), low: yi(scenario.costYi.low), high: yi(scenario.costYi.high),
    })}</OverlapRate>}
    {shown.length === 0 && <LegendNote>{t("legend.mapchallenge.day08.sitesNone")}</LegendNote>}
    {shown.map((c) => <LegendRow key={c.value} swatch={<SwatchSquare color={mapchallengeDay08SiteColor(c.value, isDark)} opacity={MAPCHALLENGE_DAY08_SITE_FILL_OPACITY} stroke={mapchallengeDay08SiteOutline(isDark)} />}>
      {t(MAPCHALLENGE_DAY08_SITE_CLASS_KEYS[c.value])}
    </LegendRow>)}
    <LegendNote>{t(historical ? "legend.mapchallenge.day08.sitesNoteHist" : "legend.mapchallenge.day08.sitesNote")}</LegendNote>
    <Day08Footer historical={historical} />
  </div>;
}

export function MapchallengeDay08Plan1955Legend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day08.planTitle")} />
    <LegendNote>{t("legend.mapchallenge.day08.planOffset")}</LegendNote>
  </div>;
}

// ── Day 9 城鄉：人口密度五等份／設施每萬人數相對全國 ─────────────
/** i18n key 寫成字面值（同上） */
export const MAPCHALLENGE_DAY09_METRIC_KEYS: Record<MapchallengeDay09Metric, `legend.mapchallenge.day09.metric.${MapchallengeDay09Metric}`> = {
  density: "legend.mapchallenge.day09.metric.density",
  elem: "legend.mapchallenge.day09.metric.elem",
  police: "legend.mapchallenge.day09.metric.police",
  post: "legend.mapchallenge.day09.metric.post",
  hc: "legend.mapchallenge.day09.metric.hc",
  cram: "legend.mapchallenge.day09.metric.cram",
  clinic: "legend.mapchallenge.day09.metric.clinic",
  pharm: "legend.mapchallenge.day09.metric.pharm",
  bank: "legend.mapchallenge.day09.metric.bank",
  cvs: "legend.mapchallenge.day09.metric.cvs",
};
export const MAPCHALLENGE_DAY09_QUINTILE_KEYS = [
  "legend.mapchallenge.day09.q0", "legend.mapchallenge.day09.q1", "legend.mapchallenge.day09.q2", "legend.mapchallenge.day09.q3", "legend.mapchallenge.day09.q4",
] as const;
const MAPCHALLENGE_DAY09_BIN_KEYS = [
  "legend.mapchallenge.day09.bin0", "legend.mapchallenge.day09.bin1", "legend.mapchallenge.day09.bin2", "legend.mapchallenge.day09.bin3",
  "legend.mapchallenge.day09.bin4", "legend.mapchallenge.day09.bin5", "legend.mapchallenge.day09.bin6",
] as const;

export function MapchallengeDay09UrbanRuralLegend() {
  const { t } = useLocale();
  const theme = useLegendTheme();
  const values = useLayerParams("mapchallengeDay09UrbanRural");
  const metric = mapchallengeDay09MetricByKey(paramStr(values, "mapchallengeDay09UrbanRural", "mapchallengeDay09UrbanRuralMetric"));
  if (metric === "density") {
    return <div>
      <LegendTitle zh={t(MAPCHALLENGE_DAY09_METRIC_KEYS.density)} />
      <LegendNote>{t("legend.mapchallenge.day09.densityUnit")}</LegendNote>
      {[4, 3, 2, 1, 0].map((q) => <LegendRow key={q} swatch={<SwatchSquare color={mapchallengeDay09DensityColors(theme.isDark)[q]!} stroke={theme.seam} />}>
        {t(MAPCHALLENGE_DAY09_QUINTILE_KEYS[q]!)} <LegendNum>{MAPCHALLENGE_DAY09_DENSITY_RANGES[q]}</LegendNum>
      </LegendRow>)}
      <LegendNote>{t("legend.mapchallenge.day09.groupNote")}</LegendNote>
    </div>;
  }
  const f = mapchallengeDay09Facility(metric);
  return <div>
    <LegendTitle zh={t(MAPCHALLENGE_DAY09_METRIC_KEYS[metric])} />
    <LegendNote>{t("legend.mapchallenge.day09.ratioSub", { n: f.national.toFixed(2) })}</LegendNote>
    {[6, 5, 4, 3, 2, 1, 0].map((i) => <LegendRow key={i} swatch={<SwatchSquare color={mapchallengeDay09RatioColors(theme.isDark)[i]!} stroke={theme.seam} />}>
      {t(MAPCHALLENGE_DAY09_BIN_KEYS[i]!)}
    </LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={MAPCHALLENGE_DAY09_ZERO_COLOR} stroke={theme.seam} />}>{t("legend.mapchallenge.day09.zero")}</LegendRow>
    {metric === "cvs" && <LegendNote>{t("legend.mapchallenge.day09.cvsNote")}</LegendNote>}
    {metric === "hc" && <LegendNote>{t("legend.mapchallenge.day09.hcNote")}</LegendNote>}
    <LegendNote>{t("legend.mapchallenge.day09.groupNote")}</LegendNote>
  </div>;
}

// ── Day 17 光與暗：真正的黑夜／衛星看不到光的路段／入夜變亮 ─────────────
/** 天空推估 5 級：連續色帶（PNG 本身是連續 magma）上畫 4 條切點刻度，下方標級數（1 級在最暗端） */
function Day17SkyClassBar() {
  const { t } = useLocale();
  const theme = useLegendTheme();
  const cuts = [0, ...MAPCHALLENGE_DAY17_SKY_BREAKS.map(mapchallengeDay17SkyPos), 1];
  return <div>
    <div style={{ position: "relative", height: LEGEND_SWATCH.gradient.height, borderRadius: RADIUS.sm, background: mapchallengeDay17Gradient(MAPCHALLENGE_DAY17_MAGMA) }}>
      {cuts.slice(1, -1).map((c) => <span key={c} style={{ position: "absolute", left: `${c * 100}%`, top: 0, bottom: 0, width: 1, background: theme.textStrong }} />)}
    </div>
    <div style={{ position: "relative", height: 12, fontSize: FONT_SIZE.xs, color: theme.textDim }}>
      {cuts.slice(0, -1).map((c, i) => <span key={c} style={{ position: "absolute", left: `${((c + cuts[i + 1]!) / 2) * 100}%`, transform: "translateX(-50%)", fontFamily: FONT_DATA }}>{i + 1}</span>)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: theme.textDim }}>
      <span>{t("legend.mapchallenge.day17.darkest")}</span><span>{t("legend.mapchallenge.day17.brightest")}</span>
    </div>
  </div>;
}

/** productIdx：embed 由網址 `p.mapchallengeDay17DarkSkyProductIdx` 帶入（embed 沒有參數 store）；主站不傳，讀 store。 */
export function MapchallengeDay17DarkSkyLegend({ isDark, productIdx }: { isDark: boolean; productIdx?: number }) {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay17DarkSky");
  const product = (productIdx != null ? MAPCHALLENGE_DAY17_PRODUCTS[Math.trunc(productIdx)] : MAPCHALLENGE_DAY17_PRODUCTS.find((p) => p.value === paramStr(values, "mapchallengeDay17DarkSky", "mapchallengeDay17DarkSkyProduct"))) ?? MAPCHALLENGE_DAY17_PRODUCTS[0];
  const [a, b, c, d] = MAPCHALLENGE_DAY17_SKY_BREAKS.map((v) => Number(v.toPrecision(2)));
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day17.darkSkyTitle")} />
    {product.value === "skyglow" ? <>
      <LegendNote>{t("legend.mapchallenge.day17.skySub")}</LegendNote>
      <Day17SkyClassBar />
      <LegendNote>{t("legend.mapchallenge.day17.skyBreaks", { a: a ?? "", b: b ?? "", c: c ?? "", d: d ?? "" })}</LegendNote>
      <LegendNote>{t("legend.mapchallenge.day17.skyNote")}</LegendNote>
      <LegendNote>{t("legend.mapchallenge.day17.hehuan")}</LegendNote>
    </> : <>
      <LegendNote>{t("legend.mapchallenge.day17.groundSub")}</LegendNote>
      <SwatchGradient gradient={mapchallengeDay17Gradient(MAPCHALLENGE_DAY17_INFERNO)} labels={["0", t("legend.mapchallenge.day17.groundMax", { n: MAPCHALLENGE_DAY17_GROUND_MAX_NW })]} />
      <LegendNote>{t("legend.mapchallenge.day17.groundNote")}</LegendNote>
    </>}
    <LegendRow swatch={<SwatchSquare color={mapchallengeDay17ProtectedLineColor(isDark)} outline />}>{t("legend.mapchallenge.day17.protected")}</LegendRow>
  </div>;
}

export function MapchallengeDay17DarkRoadsLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day17.roadsTitle")} />
    <LegendRow swatch={<SwatchLine color={mapchallengeDay17ZeroColor(isDark)} width={2} />}>{t("legend.mapchallenge.day17.zero")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={mapchallengeDay17GlowColor(isDark)} width={3} />}>{t("legend.mapchallenge.day17.top10")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={MAPCHALLENGE_DAY17_LOW_SWATCH} opacity={MAPCHALLENGE_DAY17_LOW_OPACITY} width={1} />}>{t("legend.mapchallenge.day17.low")}</LegendRow>
    <LegendNote>{t("legend.mapchallenge.day17.lowNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.roadsStats")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.pixelNote")}</LegendNote>
  </div>;
}

export function MapchallengeDay17NightFallLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day17.nightFallTitle")} />
    <SwatchGradient gradient={mapchallengeDay17Gradient(MAPCHALLENGE_DAY17_INFERNO)} labels={["0", t("legend.mapchallenge.day17.groundMax", { n: MAPCHALLENGE_DAY17_GROUND_MAX_NW })]} />
    <LegendNote>{t("legend.mapchallenge.day17.nightFallNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.nightFallRule")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.nightFallTip")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.nightFallSource")}</LegendNote>
  </div>;
}

/** LED 化 5 級標籤（高 → 低列在圖例由上而下） */
const MAPCHALLENGE_DAY17_LED_BIN_KEYS = [
  "legend.mapchallenge.day17.ledBin0", "legend.mapchallenge.day17.ledBin1", "legend.mapchallenge.day17.ledBin2",
  "legend.mapchallenge.day17.ledBin3", "legend.mapchallenge.day17.ledBin4",
] as const;

export function MapchallengeDay17LedShareLegend({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const theme = useLegendTheme();
  const values = useLayerParams("mapchallengeDay17LedShare");
  const year = mapchallengeDay17LedYearByKey(paramStr(values, "mapchallengeDay17LedShare", "mapchallengeDay17LedShareYear"));
  const colors = mapchallengeDay17LedColors(isDark);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day17.ledTitle", { year })} />
    <LegendNote>{t("legend.mapchallenge.day17.ledSub")}</LegendNote>
    {[4, 3, 2, 1, 0].map((i) => <LegendRow key={i} swatch={<SwatchSquare color={colors[i]!} stroke={theme.seam} />}>
      {t(MAPCHALLENGE_DAY17_LED_BIN_KEYS[i]!)}
    </LegendRow>)}
    <LegendNote>{t("legend.mapchallenge.day17.ledNational", { a: (MAPCHALLENGE_DAY17_LED_NATIONAL[2021] * 100).toFixed(1), b: (MAPCHALLENGE_DAY17_LED_NATIONAL[2025] * 100).toFixed(1), y: (MAPCHALLENGE_DAY17_LED_NATIONAL[year] * 100).toFixed(1), year })}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day17.ledNote")}</LegendNote>
  </div>;
}

// ── Day 19 氣味 ───────────────────────────────────────────────
/** 六類名稱的翻譯 key（順序同 MAPCHALLENGE_DAY19_CATEGORIES；說明框共用） */
export const MAPCHALLENGE_DAY19_CATEGORY_KEYS: Readonly<Record<MapchallengeDay19Category, "legend.mapchallenge.day19.cat.cooking" | "legend.mapchallenge.day19.cat.burning" | "legend.mapchallenge.day19.cat.incense" | "legend.mapchallenge.day19.cat.industry" | "legend.mapchallenge.day19.cat.farm" | "legend.mapchallenge.day19.cat.other">> = {
  cooking: "legend.mapchallenge.day19.cat.cooking", burning: "legend.mapchallenge.day19.cat.burning", incense: "legend.mapchallenge.day19.cat.incense",
  industry: "legend.mapchallenge.day19.cat.industry", farm: "legend.mapchallenge.day19.cat.farm", other: "legend.mapchallenge.day19.cat.other",
};
/** 設施五類名稱的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY19_FACILITY_KEYS = {
  landfill: "legend.mapchallenge.day19.fac.landfill", sewage: "legend.mapchallenge.day19.fac.sewage", incinerator: "legend.mapchallenge.day19.fac.incinerator",
  slaughter: "legend.mapchallenge.day19.fac.slaughter", feed: "legend.mapchallenge.day19.fac.feed",
} as const;
export const MAPCHALLENGE_DAY19_PERIOD_KEYS = { "2025": "legend.mapchallenge.day19.period2025", "2026": "legend.mapchallenge.day19.period2026" } as const;
const MAPCHALLENGE_DAY19_POTENTIAL_CLASS_KEYS = [
  "legend.mapchallenge.day19.top25", "legend.mapchallenge.day19.top10", "legend.mapchallenge.day19.top3", "legend.mapchallenge.day19.top1",
] as const;
const MAPCHALLENGE_DAY19_WIND_KEYS = { iso: "legend.mapchallenge.day19.windIso", winter: "legend.mapchallenge.day19.windWinter", summer: "legend.mapchallenge.day19.windSummer" } as const;

/** #rrggbb → rgba（圖例濃淡色塊） */
function day19Alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function MapchallengeDay19ComplaintsLegend({ isDark }: { isDark: boolean }) {
  const { t, formatNumber } = useLocale();
  const theme = useLegendTheme();
  const values = useLayerParams("mapchallengeDay19Complaints");
  const period = mapchallengeDay19PeriodByKey(paramStr(values, "mapchallengeDay19Complaints", "mapchallengeDay19ComplaintsPeriod"));
  const category = mapchallengeDay19CategoryByKey(paramStr(values, "mapchallengeDay19Complaints", "mapchallengeDay19ComplaintsCategory"));
  const stats = MAPCHALLENGE_DAY19_PERIOD_STATS[period];
  const rampBase = category === "all" ? (isDark ? "#e5e7eb" : "#374151") : mapchallengeDay19CategoryColor(category, isDark);
  const cuts = MAPCHALLENGE_DAY19_DENS_CUTS.map((c) => formatNumber(Math.round(c)));
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day19.complaintsTitle", { period: t(MAPCHALLENGE_DAY19_PERIOD_KEYS[period]) })} />
    <LegendNote>{t("legend.mapchallenge.day19.complaintsCases", { n: formatNumber(stats.cases), drawn: formatNumber(stats.drawn) })}</LegendNote>
    {category === "all"
      ? <>
        <LegendNote>{t("legend.mapchallenge.day19.colorIsTop")}</LegendNote>
        {MAPCHALLENGE_DAY19_CATEGORIES.map((c) => <LegendRow key={c.key} swatch={<SwatchSquare color={mapchallengeDay19CategoryColor(c.key, isDark)} />}>{t(MAPCHALLENGE_DAY19_CATEGORY_KEYS[c.key])}</LegendRow>)}
      </>
      : <LegendRow swatch={<SwatchSquare color={mapchallengeDay19CategoryColor(category, isDark)} />}>{t("legend.mapchallenge.day19.onlyCategory", { name: t(MAPCHALLENGE_DAY19_CATEGORY_KEYS[category]) })}</LegendRow>}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: theme.textMuted }}>{t(category === "all" ? "legend.mapchallenge.day19.densTitle" : "legend.mapchallenge.day19.densTitleCat")}</div>
    <SwatchSteps colors={MAPCHALLENGE_DAY19_DENS_OPACITY.map((a) => day19Alpha(rampBase, a))} breaks={["0", ...cuts, ""]} />
    <LegendNote>{t("legend.mapchallenge.day19.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day19.repeatNote")}</LegendNote>
    {period === "2026" && <LegendNote>{t("legend.mapchallenge.day19.julyNote")}</LegendNote>}
  </div>;
}

/** windIdx：embed 由網址 `p.mapchallengeDay19PotentialWindIdx` 帶入（embed 沒有參數 store）；主站不傳，讀 store。 */
export function MapchallengeDay19PotentialLegend({ isDark, windIdx }: { isDark: boolean; windIdx?: number }) {
  const { t } = useLocale();
  const values = useLayerParams("mapchallengeDay19Potential");
  const wind = (windIdx != null ? MAPCHALLENGE_DAY19_WINDS[Math.trunc(windIdx)] : MAPCHALLENGE_DAY19_WINDS.find((w) => w.value === paramStr(values, "mapchallengeDay19Potential", "mapchallengeDay19PotentialWind"))) ?? MAPCHALLENGE_DAY19_WINDS[0];
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day19.potentialTitle", { wind: t(MAPCHALLENGE_DAY19_WIND_KEYS[wind.value]) })} />
    {[...MAPCHALLENGE_DAY19_POTENTIAL_CLASSES].reverse().map((c, i) => <LegendRow key={c.color} swatch={<SwatchSquare color={c.color} opacity={1} />}>
      {t(MAPCHALLENGE_DAY19_POTENTIAL_CLASS_KEYS[MAPCHALLENGE_DAY19_POTENTIAL_CLASSES.length - 1 - i]!)}
    </LegendRow>)}
    <LegendNote>{t("legend.mapchallenge.day19.potentialMethod")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day19.assumedWeight")}</LegendNote>
    {MAPCHALLENGE_DAY19_FACILITY_KINDS.map((f) => <LegendRow key={f.kind} swatch={<SwatchDot color={mapchallengeDay19FacilityColor(f.kind, isDark)} />}>
      {t("legend.mapchallenge.day19.facWeight", { name: t(MAPCHALLENGE_DAY19_FACILITY_KEYS[f.kind]), w: f.weight })}
    </LegendRow>)}
    {wind.season !== null && <LegendRow swatch={<SwatchLine color={mapchallengeDay19WindColor(isDark)} width={2} />}>{t("legend.mapchallenge.day19.windArrow")}</LegendRow>}
    <LegendRow swatch={<SwatchDot color={mapchallengeDay19DumpingColor(isDark)} />}>{t("legend.mapchallenge.day19.dumping")}</LegendRow>
    <LegendNote>{t("legend.mapchallenge.day19.validation")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day19.islands")}</LegendNote>
  </div>;
}

const MAPCHALLENGE_DAY19_RATIO_KEYS = ["legend.mapchallenge.day19.ratioLow", "legend.mapchallenge.day19.ratioMid", "legend.mapchallenge.day19.ratioHigh"] as const;

/** scale：embed 由網址 `p.mapchallengeDay19PenaltiesScale` 帶入；主站不傳，讀大小滑桿（圖例圓要和地圖同尺寸，map-layers LG-5）。 */
export function MapchallengeDay19PenaltiesLegend({ isDark, scale }: { isDark: boolean; scale?: number }) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay19Penalties");
  const sizeScale = scale ?? paramNum(values, "mapchallengeDay19Penalties", "mapchallengeDay19PenaltiesScale");
  const colors = mapchallengeDay19RatioColors(isDark);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day19.penaltiesTitle")} />
    <LegendNote>{t("legend.mapchallenge.day19.penaltiesSub", { f: formatNumber(MAPCHALLENGE_DAY19_PENALTY_TOTALS.facilities), n: formatNumber(MAPCHALLENGE_DAY19_PENALTY_TOTALS.events) })}</LegendNote>
    {[2, 1, 0].map((i) => <LegendRow key={i} swatch={<SwatchDot color={colors[i]!} />}>{t(MAPCHALLENGE_DAY19_RATIO_KEYS[i]!)}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={MAPCHALLENGE_DAY19_RATIO_NULL_COLOR} />}>{t("legend.mapchallenge.day19.ratioNull")}</LegendRow>
    <LegendSizeRow title={t("legend.mapchallenge.day19.sizeTitle")} items={[1, 5, 20].map((n) => ({ r: mapchallengeDay19PenaltyRadius(n, sizeScale), label: String(n) }))} fill={colors[1]} />
    <LegendNote>{t("legend.mapchallenge.day19.penaltiesNote")}</LegendNote>
  </div>;
}

// ── Day 21 OSM ────────────────────────────────────────────────
/** 道路等級三級的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY21_CLASS_KEYS = {
  major: "legend.mapchallenge.day21.major", mid: "legend.mapchallenge.day21.mid", local: "legend.mapchallenge.day21.local",
} as const;

/** 線寬三級的示意色：取色帶中段（2011 紫），暗底與地圖同樣提亮 */
const MAPCHALLENGE_DAY21_WIDTH_SWATCH_YEAR = 2011;

/** year／newOnly：embed 由網址 `p.mapchallengeDay21OsmRoadsYear`／`NewOnly`（0/1）帶入；主站不傳，讀 store。 */
export function MapchallengeDay21OsmRoadsLegend({ isDark, year: yearProp, newOnly: newOnlyProp }: { isDark: boolean; year?: number; newOnly?: boolean }) {
  const { t, formatNumber } = useLocale();
  const theme = useLegendTheme();
  // 暗底依 C-4 提亮過的年份色（和地圖同一份對照）；直接查表，色帶格子不是 SwatchLine，不會自動套
  const liftMap = liftedColorMap("mapchallengeDay21OsmRoads", isDark);
  const lift = (c: string) => liftMap.get(normalizeColor(c)) ?? c;
  const values = useLayerParams("mapchallengeDay21OsmRoads");
  const year = mapchallengeDay21YearAt(yearProp ?? paramNum(values, "mapchallengeDay21OsmRoads", "mapchallengeDay21OsmRoadsYear"));
  const newOnly = newOnlyProp ?? paramBool(values, "mapchallengeDay21OsmRoads", "mapchallengeDay21OsmRoadsNewOnly");
  const yearText = year === MAPCHALLENGE_DAY21_YEAR_MIN ? t("legend.mapchallenge.day21.before", { year }) : String(year);
  // 色帶每年一格；拉桿以後（或只看當年時的其他年）的格子換成中性色，表示目前沒畫
  const colors = MAPCHALLENGE_DAY21_YEARS.map((y) => ((newOnly ? y === year : y <= year) ? lift(mapchallengeDay21YearColor(y)) : theme.border));
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day21.title")} />
    <LegendNote>{t(newOnly ? "legend.mapchallenge.day21.showingNew" : "legend.mapchallenge.day21.showingUpTo", { year: yearText })}</LegendNote>
    <SwatchSteps colors={colors} breaks={[t("legend.mapchallenge.day21.before", { year: MAPCHALLENGE_DAY21_YEAR_MIN }), String(MAPCHALLENGE_DAY21_YEAR_MAX)]} />
    <LegendNote>{t("legend.mapchallenge.day21.colorNote")}</LegendNote>
    {(["major", "mid", "local"] as const).map((c) => <LegendRow key={c} swatch={<SwatchLine color={lift(mapchallengeDay21YearColor(MAPCHALLENGE_DAY21_WIDTH_SWATCH_YEAR))} width={MAPCHALLENGE_DAY21_WIDTH[c][1]} />}>
      {t(MAPCHALLENGE_DAY21_CLASS_KEYS[c])}
    </LegendRow>)}
    <LegendNote>{t("legend.mapchallenge.day21.yearNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day21.limits", { km: formatNumber(MAPCHALLENGE_DAY21_TOTAL_KM) })}</LegendNote>
  </div>;
}

// ── Day 23 味覺 ────────────────────────────────────────────────
/** 24 個詞的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY23_TERM_KEYS: Readonly<Record<MapchallengeDay23TermId, StaticMessageKey>> = {
  beefSoup: "legend.mapchallenge.day23.term.beefSoup", kongRou: "legend.mapchallenge.day23.term.kongRou",
  turkeyRice: "legend.mapchallenge.day23.term.turkeyRice", fanTang: "legend.mapchallenge.day23.term.fanTang",
  yiMian: "legend.mapchallenge.day23.term.yiMian", eel: "legend.mapchallenge.day23.term.eel",
  rouZaoFan: "legend.mapchallenge.day23.term.rouZaoFan", banTiao: "legend.mapchallenge.day23.term.banTiao",
  rouYuan: "legend.mapchallenge.day23.term.rouYuan", wanGuo: "legend.mapchallenge.day23.term.wanGuo",
  urn: "legend.mapchallenge.day23.term.urn", liveFish: "legend.mapchallenge.day23.term.liveFish",
  miGan: "legend.mapchallenge.day23.term.miGan", mungBeanSoup: "legend.mapchallenge.day23.term.mungBeanSoup",
  waiShengMian: "legend.mapchallenge.day23.term.waiShengMian", xianChao: "legend.mapchallenge.day23.term.xianChao",
  daMian: "legend.mapchallenge.day23.term.daMian", shrimp: "legend.mapchallenge.day23.term.shrimp",
  milkfishCongee: "legend.mapchallenge.day23.term.milkfishCongee", qieZaiMian: "legend.mapchallenge.day23.term.qieZaiMian",
  springRoll: "legend.mapchallenge.day23.term.springRoll", saltedChicken: "legend.mapchallenge.day23.term.saltedChicken",
  stew: "legend.mapchallenge.day23.term.stew", bianShi: "legend.mapchallenge.day23.term.bianShi",
};
/** 同物異字三組的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY23_GROUP_KEYS = {
  rice: "legend.mapchallenge.day23.group.rice", banTiao: "legend.mapchallenge.day23.group.banTiao", kongRou: "legend.mapchallenge.day23.group.kongRou",
} as const;
/** 有額外比對規則的詞（意麵排除鍋燒、粄條與板條合計、塩水雞與鹽水雞合計） */
const MAPCHALLENGE_DAY23_TERM_NOTE_KEYS: Partial<Record<MapchallengeDay23TermId, StaticMessageKey>> = {
  yiMian: "legend.mapchallenge.day23.termNote.yiMian", banTiao: "legend.mapchallenge.day23.termNote.banTiao",
  saltedChicken: "legend.mapchallenge.day23.termNote.saltedChicken",
};
/** 店名裡的地名：招牌名、比對規則、原產縣市的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY23_SIGN_KEYS: Readonly<Record<MapchallengeDay23PlaceId, StaticMessageKey>> = {
  chishang: "legend.mapchallenge.day23.sign.chishang", chiayi: "legend.mapchallenge.day23.sign.chiayi",
  tainan: "legend.mapchallenge.day23.sign.tainan", gangshan: "legend.mapchallenge.day23.sign.gangshan",
  changhua: "legend.mapchallenge.day23.sign.changhua", dongshiBudai: "legend.mapchallenge.day23.sign.dongshiBudai",
  beigang: "legend.mapchallenge.day23.sign.beigang", meinong: "legend.mapchallenge.day23.sign.meinong",
};
const MAPCHALLENGE_DAY23_SIGN_RULE_KEYS: Readonly<Record<MapchallengeDay23PlaceId, StaticMessageKey>> = {
  chishang: "legend.mapchallenge.day23.signRule.chishang", chiayi: "legend.mapchallenge.day23.signRule.chiayi",
  tainan: "legend.mapchallenge.day23.signRule.tainan", gangshan: "legend.mapchallenge.day23.signRule.gangshan",
  changhua: "legend.mapchallenge.day23.signRule.changhua", dongshiBudai: "legend.mapchallenge.day23.signRule.dongshiBudai",
  beigang: "legend.mapchallenge.day23.signRule.beigang", meinong: "legend.mapchallenge.day23.signRule.meinong",
};
export const MAPCHALLENGE_DAY23_HOME_KEYS: Readonly<Record<MapchallengeDay23PlaceId, StaticMessageKey>> = {
  chishang: "legend.mapchallenge.day23.home.chishang", chiayi: "legend.mapchallenge.day23.home.chiayi",
  tainan: "legend.mapchallenge.day23.home.tainan", gangshan: "legend.mapchallenge.day23.home.gangshan",
  changhua: "legend.mapchallenge.day23.home.changhua", dongshiBudai: "legend.mapchallenge.day23.home.dongshiBudai",
  beigang: "legend.mapchallenge.day23.home.beigang", meinong: "legend.mapchallenge.day23.home.meinong",
};
/** 外來料理九組的翻譯 key（說明框共用） */
export const MAPCHALLENGE_DAY23_FOREIGN_KEYS: Readonly<Record<MapchallengeDay23ForeignId, StaticMessageKey>> = {
  vietnam: "legend.mapchallenge.day23.foreign.vietnam", thai: "legend.mapchallenge.day23.foreign.thai", indonesia: "legend.mapchallenge.day23.foreign.indonesia",
  yunnan: "legend.mapchallenge.day23.foreign.yunnan", japan: "legend.mapchallenge.day23.foreign.japan", korea: "legend.mapchallenge.day23.foreign.korea",
  hongKong: "legend.mapchallenge.day23.foreign.hongKong", italy: "legend.mapchallenge.day23.foreign.italy", america: "legend.mapchallenge.day23.foreign.america",
};
const MAPCHALLENGE_DAY23_PLACE_SIZE_STEPS = [1, 3, 8] as const;
const MAPCHALLENGE_DAY23_FOREIGN_SIZE_STEPS = [1, 10, 50] as const;
const MAPCHALLENGE_DAY23_SIZE_STEPS = [1, 5, 20] as const;

/** termIdx／scale：embed 由網址帶入（embed 沒有參數 store）；主站不傳，讀 store。圖例圓要和地圖同尺寸（LG-5）。 */
export function MapchallengeDay23TasteTermsLegend({ isDark, termIdx, scale }: { isDark: boolean; termIdx?: number; scale?: number }) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay23TasteTerms");
  const term = (termIdx != null ? MAPCHALLENGE_DAY23_TERMS[Math.trunc(termIdx)] : mapchallengeDay23TermById(paramStr(values, "mapchallengeDay23TasteTerms", "mapchallengeDay23TasteTermsTerm"))) ?? MAPCHALLENGE_DAY23_TERMS[0];
  const sizeScale = scale ?? paramNum(values, "mapchallengeDay23TasteTerms", "mapchallengeDay23TasteTermsScale");
  const color = mapchallengeDay23TermColor(term, isDark);
  const note = MAPCHALLENGE_DAY23_TERM_NOTE_KEYS[term.value];
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day23.termsTitle")} />
    <LegendRow swatch={<SwatchDot color={color} />}>
      {t("legend.mapchallenge.day23.termRow", { term: t(MAPCHALLENGE_DAY23_TERM_KEYS[term.value]), n: formatNumber(term.stores), m: formatNumber(term.mapped) })}
    </LegendRow>
    {note && <LegendNote>{t(note)}</LegendNote>}
    <LegendSizeRow title={t("legend.mapchallenge.day23.sizeTitle")} items={MAPCHALLENGE_DAY23_SIZE_STEPS.map((n) => ({ r: mapchallengeDay23Radius(n, sizeScale), label: String(n) }))} fill={color} />
    <LegendNote>{t("legend.mapchallenge.day23.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.scope")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.base", { n: formatNumber(MAPCHALLENGE_DAY23_BASE_STORES) })}</LegendNote>
  </div>;
}

export function MapchallengeDay23TasteVariantsLegend({ isDark, groupIdx, scale }: { isDark: boolean; groupIdx?: number; scale?: number }) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay23TasteVariants");
  const group = (groupIdx != null ? MAPCHALLENGE_DAY23_VARIANT_GROUPS[Math.trunc(groupIdx)] : mapchallengeDay23GroupById(paramStr(values, "mapchallengeDay23TasteVariants", "mapchallengeDay23TasteVariantsGroup"))) ?? MAPCHALLENGE_DAY23_VARIANT_GROUPS[0];
  const sizeScale = scale ?? paramNum(values, "mapchallengeDay23TasteVariants", "mapchallengeDay23TasteVariantsScale");
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day23.variantsTitle")} />
    <LegendNote>{t(MAPCHALLENGE_DAY23_GROUP_KEYS[group.value])}</LegendNote>
    {group.words.map((w) => <LegendRow key={w.label} swatch={<SwatchDot color={mapchallengeDay23TermColor(w, isDark)} />}>
      {t("legend.mapchallenge.day23.wordRow", { word: w.label, n: formatNumber(w.stores), m: formatNumber(w.mapped) })}
    </LegendRow>)}
    <LegendSizeRow title={t("legend.mapchallenge.day23.sizeTitle")} items={MAPCHALLENGE_DAY23_SIZE_STEPS.map((n) => ({ r: mapchallengeDay23Radius(n, sizeScale), label: String(n) }))} fill={mapchallengeDay23TermColor(group.words[0], isDark)} />
    <LegendNote>{t("legend.mapchallenge.day23.variantsNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.scope")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.base", { n: formatNumber(MAPCHALLENGE_DAY23_BASE_STORES) })}</LegendNote>
  </div>;
}

/** scale：embed 由網址帶入；主站不傳，讀大小滑桿（LG-5）。 */
export function MapchallengeDay23TastePlacesLegend({ isDark, scale }: { isDark: boolean; scale?: number }) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay23TastePlaces");
  const place = mapchallengeDay23PlaceById(paramStr(values, "mapchallengeDay23TastePlaces", "mapchallengeDay23TastePlacesSign")) ?? MAPCHALLENGE_DAY23_PLACES[0];
  const sizeScale = scale ?? paramNum(values, "mapchallengeDay23TastePlaces", "mapchallengeDay23TastePlacesScale");
  const color = mapchallengeDay23TermColor(place, isDark);
  const home = t(MAPCHALLENGE_DAY23_HOME_KEYS[place.value]);
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day23.placesTitle")} />
    <LegendNote>{t("legend.mapchallenge.day23.placeRow", { sign: t(MAPCHALLENGE_DAY23_SIGN_KEYS[place.value]), n: formatNumber(place.stores), out: formatNumber(place.outside), home, m: formatNumber(place.mapped) })}</LegendNote>
    <LegendNote>{t(MAPCHALLENGE_DAY23_SIGN_RULE_KEYS[place.value])}</LegendNote>
    <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={isDark ? MAPCHALLENGE_DAY23_ORIGIN.dark : MAPCHALLENGE_DAY23_ORIGIN.light} strokeWidth={MAPCHALLENGE_DAY23_ORIGIN.strokeWidth} />}>
      {t("legend.mapchallenge.day23.originRow")}
    </LegendRow>
    <LegendRow swatch={<SwatchDot color={color} />}>{t("legend.mapchallenge.day23.dotRow", { home })}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={mapchallengeDay23ArcWidth(4)} opacity={isDark ? MAPCHALLENGE_DAY23_ARC.opacityDark + 0.3 : MAPCHALLENGE_DAY23_ARC.opacityLight + 0.3} />}>{t("legend.mapchallenge.day23.arcRow")}</LegendRow>
    <LegendSizeRow title={t("legend.mapchallenge.day23.sizeTitle")} items={MAPCHALLENGE_DAY23_PLACE_SIZE_STEPS.map((n) => ({ r: mapchallengeDay23Radius(n, sizeScale), label: String(n) }))} fill={color} />
    <LegendNote>{t("legend.mapchallenge.day23.arcNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.placesScope")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.base", { n: formatNumber(MAPCHALLENGE_DAY23_BASE_STORES) })}</LegendNote>
  </div>;
}

export function MapchallengeDay23TasteForeignLegend({ isDark, scale }: { isDark: boolean; scale?: number }) {
  const { t, formatNumber } = useLocale();
  const values = useLayerParams("mapchallengeDay23TasteForeign");
  const group = mapchallengeDay23ForeignById(paramStr(values, "mapchallengeDay23TasteForeign", "mapchallengeDay23TasteForeignGroup")) ?? MAPCHALLENGE_DAY23_FOREIGN[0];
  const sizeScale = scale ?? paramNum(values, "mapchallengeDay23TasteForeign", "mapchallengeDay23TasteForeignScale");
  const color = mapchallengeDay23TermColor(group, isDark);
  const dominant = MAPCHALLENGE_DAY23_FOREIGN_DOMINANT[group.value];
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day23.foreignTitle")} />
    <LegendRow swatch={<SwatchDot color={color} />}>
      {t("legend.mapchallenge.day23.foreignRow", { group: t(MAPCHALLENGE_DAY23_FOREIGN_KEYS[group.value]), n: formatNumber(group.stores), m: formatNumber(group.mapped) })}
    </LegendRow>
    <LegendNote>{t("legend.mapchallenge.day23.foreignWords", { words: group.words.join("、") })}</LegendNote>
    {dominant && <LegendNote>{t("legend.mapchallenge.day23.foreignDominant", { word: dominant.word, hits: formatNumber(dominant.hits), n: formatNumber(group.stores), pct: Math.round((dominant.hits / group.stores) * 100) })}</LegendNote>}
    <LegendSizeRow title={t("legend.mapchallenge.day23.sizeTitle")} items={MAPCHALLENGE_DAY23_FOREIGN_SIZE_STEPS.map((n) => ({ r: mapchallengeDay23Radius(n, sizeScale, group.k), label: String(n) }))} fill={color} />
    <LegendNote>{t("legend.mapchallenge.day23.foreignSizeNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.foreignScope")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.base", { n: formatNumber(MAPCHALLENGE_DAY23_BASE_STORES) })}</LegendNote>
  </div>;
}

// ── Day 23 味覺第三批：南韓／英國／日本（一個元件，依國別設定表） ──
type IntlCc = MapchallengeDay23IntlCountry["cc"];
/** 各國文案 key（字面值，供 i18n key 檢查） */
export const MAPCHALLENGE_DAY23_INTL_KEYS: Readonly<Record<"title" | "where" | "limits" | "base" | "source", Readonly<Record<IntlCc, StaticMessageKey>>>> = {
  title: { kr: "legend.mapchallenge.day23.intl.title.kr", gb: "legend.mapchallenge.day23.intl.title.gb", jp: "legend.mapchallenge.day23.intl.title.jp" },
  where: { kr: "legend.mapchallenge.day23.intl.where.kr", gb: "legend.mapchallenge.day23.intl.where.gb", jp: "legend.mapchallenge.day23.intl.where.jp" },
  limits: { kr: "legend.mapchallenge.day23.intl.limits.kr", gb: "legend.mapchallenge.day23.intl.limits.gb", jp: "legend.mapchallenge.day23.intl.limits.jp" },
  base: { kr: "legend.mapchallenge.day23.intl.base.kr", gb: "legend.mapchallenge.day23.intl.base.gb", jp: "legend.mapchallenge.day23.intl.base.jp" },
  source: { kr: "legend.mapchallenge.day23.intl.source.kr", gb: "legend.mapchallenge.day23.intl.source.gb", jp: "legend.mapchallenge.day23.intl.source.jp" },
};
/** 各詞的說明（中文說明／英日譯文）key；日文介面下日本詞的說明與原文相同 */
const MAPCHALLENGE_DAY23_INTL_TERM_KEYS: Readonly<Record<IntlCc, Readonly<Record<string, StaticMessageKey>>>> = {
  kr: {  },
  gb: { fisheries: "legend.mapchallenge.day23.intl.term.gb.fisheries", chippy: "legend.mapchallenge.day23.intl.term.gb.chippy", fishBar: "legend.mapchallenge.day23.intl.term.gb.fishBar", balti: "legend.mapchallenge.day23.intl.term.gb.balti", pasty: "legend.mapchallenge.day23.intl.term.gb.pasty", cob: "legend.mapchallenge.day23.intl.term.gb.cob", butty: "legend.mapchallenge.day23.intl.term.gb.butty", pieMash: "legend.mapchallenge.day23.intl.term.gb.pieMash", jerk: "legend.mapchallenge.day23.intl.term.gb.jerk" },
  jp: { udon: "legend.mapchallenge.day23.intl.term.jp.udon", okonomiyaki: "legend.mapchallenge.day23.intl.term.jp.okonomiyaki", takoyaki: "legend.mapchallenge.day23.intl.term.jp.takoyaki", soba: "legend.mapchallenge.day23.intl.term.jp.soba", gyutan: "legend.mapchallenge.day23.intl.term.jp.gyutan", jingisukan: "legend.mapchallenge.day23.intl.term.jp.jingisukan", motsunabe: "legend.mapchallenge.day23.intl.term.jp.motsunabe", monja: "legend.mapchallenge.day23.intl.term.jp.monja" },
};
const MAPCHALLENGE_DAY23_INTL_SIZE_STEPS = [1, 10, 50] as const;
const MAPCHALLENGE_DAY23_INTL_SIZE_STEPS_HIGH = [1, 5, 20] as const;
/** 詞的顯示名：原文（說明）；說明與原文相同時只顯示原文 */
export function useMapchallengeDay23IntlTermName(): (country: MapchallengeDay23IntlCountry, term: MapchallengeDay23IntlTerm) => string {
  const { t } = useLocale();
  return (country, term) => {
    const key = MAPCHALLENGE_DAY23_INTL_TERM_KEYS[country.cc][term.value];
    const gloss = key ? t(key) : term.zh;
    return gloss === term.label ? term.label : t("legend.mapchallenge.day23.intl.termName", { label: term.label, gloss });
  };
}

export function MapchallengeDay23TasteIntlLegend({ layerKey, isDark }: { layerKey: MapchallengeDay23IntlKey; isDark: boolean }) {
  const { t, formatNumber } = useLocale();
  const termName = useMapchallengeDay23IntlTermName();
  const values = useLayerParams(layerKey);
  const country = mapchallengeDay23IntlByKey(layerKey);
  if (!country) return null;
  const term = mapchallengeDay23IntlTermById(country, paramStr(values, layerKey, `${layerKey}Term`)) ?? country.terms[0];
  const color = mapchallengeDay23TermColor(term, isDark);
  const [low, high] = country.res;
  return <div>
    <LegendTitle zh={t(MAPCHALLENGE_DAY23_INTL_KEYS.title[country.cc])} />
    <LegendNote>{t(MAPCHALLENGE_DAY23_INTL_KEYS.where[country.cc])}</LegendNote>
    <LegendRow swatch={<SwatchDot color={color} />}>
      {t("legend.mapchallenge.day23.intl.termRow", { term: termName(country, term), n: formatNumber(term.stores), m: formatNumber(term.mapped) })}
    </LegendRow>
    <LegendNote>{t("legend.mapchallenge.day23.sizeTitle")}</LegendNote>
    <LegendSizeRow title={t("legend.mapchallenge.day23.intl.sizeLow", { km2: formatNumber(MAPCHALLENGE_DAY23_CELL_KM2[low] ?? 0) })} items={MAPCHALLENGE_DAY23_INTL_SIZE_STEPS.map((n) => ({ r: mapchallengeDay23Radius(n, 1, term.k), label: String(n) }))} fill={color} />
    <LegendSizeRow title={t("legend.mapchallenge.day23.intl.sizeHigh", { z: country.switchZoom, km2: formatNumber(MAPCHALLENGE_DAY23_CELL_KM2[high] ?? 0) })} items={MAPCHALLENGE_DAY23_INTL_SIZE_STEPS_HIGH.map((n) => ({ r: mapchallengeDay23Radius(n, 1, term.kHigh), label: String(n) }))} fill={color} />
    <LegendNote>{t("legend.mapchallenge.day23.intl.sizeNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.intl.gridNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day23.intl.scope")}</LegendNote>
    <LegendNote>{t(MAPCHALLENGE_DAY23_INTL_KEYS.limits[country.cc])}</LegendNote>
    <LegendNote>{t(MAPCHALLENGE_DAY23_INTL_KEYS.base[country.cc], { n: formatNumber(country.baseStores), xy: formatNumber(country.baseWithXy) })}</LegendNote>
    <LegendNote>{t(MAPCHALLENGE_DAY23_INTL_KEYS.source[country.cc])}</LegendNote>
  </div>;
}
