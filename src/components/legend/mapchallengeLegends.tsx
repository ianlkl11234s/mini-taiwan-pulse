/**
 * 30 天地圖挑戰 Day 4 群聚圖例（模擬面板）。色、級距、重疊率全部讀 `data/mapchallengeDay04Types.ts`。
 * - 人口密度：magma 5 級。
 * - 設施群聚：每種設施一組色階；標題旁放該色階代表色（第 4 階），切設施時標題、色塊、級距一起換。
 * - 熱區重疊（r7 與臺中彰化 r8）：四類固定色＋大字重疊率。
 */
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchSquare, useLegendTheme } from "./legendKit";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { useLocale } from "../../state/localeStore";
import { FONT_DATA, FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";
import {
  MAPCHALLENGE_DAY04_HOTSPOT_CLASSES, MAPCHALLENGE_DAY04_PD_LABELS, MAPCHALLENGE_DAY04_TC_CH_OVERLAP,
  MAPCHALLENGE_DAY04_ZERO_SWATCH, MAPCHALLENGE_DAY04_ZERO_SWATCH_OPACITY,
  mapchallengeFacilityByKey, mapchallengeFacilityLabels, mapchallengeFacilityRamp, mapchallengeFacilitySwatch,
  mapchallengePopulationRamp, type MapchallengeFacilityKey,
} from "../../data/mapchallengeDay04Types";

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
