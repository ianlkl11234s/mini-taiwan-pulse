// 美國圖例（2026-11-25 第 0–1 波）：行政邊界、人口密度、規格驅動 9 層（重用菲律賓 PhSpecLegend）。SSOT：data/usDataLayers.ts。
// 來源、授權、資料日期在圖層「說明・來源」，圖例只留色階、單位、縮放與涵蓋範圍提示。
import { LegendNote, LegendRow, LegendTitle, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import { US_ADMIN_NOTES, US_DENSITY_LABELS_BY_LEVEL, US_NOT_COVERED_COLOR, US_POPULATION_NOTES, US_SPEC_BY_KEY, pickL3 } from "../../data/usDataLayers";
import type { UsDataKey } from "../../data/usDataKeys";
import { usDensityColors } from "../../hooks/useUsLayers";
import { PhSpecLegend } from "./intlSpecLegend";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function UsAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("usAdminBoundaries");
  const t = useLegendTheme();
  const color = BOUNDARY_GRAY[t.isDark ? "dark" : "light"];
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1]} />}>{pickL3({ zh: "州界（51）", en: "State boundary (51)", ja: "州境（51）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.7} />}>{pickL3({ zh: "郡界（3,144，z4 起）", en: "County boundary (3,144, from z4)", ja: "郡境（3,144、z4 以上）" }, locale)}</LegendRow>
    {US_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

const LEVEL_TITLES = {
  state: { zh: "州層級（51）", en: "State level (51)", ja: "州レベル（51）" },
  county: { zh: "郡層級（3,144）", en: "County level (3,144)", ja: "郡レベル（3,144）" },
  tract: { zh: "普查區層級（84,119，z7 起）", en: "Census tract level (84,119, from z7)", ja: "国勢調査区レベル（84,119、z7 以上）" },
} as const;

export function UsPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("usPopulation");
  const t = useLegendTheme();
  const colors = usDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km² 陸地，ACS 2020–2024）", en: "Population density (people/km² of land, ACS 2020–2024)", ja: "人口密度（人／km² 陸地、ACS 2020–2024）" }, locale)}</LegendNote>
    {(["state", "county", "tract"] as const).map((lv) => <div key={lv}>
      <LegendNote>{pickL3(LEVEL_TITLES[lv], locale)}</LegendNote>
      {US_DENSITY_LABELS_BY_LEVEL[lv].map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    </div>)}
    <LegendRow swatch={<SwatchSquare color={US_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {US_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

/** 規格驅動 9 層。 */
export function UsDataLegend({ layerKey }: { layerKey: UsDataKey }) {
  return <PhSpecLegend spec={US_SPEC_BY_KEY[layerKey]} />;
}
