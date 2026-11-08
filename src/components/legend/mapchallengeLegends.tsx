/**
 * 30 天地圖挑戰 Day 4 群聚圖例（模擬面板）。色、級距、重疊率全部讀 `data/mapchallengeDay04Types.ts`。
 * - 人口密度：magma 5 級。
 * - 設施群聚：每種設施一組色階；標題旁放該色階代表色（第 4 階），切設施時標題、色塊、級距一起換。
 * - 熱區重疊（r7 與臺中彰化 r8）：四類固定色＋大字重疊率。
 */
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { useLocale } from "../../state/localeStore";
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
  MAPCHALLENGE_DAY08_SCENARIOS, MAPCHALLENGE_DAY08_SITE_CLASSES, MAPCHALLENGE_DAY08_SITE_FILL_OPACITY,
  mapchallengeDay08BinColors, mapchallengeDay08ScenarioByValue, mapchallengeDay08SiteColor, mapchallengeDay08SiteOutline, mapchallengeDay08YiToBillion, MAPCHALLENGE_DAY08_COST_FORMAT,
  type MapchallengeDay08Scenario, type MapchallengeDay08SiteClass,
} from "../../data/mapchallengeDay08Types";

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
    <LegendNote>{t("legend.mapchallenge.source")}</LegendNote>
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
    <LegendNote>{t("legend.mapchallenge.source")}</LegendNote>
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
    <LegendNote>{t("legend.mapchallenge.source")}</LegendNote>
  </div>;
}

export function MapchallengeScaleTcChLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.tcchTitle")} />
    <OverlapRate>{t("legend.mapchallenge.tcchRate", { tc: MAPCHALLENGE_DAY04_TC_CH_OVERLAP.taichung, ch: MAPCHALLENGE_DAY04_TC_CH_OVERLAP.changhua })}</OverlapRate>
    <HotspotRows />
    <LegendNote>{t("legend.mapchallenge.tcchNote")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.source")}</LegendNote>
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
    <LegendNote>{t("legend.mapchallenge.day05.source")}</LegendNote>
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

function Day06Footer() {
  const { t } = useLocale();
  return <>
    <LegendNote>{t("legend.mapchallenge.day06.license")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day06.source")}</LegendNote>
  </>;
}


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
    <Day06Footer />
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
    <Day06Footer />
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
    <Day06Footer />
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
    <Day06Footer />
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

function Day08Footer() {
  const { t } = useLocale();
  return <>
    <LegendNote>{t("legend.mapchallenge.day08.caveat")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day08.source")}</LegendNote>
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
    <Day08Footer />
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
    <Day08Footer />
  </div>;
}

export function MapchallengeDay08Plan1955Legend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.mapchallenge.day08.planTitle")} />
    <LegendNote>{t("legend.mapchallenge.day08.planLicense")}</LegendNote>
    <LegendNote>{t("legend.mapchallenge.day08.planOffset")}</LegendNote>
  </div>;
}
